import { NextRequest, NextResponse } from 'next/server';
import { exec } from 'child_process';
import { promisify } from 'util';
import { writeFile, mkdir, readFile, rm } from 'fs/promises';
import { join } from 'path';
import { tmpdir } from 'os';
import { randomUUID } from 'crypto';

const execAsync = promisify(exec);

interface CompileRequest {
  latex: string;
  mainFile?: string;
  files?: Record<string, string>;
}

// Check if a command exists and works
async function commandExists(cmd: string): Promise<boolean> {
  try {
    await execAsync(`${cmd} --version`, { timeout: 5000 });
    return true;
  } catch {
    return false;
  }
}

// Check if Docker daemon is actually running (not just installed)
async function isDockerRunning(): Promise<boolean> {
  try {
    // 'docker info' will fail if daemon isn't running
    await execAsync('docker info', { timeout: 10000 });
    return true;
  } catch {
    return false;
  }
}

// External LaTeX API compilation (for serverless environments like Vercel)
async function compileWithExternalAPI(latex: string): Promise<{ success: boolean; pdf?: string; log: string }> {
  try {
    const response = await fetch('https://latex.ytotech.com/builds/sync', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        compiler: 'pdflatex',
        resources: [
          {
            main: true,
            content: latex,
          },
        ],
      }),
    });

    if (response.ok) {
      const contentType = response.headers.get('content-type') || '';
      
      if (contentType.includes('application/pdf')) {
        const arrayBuffer = await response.arrayBuffer();
        const pdfBase64 = Buffer.from(arrayBuffer).toString('base64');
        return {
          success: true,
          pdf: `data:application/pdf;base64,${pdfBase64}`,
          log: 'Compiled successfully using external LaTeX API.',
        };
      } else {
        const text = await response.text();
        return {
          success: false,
          log: `External API returned non-PDF response: ${text}`,
        };
      }
    } else {
      const errorText = await response.text();
      return {
        success: false,
        log: `External LaTeX API error (${response.status}): ${errorText}`,
      };
    }
  } catch (error: any) {
    return {
      success: false,
      log: `External API request failed: ${error.message}`,
    };
  }
}

export async function POST(request: NextRequest) {
  const tempDir = join(tmpdir(), `latex-${randomUUID()}`);
  
  try {
    const body: CompileRequest = await request.json();
    const { latex, mainFile, files = {} } = body;

    const resolvedMainFile =
      mainFile && mainFile.trim().length > 0 ? mainFile.trim() : 'main.tex';

    if (!latex || latex.trim() === '') {
      return NextResponse.json({
        success: false,
        error: 'LaTeX content is required',
      }, { status: 400 });
    }

    let compilationOutput = '';
    let pdfBuffer: Buffer | null = null;
    let compilationSuccess = false;
    let compilerUsed = '';

    // Check available compilers
    const hasLocalPdflatex = await commandExists('pdflatex');
    const hasDockerRunning = await isDockerRunning();

    // Priority: 1. Local pdflatex, 2. Docker, 3. External API
    if (hasLocalPdflatex) {
      // Use local pdflatex
      try {
        await mkdir(tempDir, { recursive: true });

        const mainPath = join(tempDir, resolvedMainFile);
        await writeFile(mainPath, latex, 'utf-8');

        for (const [filename, content] of Object.entries(files)) {
          if (filename && filename !== resolvedMainFile) {
            const filePath = join(tempDir, filename);
            await writeFile(filePath, content, 'utf-8');
          }
        }

        const { stdout, stderr } = await execAsync(
          `cd "${tempDir}" && pdflatex -interaction=nonstopmode -halt-on-error "${resolvedMainFile}" && pdflatex -interaction=nonstopmode -halt-on-error "${resolvedMainFile}"`,
          {
            timeout: 60000,
            maxBuffer: 10 * 1024 * 1024,
          }
        );

        compilationOutput = stdout + '\n' + stderr;
        const pdfPath = join(tempDir, resolvedMainFile.replace('.tex', '.pdf'));
        pdfBuffer = await readFile(pdfPath);
        compilationSuccess = true;
        compilerUsed = 'local pdflatex';

      } catch (error: any) {
        compilationOutput = `Local pdflatex compilation failed: ${error.message}`;
      }
    }

    // Try Docker if local failed and Docker is running
    if (!compilationSuccess && hasDockerRunning) {
      try {
        await mkdir(tempDir, { recursive: true });

        const mainPath = join(tempDir, resolvedMainFile);
        await writeFile(mainPath, latex, 'utf-8');

        for (const [filename, content] of Object.entries(files)) {
          if (filename && filename !== resolvedMainFile) {
            const filePath = join(tempDir, filename);
            await writeFile(filePath, content, 'utf-8');
          }
        }

        const dockerCommand = `docker run --rm \
          -v "${tempDir}:/workspace" \
          -w /workspace \
          texlive/texlive:latest \
          /bin/bash -c "pdflatex -interaction=nonstopmode -halt-on-error ${resolvedMainFile} && pdflatex -interaction=nonstopmode -halt-on-error ${resolvedMainFile}"`;

        const { stdout, stderr } = await execAsync(dockerCommand, {
          timeout: 120000,
          maxBuffer: 10 * 1024 * 1024,
        });

        compilationOutput = stdout + '\n' + stderr;
        const pdfPath = join(tempDir, resolvedMainFile.replace('.tex', '.pdf'));
        pdfBuffer = await readFile(pdfPath);
        compilationSuccess = true;
        compilerUsed = 'Docker TeX Live';

      } catch (error: any) {
        compilationOutput += `\nDocker compilation failed: ${error.message}`;
      }
    }

    // Try external API as last resort
    if (!compilationSuccess) {
      const externalResult = await compileWithExternalAPI(latex);
      
      if (externalResult.success && externalResult.pdf) {
        return NextResponse.json({
          success: true,
          pdf: externalResult.pdf,
          log: externalResult.log,
        });
      } else {
        compilationOutput += `\n${externalResult.log}`;
      }
    }

    if (compilationSuccess && pdfBuffer) {
      const pdfBase64 = pdfBuffer.toString('base64');

      return NextResponse.json({
        success: true,
        pdf: `data:application/pdf;base64,${pdfBase64}`,
        log: `Compiled successfully using ${compilerUsed}.\n${compilationOutput}`,
      });
    } else {
      try {
        const logPath = join(tempDir, resolvedMainFile.replace('.tex', '.log'));
        const logContent = await readFile(logPath, 'utf-8');
        compilationOutput += '\n\n--- LaTeX Log ---\n' + logContent;
      } catch (e) {
        // Log file might not exist
      }

      return NextResponse.json({
        success: false,
        error: 'LaTeX compilation failed',
        log: compilationOutput,
      }, { status: 400 });
    }

  } catch (error: any) {
    console.error('LaTeX compilation error:', error);
    
    return NextResponse.json({
      success: false,
      error: 'Internal server error during compilation',
      log: error.message || 'Unknown error occurred',
    }, { status: 500 });

  } finally {
    try {
      await rm(tempDir, { recursive: true, force: true });
    } catch (cleanupError) {
      // Ignore cleanup errors
    }
  }
}

// Health check endpoint
export async function GET() {
  try {
    const hasLocalPdflatex = await commandExists('pdflatex');
    const hasDockerRunning = await isDockerRunning();

    if (hasLocalPdflatex) {
      return NextResponse.json({
        status: 'ok',
        compiler: 'pdflatex',
        message: 'Local pdflatex is available for LaTeX compilation',
      });
    }

    if (hasDockerRunning) {
      return NextResponse.json({
        status: 'ok',
        compiler: 'docker',
        message: 'Docker is available for LaTeX compilation',
      });
    }

    // Check external API
    try {
      const testResponse = await fetch('https://latex.ytotech.com/', { method: 'HEAD' });
      if (testResponse.ok) {
        return NextResponse.json({
          status: 'ok',
          compiler: 'external-api',
          message: 'Using external LaTeX API for compilation',
        });
      }
    } catch (e) {
      // External API not reachable
    }

    return NextResponse.json({
      status: 'unavailable',
      compiler: 'none',
      message: 'No LaTeX compiler available.',
    }, { status: 503 });

  } catch (error) {
    return NextResponse.json({
      status: 'error',
      message: 'Failed to check compiler availability',
    }, { status: 500 });
  }
}

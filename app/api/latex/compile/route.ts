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
    await execAsync(`which ${cmd}`, { timeout: 5000 });
    return true;
  } catch {
    return false;
  }
}

// Check if Docker daemon is actually running (not just installed)
async function isDockerRunning(): Promise<boolean> {
  try {
    await execAsync('docker info', { timeout: 10000 });
    return true;
  } catch {
    return false;
  }
}

// External LaTeX API compilation (for serverless environments like Vercel)
async function compileWithExternalAPI(latex: string): Promise<{ success: boolean; pdf?: string; log: string }> {
  try {
    console.log('Attempting external API compilation...');
    
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

    console.log('External API response status:', response.status);

    if (response.ok) {
      const contentType = response.headers.get('content-type') || '';
      
      if (contentType.includes('application/pdf')) {
        const arrayBuffer = await response.arrayBuffer();
        const pdfBase64 = Buffer.from(arrayBuffer).toString('base64');
        return {
          success: true,
          pdf: `data:application/pdf;base64,${pdfBase64}`,
          log: 'Compiled successfully using external LaTeX API (latex.ytotech.com).',
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
    console.error('External API error:', error);
    return {
      success: false,
      log: `External API request failed: ${error.message}`,
    };
  }
}

// Compile using local pdflatex
async function compileWithLocalPdflatex(
  tempDir: string,
  latex: string,
  resolvedMainFile: string,
  files: Record<string, string>
): Promise<{ success: boolean; pdfBuffer?: Buffer; log: string }> {
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

    const pdfPath = join(tempDir, resolvedMainFile.replace('.tex', '.pdf'));
    const pdfBuffer = await readFile(pdfPath);

    return {
      success: true,
      pdfBuffer,
      log: `Compiled with local pdflatex.\n${stdout}\n${stderr}`,
    };
  } catch (error: any) {
    return {
      success: false,
      log: `Local pdflatex failed: ${error.message}`,
    };
  }
}

// Compile using Docker
async function compileWithDocker(
  tempDir: string,
  latex: string,
  resolvedMainFile: string,
  files: Record<string, string>
): Promise<{ success: boolean; pdfBuffer?: Buffer; log: string }> {
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

    const pdfPath = join(tempDir, resolvedMainFile.replace('.tex', '.pdf'));
    const pdfBuffer = await readFile(pdfPath);

    return {
      success: true,
      pdfBuffer,
      log: `Compiled with Docker TeX Live.\n${stdout}\n${stderr}`,
    };
  } catch (error: any) {
    return {
      success: false,
      log: `Docker compilation failed: ${error.message}`,
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

    // Check available compilers
    const hasLocalPdflatex = await commandExists('pdflatex');
    const hasDockerRunning = await isDockerRunning();

    console.log('Compiler check - pdflatex:', hasLocalPdflatex, 'docker:', hasDockerRunning);

    // Priority: 1. Local pdflatex, 2. Docker, 3. External API
    
    // Try local pdflatex first
    if (hasLocalPdflatex) {
      console.log('Trying local pdflatex...');
      const result = await compileWithLocalPdflatex(tempDir, latex, resolvedMainFile, files);
      
      if (result.success && result.pdfBuffer) {
        const pdfBase64 = result.pdfBuffer.toString('base64');
        return NextResponse.json({
          success: true,
          pdf: `data:application/pdf;base64,${pdfBase64}`,
          log: result.log,
        });
      }
      console.log('Local pdflatex failed:', result.log);
    }

    // Try Docker if available
    if (hasDockerRunning) {
      console.log('Trying Docker...');
      const result = await compileWithDocker(tempDir, latex, resolvedMainFile, files);
      
      if (result.success && result.pdfBuffer) {
        const pdfBase64 = result.pdfBuffer.toString('base64');
        return NextResponse.json({
          success: true,
          pdf: `data:application/pdf;base64,${pdfBase64}`,
          log: result.log,
        });
      }
      console.log('Docker failed:', result.log);
    }

    // Fallback to external API (for Vercel and other serverless)
    console.log('Trying external API...');
    const externalResult = await compileWithExternalAPI(latex);
    
    if (externalResult.success && externalResult.pdf) {
      return NextResponse.json({
        success: true,
        pdf: externalResult.pdf,
        log: externalResult.log,
      });
    }

    // All methods failed
    return NextResponse.json({
      success: false,
      error: 'LaTeX compilation failed',
      log: `All compilation methods failed.\n\nLocal pdflatex: ${hasLocalPdflatex ? 'tried but failed' : 'not available'}\nDocker: ${hasDockerRunning ? 'tried but failed' : 'not available'}\nExternal API: ${externalResult.log}`,
    }, { status: 400 });

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
          message: 'Using external LaTeX API for compilation (latex.ytotech.com)',
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

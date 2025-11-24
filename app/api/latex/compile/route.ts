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

// External LaTeX API compilation (for serverless environments like Vercel)
async function compileWithExternalAPI(latex: string): Promise<{ success: boolean; pdf?: string; log: string }> {
  try {
    // Using latex.ytotech.com - a free LaTeX compilation API
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

    // Normalize main file name – fall back to 'main.tex' if missing/empty
    const resolvedMainFile =
      mainFile && mainFile.trim().length > 0 ? mainFile.trim() : 'main.tex';

    if (!latex || latex.trim() === '') {
      return NextResponse.json({
        success: false,
        error: 'LaTeX content is required',
      }, { status: 400 });
    }

    // Try Docker compilation first
    let compilationOutput = '';
    let pdfBuffer: Buffer | null = null;
    let compilationSuccess = false;

    try {
      // Check if Docker is available
      await execAsync('docker --version', { timeout: 5000 });
      
      // Create temp directory
      await mkdir(tempDir, { recursive: true });

      // Write main file
      const mainPath = join(tempDir, resolvedMainFile);
      await writeFile(mainPath, latex, 'utf-8');

      // Write additional files (for \input{} and \include{} support)
      for (const [filename, content] of Object.entries(files)) {
        if (filename && filename !== resolvedMainFile) {
          const filePath = join(tempDir, filename);
          await writeFile(filePath, content, 'utf-8');
        }
      }
      
      // Compile using Docker
      const dockerCommand = `docker run --rm \
        -v "${tempDir}:/workspace" \
        -w /workspace \
        texlive/texlive:latest \
        /bin/bash -c "pdflatex -interaction=nonstopmode -halt-on-error ${resolvedMainFile} && pdflatex -interaction=nonstopmode -halt-on-error ${resolvedMainFile}"`;

      const { stdout, stderr } = await execAsync(dockerCommand, {
        timeout: 60000, // 60 seconds timeout
        maxBuffer: 10 * 1024 * 1024, // 10MB buffer
      });

      compilationOutput = stdout + '\n' + stderr;
      
      // Read generated PDF
      const pdfPath = join(tempDir, resolvedMainFile.replace('.tex', '.pdf'));
      pdfBuffer = await readFile(pdfPath);
      compilationSuccess = true;

    } catch (dockerError: any) {
      console.log('Docker compilation failed, trying local pdflatex:', dockerError.message);
      
      // Fallback: Try local pdflatex if available
      try {
        // Check if pdflatex is available locally
        await execAsync('pdflatex --version', { timeout: 5000 });
        
        // Create temp directory if not exists
        await mkdir(tempDir, { recursive: true });

        // Write main file
        const mainPath = join(tempDir, resolvedMainFile);
        await writeFile(mainPath, latex, 'utf-8');

        // Write additional files
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
        
        // Read generated PDF
        const pdfPath = join(tempDir, resolvedMainFile.replace('.tex', '.pdf'));
        pdfBuffer = await readFile(pdfPath);
        compilationSuccess = true;

      } catch (fallbackError: any) {
        console.log('Local pdflatex failed, trying external API:', fallbackError.message);
        
        // Final fallback: Use external LaTeX API (for Vercel/serverless)
        const externalResult = await compileWithExternalAPI(latex);
        
        if (externalResult.success && externalResult.pdf) {
          return NextResponse.json({
            success: true,
            pdf: externalResult.pdf,
            log: externalResult.log,
          });
        } else {
          compilationOutput = externalResult.log;
        }
      }
    }

    if (compilationSuccess && pdfBuffer) {
      const pdfBase64 = pdfBuffer.toString('base64');

      return NextResponse.json({
        success: true,
        pdf: `data:application/pdf;base64,${pdfBase64}`,
        log: compilationOutput,
      });
    } else {
      // Check for common LaTeX errors
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
    // Cleanup temp directory
    try {
      await rm(tempDir, { recursive: true, force: true });
    } catch (cleanupError) {
      console.error('Failed to cleanup temp directory:', cleanupError);
    }
  }
}

// Health check endpoint
export async function GET() {
  try {
    // Check if Docker is available
    try {
      await execAsync('docker --version', { timeout: 5000 });
      return NextResponse.json({
        status: 'ok',
        compiler: 'docker',
        message: 'Docker is available for LaTeX compilation',
      });
    } catch (dockerError) {
      // Check if pdflatex is available
      try {
        await execAsync('pdflatex --version', { timeout: 5000 });
        return NextResponse.json({
          status: 'ok',
          compiler: 'pdflatex',
          message: 'Local pdflatex is available for LaTeX compilation',
        });
      } catch (pdflatexError) {
        // Check if external API is reachable
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
      }
    }
  } catch (error) {
    return NextResponse.json({
      status: 'error',
      message: 'Failed to check compiler availability',
    }, { status: 500 });
  }
}

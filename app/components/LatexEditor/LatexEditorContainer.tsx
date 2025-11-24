'use client';

import { useState, useEffect, useRef } from 'react';
import type { Editor } from '@tiptap/react';
import SharedToolbar from './SharedToolbar';
import FileTreeSidebar from './FileTreeSidebar';
import CodeEditorPane, { CodeEditorRef } from './CodeEditorPane';
import VisualEditorPane from './VisualEditorPane';
import PdfPreviewPane from './PdfPreviewPane';
import { User } from '@/app/types';
import toast from 'react-hot-toast';

type EditorMode = 'code' | 'visual';

interface FileNode {
  id: string;
  name: string;
  type: 'file' | 'folder';
  content?: string;
  children?: FileNode[];
  isOpen?: boolean;
  dbId?: string; // Optional MongoDB id for persisted latexfiles
  parentId?: string | null; // Optional parent folder id for hierarchy
}

interface LatexEditorContainerProps {
  user: User | null;
}

// Build LaTeX document from BPMN payload stored in sessionStorage (if present)
function buildLatexFromBpmnPayload(userName: string | undefined): string | null {
  if (typeof window === 'undefined') {
    return null;
  }

  const raw = window.sessionStorage.getItem('latexFromBpmn');
  if (!raw) return null;

  try {
    const parsed = JSON.parse(raw) as {
      projectName?: string;
      processMetadata?: {
        processName?: string;
        description?: string;
        processOwner?: string;
        processManager?: string;
      };
      additionalDetails?: {
        versionNo?: string;
        processStatus?: string;
        classification?: string;
        dateOfCreation?: string;
        dateOfReview?: string;
        effectiveDate?: string;
        modificationDate?: string;
        modifiedBy?: string;
        changeDescription?: string;
        createdBy?: string;
      };
      signOffData?: {
        responsibility?: string;
        date?: string;
        name?: string;
        designation?: string;
        signature?: string;
      };
      historyData?: {
        versionNo?: string;
        date?: string;
        statusRemarks?: string;
        author?: string;
      };
      triggerData?: {
        triggers?: string;
        inputs?: string;
        outputs?: string;
      };
      selectedTables?: string[];
    };

    const pm = parsed.processMetadata || {};
    const ad = parsed.additionalDetails || {};
    const so = parsed.signOffData || {};
    const hd = parsed.historyData || {};
    const td = parsed.triggerData || {};
    const selected = parsed.selectedTables || [];

    const has = (key: string) => selected.includes(key);

    const lines: string[] = [];
    lines.push('\\documentclass{article}');
    lines.push('\\usepackage{graphicx}');
    lines.push('\\usepackage{longtable}');
    lines.push('\\usepackage{booktabs}');
    lines.push('');
    lines.push(`\\title{${parsed.projectName || pm.processName || 'Process Documentation'}}`);
    lines.push(`\\author{${userName || pm.processOwner || 'Author'}}`);
    lines.push('\\date{\\today}');
    lines.push('');
    lines.push('\\begin{document}');
    lines.push('');
    lines.push('\\maketitle');
    lines.push('');

    if (pm.processName || pm.description) {
      lines.push('\\section{Process Overview}');
      if (pm.processName) {
        lines.push(`\\textbf{Process Name:} ${pm.processName}\\\\`);
      }
      if (pm.description) {
        lines.push('');
        lines.push(pm.description);
      }
      lines.push('');
    }

    if (has('processTable')) {
      lines.push('\\section{Process Table}');
      lines.push('\\begin{longtable}{@{}ll@{}}');
      lines.push('\\toprule');
      lines.push('Field & Value\\\\');
      lines.push('\\midrule');
      if (pm.processName) lines.push(`Process Name & ${pm.processName}\\\\`);
      if (pm.processOwner) lines.push(`Process Owner & ${pm.processOwner}\\\\`);
      if (pm.processManager) lines.push(`Process Manager & ${pm.processManager}\\\\`);
      if (ad.processStatus) lines.push(`Status & ${ad.processStatus}\\\\`);
      if (ad.classification) lines.push(`Classification & ${ad.classification}\\\\`);
      lines.push('\\bottomrule');
      lines.push('\\end{longtable}');
      lines.push('');
    }

    if (has('processDetailsTable')) {
      lines.push('\\section{Process Details Table}');
      lines.push('\\begin{longtable}{@{}ll@{}}');
      lines.push('\\toprule');
      lines.push('Detail & Description\\\\');
      lines.push('\\midrule');
      if (pm.description) lines.push(`Description & ${pm.description}\\\\`);
      if (ad.versionNo) lines.push(`Version & ${ad.versionNo}\\\\`);
      if (ad.dateOfCreation) lines.push(`Date of Creation & ${ad.dateOfCreation}\\\\`);
      if (ad.effectiveDate) lines.push(`Effective Date & ${ad.effectiveDate}\\\\`);
      if (ad.modificationDate) lines.push(`Last Modified & ${ad.modificationDate}\\\\`);
      if (ad.modifiedBy) lines.push(`Modified By & ${ad.modifiedBy}\\\\`);
      if (ad.changeDescription) lines.push(`Change Description & ${ad.changeDescription}\\\\`);
      lines.push('\\bottomrule');
      lines.push('\\end{longtable}');
      lines.push('');
    }

    if (has('frameworksTable')) {
      lines.push('\\section{Frameworks and Standards Table}');
      lines.push('\\begin{longtable}{@{}lll@{}}');
      lines.push('\\toprule');
      lines.push('Framework / Standard & Code & Description\\\\');
      lines.push('\\midrule');
      lines.push('% TODO: Populate from selected standards associated with this process.');
      lines.push('\\bottomrule');
      lines.push('\\end{longtable}');
      lines.push('');
    }

    if (has('kpisTable')) {
      lines.push('\\section{Associated KPIs Table}');
      lines.push('\\begin{longtable}{@{}llll@{}}');
      lines.push('\\toprule');
      lines.push('KPI Name & Target & Unit & Frequency\\\\');
      lines.push('\\midrule');
      lines.push('% TODO: Populate from KPIs linked to this BPMN process.');
      lines.push('\\bottomrule');
      lines.push('\\end{longtable}');
      lines.push('');
    }

    if (has('signOffTable')) {
      lines.push('\\section{Sign OFF Table}');
      lines.push('\\begin{longtable}{@{}ll@{}}');
      lines.push('\\toprule');
      lines.push('Field & Value\\\\');
      lines.push('\\midrule');
      if (so.responsibility) lines.push(`Responsibility & ${so.responsibility}\\\\`);
      if (so.name) lines.push(`Name & ${so.name}\\\\`);
      if (so.designation) lines.push(`Designation & ${so.designation}\\\\`);
      if (so.date) lines.push(`Date & ${so.date}\\\\`);
      if (so.signature) lines.push(`Signature & ${so.signature}\\\\`);
      lines.push('\\bottomrule');
      lines.push('\\end{longtable}');
      lines.push('');
    }

    if (has('historyTable')) {
      lines.push('\\section{History Table}');
      lines.push('\\begin{longtable}{@{}llll@{}}');
      lines.push('\\toprule');
      lines.push('Version & Date & Status / Remarks & Author\\\\');
      lines.push('\\midrule');
      if (hd.versionNo || hd.date || hd.statusRemarks || hd.author) {
        lines.push(
          `${hd.versionNo || ''} & ${hd.date || ''} & ${hd.statusRemarks || ''} & ${hd.author || ''}\\\\`
        );
      } else {
        lines.push('% No history data available yet.');
      }
      lines.push('\\bottomrule');
      lines.push('\\end{longtable}');
      lines.push('');
    }

    if (has('triggerTable')) {
      lines.push('\\section{Trigger Table}');
      lines.push('\\begin{longtable}{@{}lll@{}}');
      lines.push('\\toprule');
      lines.push('Triggers & Inputs & Outputs\\\\');
      lines.push('\\midrule');
      if (td.triggers || td.inputs || td.outputs) {
        lines.push(`${td.triggers || ''} & ${td.inputs || ''} & ${td.outputs || ''}\\\\`);
      } else {
        lines.push('% No trigger data available yet.');
      }
      lines.push('\\bottomrule');
      lines.push('\\end{longtable}');
      lines.push('');
    }

    lines.push('\\end{document}');

    return lines.join('\n');
  } catch (e) {
    console.error('Failed to build LaTeX from BPMN payload:', e);
    return null;
  }
}

export default function LatexEditorContainer({ user }: LatexEditorContainerProps) {
  const [mode, setMode] = useState<EditorMode>('code');

  const defaultSample = `\\documentclass{article}
\\usepackage{graphicx} % Required for inserting images

\\title{Sample Document}
\\author{${user?.name || 'Author'}}
\\date{\\today}

\\begin{document}

\\maketitle

\\section{Introduction}

This is a sample LaTeX document. You can edit this content in both Code Editor and Visual Editor modes.

\\section{Example}

Here's an example of a mathematical equation:

\\[
E = mc^2
\\]

\\end{document}`;

  const initialFromBpmn = buildLatexFromBpmnPayload(user?.name);
  const [latexContent, setLatexContent] = useState<string>(
    initialFromBpmn ? '' : defaultSample
  );
  const [pdfUrl, setPdfUrl] = useState<string | null>(null);
  const [compiling, setCompiling] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [zoom, setZoom] = useState(70);
  const [compilationLog, setCompilationLog] = useState<string>('');
  const [showLog, setShowLog] = useState(false);
  const initialFileName = initialFromBpmn ? 'Untitled.tex' : 'main.tex';
  const [currentFile, setCurrentFile] = useState<string>(
    initialFromBpmn ? '' : initialFileName
  );
  const [files, setFiles] = useState<FileNode[]>(
    initialFromBpmn
      ? []
      : [
          {
            id: '1',
            name: initialFileName,
            type: 'file',
            content: defaultSample,
          },
        ]
  );
  const [visualEditor, setVisualEditor] = useState<Editor | null>(null);
  const codeEditorRef = useRef<CodeEditorRef>(null);
  const [showNameDialog, setShowNameDialog] = useState<boolean>(!!initialFromBpmn);
  const [newFileName, setNewFileName] = useState<string>(
    initialFromBpmn ? initialFileName : initialFileName
  );

  // When opening the LaTeX editor normally (not via "Generate LaTeX"),
  // load any existing LaTeX files from MongoDB so they always re-appear.
  useEffect(() => {
    const loadExistingLatexFiles = async () => {
      if (!user?.id || initialFromBpmn) return;

      try {
        const res = await fetch(`/api/latexfiles?userId=${encodeURIComponent(user.id)}`);
        if (!res.ok) {
          console.error('Failed to fetch LaTeX files from MongoDB:', await res.text());
          return;
        }

        const data = await res.json();
        const filesFromDb = (data?.files || []) as Array<{
          _id: string;
          name: string;
          content: string;
        }>;

        if (filesFromDb.length === 0) {
          return;
        }

        const mapped: FileNode[] = filesFromDb.map((f) => ({
          id: f._id,
          dbId: f._id,
          name: f.name,
          type: 'file',
          content: f.content,
          parentId: null,
        }));

        setFiles(mapped);

        // If no file is currently selected (i.e. we were showing the sample),
        // switch to the first real LaTeX file from the database.
        if (!currentFile && mapped.length > 0) {
          setCurrentFile(mapped[0].name);
          setLatexContent(mapped[0].content || '');
        }
      } catch (err) {
        console.error('Error loading LaTeX files from MongoDB:', err);
      }
    };

    loadExistingLatexFiles();
  }, [user?.id, initialFromBpmn, currentFile]);

  const handleCompile = async () => {
    setCompiling(true);
    setCompilationLog('Starting compilation...\n');

    // If there's no LaTeX content, don't call the API – just clear the preview.
    if (!latexContent.trim()) {
      setPdfUrl(null);
      setCompilationLog((prev) => prev + 'LaTeX content is required.\n');
      setShowLog(true);
      setCompiling(false);
      return;
    }
    
    try {
      // Prepare files object for multi-file support
      const filesObject: Record<string, string> = {};
      files.forEach(file => {
        if (file.type === 'file' && file.content) {
          filesObject[file.name] = file.content;
        }
      });

      const response = await fetch('/api/latex/compile', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          latex: latexContent,
          mainFile: currentFile,
          files: filesObject,
        }),
      });

      const data = await response.json();
      
      if (data.success) {
        setPdfUrl(data.pdf);
        setCompilationLog(prev => prev + '\nCompilation successful! ✓\n' + (data.log || ''));
      } else {
        setCompilationLog(prev => prev + '\nCompilation failed! ✗\n' + (data.log || data.error || ''));
        setShowLog(true);
      }
    } catch (error: any) {
      setCompilationLog(prev => prev + `\nError: ${error.message}\n`);
      setShowLog(true);
    } finally {
      setCompiling(false);
    }
  };

  // Auto-compile on content change (debounced)
  useEffect(() => {
    const timer = setTimeout(() => {
      if (latexContent.trim()) {
        handleCompile();
      }
    }, 2000);

    return () => clearTimeout(timer);
  }, [latexContent]);

  const handleFileSelect = (fileId: string) => {
    const file = files.find(f => f.id === fileId);
    if (file && file.type === 'file') {
      setCurrentFile(file.name);
      const content = file.content || '';
      setLatexContent(content);

      // If the newly selected file has no content, also clear the PDF preview/log
      if (!content.trim()) {
        setPdfUrl(null);
        setCompilationLog('');
        setShowLog(false);
      }
    }
  };

  const handleContentChange = (newContent: string) => {
    setLatexContent(newContent);
    // Update the file content in the files array
    setFiles(prevFiles => 
      prevFiles.map(file => 
        file.name === currentFile 
          ? { ...file, content: newContent }
          : file
      )
    );
  };

  const handleAddFile = (fileName: string) => {
    const newFile: FileNode = {
      id: Date.now().toString(),
      name: fileName,
      type: 'file',
      content: '',
      parentId: null,
    };
    setFiles(prev => [...prev, newFile]);
  };

  const handleAddFolder = (folderName: string) => {
    const newFolder: FileNode = {
      id: `folder-${Date.now().toString()}`,
      name: folderName,
      type: 'folder',
      children: [],
      parentId: null,
    };
    setFiles(prev => [...prev, newFolder]);
  };

  const handleDeleteFile = (fileId: string) => {
    setFiles(prev => {
      const fileToDelete = prev.find(f => f.id === fileId);
      const remaining = prev.filter(f => f.id !== fileId);

      // Delete from MongoDB if this file was persisted
      (async () => {
        if (fileToDelete?.dbId) {
          try {
            const res = await fetch(`/api/latexfiles?fileId=${encodeURIComponent(fileToDelete.dbId)}`, {
              method: 'DELETE',
            });
            if (!res.ok) {
              console.error('Failed to delete LaTeX file from MongoDB:', await res.text());
            }
          } catch (err) {
            console.error('Error deleting LaTeX file from MongoDB:', err);
          }
        }
      })();

      // If we deleted the currently open file, update editor state
      if (fileToDelete && fileToDelete.name === currentFile) {
        if (remaining.length > 0) {
          const nextFile = remaining[0];
          setCurrentFile(nextFile.name);
          setLatexContent(nextFile.content || '');
        } else {
          // No files left: clear code editor and PDF preview
          setCurrentFile('');
          setLatexContent('');
          setPdfUrl(null);
          setCompilationLog('');
          setShowLog(false);
        }
      }

      if (fileToDelete) {
        toast.success(`"${fileToDelete.name}" deleted successfully`);
      }

      return remaining;
    });
  };

  const handleRenameFile = (fileId: string, newName: string) => {
    setFiles(prev => {
      const updated = prev.map(file =>
        file.id === fileId ? { ...file, name: newName } : file
      );

      const renamedFile = updated.find(f => f.id === fileId);

      // Reflect rename in MongoDB for persisted files
      (async () => {
        if (renamedFile?.dbId) {
          try {
            const res = await fetch('/api/latexfiles', {
              method: 'PUT',
              headers: {
                'Content-Type': 'application/json',
              },
              body: JSON.stringify({
                fileId: renamedFile.dbId,
                name: newName,
              }),
            });

            if (!res.ok) {
              console.error(
                'Failed to update LaTeX file name in MongoDB:',
                await res.text()
              );
            } else {
              toast.success('File name updated');
            }
          } catch (err) {
            console.error('Error updating LaTeX file name in MongoDB:', err);
          }
        }
      })();

      // Update currentFile label if renamed file is open
      if (renamedFile && renamedFile.name === currentFile) {
        setCurrentFile(newName);
      }

      return updated;
    });
  };

  const handleMoveNode = (nodeId: string, newParentId: string | null) => {
    setFiles(prev =>
      prev.map(node =>
        node.id === nodeId
          ? {
              ...node,
              parentId: newParentId,
            }
          : node
      )
    );
  };

  // Run command on visual editor (TipTap)
  const runVisualCommand = (command: (editor: Editor) => void) => {
    if (!visualEditor) return;
    command(visualEditor);
  };

  // Run command on code editor (CodeMirror)
  const runCodeCommand = (action: (ref: CodeEditorRef) => void) => {
    if (!codeEditorRef.current) return;
    action(codeEditorRef.current);
  };

  const handleBold = () => {
    if (mode === 'code') {
      runCodeCommand(ref => ref.wrapSelection('\\textbf{', '}'));
    } else {
      runVisualCommand(editor => editor.chain().focus().toggleBold().run());
    }
  };

  const handleItalic = () => {
    if (mode === 'code') {
      runCodeCommand(ref => ref.wrapSelection('\\textit{', '}'));
    } else {
      runVisualCommand(editor => editor.chain().focus().toggleItalic().run());
    }
  };

  const handleUnderline = () => {
    if (mode === 'code') {
      runCodeCommand(ref => ref.wrapSelection('\\underline{', '}'));
    } else {
      runVisualCommand(editor => editor.chain().focus().toggleUnderline().run());
    }
  };

  const handleInsertMath = () => {
    if (mode === 'code') {
      runCodeCommand(ref => {
        const selection = ref.getSelection();
        if (selection) {
          // Wrap selection in math delimiters
          ref.wrapSelection('\\[', '\\]');
        } else {
          // Insert placeholder math
          ref.insertText('\\[\n  E = mc^2\n\\]');
        }
      });
    } else {
      runVisualCommand(editor => {
        editor
          .chain()
          .focus()
          .insertContent('<em>E = mc^2</em>')
          .run();
      });
    }
  };

  const handleInsertTable = () => {
    if (mode === 'code') {
      runCodeCommand(ref => {
        const tableLatex = `\\begin{tabular}{|l|l|}
\\hline
Header 1 & Header 2 \\\\
\\hline
Cell 1 & Cell 2 \\\\
\\hline
Cell 3 & Cell 4 \\\\
\\hline
\\end{tabular}`;
        ref.insertText(tableLatex);
      });
    } else {
      runVisualCommand(editor => {
        (editor.chain().focus() as any).insertTable({ rows: 3, cols: 2, withHeaderRow: true }).run();
      });
    }
  };

  const handleInsertImage = () => {
    const url = window.prompt('Enter image URL or filename');
    if (!url) return;

    if (mode === 'code') {
      runCodeCommand(ref => {
        const imageLatex = `\\begin{figure}[h]
\\centering
\\includegraphics[width=0.8\\textwidth]{${url}}
\\caption{Your caption here}
\\label{fig:label}
\\end{figure}`;
        ref.insertText(imageLatex);
      });
    } else {
      runVisualCommand(editor => {
        (editor.chain().focus() as any).setImage({ src: url }).run();
      });
    }
  };

  const handleToggleList = () => {
    if (mode === 'code') {
      runCodeCommand(ref => {
        const selection = ref.getSelection();
        if (selection) {
          // Convert selected lines to list items
          const items = selection.split('\n').map(line => `  \\item ${line}`).join('\n');
          ref.wrapSelection('\\begin{itemize}\n', '\n\\end{itemize}');
        } else {
          const listLatex = `\\begin{itemize}
  \\item Item 1
  \\item Item 2
  \\item Item 3
\\end{itemize}`;
          ref.insertText(listLatex);
        }
      });
    } else {
      runVisualCommand(editor => {
        editor.chain().focus().toggleBulletList().run();
      });
    }
  };

  const handleDownloadPdf = () => {
    if (!pdfUrl) return;
    window.open(pdfUrl, '_blank');
  };

  // When arriving from "Generate LaTeX", create the file only after the user
  // enters a name. Until then, the editor stays empty.
  const handleCreateFromBpmn = async () => {
    if (!initialFromBpmn) {
      setShowNameDialog(false);
      return;
    }

    const trimmed = newFileName.trim() || 'Untitled.tex';
    const finalName = trimmed.endsWith('.tex') ? trimmed : `${trimmed}.tex`;

    setLatexContent(initialFromBpmn);

    // Persist this file to MongoDB latexfiles collection first so we have its id
    let dbId: string | undefined;
    try {
      if (user?.id && typeof window !== 'undefined') {
        let payload: any = null;
        const raw = window.sessionStorage.getItem('latexFromBpmn');
        if (raw) {
          try {
            payload = JSON.parse(raw);
          } catch (e) {
            console.error('Failed to parse latexFromBpmn payload from sessionStorage:', e);
          }
        }

        const res = await fetch('/api/latexfiles', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            userId: user.id,
            name: finalName,
            content: initialFromBpmn,
            sourceProjectId: payload?.projectId,
            processMetadata: payload?.processMetadata,
            additionalDetails: payload?.additionalDetails,
            selectedTables: payload?.selectedTables,
          }),
        });

        if (res.ok) {
          const data = await res.json();
          dbId = data?.file?._id || data?.file?.id;
          toast.success('LaTeX file created successfully');
        } else {
          console.error('Failed to persist LaTeX file to MongoDB:', await res.text());
        }

        // Clear payload so subsequent LaTeX opens are clean
        window.sessionStorage.removeItem('latexFromBpmn');
      }
    } catch (err) {
      console.error('Failed to save LaTeX file created from BPMN:', err);
    }

    const fileId = Date.now().toString();
    const newFile: FileNode = {
      id: fileId,
      name: finalName,
      type: 'file',
      content: initialFromBpmn,
      dbId,
    };
    setFiles([newFile]);
    setCurrentFile(finalName);
    setShowNameDialog(false);
  };

  return (
    <div className="flex flex-col h-full bg-gray-50">
      {/* Top Navigation Bar */}
      <div className="bg-gray-800 text-white px-4 py-2 flex items-center justify-between border-b border-gray-700">
        <div className="flex items-center gap-4">
          <h1 className="text-lg font-semibold">LaTeX Editor</h1>
          <span className="text-sm text-gray-400">{currentFile}</span>
        </div>
        <div className="flex items-center gap-2 text-sm">
          <span className="text-gray-400">User:</span>
          <span className="font-medium">{user?.name || 'Guest'}</span>
        </div>
      </div>

      {/* Shared Toolbar */}
      <SharedToolbar
        mode={mode}
        onModeChange={setMode}
        onCompile={handleCompile}
        compiling={compiling}
        currentPage={currentPage}
        totalPages={totalPages}
        zoom={zoom}
        onZoomChange={setZoom}
        showLog={showLog}
        onToggleLog={() => setShowLog(!showLog)}
        onBold={handleBold}
        onItalic={handleItalic}
        onUnderline={handleUnderline}
        onInsertMath={handleInsertMath}
        onInsertTable={handleInsertTable}
        onInsertImage={handleInsertImage}
        onToggleList={handleToggleList}
        onDownloadPdf={handleDownloadPdf}
      />

      {/* Main Content Area */}
      <div className="flex flex-1 overflow-hidden">
        {/* Left Sidebar - File Tree */}
        <FileTreeSidebar
          files={files}
          currentFile={currentFile}
          onFileSelect={handleFileSelect}
          onAddFile={handleAddFile}
          onAddFolder={handleAddFolder}
          onDeleteFile={handleDeleteFile}
          onRenameFile={handleRenameFile}
          onMoveNode={handleMoveNode}
        />

        {/* Editor Area */}
        <div className="flex-1 flex flex-col overflow-hidden">
          {mode === 'code' ? (
            <CodeEditorPane
              ref={codeEditorRef}
              content={latexContent}
              onChange={handleContentChange}
            />
          ) : (
            <VisualEditorPane
              content={latexContent}
              onChange={handleContentChange}
              onEditorReady={setVisualEditor}
            />
          )}
          
          {/* Compilation Log */}
          {showLog && (
            <div className="h-32 bg-gray-900 text-gray-100 p-3 overflow-y-auto font-mono text-xs border-t border-gray-700">
              <div className="flex items-center justify-between mb-2">
                <span className="font-semibold">Compilation Log</span>
                <button
                  onClick={() => setShowLog(false)}
                  className="text-gray-400 hover:text-white"
                >
                  ✕
                </button>
              </div>
              <pre className="whitespace-pre-wrap">{compilationLog}</pre>
            </div>
          )}
        </div>

        {/* PDF Preview */}
        <PdfPreviewPane
          pdfUrl={pdfUrl}
          currentPage={currentPage}
          onPageChange={setCurrentPage}
          onTotalPagesChange={setTotalPages}
          zoom={zoom}
        />
      </div>
      {/* Name prompt when arriving from "Generate LaTeX" */}
      {showNameDialog && (
        <div className="fixed inset-0 z-[10000] flex items-center justify-center bg-black bg-opacity-50 px-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-2">
              Name your LaTeX file
            </h2>
            <p className="text-sm text-gray-600 mb-4">
              Enter a name for the new LaTeX document generated from your BPMN
              diagram.
            </p>
            <input
              type="text"
              className="w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 mb-4 text-sm"
              value={newFileName}
              onChange={(e) => setNewFileName(e.target.value)}
              autoFocus
            />
            <div className="flex justify-end gap-2">
              <button
                onClick={() => {
                  // Keep editor empty if the user cancels
                  setShowNameDialog(false);
                }}
                className="px-4 py-2 text-sm rounded-md border border-gray-300 bg-white text-gray-700 hover:bg-gray-100"
              >
                Cancel
              </button>
              <button
                onClick={handleCreateFromBpmn}
                className="px-4 py-2 text-sm rounded-md bg-blue-600 text-white hover:bg-blue-700"
              >
                Create
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}


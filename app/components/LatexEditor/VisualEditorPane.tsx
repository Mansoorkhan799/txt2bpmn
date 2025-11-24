'use client';

import { useEditor, EditorContent, type Editor } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Underline from '@tiptap/extension-underline';
import TextAlign from '@tiptap/extension-text-align';
import { Table } from '@tiptap/extension-table';
import { TableRow } from '@tiptap/extension-table-row';
import { TableCell } from '@tiptap/extension-table-cell';
import { TableHeader } from '@tiptap/extension-table-header';
import Image from '@tiptap/extension-image';
import Link from '@tiptap/extension-link';
import { useEffect, useRef } from 'react';

interface VisualEditorPaneProps {
  content: string;
  onChange: (value: string) => void;
  onEditorReady?: (editor: Editor | null) => void;
}

// Helper function to convert LaTeX table body to HTML table
function convertLatexTableToHtml(inner: string): string {
  // Remove booktabs rules, hline, and collapse whitespace
  let body = String(inner)
    .replace(/\\toprule/g, '')
    .replace(/\\midrule/g, '')
    .replace(/\\bottomrule/g, '')
    .replace(/\\hline/g, '')
    .replace(/\\cline\{[^}]*\}/g, '')
    .trim();

  // Split rows on "\\" (LaTeX row separator)
  const rawRows = body
    .split(/\\\\/g)
    .map((r) => r.trim())
    .filter((r) => r.length > 0 && !r.startsWith('\\'));

  if (rawRows.length === 0) {
    return '<p><em>[Empty table]</em></p>';
  }

  const rows: string[][] = rawRows.map((row) =>
    row.split('&').map((c) => c.trim())
  );

  const header = rows[0];
  const bodyRows = rows.slice(1);

  const headerHtml =
    '<tr>' + header.map((c) => `<th style="border:1px solid #ccc;padding:8px;background:#f5f5f5;">${c}</th>`).join('') + '</tr>';
  const bodyHtml = bodyRows
    .map(
      (r) =>
        '<tr>' + r.map((c) => `<td style="border:1px solid #ccc;padding:8px;">${c}</td>`).join('') + '</tr>'
    )
    .join('');

  return `<table style="border-collapse:collapse;width:100%;margin:1em 0;"><thead>${headerHtml}</thead><tbody>${bodyHtml}</tbody></table>`;
}

// Function to convert LaTeX to HTML (simplified version)
function latexToHtml(latex: string): string {
  let html = latex;
  
  // Remove LaTeX comments (everything after % on a line)
  html = html.replace(/%.*/g, '');

  // Convert document structure
  html = html.replace(/\\documentclass\{[^}]*\}/g, '');
  html = html.replace(/\\usepackage(\[[^\]]*\])?\{[^}]*\}/g, '');
  html = html.replace(/\\label\{[^}]*\}/g, '');
  html = html.replace(/\\caption\{([^}]*)\}/g, '<p><em>$1</em></p>');
  
  // Title centered, big heading
  html = html.replace(/\\title\{([^}]*)\}/g, '<h1 style="text-align:center;">$1</h1>');
  // Author shown as plain name under the title (no "By")
  html = html.replace(
    /\\author\{([^}]*)\}/g,
    '<p style="text-align:center; margin-top:0.25rem;">$1</p>'
  );
  // Hide explicit date from the visual view (to match reference screenshot)
  html = html.replace(/\\date\{[^}]*\}/g, '');
  html = html.replace(/\\maketitle/g, '');
  html = html.replace(/\\begin\{document\}/g, '');
  html = html.replace(/\\end\{document\}/g, '');
  
  // Convert sections
  html = html.replace(/\\section\*?\{([^}]*)\}/g, '<h2>$1</h2>');
  html = html.replace(/\\subsection\*?\{([^}]*)\}/g, '<h3>$1</h3>');
  html = html.replace(/\\subsubsection\*?\{([^}]*)\}/g, '<h4>$1</h4>');
  
  // Convert text formatting
  html = html.replace(/\\textbf\{([^}]*)\}/g, '<strong>$1</strong>');
  html = html.replace(/\\textit\{([^}]*)\}/g, '<em>$1</em>');
  html = html.replace(/\\underline\{([^}]*)\}/g, '<u>$1</u>');
  html = html.replace(/\\emph\{([^}]*)\}/g, '<em>$1</em>');
  
  // Convert lists
  html = html.replace(/\\begin\{itemize\}/g, '<ul>');
  html = html.replace(/\\end\{itemize\}/g, '</ul>');
  html = html.replace(/\\begin\{enumerate\}/g, '<ol>');
  html = html.replace(/\\end\{enumerate\}/g, '</ol>');
  html = html.replace(/\\item\s*/g, '<li>');
  
  // Convert display math \[ ... \]
  html = html.replace(/\\\[([\s\S]*?)\\\]/g, (_match, expr) => {
    const cleanExpr = expr.trim();
    return `<p style="text-align:center;font-style:italic;font-size:1.1em;margin:1em 0;padding:0.5em;background:#f9f9f9;border-radius:4px;">${cleanExpr}</p>`;
  });
  
  // Convert inline math \( ... \)
  html = html.replace(/\\\(([\s\S]*?)\\\)/g, '<em>$1</em>');
  
  // Convert $ ... $ inline math
  html = html.replace(/\$([^$]+)\$/g, '<em>$1</em>');

  // Convert figure environments
  html = html.replace(/\\begin\{figure\}(\[[^\]]*\])?([\s\S]*?)\\end\{figure\}/g, (_match, _opts, inner) => {
    // Extract includegraphics
    const imgMatch = inner.match(/\\includegraphics(\[[^\]]*\])?\{([^}]*)\}/);
    const captionMatch = inner.match(/\\caption\{([^}]*)\}/);
    
    let result = '<div style="text-align:center;margin:1em 0;">';
    if (imgMatch) {
      result += `<img src="${imgMatch[2]}" alt="Figure" style="max-width:100%;height:auto;" />`;
    }
    if (captionMatch) {
      result += `<p><em>${captionMatch[1]}</em></p>`;
    }
    result += '</div>';
    return result;
  });
  
  // Convert standalone includegraphics
  html = html.replace(/\\includegraphics(\[[^\]]*\])?\{([^}]*)\}/g, '<img src="$2" alt="Image" style="max-width:100%;height:auto;" />');

  // Convert tabular environments into HTML tables
  html = html.replace(
    /\\begin\{tabular\}\{[^}]*\}([\s\S]*?)\\end\{tabular\}/g,
    (_match, inner) => convertLatexTableToHtml(inner)
  );

  // Convert longtable environments into HTML tables
  html = html.replace(
    /\\begin\{longtable\}\{(?:[^{}]|\{[^}]*\})*\}([\s\S]*?)\\end\{longtable\}/g,
    (_match, inner) => convertLatexTableToHtml(inner)
  );

  // Convert table environments (wrapper)
  html = html.replace(/\\begin\{table\}(\[[^\]]*\])?/g, '<div class="table-wrapper">');
  html = html.replace(/\\end\{table\}/g, '</div>');

  // Convert centering
  html = html.replace(/\\centering/g, '');
  html = html.replace(/\\begin\{center\}/g, '<div style="text-align:center;">');
  html = html.replace(/\\end\{center\}/g, '</div>');

  // Clean up line breaks
  html = html.replace(/\\\\/g, '<br/>');
  
  // Clean up extra whitespace and newlines
  html = html.replace(/\n\n+/g, '</p><p>');
  html = html.replace(/\n/g, ' ');
  
  return `<div>${html}</div>`;
}

// Function to convert HTML back to LaTeX (simplified version)
function htmlToLatex(html: string): string {
  let latex = html;
  
  // Remove wrapper div
  latex = latex.replace(/<div[^>]*>([\s\S]*)<\/div>/g, '$1');

  // Convert display math paragraphs produced by latexToHtml
  latex = latex.replace(
    /<p[^>]*style="[^"]*text-align:center[^"]*"[^>]*>([\s\S]*?)<\/p>/g,
    (_match, content) => {
      // Check if it's a math expression (contains math-like content)
      const cleanContent = content.replace(/<[^>]*>/g, '').trim();
      if (cleanContent && /[=^_]|mc|frac|sqrt|sum|int/.test(cleanContent)) {
        return `\n\\[\n${cleanContent}\n\\]\n\n`;
      }
      return `\n${cleanContent}\n\n`;
    }
  );

  // Convert headings
  latex = latex.replace(/<h1[^>]*>(.*?)<\/h1>/g, '\\title{$1}');
  latex = latex.replace(/<h2[^>]*>(.*?)<\/h2>/g, '\\section{$1}');
  latex = latex.replace(/<h3[^>]*>(.*?)<\/h3>/g, '\\subsection{$1}');
  latex = latex.replace(/<h4[^>]*>(.*?)<\/h4>/g, '\\subsubsection{$1}');
  
  // Convert text formatting
  latex = latex.replace(/<strong>(.*?)<\/strong>/g, '\\textbf{$1}');
  latex = latex.replace(/<b>(.*?)<\/b>/g, '\\textbf{$1}');
  latex = latex.replace(/<em>(.*?)<\/em>/g, (_match, inner) => {
    const content = String(inner).trim();
    // Check if it looks like math
    if (/[=^_]|mc|frac|sqrt/.test(content)) {
      return `\\(${content}\\)`;
    }
    return `\\textit{${content}}`;
  });
  latex = latex.replace(/<i>(.*?)<\/i>/g, '\\textit{$1}');
  latex = latex.replace(/<u>(.*?)<\/u>/g, '\\underline{$1}');
  
  // Convert lists
  latex = latex.replace(/<ul[^>]*>/g, '\\begin{itemize}');
  latex = latex.replace(/<\/ul>/g, '\\end{itemize}');
  latex = latex.replace(/<ol[^>]*>/g, '\\begin{enumerate}');
  latex = latex.replace(/<\/ol>/g, '\\end{enumerate}');
  latex = latex.replace(/<li[^>]*>/g, '\\item ');
  latex = latex.replace(/<\/li>/g, '\n');
  
  // Convert paragraphs
  latex = latex.replace(/<p[^>]*>(.*?)<\/p>/g, '$1\n\n');
  
  // Convert line breaks
  latex = latex.replace(/<br\s*\/?>/g, '\\\\\n');

  // Convert images
  latex = latex.replace(/<img[^>]*src="([^"]*)"[^>]*>/g, '\\includegraphics[width=0.8\\textwidth]{$1}');

  // Convert HTML tables back to LaTeX tabular
  latex = latex.replace(
    /<table[^>]*>([\s\S]*?)<\/table>/g,
    (_match, inner) => {
      const rows: string[][] = [];
      const rowRegex = /<tr[^>]*>([\s\S]*?)<\/tr>/g;
      let rowMatch: RegExpExecArray | null;

      while ((rowMatch = rowRegex.exec(inner)) !== null) {
        const cellsHtml = rowMatch[1];
        const cellRegex = /<t[dh][^>]*>([\s\S]*?)<\/t[dh]>/g;
        const cells: string[] = [];
        let cellMatch: RegExpExecArray | null;
        while ((cellMatch = cellRegex.exec(cellsHtml)) !== null) {
          const cellText = cellMatch[1].replace(/<[^>]*>/g, '').trim();
          cells.push(cellText);
        }
        if (cells.length > 0) {
          rows.push(cells);
        }
      }

      if (rows.length === 0) {
        return '';
      }

      const colCount = rows[0].length;
      const colSpec = '|' + 'l|'.repeat(colCount);

      const lines: string[] = [];
      lines.push(`\\begin{tabular}{${colSpec}}`);
      lines.push('\\hline');
      rows.forEach((r, idx) => {
        lines.push(r.join(' & ') + ' \\\\');
        lines.push('\\hline');
      });
      lines.push('\\end{tabular}');

      return '\n' + lines.join('\n') + '\n';
    }
  );
  
  // Clean up remaining HTML tags
  latex = latex.replace(/<[^>]*>/g, '');

  // Decode common HTML entities
  latex = latex
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&nbsp;/g, ' ')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'");

  const body = latex.trim();

  // Wrap the visual-editor body back into a compilable LaTeX document
  return `\\documentclass{article}
\\usepackage{graphicx}
\\usepackage{longtable}
\\usepackage{booktabs}

\\begin{document}
${body}

\\end{document}`;
}

export default function VisualEditorPane({
  content,
  onChange,
  onEditorReady,
}: VisualEditorPaneProps) {
  // Track last LaTeX value that originated from this visual editor so we can
  // avoid an update loop between onUpdate -> parent state -> useEffect sync.
  const lastLatexFromEditorRef = useRef<string | null>(null);

  const editor = useEditor({
    immediatelyRender: false,
    extensions: [
      StarterKit,
      Underline,
      TextAlign.configure({
        types: ['heading', 'paragraph'],
      }),
      Table.configure({
        resizable: true,
      }),
      TableRow,
      TableHeader,
      TableCell,
      Image,
      Link.configure({
        openOnClick: false,
      }),
    ],
    content: latexToHtml(content),
    onUpdate: ({ editor }) => {
      const html = editor.getHTML();
      const latex = htmlToLatex(html);
      // Remember that this LaTeX came from the visual editor itself
      lastLatexFromEditorRef.current = latex;
      onChange(latex);
    },
    editorProps: {
      attributes: {
        // Use smaller, consistent typography so the visual editor
        // feels closer to an actual LaTeX page rather than huge UI text.
        class:
          'prose prose-sm max-w-none focus:outline-none text-[14px] leading-relaxed',
      },
    },
  });

  // Notify parent when the editor instance becomes available or changes
  useEffect(() => {
    if (onEditorReady) {
      onEditorReady(editor);
    }
  }, [editor, onEditorReady]);

  // Update editor content when prop changes (from code editor)
  useEffect(() => {
    if (editor && content) {
      // If the incoming content is exactly what we just emitted from this
      // visual editor, skip resetting the editor to avoid an infinite loop.
      if (lastLatexFromEditorRef.current === content) {
        return;
      }

      const currentHtml = editor.getHTML();
      const newHtml = latexToHtml(content);
      
      // Only update if content is different to avoid cursor jumping
      if (currentHtml !== newHtml) {
        editor.commands.setContent(newHtml);
      }
    }
  }, [content, editor]);

  if (!editor) {
    return (
      <div className="flex items-center justify-center h-full bg-gray-50">
        <div className="text-gray-500">Loading visual editor...</div>
      </div>
    );
  }

  return (
    <div className="h-full w-full overflow-auto bg-gray-100">
      {/* Centered "page" to mimic a document layout */}
      <div className="flex justify-center py-8">
        <div className="bg-white shadow-md border border-gray-200 w-[800px] min-h-[1000px] px-16 py-12">
          <EditorContent editor={editor} />
        </div>
      </div>
    </div>
  );
}


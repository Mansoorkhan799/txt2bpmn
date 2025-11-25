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

  // Split rows on "\\" (LaTeX row separator) - handle both \\ and escaped \\\\
  const rawRows = body
    .split(/\\\\|\n/)
    .map((r) => r.trim())
    .filter((r) => r.length > 0 && !r.match(/^\\[a-z]/i));

  if (rawRows.length === 0) {
    return '<p><em>[Empty table]</em></p>';
  }

  const rows: string[][] = rawRows.map((row) =>
    row.split('&').map((c) => c.trim())
  );

  // Filter out empty rows
  const validRows = rows.filter(r => r.some(cell => cell.length > 0));
  
  if (validRows.length === 0) {
    return '<p><em>[Empty table]</em></p>';
  }

  const header = validRows[0];
  const bodyRows = validRows.slice(1);

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

// Function to convert LaTeX to HTML
function latexToHtml(latex: string): string {
  let html = latex;
  
  // Remove LaTeX comments (everything after % on a line, but not \%)
  html = html.replace(/(?<!\\)%.*/g, '');

  // ============ STRIP PREAMBLE AND COMPLEX COMMANDS ============
  
  // Remove document class and options
  html = html.replace(/\\documentclass(\[[^\]]*\])?\{[^}]*\}/g, '');
  
  // Remove all \usepackage commands
  html = html.replace(/\\usepackage(\[[^\]]*\])?\{[^}]*\}/g, '');
  
  // Remove \input and \include
  html = html.replace(/\\(input|include)\{[^}]*\}/g, '');
  
  // Remove color definitions
  html = html.replace(/\\definecolor\{[^}]*\}\{[^}]*\}\{[^}]*\}/g, '');
  html = html.replace(/\\color\{[^}]*\}/g, '');
  html = html.replace(/\\textcolor\{[^}]*\}\{([^}]*)\}/g, '$1');
  html = html.replace(/\\colorbox\{[^}]*\}\{([^}]*)\}/g, '$1');
  html = html.replace(/\\cellcolor(\[[^\]]*\])?\{[^}]*\}/g, '');
  html = html.replace(/\\rowcolor(\[[^\]]*\])?\{[^}]*\}/g, '');
  
  // Remove page style commands
  html = html.replace(/\\pagestyle\{[^}]*\}/g, '');
  html = html.replace(/\\thispagestyle\{[^}]*\}/g, '');
  html = html.replace(/\\fancypagestyle\{[^}]*\}\{[\s\S]*?\}/g, '');
  html = html.replace(/\\fancyhead(\[[^\]]*\])?\{[^}]*\}/g, '');
  html = html.replace(/\\fancyfoot(\[[^\]]*\])?\{[^}]*\}/g, '');
  html = html.replace(/\\fancyhf\{[^}]*\}/g, '');
  html = html.replace(/\\lhead\{[^}]*\}/g, '');
  html = html.replace(/\\rhead\{[^}]*\}/g, '');
  html = html.replace(/\\chead\{[^}]*\}/g, '');
  html = html.replace(/\\lfoot\{[^}]*\}/g, '');
  html = html.replace(/\\rfoot\{[^}]*\}/g, '');
  html = html.replace(/\\cfoot\{[^}]*\}/g, '');
  
  // Remove geometry and layout commands
  html = html.replace(/\\geometry\{[^}]*\}/g, '');
  html = html.replace(/\\setlength\{[^}]*\}\{[^}]*\}/g, '');
  html = html.replace(/\\setcounter\{[^}]*\}\{[^}]*\}/g, '');
  html = html.replace(/\\addtolength\{[^}]*\}\{[^}]*\}/g, '');
  
  // Remove newcommand, renewcommand, def
  html = html.replace(/\\(new|renew)command\{[^}]*\}(\[[^\]]*\])?\{[\s\S]*?\}/g, '');
  html = html.replace(/\\def\\[a-zA-Z]+\{[\s\S]*?\}/g, '');
  
  // Remove font commands
  html = html.replace(/\\(tiny|scriptsize|footnotesize|small|normalsize|large|Large|LARGE|huge|Huge)\b/g, '');
  html = html.replace(/\\(rmfamily|sffamily|ttfamily|bfseries|mdseries|itshape|slshape|scshape|upshape)\b/g, '');
  html = html.replace(/\\fontsize\{[^}]*\}\{[^}]*\}/g, '');
  html = html.replace(/\\selectfont/g, '');
  
  // Remove spacing commands
  html = html.replace(/\\(vspace|hspace|vskip|hskip|quad|qquad|enspace|thinspace)\*?\{?[^}]*\}?/g, ' ');
  html = html.replace(/\\(smallskip|medskip|bigskip|newline|linebreak|pagebreak|newpage|clearpage)/g, '');
  
  // Remove labels and refs
  html = html.replace(/\\label\{[^}]*\}/g, '');
  html = html.replace(/\\ref\{[^}]*\}/g, '[ref]');
  html = html.replace(/\\pageref\{[^}]*\}/g, '[page]');
  html = html.replace(/\\cite\{[^}]*\}/g, '[cite]');
  
  // Remove hyperref commands
  html = html.replace(/\\hypersetup\{[\s\S]*?\}/g, '');
  html = html.replace(/\\href\{[^}]*\}\{([^}]*)\}/g, '$1');
  html = html.replace(/\\url\{([^}]*)\}/g, '$1');
  
  // Remove TOC commands
  html = html.replace(/\\tableofcontents/g, '');
  html = html.replace(/\\listoffigures/g, '');
  html = html.replace(/\\listoftables/g, '');
  
  // Remove bibliography
  html = html.replace(/\\bibliography\{[^}]*\}/g, '');
  html = html.replace(/\\bibliographystyle\{[^}]*\}/g, '');
  
  // Remove rotatebox and similar
  html = html.replace(/\\rotatebox\{[^}]*\}\{([^}]*)\}/g, '$1');
  html = html.replace(/\\scalebox\{[^}]*\}\{([^}]*)\}/g, '$1');
  html = html.replace(/\\resizebox\{[^}]*\}\{[^}]*\}\{([^}]*)\}/g, '$1');
  
  // Remove minipage, parbox
  html = html.replace(/\\begin\{minipage\}(\[[^\]]*\])?\{[^}]*\}/g, '');
  html = html.replace(/\\end\{minipage\}/g, '');
  html = html.replace(/\\parbox(\[[^\]]*\])?\{[^}]*\}\{([^}]*)\}/g, '$2');
  
  // Remove abstract environment content but keep it
  html = html.replace(/\\begin\{abstract\}/g, '<div><strong>Abstract</strong><br/>');
  html = html.replace(/\\end\{abstract\}/g, '</div>');
  
  // ============ CONVERT DOCUMENT STRUCTURE ============
  
  html = html.replace(/\\begin\{document\}/g, '');
  html = html.replace(/\\end\{document\}/g, '');
  html = html.replace(/\\maketitle/g, '');
  
  // Title, author, date
  html = html.replace(/\\title\{([^}]*)\}/g, '<h1 style="text-align:center;margin-bottom:0.5em;">$1</h1>');
  html = html.replace(/\\author\{([^}]*)\}/g, '<p style="text-align:center;color:#666;">$1</p>');
  html = html.replace(/\\date\{([^}]*)\}/g, '<p style="text-align:center;color:#888;font-size:0.9em;">$1</p>');
  
  // Chapters and sections
  html = html.replace(/\\chapter\*?\{([^}]*)\}/g, '<h1>$1</h1>');
  html = html.replace(/\\section\*?\{([^}]*)\}/g, '<h2>$1</h2>');
  html = html.replace(/\\subsection\*?\{([^}]*)\}/g, '<h3>$1</h3>');
  html = html.replace(/\\subsubsection\*?\{([^}]*)\}/g, '<h4>$1</h4>');
  html = html.replace(/\\paragraph\*?\{([^}]*)\}/g, '<h5>$1</h5>');
  
  // ============ CONVERT TEXT FORMATTING ============
  
  html = html.replace(/\\textbf\{([^}]*)\}/g, '<strong>$1</strong>');
  html = html.replace(/\\textit\{([^}]*)\}/g, '<em>$1</em>');
  html = html.replace(/\\underline\{([^}]*)\}/g, '<u>$1</u>');
  html = html.replace(/\\emph\{([^}]*)\}/g, '<em>$1</em>');
  html = html.replace(/\\textsf\{([^}]*)\}/g, '$1');
  html = html.replace(/\\texttt\{([^}]*)\}/g, '<code>$1</code>');
  html = html.replace(/\\textsc\{([^}]*)\}/g, '<span style="font-variant:small-caps;">$1</span>');
  
  // ============ CONVERT LISTS ============
  
  html = html.replace(/\\begin\{itemize\}/g, '<ul>');
  html = html.replace(/\\end\{itemize\}/g, '</ul>');
  html = html.replace(/\\begin\{enumerate\}/g, '<ol>');
  html = html.replace(/\\end\{enumerate\}/g, '</ol>');
  html = html.replace(/\\begin\{description\}/g, '<dl>');
  html = html.replace(/\\end\{description\}/g, '</dl>');
  html = html.replace(/\\item\[([^\]]*)\]/g, '<dt>$1</dt><dd>');
  html = html.replace(/\\item\s*/g, '<li>');
  
  // ============ CONVERT MATH ============
  
  // Display math \[ ... \]
  html = html.replace(/\\\[([\s\S]*?)\\\]/g, (_match, expr) => {
    const cleanExpr = expr.trim();
    return `<div style="text-align:center;font-style:italic;font-size:1.1em;margin:1em 0;padding:0.75em;background:#f5f5f5;border-radius:4px;border-left:3px solid #007bff;">${cleanExpr}</div>`;
  });
  
  // Equation environment
  html = html.replace(/\\begin\{equation\*?\}([\s\S]*?)\\end\{equation\*?\}/g, (_match, expr) => {
    return `<div style="text-align:center;font-style:italic;margin:1em 0;padding:0.75em;background:#f5f5f5;border-radius:4px;">${expr.trim()}</div>`;
  });
  
  // Inline math \( ... \)
  html = html.replace(/\\\(([\s\S]*?)\\\)/g, '<em style="background:#f9f9f9;padding:0 4px;border-radius:2px;">$1</em>');
  
  // Inline math $ ... $
  html = html.replace(/\$([^$]+)\$/g, '<em style="background:#f9f9f9;padding:0 4px;border-radius:2px;">$1</em>');

  // ============ CONVERT FIGURES ============
  
  html = html.replace(/\\begin\{figure\}(\[[^\]]*\])?([\s\S]*?)\\end\{figure\}/g, (_match, _opts, inner) => {
    const imgMatch = inner.match(/\\includegraphics(\[[^\]]*\])?\{([^}]*)\}/);
    const captionMatch = inner.match(/\\caption\{([^}]*)\}/);
    
    let result = '<figure style="text-align:center;margin:1.5em 0;padding:1em;background:#fafafa;border-radius:4px;">';
    if (imgMatch) {
      result += `<img src="${imgMatch[2]}" alt="Figure" style="max-width:100%;height:auto;" />`;
    } else {
      result += '<p style="color:#999;">[Image placeholder]</p>';
    }
    if (captionMatch) {
      result += `<figcaption style="margin-top:0.5em;font-style:italic;color:#666;">${captionMatch[1]}</figcaption>`;
    }
    result += '</figure>';
    return result;
  });
  
  html = html.replace(/\\includegraphics(\[[^\]]*\])?\{([^}]*)\}/g, 
    '<img src="$2" alt="Image" style="max-width:100%;height:auto;display:block;margin:1em auto;" />');
  html = html.replace(/\\caption\{([^}]*)\}/g, '<p style="text-align:center;font-style:italic;color:#666;">$1</p>');

  // ============ CONVERT TABLES ============
  
  // tabular environment
  html = html.replace(
    /\\begin\{tabular\}\{[^}]*\}([\s\S]*?)\\end\{tabular\}/g,
    (_match, inner) => convertLatexTableToHtml(inner)
  );
  
  // longtable environment
  html = html.replace(
    /\\begin\{longtable\}\{[^}]*\}([\s\S]*?)\\end\{longtable\}/g,
    (_match, inner) => convertLatexTableToHtml(inner)
  );
  
  // table wrapper
  html = html.replace(/\\begin\{table\}(\[[^\]]*\])?/g, '<div style="margin:1em 0;">');
  html = html.replace(/\\end\{table\}/g, '</div>');
  
  // ============ CONVERT OTHER ENVIRONMENTS ============
  
  html = html.replace(/\\begin\{center\}/g, '<div style="text-align:center;">');
  html = html.replace(/\\end\{center\}/g, '</div>');
  html = html.replace(/\\begin\{flushleft\}/g, '<div style="text-align:left;">');
  html = html.replace(/\\end\{flushleft\}/g, '</div>');
  html = html.replace(/\\begin\{flushright\}/g, '<div style="text-align:right;">');
  html = html.replace(/\\end\{flushright\}/g, '</div>');
  html = html.replace(/\\begin\{quote\}/g, '<blockquote style="margin:1em 2em;padding:0.5em;border-left:3px solid #ccc;">');
  html = html.replace(/\\end\{quote\}/g, '</blockquote>');
  html = html.replace(/\\begin\{verbatim\}([\s\S]*?)\\end\{verbatim\}/g, '<pre style="background:#f5f5f5;padding:1em;overflow-x:auto;">$1</pre>');
  
  html = html.replace(/\\centering/g, '');
  
  // ============ CLEAN UP REMAINING LATEX ============
  
  // Remove any remaining \begin{...} and \end{...}
  html = html.replace(/\\begin\{[^}]*\}(\[[^\]]*\])?/g, '');
  html = html.replace(/\\end\{[^}]*\}/g, '');
  
  // Remove any remaining backslash commands that weren't handled
  // This catches things like \somecommand{arg} or \somecommand
  html = html.replace(/\\[a-zA-Z]+\*?(\[[^\]]*\])?(\{[^}]*\})*/g, '');
  
  // Clean up line breaks
  html = html.replace(/\\\\/g, '<br/>');
  
  // Clean up special characters
  html = html.replace(/\\&/g, '&amp;');
  html = html.replace(/\\#/g, '#');
  html = html.replace(/\\%/g, '%');
  html = html.replace(/\\_/g, '_');
  html = html.replace(/\\{/g, '{');
  html = html.replace(/\\}/g, '}');
  html = html.replace(/\\~/g, '&nbsp;');
  html = html.replace(/~~/g, '&nbsp;');
  html = html.replace(/---/g, '—');
  html = html.replace(/--/g, '–');
  html = html.replace(/``/g, '"');
  html = html.replace(/''/g, '"');
  
  // Clean up multiple spaces and newlines
  html = html.replace(/\n\s*\n\s*\n+/g, '</p><p>');
  html = html.replace(/\n\n+/g, '</p><p>');
  html = html.replace(/\n/g, ' ');
  html = html.replace(/\s+/g, ' ');
  
  // Wrap in container
  return `<div style="font-family: Georgia, 'Times New Roman', serif; line-height: 1.6;">${html}</div>`;
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

      const newHtml = latexToHtml(content);
      
      // Always update when content changes from code editor
      editor.commands.setContent(newHtml);
    }
  }, [content, editor]);

  // Force refresh when editor is first ready
  useEffect(() => {
    if (editor && content) {
      const newHtml = latexToHtml(content);
      editor.commands.setContent(newHtml);
    }
  }, [editor]); // Only run when editor becomes available

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


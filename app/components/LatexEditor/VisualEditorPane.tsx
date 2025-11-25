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

// Store the original LaTeX content to preserve structure
let originalLatexContent = '';

// Helper function to convert LaTeX table body to HTML table
function convertLatexTableToHtml(inner: string): string {
  // Normalize the content
  let body = String(inner)
    .replace(/\r\n/g, '\n')
    .replace(/\n+/g, ' ')
    .replace(/\\toprule/g, '|||ROW_SEP|||')
    .replace(/\\midrule/g, '|||ROW_SEP|||')
    .replace(/\\bottomrule/g, '|||ROW_SEP|||')
    .replace(/\\hline/g, '|||ROW_SEP|||')
    .replace(/\\cline\{[^}]*\}/g, '')
    .replace(/\\endhead/g, '|||ROW_SEP|||')
    .replace(/\\endfirsthead/g, '|||ROW_SEP|||')
    .replace(/\\endfoot/g, '|||ROW_SEP|||')
    .replace(/\\endlastfoot/g, '|||ROW_SEP|||')
    .replace(/\\multicolumn\{(\d+)\}\{[^}]*\}\{([^}]*)\}/g, '$2')
    .replace(/\\textbf\{([^}]*)\}/g, '<strong>$1</strong>')
    .replace(/\\textit\{([^}]*)\}/g, '<em>$1</em>')
    .trim();

  body = body.replace(/\\\\/g, '|||ROW_SEP|||');
  
  const rawRows = body
    .split('|||ROW_SEP|||')
    .map((r) => r.trim())
    .filter((r) => {
      if (r.length === 0) return false;
      if (r.match(/^\\[a-z]/i)) return false;
      return r.includes('&') || r.replace(/[^a-zA-Z0-9]/g, '').length > 0;
    });

  if (rawRows.length === 0) {
    return '<p><em>[Empty table]</em></p>';
  }

  const rows: string[][] = rawRows.map((row) => {
    let cleanRow = row
      .replace(/\\[a-zA-Z]+\{[^}]*\}/g, '')
      .replace(/\\[a-zA-Z]+/g, '')
      .trim();
    
    return cleanRow.split('&').map((c) => {
      let cell = c.trim();
      cell = cell.replace(/^\s*\|?\s*/, '').replace(/\s*\|?\s*$/, '');
      cell = cell.replace(/___AMP___/g, '&amp;');
      return cell;
    });
  });

  const validRows = rows.filter(r => r.some(cell => cell.length > 0));
  
  if (validRows.length === 0) {
    return '<p><em>[Empty table]</em></p>';
  }

  const maxCols = Math.max(...validRows.map(r => r.length));
  const normalizedRows = validRows.map(r => {
    while (r.length < maxCols) r.push('');
    return r;
  });

  const header = normalizedRows[0];
  const bodyRows = normalizedRows.slice(1);

  const headerStyle = 'border:1px solid #ccc;padding:10px 12px;background:#004d4d;color:white;font-weight:bold;text-align:left;';
  const cellStyle = 'border:1px solid #ccc;padding:10px 12px;text-align:left;vertical-align:top;';

  const headerHtml = '<tr>' + header.map((c) => `<th style="${headerStyle}">${c}</th>`).join('') + '</tr>';
  const bodyHtml = bodyRows
    .map((r, idx) => {
      const rowBg = idx % 2 === 0 ? 'background:#fff;' : 'background:#f9f9f9;';
      return '<tr>' + r.map((c) => `<td style="${cellStyle}${rowBg}">${c}</td>`).join('') + '</tr>';
    })
    .join('');

  return `<table style="border-collapse:collapse;width:100%;margin:1em 0;border:1px solid #ccc;"><thead>${headerHtml}</thead><tbody>${bodyHtml}</tbody></table>`;
}

// Function to convert LaTeX to HTML - preserves all content
function latexToHtml(latex: string): string {
  // Store original for later use
  originalLatexContent = latex;
  
  let html = latex;
  
  // Replace \& with placeholder to avoid confusion with table separator
  html = html.replace(/\\&/g, '___AMP___');
  
  // Remove LaTeX comments
  html = html.replace(/%.*/g, '');
  
  // === PREAMBLE: Convert to a visible header ===
  const preambleMatch = html.match(/^([\s\S]*?)\\begin\{document\}/);
  let preambleHtml = '';
  if (preambleMatch) {
    const preamble = preambleMatch[1];
    // Show preamble as a collapsible/styled block
    const docClass = preamble.match(/\\documentclass(\[[^\]]*\])?\{([^}]*)\}/);
    const packages = preamble.match(/\\usepackage(\[[^\]]*\])?\{[^}]*\}/g) || [];
    
    preambleHtml = `<div style="background:#f0f4f8;border:1px solid #d0d7de;border-radius:6px;padding:12px;margin-bottom:1.5em;font-family:monospace;font-size:12px;">
      <div style="color:#0969da;font-weight:bold;margin-bottom:8px;">📄 Document Setup</div>
      ${docClass ? `<div style="color:#333;">Class: <strong>${docClass[2]}</strong></div>` : ''}
      ${packages.length > 0 ? `<div style="color:#666;font-size:11px;">Packages: ${packages.length} loaded</div>` : ''}
    </div>`;
    
    // Remove preamble from main content
    html = html.replace(/^[\s\S]*?\\begin\{document\}/, '');
  }
  
  // Remove \end{document}
  html = html.replace(/\\end\{document\}[\s\S]*$/, '');
  
  // === TITLEPAGE: Convert to styled block ===
  html = html.replace(/\\begin\{titlepage\}([\s\S]*?)\\end\{titlepage\}/g, (_match, inner) => {
    let content = inner;
    // Clean and extract key info
    content = content.replace(/\\vspace\{[^}]*\}/g, '');
    content = content.replace(/\\vfill/g, '');
    content = content.replace(/\\centering/g, '');
    content = content.replace(/\\noindent/g, '');
    content = content.replace(/\\rule\{[^}]*\}\{[^}]*\}/g, '<hr style="border:none;border-top:2px solid #004d4d;margin:1em 0;">');
    content = content.replace(/\\includegraphics[^}]*\{[^}]*\}/g, '[Logo]');
    content = content.replace(/\\Huge\s*/g, '<span style="font-size:2em;font-weight:bold;">');
    content = content.replace(/\\LARGE\s*/g, '<span style="font-size:1.5em;font-weight:bold;">');
    content = content.replace(/\\Large\s*/g, '<span style="font-size:1.2em;">');
    content = content.replace(/\\large\s*/g, '<span style="font-size:1.1em;">');
    content = content.replace(/\\small\s*/g, '<span style="font-size:0.9em;">');
    content = content.replace(/\\textbf\{([^}]*)\}/g, '<strong>$1</strong>');
    content = content.replace(/\\textit\{([^}]*)\}/g, '<em>$1</em>');
    content = content.replace(/\\\\/g, '<br>');
    content = content.replace(/\{([^{}]*)\}/g, '$1'); // Remove remaining braces
    content = content.replace(/\\[a-zA-Z]+/g, ''); // Remove remaining commands
    
    return `<div style="text-align:center;padding:2em;margin-bottom:2em;border:2px solid #004d4d;border-radius:8px;background:#fafafa;">
      <div style="font-size:0.8em;color:#666;margin-bottom:1em;">📋 TITLE PAGE</div>
      ${content}
    </div>`;
  });
  
  // === SECTIONS ===
  html = html.replace(/\\chapter\*?\{([^}]*)\}/g, '<h1 style="font-size:1.8em;border-bottom:2px solid #004d4d;padding-bottom:0.3em;margin-top:1.5em;">$1</h1>');
  html = html.replace(/\\section\*?\{([^}]*)\}/g, '<h2 style="font-size:1.4em;color:#1a1a2e;border-bottom:1px solid #ddd;padding-bottom:0.2em;margin-top:1.5em;">$1</h2>');
  html = html.replace(/\\subsection\*?\{([^}]*)\}/g, '<h3 style="font-size:1.2em;color:#333;margin-top:1.2em;">$1</h3>');
  html = html.replace(/\\subsubsection\*?\{([^}]*)\}/g, '<h4 style="font-size:1.1em;color:#444;margin-top:1em;">$1</h4>');
  html = html.replace(/\\paragraph\*?\{([^}]*)\}/g, '<h5 style="font-size:1em;font-weight:bold;margin-top:0.8em;">$1</h5>');
  
  // === TEXT FORMATTING ===
  html = html.replace(/\\textbf\{([^}]*)\}/g, '<strong>$1</strong>');
  html = html.replace(/\\textit\{([^}]*)\}/g, '<em>$1</em>');
  html = html.replace(/\\underline\{([^}]*)\}/g, '<u>$1</u>');
  html = html.replace(/\\emph\{([^}]*)\}/g, '<em>$1</em>');
  html = html.replace(/\\texttt\{([^}]*)\}/g, '<code style="background:#f5f5f5;padding:2px 4px;border-radius:3px;">$1</code>');
  
  // === LISTS ===
  html = html.replace(/\\begin\{itemize\}(\[[^\]]*\])?/g, '<ul style="margin:0.5em 0;padding-left:1.5em;">');
  html = html.replace(/\\end\{itemize\}/g, '</ul>');
  html = html.replace(/\\begin\{enumerate\}(\[[^\]]*\])?/g, '<ol style="margin:0.5em 0;padding-left:1.5em;">');
  html = html.replace(/\\end\{enumerate\}/g, '</ol>');
  html = html.replace(/\\item\s*/g, '<li>');
  
  // === MATH ===
  html = html.replace(/\\\[([\s\S]*?)\\\]/g, (_match, expr) => {
    return `<div style="text-align:center;font-family:'Times New Roman',serif;font-style:italic;padding:1em;margin:1em 0;background:#f8f9fa;border-radius:4px;border-left:3px solid #007bff;">${expr.trim()}</div>`;
  });
  html = html.replace(/\\begin\{equation\*?\}([\s\S]*?)\\end\{equation\*?\}/g, (_match, expr) => {
    return `<div style="text-align:center;font-family:'Times New Roman',serif;font-style:italic;padding:1em;margin:1em 0;background:#f8f9fa;border-radius:4px;">${expr.trim()}</div>`;
  });
  html = html.replace(/\\\(([\s\S]*?)\\\)/g, '<span style="font-family:\'Times New Roman\',serif;font-style:italic;background:#f8f9fa;padding:0 4px;border-radius:2px;">$1</span>');
  html = html.replace(/\$([^$]+)\$/g, '<span style="font-family:\'Times New Roman\',serif;font-style:italic;background:#f8f9fa;padding:0 4px;border-radius:2px;">$1</span>');
  
  // === FIGURES ===
  html = html.replace(/\\begin\{figure\}(\[[^\]]*\])?([\s\S]*?)\\end\{figure\}/g, (_match, _opts, inner) => {
    const imgMatch = inner.match(/\\includegraphics(\[[^\]]*\])?\{([^}]*)\}/);
    const captionMatch = inner.match(/\\caption\{([^}]*)\}/);
    
    let result = '<figure style="text-align:center;margin:1.5em 0;padding:1em;background:#fafafa;border:1px solid #e0e0e0;border-radius:4px;">';
    if (imgMatch) {
      result += `<div style="color:#666;">[Image: ${imgMatch[2]}]</div>`;
    } else {
      result += '<div style="color:#999;padding:2em;">[Figure placeholder]</div>';
    }
    if (captionMatch) {
      result += `<figcaption style="margin-top:0.5em;font-style:italic;color:#666;font-size:0.9em;">${captionMatch[1]}</figcaption>`;
    }
    result += '</figure>';
    return result;
  });
  
  // === TABLES ===
  html = html.replace(/\\begin\{tabular\}\{[^}]*\}([\s\S]*?)\\end\{tabular\}/g, (_match, inner) => convertLatexTableToHtml(inner));
  html = html.replace(/\\begin\{longtable\}\{[^}]*\}([\s\S]*?)\\end\{longtable\}/g, (_match, inner) => convertLatexTableToHtml(inner));
  html = html.replace(/\\begin\{table\}(\[[^\]]*\])?/g, '<div style="margin:1em 0;">');
  html = html.replace(/\\end\{table\}/g, '</div>');
  
  // === OTHER ENVIRONMENTS ===
  html = html.replace(/\\begin\{center\}/g, '<div style="text-align:center;">');
  html = html.replace(/\\end\{center\}/g, '</div>');
  html = html.replace(/\\begin\{quote\}/g, '<blockquote style="margin:1em 2em;padding:0.5em 1em;border-left:3px solid #ccc;background:#f9f9f9;">');
  html = html.replace(/\\end\{quote\}/g, '</blockquote>');
  html = html.replace(/\\begin\{verbatim\}([\s\S]*?)\\end\{verbatim\}/g, '<pre style="background:#f5f5f5;padding:1em;overflow-x:auto;border-radius:4px;font-family:monospace;">$1</pre>');
  html = html.replace(/\\begin\{abstract\}/g, '<div style="margin:1em 2em;padding:1em;background:#f0f4f8;border-radius:4px;"><strong>Abstract</strong><br>');
  html = html.replace(/\\end\{abstract\}/g, '</div>');
  
  // === CLEANUP ===
  html = html.replace(/\\centering/g, '');
  html = html.replace(/\\noindent/g, '');
  html = html.replace(/\\maketitle/g, '');
  html = html.replace(/\\tableofcontents/g, '<div style="color:#666;font-style:italic;padding:1em;background:#f9f9f9;border-radius:4px;">[Table of Contents]</div>');
  html = html.replace(/\\listoffigures/g, '<div style="color:#666;font-style:italic;padding:0.5em;">[List of Figures]</div>');
  html = html.replace(/\\listoftables/g, '<div style="color:#666;font-style:italic;padding:0.5em;">[List of Tables]</div>');
  
  // Remove remaining \begin{...} and \end{...}
  html = html.replace(/\\begin\{[^}]*\}(\[[^\]]*\])?(\{[^}]*\})*/g, '');
  html = html.replace(/\\end\{[^}]*\}/g, '');
  
  // Remove remaining commands
  html = html.replace(/\\[a-zA-Z@]+\*?(\[[^\]]*\])?(\{[^{}]*\})*/g, '');
  
  // Line breaks
  html = html.replace(/\\\\/g, '<br>');
  
  // Special characters
  html = html.replace(/___AMP___/g, '&amp;');
  html = html.replace(/---/g, '—');
  html = html.replace(/--/g, '–');
  html = html.replace(/``/g, '"');
  html = html.replace(/''/g, '"');
  html = html.replace(/\\copyright/g, '©');
  
  // Remove remaining backslashes and braces
  html = html.replace(/\\/g, '');
  html = html.replace(/\{([^{}]*)\}/g, '$1');
  html = html.replace(/[{}]/g, '');
  
  // Clean up whitespace
  html = html.replace(/\n\s*\n\s*\n+/g, '</p><p>');
  html = html.replace(/\n\n+/g, '</p><p>');
  html = html.replace(/\n/g, ' ');
  html = html.replace(/\s+/g, ' ');
  html = html.replace(/<p>\s*<\/p>/g, '');
  
  html = html.trim();
  
  return `<div style="font-family: Georgia, 'Times New Roman', serif; line-height: 1.7; color: #333;">${preambleHtml}${html}</div>`;
}

// Extract preamble from original LaTeX for reuse
function extractPreamble(latex: string): string {
  const match = latex.match(/^([\s\S]*?)\\begin\{document\}/);
  if (match) {
    return match[1];
  }
  // Default preamble if none found
  return `\\documentclass{article}
\\usepackage{graphicx}
\\usepackage{longtable}
\\usepackage{booktabs}
\\usepackage{array}
\\usepackage{hyperref}

`;
}

// Function to convert HTML back to LaTeX - properly converts edits
function htmlToLatex(html: string): string {
  let latex = html;
  
  // Remove the Document Setup info box (it's just for display)
  latex = latex.replace(/<div[^>]*>📄 Document Setup[\s\S]*?<\/div>\s*<\/div>/gi, '');
  
  // Remove the Title Page wrapper but keep content
  latex = latex.replace(/<div[^>]*>📋 TITLE PAGE<\/div>/gi, '');
  
  // Remove wrapper divs but keep content
  latex = latex.replace(/<div[^>]*style="[^"]*font-family[^"]*"[^>]*>([\s\S]*)<\/div>$/gi, '$1');
  
  // Convert title page content
  latex = latex.replace(/<div[^>]*style="[^"]*border[^"]*2px solid[^"]*"[^>]*>([\s\S]*?)<\/div>/gi, (_match, inner) => {
    // This is the title page - convert it back
    let titleContent = inner;
    titleContent = titleContent.replace(/<hr[^>]*>/gi, '\\rule{\\textwidth}{0.5pt}');
    titleContent = titleContent.replace(/<span[^>]*font-size:\s*2em[^>]*>([\s\S]*?)<\/span>/gi, '{\\Huge $1}');
    titleContent = titleContent.replace(/<span[^>]*font-size:\s*1\.5em[^>]*>([\s\S]*?)<\/span>/gi, '{\\LARGE $1}');
    titleContent = titleContent.replace(/<span[^>]*font-size:\s*1\.2em[^>]*>([\s\S]*?)<\/span>/gi, '{\\Large $1}');
    return `\\begin{titlepage}
\\centering
${titleContent}
\\end{titlepage}`;
  });
  
  // Convert headings
  latex = latex.replace(/<h1[^>]*>(.*?)<\/h1>/gi, '\n\\section*{$1}\n');
  latex = latex.replace(/<h2[^>]*>(.*?)<\/h2>/gi, '\n\\section{$1}\n');
  latex = latex.replace(/<h3[^>]*>(.*?)<\/h3>/gi, '\n\\subsection{$1}\n');
  latex = latex.replace(/<h4[^>]*>(.*?)<\/h4>/gi, '\n\\subsubsection{$1}\n');
  latex = latex.replace(/<h5[^>]*>(.*?)<\/h5>/gi, '\n\\paragraph{$1}\n');
  
  // Convert text formatting
  latex = latex.replace(/<strong>(.*?)<\/strong>/gi, '\\textbf{$1}');
  latex = latex.replace(/<b>(.*?)<\/b>/gi, '\\textbf{$1}');
  latex = latex.replace(/<em>(.*?)<\/em>/gi, '\\textit{$1}');
  latex = latex.replace(/<i>(.*?)<\/i>/gi, '\\textit{$1}');
  latex = latex.replace(/<u>(.*?)<\/u>/gi, '\\underline{$1}');
  latex = latex.replace(/<code[^>]*>(.*?)<\/code>/gi, '\\texttt{$1}');
  
  // Convert blockquotes
  latex = latex.replace(/<blockquote[^>]*>([\s\S]*?)<\/blockquote>/gi, '\\begin{quote}\n$1\n\\end{quote}');
  
  // Convert lists
  latex = latex.replace(/<ul[^>]*>/gi, '\n\\begin{itemize}\n');
  latex = latex.replace(/<\/ul>/gi, '\\end{itemize}\n');
  latex = latex.replace(/<ol[^>]*>/gi, '\n\\begin{enumerate}\n');
  latex = latex.replace(/<\/ol>/gi, '\\end{enumerate}\n');
  latex = latex.replace(/<li[^>]*>([\s\S]*?)<\/li>/gi, '\\item $1\n');
  
  // Convert figures
  latex = latex.replace(/<figure[^>]*>[\s\S]*?\[Image:\s*([^\]]*)\][\s\S]*?<figcaption[^>]*>([\s\S]*?)<\/figcaption>[\s\S]*?<\/figure>/gi, 
    '\\begin{figure}[h]\n\\centering\n\\includegraphics[width=0.8\\textwidth]{$1}\n\\caption{$2}\n\\end{figure}');
  latex = latex.replace(/<figure[^>]*>[\s\S]*?\[Image:\s*([^\]]*)\][\s\S]*?<\/figure>/gi, 
    '\\begin{figure}[h]\n\\centering\n\\includegraphics[width=0.8\\textwidth]{$1}\n\\end{figure}');
  latex = latex.replace(/<figure[^>]*>[\s\S]*?<\/figure>/gi, '');
  
  // Convert tables
  latex = latex.replace(/<table[^>]*>([\s\S]*?)<\/table>/gi, (_match, inner) => {
    const rows: string[][] = [];
    const rowRegex = /<tr[^>]*>([\s\S]*?)<\/tr>/gi;
    let rowMatch;
    while ((rowMatch = rowRegex.exec(inner)) !== null) {
      const cellsHtml = rowMatch[1];
      const cellRegex = /<t[dh][^>]*>([\s\S]*?)<\/t[dh]>/gi;
      const cells: string[] = [];
      let cellMatch;
      while ((cellMatch = cellRegex.exec(cellsHtml)) !== null) {
        let cellContent = cellMatch[1].replace(/<[^>]*>/g, '').trim();
        // Escape & in cell content
        cellContent = cellContent.replace(/&(?!amp;|lt;|gt;|nbsp;)/g, '\\&');
        cells.push(cellContent);
      }
      if (cells.length > 0) rows.push(cells);
    }
    if (rows.length === 0) return '';
    const colCount = Math.max(...rows.map(r => r.length));
    const colSpec = '|' + 'l|'.repeat(colCount);
    const lines = [`\n\\begin{tabular}{${colSpec}}`, '\\hline'];
    rows.forEach((r) => {
      // Pad row to have correct number of columns
      while (r.length < colCount) r.push('');
      lines.push(r.join(' & ') + ' \\\\');
      lines.push('\\hline');
    });
    lines.push('\\end{tabular}\n');
    return lines.join('\n');
  });
  
  // Convert math blocks
  latex = latex.replace(/<div[^>]*style="[^"]*text-align:\s*center[^"]*border-left:\s*3px solid[^"]*"[^>]*>([\s\S]*?)<\/div>/gi, '\n\\[\n$1\n\\]\n');
  latex = latex.replace(/<div[^>]*style="[^"]*text-align:\s*center[^"]*font-style:\s*italic[^"]*"[^>]*>([\s\S]*?)<\/div>/gi, '\n\\[\n$1\n\\]\n');
  latex = latex.replace(/<span[^>]*style="[^"]*font-style:\s*italic[^"]*background[^"]*"[^>]*>([\s\S]*?)<\/span>/gi, '$$$1$$');
  
  // Convert paragraphs and breaks
  latex = latex.replace(/<p[^>]*>([\s\S]*?)<\/p>/gi, '$1\n\n');
  latex = latex.replace(/<br\s*\/?>/gi, '\\\\\n');
  
  // Convert centered divs
  latex = latex.replace(/<div[^>]*style="[^"]*text-align:\s*center[^"]*"[^>]*>([\s\S]*?)<\/div>/gi, '\\begin{center}\n$1\n\\end{center}');
  
  // Remove remaining divs but keep content
  latex = latex.replace(/<div[^>]*>([\s\S]*?)<\/div>/gi, '$1');
  
  // Remove placeholder text
  latex = latex.replace(/\[Table of Contents\]/gi, '\\tableofcontents');
  latex = latex.replace(/\[List of Figures\]/gi, '\\listoffigures');
  latex = latex.replace(/\[List of Tables\]/gi, '\\listoftables');
  latex = latex.replace(/\[Figure placeholder\]/gi, '');
  latex = latex.replace(/\[Logo\]/gi, '');
  
  // Clean up remaining HTML tags
  latex = latex.replace(/<[^>]*>/g, '');
  
  // Convert HTML entities
  latex = latex.replace(/&amp;/g, '\\&');
  latex = latex.replace(/&lt;/g, '<');
  latex = latex.replace(/&gt;/g, '>');
  latex = latex.replace(/&nbsp;/g, '~');
  latex = latex.replace(/&quot;/g, '"');
  latex = latex.replace(/&#39;/g, "'");
  latex = latex.replace(/©/g, '\\copyright{}');
  latex = latex.replace(/—/g, '---');
  latex = latex.replace(/–/g, '--');
  
  // Clean up extra whitespace
  latex = latex.replace(/\n{3,}/g, '\n\n');
  
  const body = latex.trim();
  
  // Use original preamble if available, otherwise use default
  const preamble = originalLatexContent ? extractPreamble(originalLatexContent) : extractPreamble('');
  
  return `${preamble}\\begin{document}

${body}

\\end{document}`;
}

export default function VisualEditorPane({
  content,
  onChange,
  onEditorReady,
}: VisualEditorPaneProps) {
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
      lastLatexFromEditorRef.current = latex;
      onChange(latex);
    },
    editorProps: {
      attributes: {
        class: 'prose prose-sm max-w-none focus:outline-none text-[14px] leading-relaxed break-words',
      },
    },
  });

  useEffect(() => {
    if (onEditorReady) {
      onEditorReady(editor);
    }
  }, [editor, onEditorReady]);

  useEffect(() => {
    if (editor && content) {
      if (lastLatexFromEditorRef.current === content) {
        return;
      }
      const newHtml = latexToHtml(content);
      editor.commands.setContent(newHtml);
    }
  }, [content, editor]);

  useEffect(() => {
    if (editor && content) {
      const newHtml = latexToHtml(content);
      editor.commands.setContent(newHtml);
    }
  }, [editor]);

  if (!editor) {
    return (
      <div className="flex items-center justify-center h-full bg-gray-50">
        <div className="text-gray-500">Loading visual editor...</div>
      </div>
    );
  }

  return (
    <div className="h-full w-full overflow-auto bg-gray-100">
      <div className="flex justify-center py-8 px-4">
        <div className="bg-white shadow-md border border-gray-200 w-full max-w-[800px] min-h-[1000px] px-8 sm:px-12 md:px-16 py-12">
          <EditorContent editor={editor} />
        </div>
      </div>
    </div>
  );
}

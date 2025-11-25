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
  // First, normalize the content - replace newlines with spaces to handle multi-line cells
  let body = String(inner)
    .replace(/\r\n/g, '\n')
    .replace(/\n+/g, ' ')  // Replace newlines with spaces first
    .replace(/\\toprule/g, '|||ROW_SEP|||')
    .replace(/\\midrule/g, '|||ROW_SEP|||')
    .replace(/\\bottomrule/g, '|||ROW_SEP|||')
    .replace(/\\hline/g, '|||ROW_SEP|||')
    .replace(/\\cline\{[^}]*\}/g, '')
    .replace(/\\endhead/g, '|||ROW_SEP|||')
    .replace(/\\endfirsthead/g, '|||ROW_SEP|||')
    .replace(/\\endfoot/g, '|||ROW_SEP|||')
    .replace(/\\endlastfoot/g, '|||ROW_SEP|||')
    .replace(/\\multicolumn\{(\d+)\}\{[^}]*\}\{([^}]*)\}/g, '$2') // Simplify multicolumn
    .replace(/\\textbf\{([^}]*)\}/g, '<strong>$1</strong>')
    .replace(/\\textit\{([^}]*)\}/g, '<em>$1</em>')
    .trim();

  // Split rows on \\ (the actual LaTeX row separator)
  // First replace \\ with a unique marker, then split
  body = body.replace(/\\\\/g, '|||ROW_SEP|||');
  
  const rawRows = body
    .split('|||ROW_SEP|||')
    .map((r) => r.trim())
    .filter((r) => {
      // Filter out empty rows and rows that are just LaTeX commands
      if (r.length === 0) return false;
      if (r.match(/^\\[a-z]/i)) return false;
      // Must contain at least one & or some actual content
      return r.includes('&') || r.replace(/[^a-zA-Z0-9]/g, '').length > 0;
    });

  if (rawRows.length === 0) {
    return '<p><em>[Empty table]</em></p>';
  }

  const rows: string[][] = rawRows.map((row) => {
    // Clean up the row content
    let cleanRow = row
      .replace(/\\[a-zA-Z]+\{[^}]*\}/g, '') // Remove remaining commands
      .replace(/\\[a-zA-Z]+/g, '') // Remove commands without args
      .trim();
    
    return cleanRow.split('&').map((c) => {
      let cell = c.trim();
      // Clean up cell content
      cell = cell.replace(/^\s*\|?\s*/, '').replace(/\s*\|?\s*$/, '');
      // Convert our ampersand placeholder back
      cell = cell.replace(/___AMP___/g, '&amp;');
      return cell;
    });
  });

  // Filter out rows that are empty or have only empty cells
  const validRows = rows.filter(r => r.some(cell => cell.length > 0));
  
  if (validRows.length === 0) {
    return '<p><em>[Empty table]</em></p>';
  }

  // Find the maximum number of columns
  const maxCols = Math.max(...validRows.map(r => r.length));
  
  // Normalize all rows to have the same number of columns
  const normalizedRows = validRows.map(r => {
    while (r.length < maxCols) r.push('');
    return r;
  });

  const header = normalizedRows[0];
  const bodyRows = normalizedRows.slice(1);

  // Style matching the PDF appearance
  const headerStyle = 'border:1px solid #ccc;padding:10px 12px;background:#004d4d;color:white;font-weight:bold;text-align:left;';
  const cellStyle = 'border:1px solid #ccc;padding:10px 12px;text-align:left;vertical-align:top;';

  const headerHtml =
    '<tr>' + header.map((c) => `<th style="${headerStyle}">${c}</th>`).join('') + '</tr>';
  const bodyHtml = bodyRows
    .map(
      (r, idx) => {
        const rowBg = idx % 2 === 0 ? 'background:#fff;' : 'background:#f9f9f9;';
        return '<tr>' + r.map((c) => `<td style="${cellStyle}${rowBg}">${c}</td>`).join('') + '</tr>';
      }
    )
    .join('');

  return `<table style="border-collapse:collapse;width:100%;margin:1em 0;border:1px solid #ccc;"><thead>${headerHtml}</thead><tbody>${bodyHtml}</tbody></table>`;
}

// Function to convert LaTeX to HTML
function latexToHtml(latex: string): string {
  let html = latex;
  
  // Remove LaTeX comments (everything after % on a line)
  html = html.replace(/%.*/g, '');

  // ============ FIRST: EXTRACT ONLY DOCUMENT BODY ============
  // If there's a \begin{document}...\end{document}, only keep that content
  const docMatch = html.match(/\\begin\{document\}([\s\S]*?)\\end\{document\}/);
  if (docMatch) {
    html = docMatch[1];
  }
  
  // ============ EXTRACT TITLE FROM TITLEPAGE ============
  // Try to extract meaningful content from titlepage before removing it
  let titleHtml = '';
  const titlepageMatch = html.match(/\\begin\{titlepage\}([\s\S]*?)\\end\{titlepage\}/);
  if (titlepageMatch) {
    let titlepageContent = titlepageMatch[1];
    
    // Clean up the content first to make extraction easier
    let cleanedContent = titlepageContent
      .replace(/\\textbf\{([^}]*)\}/g, '$1')
      .replace(/\\textit\{([^}]*)\}/g, '$1')
      .replace(/\\color\{[^}]*\}/g, '')
      .replace(/\\[a-z]+color\{[^}]*\}/gi, '');
    
    // Extract all the key information from the titlepage
    let mainTitle = '';
    let subtitle = '';
    let status = '';
    let version = '';
    let documentNumber = '';
    let copyright = '';
    let classification = '';
    
    // Look for IMDT in the content and extract the full title
    // The title is usually: IMDT CAPACITY MANAGEMENT (on one line) and PROCESS (on next)
    if (cleanedContent.includes('IMDT') && cleanedContent.includes('CAPACITY')) {
      mainTitle = 'IMDT CAPACITY MANAGEMENT';
    } else if (cleanedContent.includes('CAPACITY') && cleanedContent.includes('MANAGEMENT')) {
      mainTitle = 'CAPACITY MANAGEMENT';
    }
    
    // Check for PROCESS as subtitle or part of title
    if (cleanedContent.includes('PROCESS')) {
      if (mainTitle) {
        subtitle = 'PROCESS';
      } else {
        mainTitle = 'PROCESS';
      }
    }
    
    // Look for Status - handle various formats
    const statusPatterns = [
      /Status[:\s]*(Final|Draft|Review|Approved)/i,
      /\bFinal\b/,
      /\bDraft\b/,
    ];
    for (const pattern of statusPatterns) {
      const match = cleanedContent.match(pattern);
      if (match) {
        status = match[1] || match[0];
        break;
      }
    }
    
    // Look for Version
    const versionMatch = cleanedContent.match(/Version[:\s]*(\d+\.?\d*)/i);
    if (versionMatch) {
      version = versionMatch[1].trim();
    }
    
    // Look for Document Number - various formats
    const docNumPatterns = [
      /Document\s*#?\s*:?\s*([A-Z]+-[A-Z]+-[A-Z]+-\d+-[\d.]+)/i,
      /IMDT-ITSM-[A-Z]+-\d+-[\d.]+/i,
      /[A-Z]+-ITSM-[A-Z]+-\d+-[\d.]+/i,
    ];
    for (const pattern of docNumPatterns) {
      const match = cleanedContent.match(pattern);
      if (match) {
        documentNumber = (match[1] || match[0]).trim();
        break;
      }
    }
    
    // Look for Protected/Confidential
    if (cleanedContent.includes('Protected')) {
      classification = 'Protected';
    } else if (cleanedContent.includes('Confidential')) {
      classification = 'Confidential';
    } else if (cleanedContent.includes('Public')) {
      classification = 'Public';
    }
    
    // Look for Copyright - handle the \& for ampersand
    let copyrightText = cleanedContent.replace(/\\&/g, '&').replace(/___AMP___/g, '&');
    const copyrightPatterns = [
      /Copyright\s*(?:\\copyright\s*)?©?\s*(\d{4})\s*(?:by\s*)?([^\\}\n]+)/i,
      /©\s*(\d{4})\s*(?:by\s*)?([^\\}\n]+)/i,
    ];
    for (const pattern of copyrightPatterns) {
      const match = copyrightText.match(pattern);
      if (match) {
        let company = match[2].trim()
          .replace(/\s+/g, ' ')
          .replace(/[{}\\]/g, '')
          .trim();
        copyright = `Copyright © ${match[1]} by ${company}`;
        break;
      }
    }
    
    // If no copyright found but we have CMGL or Coopers
    if (!copyright && (cleanedContent.includes('CMGL') || cleanedContent.includes('Coopers'))) {
      const yearMatch = cleanedContent.match(/20\d{2}/);
      if (yearMatch) {
        copyright = `Copyright © ${yearMatch[0]} by CMGL - Coopers & McGill`;
      }
    }
    
    // Build the title page HTML - centered like the PDF
    // IMPORTANT: Mark with data-display-only so htmlToLatex knows to skip these
    if (mainTitle || documentNumber || status) {
      // Header bar (like the running header in PDF)
      const fullTitle = mainTitle + (subtitle ? ' ' + subtitle : '');
      const headerHtml = `
        <div data-display-only="header" style="display:flex;justify-content:space-between;align-items:center;padding:1em 1.5em;background:#f8f9fa;border-bottom:2px solid #e0e0e0;margin-bottom:2em;font-size:0.85em;gap:3em;">
          <span style="font-weight:bold;color:#1a1a2e;flex-shrink:0;">${fullTitle}</span>
          <span style="color:#333;flex-shrink:0;white-space:nowrap;">
            ${status ? `Status: ${status}` : ''}
            ${status && version ? ' &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp; ' : ''}
            ${version ? `Version: ${version}` : ''}
          </span>
        </div>
      `;
      
      // Main title section (centered)
      const titleSectionHtml = `
        <div data-display-only="titlepage" style="display:flex;flex-direction:column;align-items:center;justify-content:center;text-align:center;margin:0 auto 3em auto;padding:3em 2em;width:100%;">
          ${mainTitle ? `<h1 style="margin:0;font-size:2em;font-weight:bold;color:#1a1a2e;letter-spacing:0.5px;text-align:center;">${mainTitle}</h1>` : ''}
          ${subtitle ? `<h2 style="margin:0.2em 0 0 0;font-size:1.5em;font-weight:bold;color:#1a1a2e;text-align:center;">${subtitle}</h2>` : ''}
          ${status || version ? `<p style="margin:1.5em 0 0 0;font-size:1em;color:#333;text-align:center;">
            ${status ? `Status: ${status}` : ''}
            ${status && version ? ' &nbsp;&nbsp;&nbsp;&nbsp; ' : ''}
            ${version ? `Version: ${version}` : ''}
          </p>` : ''}
          ${documentNumber ? `<p style="margin:1.5em 0 0 0;font-size:0.95em;color:#333;text-align:center;">
            Document # ${documentNumber}${classification ? ` &nbsp;&nbsp;|&nbsp;&nbsp; ${classification}` : ''}
          </p>` : ''}
          ${copyright ? `<p style="margin:1.5em 0 0 0;font-size:0.9em;color:#555;text-align:center;">${copyright}</p>` : ''}
        </div>
      `;
      
      titleHtml = headerHtml + titleSectionHtml;
    }
    
    // Remove the titlepage
    html = html.replace(/\\begin\{titlepage\}[\s\S]*?\\end\{titlepage\}/g, '');
  }

  // ============ STRIP REMAINING PREAMBLE COMMANDS ============
  
  // Remove any remaining document class and usepackage (shouldn't be in body but just in case)
  html = html.replace(/\\documentclass(\[[^\]]*\])?\{[^}]*\}/g, '');
  html = html.replace(/\\usepackage(\[[^\]]*\])?\{[^}]*\}/g, '');
  
  // Remove color commands
  html = html.replace(/\\definecolor\{[^}]*\}\{[^}]*\}\{[^}]*\}/g, '');
  html = html.replace(/\\color\{[^}]*\}/g, '');
  html = html.replace(/\\textcolor\{[^}]*\}\{([^}]*)\}/g, '$1');
  html = html.replace(/\\colorbox\{[^}]*\}\{([^}]*)\}/g, '$1');
  html = html.replace(/\\cellcolor(\[[^\]]*\])?\{[^}]*\}/g, '');
  html = html.replace(/\\rowcolor(\[[^\]]*\])?\{[^}]*\}/g, '');
  
  // Remove page style commands - handle nested braces properly
  html = html.replace(/\\pagestyle\{[^}]*\}/g, '');
  html = html.replace(/\\thispagestyle\{[^}]*\}/g, '');
  // fancypagestyle can have deeply nested content
  html = html.replace(/\\fancypagestyle\{[^}]*\}\s*\{[^{}]*(?:\{[^{}]*(?:\{[^{}]*\}[^{}]*)*\}[^{}]*)*\}/g, '');
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
  
  // Remove newcommand, renewcommand, def with nested braces
  html = html.replace(/\\(new|renew)command\{[^}]*\}(\[\d+\])?(\[[^\]]*\])?\{[^{}]*(?:\{[^{}]*\}[^{}]*)*\}/g, '');
  html = html.replace(/\\def\\[a-zA-Z@]+[^{]*\{[^{}]*(?:\{[^{}]*\}[^{}]*)*\}/g, '');
  
  // Remove font commands
  html = html.replace(/\\(tiny|scriptsize|footnotesize|small|normalsize|large|Large|LARGE|huge|Huge)\b/g, '');
  html = html.replace(/\\(rmfamily|sffamily|ttfamily|bfseries|mdseries|itshape|slshape|scshape|upshape)\b/g, '');
  html = html.replace(/\\fontsize\{[^}]*\}\{[^}]*\}/g, '');
  html = html.replace(/\\selectfont/g, '');
  
  // Remove spacing commands
  html = html.replace(/\\(vspace|hspace|vskip|hskip|quad|qquad|enspace|thinspace)\*?\{[^}]*\}/g, ' ');
  html = html.replace(/\\(vspace|hspace|vskip|hskip|quad|qquad|enspace|thinspace)\*?/g, ' ');
  html = html.replace(/\\(smallskip|medskip|bigskip|newline|linebreak|pagebreak|newpage|clearpage|noindent|indent)/g, '');
  
  // Remove labels and refs
  html = html.replace(/\\label\{[^}]*\}/g, '');
  html = html.replace(/\\ref\{[^}]*\}/g, '[ref]');
  html = html.replace(/\\pageref\{[^}]*\}/g, '[page]');
  html = html.replace(/\\cite\{[^}]*\}/g, '[cite]');
  
  // Remove hyperref commands
  html = html.replace(/\\hypersetup\{[^{}]*(?:\{[^{}]*\}[^{}]*)*\}/g, '');
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
  
  // ============ CONVERT SPECIAL CHARACTERS EARLY ============
  // Convert \& to a placeholder before table processing to avoid confusion with table column separator
  html = html.replace(/\\&/g, '___AMP___');
  
  // ============ CONVERT DOCUMENT STRUCTURE ============
  
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
  
  html = html.replace(/\\begin\{itemize\}(\[[^\]]*\])?/g, '<ul>');
  html = html.replace(/\\end\{itemize\}/g, '</ul>');
  html = html.replace(/\\begin\{enumerate\}(\[[^\]]*\])?/g, '<ol>');
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
  
  // Remove any remaining \begin{...} and \end{...} with their arguments
  html = html.replace(/\\begin\{[^}]*\}(\[[^\]]*\])?(\{[^}]*\})*/g, '');
  html = html.replace(/\\end\{[^}]*\}/g, '');
  
  // Remove any remaining backslash commands that weren't handled
  // This catches things like \somecommand{arg} or \somecommand
  html = html.replace(/\\[a-zA-Z@]+\*?(\[[^\]]*\])?(\{[^{}]*\})*/g, '');
  
  // Clean up line breaks
  html = html.replace(/\\\\/g, '<br/>');
  
  // Clean up special characters
  html = html.replace(/___AMP___/g, '&amp;'); // Convert our placeholder back to &
  html = html.replace(/\\&/g, '&amp;');
  html = html.replace(/\\#/g, '#');
  html = html.replace(/\\%/g, '%');
  html = html.replace(/\\_/g, '_');
  html = html.replace(/\\{/g, '');
  html = html.replace(/\\}/g, '');
  html = html.replace(/\\~/g, '&nbsp;');
  html = html.replace(/~~/g, '&nbsp;');
  html = html.replace(/\\copyright/g, '©');
  html = html.replace(/---/g, '—');
  html = html.replace(/--/g, '–');
  html = html.replace(/``/g, '"');
  html = html.replace(/''/g, '"');
  
  // Remove remaining backslashes
  html = html.replace(/\\/g, '');
  
  // Remove table column specifications like |p5cm|p9cm| or |l|l|c| or p{5cm}
  html = html.replace(/[plcrm]\{\d*\.?\d*(?:cm|em|in|pt|mm|\\[a-z]+)?\}/gi, '');
  html = html.replace(/[plcrm]\d*\.?\d*(?:cm|em|in|pt|mm)/gi, '');
  html = html.replace(/\|?[plcrm]\d*\.?\d*(?:cm|em|in|pt|mm)?\|/gi, '');
  html = html.replace(/\|[|plcrm\d.cmeминpt\s]+\|/gi, '');
  
  // Remove [Xex] patterns (spacing like [1ex], [3ex], etc.)
  html = html.replace(/\[\d*\.?\d*ex\]/g, '');
  html = html.replace(/\[\d*\.?\d*(?:cm|em|in|pt|mm)\]/gi, '');
  // Remove [X] patterns that are options
  html = html.replace(/\[[a-zA-Z0-9.,!\s]*\]/g, '');
  
  // Remove multiple consecutive braces
  html = html.replace(/\}{2,}/g, '');
  html = html.replace(/\{{2,}/g, '');
  
  // Remove empty or nearly empty brace pairs
  html = html.replace(/\{\s*\}/g, '');
  
  // Remove orphaned braces - be aggressive
  html = html.replace(/^\s*\}\s*/gm, '');
  html = html.replace(/\s*\{\s*$/gm, '');
  html = html.replace(/\s+\}\s+/g, ' ');
  html = html.replace(/\s+\{\s+/g, ' ');
  html = html.replace(/^\s*\{\s*/gm, '');
  
  // Remove standalone braces at word boundaries
  html = html.replace(/\s+\}/g, ' ');
  html = html.replace(/\{\s+/g, ' ');
  html = html.replace(/\}+/g, '');
  html = html.replace(/\{+/g, '');
  
  // Remove pipe characters that are table artifacts
  html = html.replace(/\s*\|\s*/g, ' ');
  
  // Clean up multiple spaces and newlines
  html = html.replace(/\n\s*\n\s*\n+/g, '</p><p>');
  html = html.replace(/\n\n+/g, '</p><p>');
  html = html.replace(/\n/g, ' ');
  html = html.replace(/\s+/g, ' ');
  
  // Remove empty paragraphs
  html = html.replace(/<p>\s*<\/p>/g, '');
  
  // Final cleanup - trim whitespace
  html = html.trim();
  
  // Wrap in container with title at the top
  return `<div style="font-family: Georgia, 'Times New Roman', serif; line-height: 1.6;">${titleHtml}${html}</div>`;
}

// Function to convert HTML back to LaTeX (simplified version)
// Takes optional original preamble and titlepage to preserve document structure
function htmlToLatex(
  html: string, 
  originalParts?: { preamble: string; titlepage: string } | null
): string {
  let latex = html;
  
  // ============ FIRST: Remove display-only sections ============
  // These are header and title sections we generate for visual display only
  // They should NOT be converted back to LaTeX
  
  // Remove elements with data-display-only attribute and all their contents
  latex = latex.replace(/<div[^>]*data-display-only="[^"]*"[^>]*>[\s\S]*?<\/div>/gi, '');
  
  // Also remove by pattern - header bar with flex display
  latex = latex.replace(/<div[^>]*style="[^"]*display:\s*flex[^"]*justify-content:\s*space-between[^"]*"[^>]*>[\s\S]*?<\/div>/gi, '');
  
  // Remove title section with flex-direction:column
  latex = latex.replace(/<div[^>]*style="[^"]*display:\s*flex[^"]*flex-direction:\s*column[^"]*"[^>]*>[\s\S]*?<\/div>/gi, '');
  
  // Remove wrapper div (but keep content)
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
          let cellText = cellMatch[1].replace(/<[^>]*>/g, '').trim();
          // Escape special LaTeX characters in table cells
          cellText = cellText
            .replace(/&amp;/g, '\\&')
            .replace(/&/g, '\\&')
            .replace(/#/g, '\\#')
            .replace(/%/g, '\\%')
            .replace(/_/g, '\\_');
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

  // Decode common HTML entities - but escape them for LaTeX
  latex = latex
    .replace(/&amp;/g, '\\&')  // & must be escaped in LaTeX
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&nbsp;/g, '~')   // Non-breaking space in LaTeX
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/©/g, '\\copyright{}');  // Copyright symbol
  
  // Escape special LaTeX characters that aren't already escaped
  // Must escape: # $ % & _ { } ~ ^ \
  latex = latex.replace(/(?<!\\)#/g, '\\#');  // Escape # if not already escaped
  latex = latex.replace(/(?<!\\)%/g, '\\%');  // Escape % if not already escaped
  latex = latex.replace(/(?<!\\)&(?!amp;)/g, '\\&');  // Escape & if not already escaped
  latex = latex.replace(/(?<!\\)_/g, '\\_');  // Escape _ if not already escaped

  const body = latex.trim();

  // If we have original preamble and titlepage, use them to preserve document structure
  if (originalParts && originalParts.preamble) {
    return `${originalParts.preamble}\\begin{document}
${originalParts.titlepage}

${body}

\\end{document}`;
  }

  // Fallback: Wrap the visual-editor body back into a basic compilable LaTeX document
  return `\\documentclass{article}
\\usepackage{graphicx}
\\usepackage{longtable}
\\usepackage{booktabs}

\\begin{document}
${body}

\\end{document}`;
}

// Helper to extract preamble and titlepage from original LaTeX
function extractLatexParts(latex: string): { preamble: string; titlepage: string; body: string } {
  let preamble = '';
  let titlepage = '';
  let body = latex;
  
  // Extract everything before \begin{document}
  const docStartMatch = latex.match(/([\s\S]*?)\\begin\{document\}/);
  if (docStartMatch) {
    preamble = docStartMatch[1];
    body = latex.substring(docStartMatch[0].length);
  }
  
  // Extract titlepage if present
  const titlepageMatch = body.match(/\\begin\{titlepage\}[\s\S]*?\\end\{titlepage\}/);
  if (titlepageMatch) {
    titlepage = titlepageMatch[0];
    body = body.replace(titlepageMatch[0], '');
  }
  
  // Remove \end{document}
  body = body.replace(/\\end\{document\}[\s\S]*$/, '').trim();
  
  return { preamble, titlepage, body };
}

export default function VisualEditorPane({
  content,
  onChange,
  onEditorReady,
}: VisualEditorPaneProps) {
  // Track last content we received from parent to detect external changes
  const lastExternalContentRef = useRef<string>(content);
  
  // Track if we're currently making an internal update (to avoid loops)
  const isInternalUpdateRef = useRef<boolean>(false);
  
  // Store the original preamble and titlepage so we can preserve them
  const originalPartsRef = useRef<{ preamble: string; titlepage: string } | null>(null);

  // Extract and store original parts on initial content
  if (!originalPartsRef.current && content) {
    const parts = extractLatexParts(content);
    if (parts.preamble || parts.titlepage) {
      originalPartsRef.current = { preamble: parts.preamble, titlepage: parts.titlepage };
    }
  }
  
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
      // Skip if this update was triggered by external content sync
      if (isInternalUpdateRef.current) {
        return;
      }
      
      const html = editor.getHTML();
      // Pass the original parts to preserve document structure
      const latex = htmlToLatex(html, originalPartsRef.current);
      
      // Update the last external content to match what we're sending
      lastExternalContentRef.current = latex;
      onChange(latex);
    },
    editorProps: {
      attributes: {
        // Use smaller, consistent typography so the visual editor
        // feels closer to an actual LaTeX page rather than huge UI text.
        class:
          'prose prose-sm max-w-none focus:outline-none text-[14px] leading-relaxed break-words',
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
      // Check if content actually changed from external source
      // Compare by normalizing whitespace to avoid false positives
      const normalizedNew = content.replace(/\s+/g, ' ').trim();
      const normalizedLast = lastExternalContentRef.current.replace(/\s+/g, ' ').trim();
      
      if (normalizedNew === normalizedLast) {
        return;
      }

      // Update original parts when content changes from code editor
      const parts = extractLatexParts(content);
      if (parts.preamble || parts.titlepage) {
        originalPartsRef.current = { preamble: parts.preamble, titlepage: parts.titlepage };
      }

      const newHtml = latexToHtml(content);
      
      // Mark as internal update to prevent onUpdate from firing
      isInternalUpdateRef.current = true;
      editor.commands.setContent(newHtml);
      // Reset the flag after a short delay to allow the update to complete
      setTimeout(() => {
        isInternalUpdateRef.current = false;
      }, 0);
      
      // Update our tracking ref
      lastExternalContentRef.current = content;
    }
  }, [content, editor]);

  // Force refresh when editor is first ready
  useEffect(() => {
    if (editor && content) {
      const newHtml = latexToHtml(content);
      isInternalUpdateRef.current = true;
      editor.commands.setContent(newHtml);
      setTimeout(() => {
        isInternalUpdateRef.current = false;
      }, 0);
      lastExternalContentRef.current = content;
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
      <div className="flex justify-center py-8 px-4">
        <div className="bg-white shadow-md border border-gray-200 w-full max-w-[800px] min-h-[1000px] px-8 sm:px-12 md:px-16 py-12">
          <EditorContent editor={editor} />
        </div>
      </div>
    </div>
  );
}

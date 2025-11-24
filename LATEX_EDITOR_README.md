# LaTeX Editor - Overleaf-like Experience

This project includes a professional LaTeX editor with features similar to Overleaf, including:

- **Code Editor**: Powered by CodeMirror 6 with syntax highlighting
- **Visual Editor**: WYSIWYG editing with TipTap (converts LaTeX ↔ HTML)
- **Real-time PDF Preview**: Live compilation and preview
- **File Management**: Multi-file projects with file tree
- **Docker Compilation**: Isolated and reliable LaTeX compilation

## Features

### 1. Dual Editor Modes
- **Code Editor**: Write LaTeX code directly with syntax highlighting
- **Visual Editor**: Edit content visually, automatically converts to/from LaTeX

### 2. Shared Toolbar
- Toggle between Code and Visual modes
- Formatting tools (Bold, Italic, Underline, Math, Tables, etc.)
- Recompile button with loading state
- Page navigation and zoom controls
- Compilation log viewer

### 3. File Management
- Create multiple `.tex` files in a project
- File tree with context menu (rename, delete)
- Support for `\input{}` and `\include{}` directives

### 4. PDF Preview
- Real-time PDF rendering
- Page navigation
- Zoom controls
- Fullscreen support

## Installation & Setup

### Prerequisites

You need **one** of the following for LaTeX compilation:

#### Option 1: Docker (Recommended)
Docker provides isolated, consistent compilation across all environments.

**Install Docker:**
- macOS: [Docker Desktop for Mac](https://docs.docker.com/desktop/install/mac-install/)
- Windows: [Docker Desktop for Windows](https://docs.docker.com/desktop/install/windows-install/)
- Linux: [Docker Engine](https://docs.docker.com/engine/install/)

**Pull the TeX Live image:**
```bash
docker pull texlive/texlive:latest
```

**Or build custom image:**
```bash
docker build -t latex-compiler -f Dockerfile.latex .
```

**Test Docker compilation:**
```bash
echo '\documentclass{article}\begin{document}Hello World\end{document}' > test.tex
docker run --rm -v $(pwd):/workspace texlive/texlive:latest pdflatex test.tex
```

#### Option 2: Local TeX Live Installation
If you prefer not to use Docker, install TeX Live locally:

- **macOS**: Install MacTeX from [tug.org/mactex](https://tug.org/mactex/)
- **Windows**: Install MiKTeX from [miktex.org](https://miktex.org/)
- **Linux**: 
  ```bash
  sudo apt-get install texlive-full  # Ubuntu/Debian
  sudo dnf install texlive-scheme-full  # Fedora
  ```

**Verify installation:**
```bash
pdflatex --version
```

### Dependencies Installation

The required npm packages are already installed:

```json
{
  "@codemirror/state": "^6.4.1",
  "@codemirror/view": "^6.26.3",
  "@uiw/react-codemirror": "^4.21.25",
  "@react-pdf-viewer/core": "^3.12.0",
  "@react-pdf-viewer/default-layout": "^3.12.0",
  "@tiptap/react": "^3.0.7",
  "@tiptap/starter-kit": "^3.0.7",
  "yjs": "^13.6.14",
  "y-websocket": "^1.5.4"
}
```

## Usage

### 1. Access the LaTeX Editor
Navigate to the LaTeX Editor from the side menu in the application.

### 2. Writing LaTeX
You can write LaTeX in two modes:

**Code Editor Mode:**
```latex
\documentclass{article}
\usepackage{amsmath}

\title{My Document}
\author{Your Name}
\date{\today}

\begin{document}
\maketitle

\section{Introduction}
This is a sample document.

\[
E = mc^2
\]

\end{document}
```

**Visual Editor Mode:**
- Switch to Visual Editor tab
- Use the toolbar to format text
- Math equations are displayed as `[Math: ...]`
- Changes sync automatically with Code Editor

### 3. Compilation
- **Auto-compile**: The editor automatically compiles after 2 seconds of inactivity
- **Manual compile**: Click the "Recompile" button in the toolbar
- **View log**: Click the log icon to see compilation output

### 4. Multi-file Projects
- Click the `+` button in the file tree to create new files
- Reference files using `\input{filename}` or `\include{filename}`
- Switch between files by clicking them in the tree

## API Endpoints

### POST `/api/latex/compile`
Compiles LaTeX code to PDF.

**Request:**
```json
{
  "latex": "\\documentclass{article}...",
  "mainFile": "main.tex",
  "files": {
    "chapter1.tex": "\\chapter{One}...",
    "chapter2.tex": "\\chapter{Two}..."
  }
}
```

**Response (Success):**
```json
{
  "success": true,
  "pdf": "data:application/pdf;base64,...",
  "log": "Compilation output..."
}
```

**Response (Error):**
```json
{
  "success": false,
  "error": "LaTeX compilation failed",
  "log": "Error details..."
}
```

### GET `/api/latex/compile`
Health check endpoint to verify compiler availability.

**Response:**
```json
{
  "status": "ok",
  "compiler": "docker",
  "message": "Docker is available for LaTeX compilation"
}
```

## Architecture

### Component Structure

```
app/components/LatexEditor/
├── LatexEditorContainer.tsx    # Main container with state management
├── SharedToolbar.tsx            # Shared toolbar for both modes
├── CodeEditorPane.tsx           # Code editor with CodeMirror 6
├── VisualEditorPane.tsx         # Visual editor with TipTap
├── PdfPreviewPane.tsx           # PDF viewer with react-pdf-viewer
└── FileTreeSidebar.tsx          # File management sidebar
```

### Technology Stack

| Component | Technology |
|-----------|-----------|
| Code Editor | CodeMirror 6 with `@uiw/react-codemirror` |
| Visual Editor | TipTap (ProseMirror-based) |
| PDF Viewer | `@react-pdf-viewer/core` |
| LaTeX → HTML | Custom converter (simplified) |
| HTML → LaTeX | Custom converter (simplified) |
| Compilation | Docker with TeX Live or local pdflatex |
| Collaboration | Yjs (ready for real-time features) |

## Docker Compilation Details

The compilation API uses Docker with the following workflow:

1. **Create temp directory** with unique ID
2. **Write LaTeX files** to temp directory
3. **Run Docker container**:
   ```bash
   docker run --rm \
     -v "/tmp/latex-uuid:/workspace" \
     texlive/texlive:latest \
     pdflatex -interaction=nonstopmode main.tex
   ```
4. **Read generated PDF** and convert to base64
5. **Cleanup** temp directory

### Fallback Compilation

If Docker is not available, the API falls back to local `pdflatex` if installed.

## Troubleshooting

### "LaTeX compiler not found"
Install Docker or TeX Live (see Prerequisites above).

### Docker permission issues (Linux)
Add your user to the docker group:
```bash
sudo usermod -aG docker $USER
newgrp docker
```

### Compilation timeout
Increase timeout in `app/api/latex/compile/route.ts`:
```typescript
timeout: 60000, // Increase from 60 to 120 seconds
```

### Missing LaTeX packages
If using local TeX Live, install missing packages:
```bash
tlmgr install <package-name>
```

With Docker, packages are included in the `texlive/texlive:latest` image.

## Future Enhancements

- [ ] Real-time collaboration with Yjs
- [ ] LaTeX language server integration (TexLab)
- [ ] Advanced LaTeX → HTML conversion
- [ ] Project templates
- [ ] Git integration
- [ ] BibTeX support
- [ ] Image upload and management
- [ ] Custom PDF viewer with annotations
- [ ] Export to multiple formats (Word, HTML)

## References

- [CodeMirror 6](https://codemirror.net/)
- [TipTap](https://tiptap.dev/)
- [react-pdf-viewer](https://react-pdf-viewer.dev/)
- [TeX Live](https://www.tug.org/texlive/)
- [Docker](https://www.docker.com/)
- [Yjs](https://yjs.dev/)

## License

This LaTeX editor is part of the Text-to-BPMN project and follows the same license.



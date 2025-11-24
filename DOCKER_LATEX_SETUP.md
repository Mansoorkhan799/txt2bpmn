# Docker Setup for LaTeX Compilation

This guide helps you set up Docker for LaTeX compilation in the editor.

## Quick Start

### Step 1: Install Docker

#### macOS
1. Download [Docker Desktop for Mac](https://docs.docker.com/desktop/install/mac-install/)
2. Install the `.dmg` file
3. Open Docker Desktop
4. Verify installation:
   ```bash
   docker --version
   ```

#### Windows
1. Download [Docker Desktop for Windows](https://docs.docker.com/desktop/install/windows-install/)
2. Install the `.exe` file
3. Enable WSL2 if prompted
4. Open Docker Desktop
5. Verify installation:
   ```powershell
   docker --version
   ```

#### Linux (Ubuntu/Debian)
```bash
# Update package index
sudo apt-get update

# Install prerequisites
sudo apt-get install -y \
    ca-certificates \
    curl \
    gnupg \
    lsb-release

# Add Docker's official GPG key
sudo mkdir -p /etc/apt/keyrings
curl -fsSL https://download.docker.com/linux/ubuntu/gpg | sudo gpg --dearmor -o /etc/apt/keyrings/docker.gpg

# Set up repository
echo \
  "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.gpg] https://download.docker.com/linux/ubuntu \
  $(lsb_release -cs) stable" | sudo tee /etc/apt/sources.list.d/docker.list > /dev/null

# Install Docker Engine
sudo apt-get update
sudo apt-get install -y docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin

# Verify installation
docker --version

# Add your user to docker group (to run without sudo)
sudo usermod -aG docker $USER
newgrp docker
```

### Step 2: Pull TeX Live Image

```bash
# Pull the official TeX Live Docker image
docker pull texlive/texlive:latest

# This is a large image (~5GB), so it may take several minutes
```

### Step 3: Test LaTeX Compilation

Create a test file:

```bash
cat > test.tex << 'EOF'
\documentclass{article}
\usepackage{amsmath}

\title{Docker LaTeX Test}
\author{Test User}
\date{\today}

\begin{document}
\maketitle

\section{Test Section}
This is a test document.

\[
E = mc^2
\]

\end{document}
EOF
```

Compile with Docker:

```bash
docker run --rm -v $(pwd):/workspace -w /workspace texlive/texlive:latest pdflatex test.tex
```

If successful, you should see `test.pdf` in your current directory.

### Step 4: Start Your Next.js Application

```bash
npm run dev
```

Navigate to the LaTeX Editor in the application and try compiling a document!

## Alternative: Build Custom Docker Image

If you want to customize the LaTeX environment:

```bash
# Build the custom image from Dockerfile.latex
docker build -t my-latex-compiler -f Dockerfile.latex .

# Update the API to use your custom image
# Edit app/api/latex/compile/route.ts and change:
# texlive/texlive:latest → my-latex-compiler
```

## Troubleshooting

### Issue: "docker: command not found"
**Solution**: Docker is not installed or not in PATH. Follow Step 1 above.

### Issue: "permission denied while trying to connect to the Docker daemon"
**Solution (Linux)**: Add your user to the docker group:
```bash
sudo usermod -aG docker $USER
newgrp docker
```

### Issue: "Cannot connect to the Docker daemon"
**Solution**: Make sure Docker Desktop is running (macOS/Windows) or Docker daemon is started (Linux):
```bash
# Linux
sudo systemctl start docker
sudo systemctl enable docker
```

### Issue: Compilation is slow
**Solution**: Docker needs to download the image on first use. Subsequent compilations will be faster.

### Issue: "Unable to find image 'texlive/texlive:latest'"
**Solution**: Pull the image manually:
```bash
docker pull texlive/texlive:latest
```

## Using Local pdflatex Instead of Docker

If you prefer not to use Docker, you can install TeX Live locally:

### macOS
```bash
# Install via Homebrew
brew install --cask mactex

# Or download from https://tug.org/mactex/
```

### Windows
1. Download MiKTeX from https://miktex.org/
2. Run the installer
3. MiKTeX will auto-install missing packages on first use

### Linux
```bash
# Ubuntu/Debian
sudo apt-get install texlive-full

# Fedora
sudo dnf install texlive-scheme-full

# Arch Linux
sudo pacman -S texlive-core texlive-latexextra texlive-fontsextra
```

### Verify Local Installation
```bash
pdflatex --version
```

The API will automatically fall back to local `pdflatex` if Docker is not available.

## Performance Comparison

| Method | First Compile | Subsequent Compiles | Isolation | Setup Complexity |
|--------|--------------|---------------------|-----------|------------------|
| Docker | ~5-10s | ~2-5s | ✅ Isolated | Medium |
| Local TeX Live | ~2-5s | ~1-2s | ❌ System-wide | Easy |

**Recommendation**: Use Docker for production environments and local TeX Live for development.

## Docker Resource Limits

Docker Desktop allows you to configure resource limits:

1. Open Docker Desktop Settings
2. Go to Resources
3. Adjust:
   - **CPUs**: 2-4 cores recommended
   - **Memory**: 4-8 GB recommended
   - **Disk**: 20 GB minimum (for TeX Live image)

## Security Considerations

Docker provides security isolation:
- LaTeX compilation runs in a container
- No access to host system files (except mounted workspace)
- Automatic cleanup of temporary files
- No persistent state between compilations

## Additional Resources

- [Docker Documentation](https://docs.docker.com/)
- [TeX Live Docker Hub](https://hub.docker.com/r/texlive/texlive)
- [LaTeX Project](https://www.latex-project.org/)
- [Overleaf Documentation](https://www.overleaf.com/learn)

---

**Questions or Issues?**

If you encounter any problems with Docker setup:
1. Check Docker is running: `docker ps`
2. Check Docker version: `docker --version`
3. Test with simple command: `docker run hello-world`
4. Check API health: `GET http://localhost:3000/api/latex/compile`



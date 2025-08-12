# Deployment Guide for PDF Processing API

## 🚀 Production Deployment Options

### Option 1: Docker Deployment (Recommended)

Create a `Dockerfile` that includes all system dependencies:

```dockerfile
FROM node:18-alpine

# Install system dependencies for PDF-to-image conversion
RUN apk add --no-cache \
    graphicsmagick \
    ghostscript \
    poppler-utils

# Set working directory
WORKDIR /app

# Copy package files
COPY package*.json ./

# Install Node.js dependencies
RUN npm ci --only=production

# Copy application code
COPY . .

# Build the application
RUN npm run build

# Expose port
EXPOSE 3000

# Start the application
CMD ["npm", "run", "start:prod"]
```

### Option 2: Cloud Platform Deployment

#### Heroku

Add buildpacks for system dependencies:

```bash
heroku buildpacks:add --index 1 https://github.com/ello/heroku-buildpack-imagemagick
heroku buildpacks:add --index 2 heroku/nodejs
```

#### Railway/Render

Add a `nixpacks.toml` file:

```toml
[phases.setup]
nixPkgs = ['nodejs', 'graphicsmagick', 'ghostscript']
```

#### AWS/GCP/Azure

Use container deployment with the Docker approach above.

### Option 3: Environment Variables

Add these environment variables to control PDF processing:

```bash
# Enable/disable PDF-to-image conversion
PDF_CONVERSION_ENABLED=true

# Fallback behavior when dependencies are missing
PDF_FALLBACK_MODE=graceful

# System dependency paths (if custom installation)
GRAPHICSMAGICK_PATH=/usr/bin/gm
IMAGEMAGICK_PATH=/usr/bin/convert
```

## 🔧 Development vs Production

### Development (Current)

- Manual dependency installation
- Local system dependencies
- Direct file system access

### Production (Recommended)

- Containerized deployment
- System dependencies in container
- Environment-based configuration
- Graceful fallback when dependencies unavailable

## 📦 Required NPM Packages

Already installed:

- `pdf2pic` - PDF to image conversion
- `tesseract.js` - OCR processing
- `pdf-parse` - Direct PDF text extraction

## 🎯 Deployment Strategy

1. **Use Docker** for consistent environment
2. **Include system dependencies** in container
3. **Environment variables** for configuration
4. **Graceful fallback** when dependencies missing
5. **Health checks** to verify all components working

This approach ensures your API works consistently across development and production environments without manual dependency installation.

# PDF-to-Image Dependencies Installation

## Windows Installation

### Option 1: Using Chocolatey (Recommended)

```bash
# Install Chocolatey if not already installed
# Then install GraphicsMagick:
choco install graphicsmagick

# Or install ImageMagick:
choco install imagemagick
```

### Option 2: Manual Installation

1. **GraphicsMagick**: Download from http://www.graphicsmagick.org/download.html
2. **ImageMagick**: Download from https://imagemagick.org/script/download.php#windows

### Verify Installation

```bash
# Test GraphicsMagick
gm version

# Or test ImageMagick
magick -version
```

## Quick Test

After installation, restart your development server and try uploading a scanned PDF.

## Troubleshooting

- Make sure to restart your terminal/command prompt after installation
- Add the installation directory to your PATH environment variable if needed
- On Windows, the default installation paths are usually:
  - GraphicsMagick: `C:\Program Files\GraphicsMagick-1.3.x\`
  - ImageMagick: `C:\Program Files\ImageMagick-7.x.x\`

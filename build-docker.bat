@echo off
echo 🐳 Building Docker container for PDF Processing API...
echo.

echo Checking Docker installation...
docker --version
if %errorlevel% neq 0 (
    echo ❌ Docker is not installed or not running
    echo Please install Docker Desktop from: https://www.docker.com/products/docker-desktop
    pause
    exit /b 1
)

echo.
echo ✅ Docker is available
echo.

echo 🔨 Building Docker image...
docker build -t document-processing-api .

if %errorlevel% neq 0 (
    echo ❌ Docker build failed
    pause
    exit /b 1
)

echo.
echo ✅ Docker image built successfully
echo.

echo 🚀 Starting container...
docker run -d -p 3000:3000 --name pdf-api document-processing-api

if %errorlevel% neq 0 (
    echo ❌ Failed to start container
    pause
    exit /b 1
)

echo.
echo 🎉 Container started successfully!
echo 📡 API is running at: http://localhost:3000
echo 🔍 Check logs with: docker logs pdf-api
echo 🛑 Stop with: docker stop pdf-api
echo.
pause
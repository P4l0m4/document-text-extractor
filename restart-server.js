const { exec } = require('child_process');
const fs = require('fs');
const path = require('path');

console.log('🔄 Forcing server restart...');

// Kill any existing Node processes running the server
exec('taskkill /f /im node.exe', (error) => {
  if (error) {
    console.log('No existing Node processes found (this is normal)');
  }

  // Clean the dist folder
  const distPath = path.join(__dirname, 'dist');
  if (fs.existsSync(distPath)) {
    console.log('🧹 Cleaning dist folder...');
    fs.rmSync(distPath, { recursive: true, force: true });
  }

  // Build the project
  console.log('🔨 Building project...');
  exec('npm run build', (buildError, stdout, stderr) => {
    if (buildError) {
      console.error('Build failed:', buildError);
      return;
    }

    console.log('✅ Build completed');
    console.log('🚀 Starting server...');

    // Start the server
    const serverProcess = exec(
      'npm run start:dev',
      (startError, startStdout, startStderr) => {
        if (startError) {
          console.error('Server start failed:', startError);
          return;
        }
      },
    );

    // Pipe server output
    serverProcess.stdout.on('data', (data) => {
      console.log(data.toString());
    });

    serverProcess.stderr.on('data', (data) => {
      console.error(data.toString());
    });
  });
});

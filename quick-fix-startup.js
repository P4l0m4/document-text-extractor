console.log('🔄 Quick Fix: Restarting server with clean code...');

// Kill any existing processes
require('child_process').exec('taskkill /f /im node.exe', () => {
  console.log('✅ Killed existing processes');

  // Clean build
  require('child_process').exec('rmdir /s /q dist', () => {
    console.log('✅ Cleaned dist folder');

    // Start fresh
    console.log('🚀 Starting server...');
    require('child_process').spawn('npm', ['run', 'start:dev'], {
      stdio: 'inherit',
      shell: true,
    });
  });
});

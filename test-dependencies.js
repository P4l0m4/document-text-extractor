const { exec } = require('child_process');

console.log('🔍 Testing PDF-to-image dependencies...\n');

// Test GraphicsMagick
exec('gm version', (error, stdout, stderr) => {
  if (error) {
    console.log('❌ GraphicsMagick: Not installed');
    console.log(
      '   Install from: http://www.graphicsmagick.org/download.html\n',
    );
  } else {
    console.log('✅ GraphicsMagick: Available');
    console.log(`   Version: ${stdout.split('\n')[0]}\n`);
  }

  // Test ImageMagick
  exec('magick -version', (error2, stdout2, stderr2) => {
    if (error2) {
      console.log('❌ ImageMagick: Not installed');
      console.log(
        '   Install from: https://imagemagick.org/script/download.php#windows\n',
      );
    } else {
      console.log('✅ ImageMagick: Available');
      console.log(`   Version: ${stdout2.split('\n')[0]}\n`);
    }

    // Test pdf2pic
    try {
      require('pdf2pic');
      console.log('✅ pdf2pic: Available\n');
    } catch (e) {
      console.log('❌ pdf2pic: Not installed');
      console.log('   Run: npm install pdf2pic --legacy-peer-deps\n');
    }

    console.log('📋 Summary:');
    if (!error || !error2) {
      console.log('🎉 PDF-to-image conversion should work!');
      console.log('   Restart your server and test with a scanned PDF.');
    } else {
      console.log(
        '⚠️  Install GraphicsMagick or ImageMagick to enable PDF-to-image conversion.',
      );
      console.log(
        '   Your OCR pipeline works great - just need the system dependency!',
      );
    }
  });
});

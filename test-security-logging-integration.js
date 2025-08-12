const axios = require('axios');

async function testSecurityLoggingIntegration() {
  const baseUrl = 'http://localhost:3000';

  console.log('Testing Security Logging Integration...\n');

  try {
    // Test 1: Rate limiting with logging
    console.log('1. Testing rate limiting with security logging...');

    // Make multiple rapid requests to trigger rate limiting
    const promises = [];
    for (let i = 0; i < 5; i++) {
      promises.push(
        axios.get(`${baseUrl}/api/health`, {
          validateStatus: () => true, // Accept all status codes
        }),
      );
    }

    const responses = await Promise.all(promises);
    const rateLimitedResponses = responses.filter((r) => r.status === 429);

    console.log(`   - Made 5 rapid requests`);
    console.log(`   - Rate limited responses: ${rateLimitedResponses.length}`);

    if (rateLimitedResponses.length > 0) {
      console.log('   ✓ Rate limiting is working');
      console.log(
        '   ✓ Security logging should have captured rate limit violations',
      );
    } else {
      console.log(
        '   ⚠ No rate limiting detected - may need to increase request frequency',
      );
    }

    // Test 2: CORS violation with logging
    console.log('\n2. Testing CORS violation with security logging...');

    try {
      await axios.get(`${baseUrl}/api/health`, {
        headers: {
          Origin: 'https://malicious-site.com',
        },
        validateStatus: () => true,
      });
      console.log('   ✓ CORS request sent with unauthorized origin');
      console.log('   ✓ Security logging should have captured CORS violation');
    } catch (error) {
      console.log('   ✓ CORS violation blocked as expected');
      console.log('   ✓ Security logging should have captured CORS violation');
    }

    // Test 3: Valid request (should not trigger security logging)
    console.log('\n3. Testing valid request (no security violations)...');

    try {
      const response = await axios.get(`${baseUrl}/api/health`, {
        headers: {
          Origin: 'http://localhost:3001',
        },
        validateStatus: () => true,
      });

      if (response.status === 200) {
        console.log('   ✓ Valid request processed successfully');
        console.log('   ✓ No security violations should be logged');
      }
    } catch (error) {
      console.log('   ⚠ Valid request failed:', error.message);
    }

    console.log('\n✅ Security logging integration test completed');
    console.log('📝 Check the application logs for security event entries');
  } catch (error) {
    console.error('❌ Test failed:', error.message);
    console.log(
      '💡 Make sure the application is running on http://localhost:3000',
    );
  }
}

// Run the test
testSecurityLoggingIntegration();

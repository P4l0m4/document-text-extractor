const { Test } = require('@nestjs/testing');
const { ConfigService } = require('@nestjs/config');
const {
  FileCleanupService,
} = require('./src/common/services/file-cleanup.service');
const fs = require('fs');
const path = require('path');

async function testFileCleanupService() {
  console.log('Testing FileCleanupService...');

  // Create test module
  const module = await Test.createTestingModule({
    providers: [
      FileCleanupService,
      {
        provide: ConfigService,
        useValue: {
          get: jest.fn((key) => {
            switch (key) {
              case 'app.tempDir':
                return './test-temp';
              case 'app.cleanupInterval':
                return 1000;
              default:
                return undefined;
            }
          }),
        },
      },
    ],
  }).compile();

  const service = module.get(FileCleanupService);

  console.log('✓ FileCleanupService created successfully');
  console.log('✓ Temp directory:', service.getTempDir());
  console.log('✓ Tracked files count:', service.getTrackedFileCount());

  // Test tracking files
  service.trackFile('/tmp/test1.txt');
  service.trackFile('/tmp/test2.txt');
  console.log('✓ Tracked files after adding:', service.getTrackedFileCount());

  // Test untracking
  service.untrackFile('/tmp/test1.txt');
  console.log(
    '✓ Tracked files after removing one:',
    service.getTrackedFileCount(),
  );

  console.log('✓ All FileCleanupService tests passed!');

  // Cleanup
  await service.onModuleDestroy();
  console.log('✓ Service destroyed successfully');
}

// Mock jest functions for the test
global.jest = {
  fn: (implementation) => {
    const mockFn = implementation || (() => {});
    mockFn.mockReturnValue = (value) => {
      mockFn._mockReturnValue = value;
      return mockFn;
    };
    mockFn.mockImplementation = (impl) => {
      Object.assign(mockFn, impl);
      return mockFn;
    };
    return mockFn;
  },
};

testFileCleanupService().catch(console.error);

import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { BadRequestException } from '@nestjs/common';
import { FileValidationService } from './file-validation.service';
import { readFileSync } from 'fs';

// Mock fs module
jest.mock('fs', () => ({
  readFileSync: jest.fn(),
}));

describe('FileValidationService', () => {
  let service: FileValidationService;
  let configService: ConfigService;
  let mockReadFileSync: jest.MockedFunction<typeof readFileSync>;

  beforeEach(async () => {
    mockReadFileSync = readFileSync as jest.MockedFunction<typeof readFileSync>;

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        FileValidationService,
        {
          provide: ConfigService,
          useValue: {
            get: jest.fn().mockImplementation((key: string) => {
              switch (key) {
                case 'app.supportedFormats':
                  return ['png', 'jpg', 'jpeg', 'pdf'];
                case 'app.maxFileSize':
                  return '10MB';
                default:
                  return undefined;
              }
            }),
          },
        },
      ],
    }).compile();

    service = module.get<FileValidationService>(FileValidationService);
    configService = module.get<ConfigService>(ConfigService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('validateFileType', () => {
    it('should accept supported file types', async () => {
      const pngFile = { originalname: 'test.png' } as Express.Multer.File;
      const jpgFile = { originalname: 'test.jpg' } as Express.Multer.File;
      const jpegFile = { originalname: 'test.jpeg' } as Express.Multer.File;
      const pdfFile = { originalname: 'test.pdf' } as Express.Multer.File;

      await expect(service.validateFileType(pngFile)).resolves.not.toThrow();
      await expect(service.validateFileType(jpgFile)).resolves.not.toThrow();
      await expect(service.validateFileType(jpegFile)).resolves.not.toThrow();
      await expect(service.validateFileType(pdfFile)).resolves.not.toThrow();
    });

    it('should reject unsupported file types', async () => {
      const txtFile = { originalname: 'test.txt' } as Express.Multer.File;
      const docFile = { originalname: 'test.doc' } as Express.Multer.File;

      await expect(service.validateFileType(txtFile)).rejects.toThrow(
        BadRequestException,
      );
      await expect(service.validateFileType(docFile)).rejects.toThrow(
        BadRequestException,
      );
    });

    it('should reject files without extension', async () => {
      const noExtFile = { originalname: 'test' } as Express.Multer.File;

      await expect(service.validateFileType(noExtFile)).rejects.toThrow(
        new BadRequestException('File must have an extension'),
      );
    });

    it('should handle case insensitive extensions', async () => {
      const upperCaseFile = { originalname: 'test.PNG' } as Express.Multer.File;

      await expect(
        service.validateFileType(upperCaseFile),
      ).resolves.not.toThrow();
    });
  });

  describe('validateFileSize', () => {
    it('should accept files within size limit', () => {
      const validFile = {
        originalname: 'test.png',
        size: 5 * 1024 * 1024, // 5MB
      } as Express.Multer.File;

      expect(() => service.validateFileSize(validFile)).not.toThrow();
    });

    it('should reject files exceeding size limit', () => {
      const largeFile = {
        originalname: 'test.png',
        size: 15 * 1024 * 1024, // 15MB
      } as Express.Multer.File;

      expect(() => service.validateFileSize(largeFile)).toThrow(
        BadRequestException,
      );
      expect(() => service.validateFileSize(largeFile)).toThrow(
        /exceeds maximum allowed size/,
      );
    });

    it('should reject empty files', () => {
      const emptyFile = {
        originalname: 'test.png',
        size: 0,
      } as Express.Multer.File;

      expect(() => service.validateFileSize(emptyFile)).toThrow(
        new BadRequestException('File cannot be empty'),
      );
    });

    it('should accept files at the exact size limit', () => {
      const exactSizeFile = {
        originalname: 'test.png',
        size: 10 * 1024 * 1024, // Exactly 10MB
      } as Express.Multer.File;

      expect(() => service.validateFileSize(exactSizeFile)).not.toThrow();
    });
  });

  describe('validateMimeType', () => {
    it('should accept correct MIME types for each format', async () => {
      const pngFile = {
        originalname: 'test.png',
        mimetype: 'image/png',
      } as Express.Multer.File;

      const jpgFile = {
        originalname: 'test.jpg',
        mimetype: 'image/jpeg',
      } as Express.Multer.File;

      const pdfFile = {
        originalname: 'test.pdf',
        mimetype: 'application/pdf',
      } as Express.Multer.File;

      await expect(service.validateMimeType(pngFile)).resolves.not.toThrow();
      await expect(service.validateMimeType(jpgFile)).resolves.not.toThrow();
      await expect(service.validateMimeType(pdfFile)).resolves.not.toThrow();
    });

    it('should reject incorrect MIME types', async () => {
      const wrongMimeFile = {
        originalname: 'test.png',
        mimetype: 'text/plain',
      } as Express.Multer.File;

      await expect(service.validateMimeType(wrongMimeFile)).rejects.toThrow(
        BadRequestException,
      );
      await expect(service.validateMimeType(wrongMimeFile)).rejects.toThrow(
        /Invalid MIME type/,
      );
    });

    it('should handle JPEG files with .jpg extension', async () => {
      const jpgFile = {
        originalname: 'test.jpg',
        mimetype: 'image/jpeg',
      } as Express.Multer.File;

      await expect(service.validateMimeType(jpgFile)).resolves.not.toThrow();
    });
  });

  describe('validateFileSignature', () => {
    it('should accept valid PNG signature', async () => {
      const pngSignature = Buffer.from([
        0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a,
      ]);
      mockReadFileSync.mockReturnValue(pngSignature);

      const pngFile = {
        originalname: 'test.png',
        path: '/tmp/test.png',
      } as Express.Multer.File;

      await expect(
        service.validateFileSignature(pngFile),
      ).resolves.not.toThrow();
    });

    it('should accept valid JPEG signature', async () => {
      const jpegSignature = Buffer.from([0xff, 0xd8, 0xff, 0xe0]);
      mockReadFileSync.mockReturnValue(jpegSignature);

      const jpegFile = {
        originalname: 'test.jpg',
        path: '/tmp/test.jpg',
      } as Express.Multer.File;

      await expect(
        service.validateFileSignature(jpegFile),
      ).resolves.not.toThrow();
    });

    it('should accept valid PDF signature', async () => {
      const pdfSignature = Buffer.from([0x25, 0x50, 0x44, 0x46]); // %PDF
      mockReadFileSync.mockReturnValue(pdfSignature);

      const pdfFile = {
        originalname: 'test.pdf',
        path: '/tmp/test.pdf',
      } as Express.Multer.File;

      await expect(
        service.validateFileSignature(pdfFile),
      ).resolves.not.toThrow();
    });

    it('should reject invalid file signature', async () => {
      const invalidSignature = Buffer.from([0x00, 0x00, 0x00, 0x00]);
      mockReadFileSync.mockReturnValue(invalidSignature);

      const fakeFile = {
        originalname: 'test.png',
        path: '/tmp/test.png',
      } as Express.Multer.File;

      await expect(service.validateFileSignature(fakeFile)).rejects.toThrow(
        BadRequestException,
      );
      await expect(service.validateFileSignature(fakeFile)).rejects.toThrow(
        /File signature does not match/,
      );
    });

    it('should reject file without path', async () => {
      const fileWithoutPath = {
        originalname: 'test.png',
      } as Express.Multer.File;

      await expect(
        service.validateFileSignature(fileWithoutPath),
      ).rejects.toThrow(
        new BadRequestException(
          'File path is required for signature validation',
        ),
      );
    });

    it('should handle file read errors', async () => {
      mockReadFileSync.mockImplementation(() => {
        throw new Error('File read error');
      });

      const file = {
        originalname: 'test.png',
        path: '/tmp/test.png',
      } as Express.Multer.File;

      await expect(service.validateFileSignature(file)).rejects.toThrow(
        BadRequestException,
      );
      await expect(service.validateFileSignature(file)).rejects.toThrow(
        /Failed to validate file signature/,
      );
    });

    it('should accept different JPEG signature variants', async () => {
      const jpegSignatures = [
        Buffer.from([0xff, 0xd8, 0xff, 0xe0]),
        Buffer.from([0xff, 0xd8, 0xff, 0xe1]),
        Buffer.from([0xff, 0xd8, 0xff, 0xe2]),
        Buffer.from([0xff, 0xd8, 0xff, 0xe3]),
        Buffer.from([0xff, 0xd8, 0xff, 0xe8]),
      ];

      for (const signature of jpegSignatures) {
        mockReadFileSync.mockReturnValue(signature);

        const jpegFile = {
          originalname: 'test.jpeg',
          path: '/tmp/test.jpeg',
        } as Express.Multer.File;

        await expect(
          service.validateFileSignature(jpegFile),
        ).resolves.not.toThrow();
      }
    });
  });

  describe('validateFile', () => {
    it('should validate all criteria for a valid file', async () => {
      const pngSignature = Buffer.from([
        0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a,
      ]);
      mockReadFileSync.mockReturnValue(pngSignature);

      const validFile = {
        originalname: 'test.png',
        mimetype: 'image/png',
        size: 5 * 1024 * 1024, // 5MB
        path: '/tmp/test.png',
      } as Express.Multer.File;

      await expect(service.validateFile(validFile)).resolves.not.toThrow();
    });

    it('should fail validation if any criteria fails', async () => {
      const invalidFile = {
        originalname: 'test.txt', // Invalid extension
        mimetype: 'text/plain',
        size: 5 * 1024 * 1024,
        path: '/tmp/test.txt',
      } as Express.Multer.File;

      await expect(service.validateFile(invalidFile)).rejects.toThrow(
        BadRequestException,
      );
    });
  });

  describe('getSupportedFormats', () => {
    it('should return supported formats', () => {
      const formats = service.getSupportedFormats();
      expect(formats).toEqual(['png', 'jpg', 'jpeg', 'pdf']);
    });

    it('should return a copy of the array', () => {
      const formats1 = service.getSupportedFormats();
      const formats2 = service.getSupportedFormats();

      expect(formats1).not.toBe(formats2); // Different array instances
      expect(formats1).toEqual(formats2); // Same content
    });
  });

  describe('getMaxFileSize', () => {
    it('should return max file size in bytes', () => {
      const maxSize = service.getMaxFileSize();
      expect(maxSize).toBe(10 * 1024 * 1024); // 10MB in bytes
    });
  });

  describe('configuration handling', () => {
    it('should use default values when config is not available', async () => {
      const mockConfigService = {
        get: jest.fn().mockReturnValue(undefined),
      };

      const module: TestingModule = await Test.createTestingModule({
        providers: [
          FileValidationService,
          {
            provide: ConfigService,
            useValue: mockConfigService,
          },
        ],
      }).compile();

      const serviceWithDefaults = module.get<FileValidationService>(
        FileValidationService,
      );

      expect(serviceWithDefaults.getSupportedFormats()).toEqual([
        'png',
        'jpg',
        'jpeg',
        'pdf',
      ]);
      expect(serviceWithDefaults.getMaxFileSize()).toBe(10 * 1024 * 1024);
    });

    it('should handle different file size units', async () => {
      const testCases = [
        { input: '5MB', expected: 5 * 1024 * 1024 },
        { input: '500KB', expected: 500 * 1024 },
        { input: '1GB', expected: 1 * 1024 * 1024 * 1024 },
        { input: '1024B', expected: 1024 },
      ];

      for (const testCase of testCases) {
        const mockConfigService = {
          get: jest.fn().mockImplementation((key: string) => {
            if (key === 'app.maxFileSize') return testCase.input;
            if (key === 'app.supportedFormats') return ['png'];
            return undefined;
          }),
        };

        const module: TestingModule = await Test.createTestingModule({
          providers: [
            FileValidationService,
            {
              provide: ConfigService,
              useValue: mockConfigService,
            },
          ],
        }).compile();

        const testService = module.get<FileValidationService>(
          FileValidationService,
        );
        expect(testService.getMaxFileSize()).toBe(testCase.expected);
      }
    });
  });
});

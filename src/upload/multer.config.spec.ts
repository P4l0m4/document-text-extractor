import { ConfigService } from '@nestjs/config';
import { BadRequestException } from '@nestjs/common';
import { createMulterConfig } from './multer.config';
import { existsSync, mkdirSync } from 'fs';

// Mock fs functions
jest.mock('fs', () => ({
  existsSync: jest.fn(),
  mkdirSync: jest.fn(),
}));

describe('MulterConfig', () => {
  let configService: ConfigService;
  let mockExistsSync: jest.MockedFunction<typeof existsSync>;
  let mockMkdirSync: jest.MockedFunction<typeof mkdirSync>;

  beforeEach(() => {
    configService = new ConfigService();
    mockExistsSync = existsSync as jest.MockedFunction<typeof existsSync>;
    mockMkdirSync = mkdirSync as jest.MockedFunction<typeof mkdirSync>;

    // Reset mocks
    jest.clearAllMocks();
  });

  describe('createMulterConfig', () => {
    it('should create multer config with default values', () => {
      mockExistsSync.mockReturnValue(true);

      jest
        .spyOn(configService, 'get')
        .mockReturnValueOnce('./temp') // tempDir
        .mockReturnValueOnce('10MB') // maxFileSize
        .mockReturnValueOnce(['png', 'jpg', 'jpeg', 'pdf']); // supportedFormats

      const config = createMulterConfig(configService);

      expect(config).toBeDefined();
      expect(config.storage).toBeDefined();
      expect(config.fileFilter).toBeDefined();
      expect(config.limits).toEqual({
        fileSize: 10 * 1024 * 1024, // 10MB in bytes
        files: 1,
      });
    });

    it('should create temp directory if it does not exist', () => {
      mockExistsSync.mockReturnValue(false);

      jest
        .spyOn(configService, 'get')
        .mockReturnValueOnce('./temp')
        .mockReturnValueOnce('10MB')
        .mockReturnValueOnce(['png', 'jpg', 'jpeg', 'pdf']);

      createMulterConfig(configService);

      expect(mockMkdirSync).toHaveBeenCalledWith('./temp', { recursive: true });
    });

    it('should use fallback values when config is not available', () => {
      mockExistsSync.mockReturnValue(true);

      jest
        .spyOn(configService, 'get')
        .mockReturnValueOnce(undefined) // tempDir
        .mockReturnValueOnce(undefined) // maxFileSize
        .mockReturnValueOnce(undefined); // supportedFormats

      const config = createMulterConfig(configService);

      expect(config.limits?.fileSize).toBe(10 * 1024 * 1024); // Default 10MB
    });
  });

  describe('fileFilter', () => {
    let fileFilter: any;

    beforeEach(() => {
      mockExistsSync.mockReturnValue(true);

      jest
        .spyOn(configService, 'get')
        .mockReturnValueOnce('./temp')
        .mockReturnValueOnce('10MB')
        .mockReturnValueOnce(['png', 'jpg', 'jpeg', 'pdf']);

      const config = createMulterConfig(configService);
      fileFilter = config.fileFilter;
    });

    it('should accept valid PNG file', (done) => {
      const mockFile = {
        originalname: 'test.png',
        mimetype: 'image/png',
      } as Express.Multer.File;

      fileFilter(null, mockFile, (error: any, result: boolean) => {
        expect(error).toBeNull();
        expect(result).toBe(true);
        done();
      });
    });

    it('should accept valid JPG file', (done) => {
      const mockFile = {
        originalname: 'test.jpg',
        mimetype: 'image/jpeg',
      } as Express.Multer.File;

      fileFilter(null, mockFile, (error: any, result: boolean) => {
        expect(error).toBeNull();
        expect(result).toBe(true);
        done();
      });
    });

    it('should accept valid JPEG file', (done) => {
      const mockFile = {
        originalname: 'test.jpeg',
        mimetype: 'image/jpeg',
      } as Express.Multer.File;

      fileFilter(null, mockFile, (error: any, result: boolean) => {
        expect(error).toBeNull();
        expect(result).toBe(true);
        done();
      });
    });

    it('should accept valid PDF file', (done) => {
      const mockFile = {
        originalname: 'test.pdf',
        mimetype: 'application/pdf',
      } as Express.Multer.File;

      fileFilter(null, mockFile, (error: any, result: boolean) => {
        expect(error).toBeNull();
        expect(result).toBe(true);
        done();
      });
    });

    it('should reject unsupported file extension', (done) => {
      const mockFile = {
        originalname: 'test.txt',
        mimetype: 'text/plain',
      } as Express.Multer.File;

      fileFilter(null, mockFile, (error: any, result: boolean) => {
        expect(error).toBeInstanceOf(BadRequestException);
        expect(error.message).toContain('Unsupported file type');
        expect(result).toBe(false);
        done();
      });
    });

    it('should reject file with invalid MIME type', (done) => {
      const mockFile = {
        originalname: 'test.png',
        mimetype: 'text/plain', // Wrong MIME type for PNG
      } as Express.Multer.File;

      fileFilter(null, mockFile, (error: any, result: boolean) => {
        expect(error).toBeInstanceOf(BadRequestException);
        expect(error.message).toContain('Invalid MIME type');
        expect(result).toBe(false);
        done();
      });
    });

    it('should reject PDF with wrong MIME type', (done) => {
      const mockFile = {
        originalname: 'test.pdf',
        mimetype: 'image/png', // Wrong MIME type for PDF
      } as Express.Multer.File;

      fileFilter(null, mockFile, (error: any, result: boolean) => {
        expect(error).toBeInstanceOf(BadRequestException);
        expect(error.message).toContain('Invalid MIME type');
        expect(result).toBe(false);
        done();
      });
    });
  });

  describe('parseFileSize', () => {
    // Test parseFileSize indirectly through config creation
    it('should parse different file size formats correctly', () => {
      mockExistsSync.mockReturnValue(true);

      // Test MB
      jest
        .spyOn(configService, 'get')
        .mockReturnValueOnce('./temp')
        .mockReturnValueOnce('5MB')
        .mockReturnValueOnce(['png']);

      let config = createMulterConfig(configService);
      expect(config.limits?.fileSize).toBe(5 * 1024 * 1024);

      // Test KB
      jest
        .spyOn(configService, 'get')
        .mockReturnValueOnce('./temp')
        .mockReturnValueOnce('500KB')
        .mockReturnValueOnce(['png']);

      config = createMulterConfig(configService);
      expect(config.limits?.fileSize).toBe(500 * 1024);

      // Test GB
      jest
        .spyOn(configService, 'get')
        .mockReturnValueOnce('./temp')
        .mockReturnValueOnce('1GB')
        .mockReturnValueOnce(['png']);

      config = createMulterConfig(configService);
      expect(config.limits?.fileSize).toBe(1 * 1024 * 1024 * 1024);
    });
  });

  describe('storage configuration', () => {
    it('should have storage configured', () => {
      mockExistsSync.mockReturnValue(true);

      jest
        .spyOn(configService, 'get')
        .mockReturnValueOnce('./temp')
        .mockReturnValueOnce('10MB')
        .mockReturnValueOnce(['png']);

      const config = createMulterConfig(configService);

      expect(config.storage).toBeDefined();
    });
  });
});

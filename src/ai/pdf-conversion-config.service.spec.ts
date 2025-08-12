import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { PdfConversionConfigService } from './pdf-conversion-config.service';
import { PDF_CONVERSION_DEFAULTS } from './interfaces/pdf-conversion.interface';

describe('PdfConversionConfigService', () => {
  let service: PdfConversionConfigService;
  let configService: jest.Mocked<ConfigService>;

  const createTestingModule = async (configValues: Record<string, any> = {}) => {
    const mockConfigService = {
      get: jest.fn((key: string) => configValues[key]),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PdfConversionConfigService,
        {
          provide: ConfigService,
          useValue: mockConfigService,
        },
      ],
    }).compile();

    service = module.get<PdfConversionConfigService>(PdfConversionConfigService);
    configService = module.get(ConfigService);
    return module;
  };

  describe('Default Configuration', () => {
    beforeEach(async () => {
      await createTestingModule();
    });

    it('should be defined', () => {
      expect(service).toBeDefined();
    });

    it('should use default values when no environment variables are set', () => {
      const config = service.getConfig();
      
      expect(config.density).toBe(PDF_CONVERSION_DEFAULTS.DENSITY);
      expect(config.format).toBe(PDF_CONVERSION_DEFAULTS.FORMAT);
      expect(config.width).toBe(PDF_CONVERSION_DEFAULTS.WIDTH);
      expect(config.height).toBe(PDF_CONVERSION_DEFAULTS.HEIGHT);
      expect(config.maxPages).toBe(PDF_CONVERSION_DEFAULTS.MAX_PAGES);
      expect(config.timeout).toBe(PDF_CONVERSION_DEFAULTS.TIMEOUT);
      expect(config.enabled).toBe(PDF_CONVERSION_DEFAULTS.ENABLED);
    });

    it('should provide individual getter methods', () => {
      expect(service.getDensity()).toBe(PDF_CONVERSION_DEFAULTS.DENSITY);
      expect(service.getFormat()).toBe(PDF_CONVERSION_DEFAULTS.FORMAT);
      expect(service.getWidth()).toBe(PDF_CONVERSION_DEFAULTS.WIDTH);
      expect(service.getHeight()).toBe(PDF_CONVERSION_DEFAULTS.HEIGHT);
      expect(service.getMaxPages()).toBe(PDF_CONVERSION_DEFAULTS.MAX_PAGES);
      expect(service.getTempDir()).toBe('/tmp/document-processing/pdf-conversion');
      expect(service.getTimeout()).toBe(PDF_CONVERSION_DEFAULTS.TIMEOUT);
      expect(service.isEnabled()).toBe(PDF_CONVERSION_DEFAULTS.ENABLED);
    });
  });

  describe('Custom Configuration', () => {
    it('should use custom values from environment variables', async () => {
      const customConfig = {
        PDF_CONVERSION_DPI: 300,
        PDF_CONVERSION_FORMAT: 'jpg',
        PDF_CONVERSION_WIDTH: 1500,
        PDF_CONVERSION_HEIGHT: 1500,
        PDF_CONVERSION_MAX_PAGES: 3,
        PDF_CONVERSION_TIMEOUT: 45000,
        PDF_CONVERSION_ENABLED: false,
        PDF_TEMP_DIR: '/custom/temp/dir',
      };

      await createTestingModule(customConfig);

      const config = service.getConfig();
      expect(config.density).toBe(300);
      expect(config.format).toBe('jpg');
      expect(config.width).toBe(1500);
      expect(config.height).toBe(1500);
      expect(config.maxPages).toBe(3);
      expect(config.timeout).toBe(45000);
      expect(config.enabled).toBe(false);
      expect(config.tempDir).toBe('/custom/temp/dir');
    });

    it('should handle TEMP_DIR fallback for PDF_TEMP_DIR', async () => {
      const customConfig = {
        TEMP_DIR: '/custom/base/temp',
      };

      await createTestingModule(customConfig);

      expect(service.getTempDir()).toBe('/custom/base/temp/pdf-conversion');
    });

    it('should normalize jpeg format to jpg', async () => {
      const customConfig = {
        PDF_CONVERSION_FORMAT: 'jpeg',
      };

      await createTestingModule(customConfig);

      expect(service.getFormat()).toBe('jpg');
    });

    it('should handle case-insensitive format values', async () => {
      const customConfig = {
        PDF_CONVERSION_FORMAT: 'PNG',
      };

      await createTestingModule(customConfig);

      expect(service.getFormat()).toBe('png');
    });
  });

  describe('Configuration Validation', () => {
    it('should throw error for invalid DPI values', async () => {
      const invalidConfigs = [
        { PDF_CONVERSION_DPI: 50 }, // Too low
        { PDF_CONVERSION_DPI: 700 }, // Too high
      ];

      for (const config of invalidConfigs) {
        await expect(createTestingModule(config)).rejects.toThrow(
          /PDF_CONVERSION_DPI must be between 72 and 600/
        );
      }
    });

    it('should throw error for invalid width values', async () => {
      const invalidConfigs = [
        { PDF_CONVERSION_WIDTH: 50 }, // Too low
        { PDF_CONVERSION_WIDTH: 6000 }, // Too high
      ];

      for (const config of invalidConfigs) {
        await expect(createTestingModule(config)).rejects.toThrow(
          /PDF_CONVERSION_WIDTH must be between 100 and 5000/
        );
      }
    });

    it('should throw error for invalid height values', async () => {
      const invalidConfigs = [
        { PDF_CONVERSION_HEIGHT: 50 }, // Too low
        { PDF_CONVERSION_HEIGHT: 6000 }, // Too high
      ];

      for (const config of invalidConfigs) {
        await expect(createTestingModule(config)).rejects.toThrow(
          /PDF_CONVERSION_HEIGHT must be between 100 and 5000/
        );
      }
    });

    it('should throw error for invalid max pages values', async () => {
      const invalidConfigs = [
        { PDF_CONVERSION_MAX_PAGES: 0 }, // Too low
        { PDF_CONVERSION_MAX_PAGES: 15 }, // Too high
      ];

      for (const config of invalidConfigs) {
        await expect(createTestingModule(config)).rejects.toThrow(
          /PDF_CONVERSION_MAX_PAGES must be between 1 and 10/
        );
      }
    });

    it('should throw error for invalid timeout values', async () => {
      const invalidConfigs = [
        { PDF_CONVERSION_TIMEOUT: 1000 }, // Too low
        { PDF_CONVERSION_TIMEOUT: 400000 }, // Too high
      ];

      for (const config of invalidConfigs) {
        await expect(createTestingModule(config)).rejects.toThrow(
          /PDF_CONVERSION_TIMEOUT must be between 5000 and 300000 ms/
        );
      }
    });

    it('should throw error for empty temp directory', async () => {
      const invalidConfigs = [
        { PDF_TEMP_DIR: '' },
        { PDF_TEMP_DIR: '   ' }, // Whitespace only
      ];

      for (const config of invalidConfigs) {
        await expect(createTestingModule(config)).rejects.toThrow(
          /PDF_TEMP_DIR cannot be empty/
        );
      }
    });

    it('should accept valid configuration values at boundaries', async () => {
      const validConfig = {
        PDF_CONVERSION_DPI: 72, // Minimum valid
        PDF_CONVERSION_WIDTH: 100, // Minimum valid
        PDF_CONVERSION_HEIGHT: 5000, // Maximum valid
        PDF_CONVERSION_MAX_PAGES: 10, // Maximum valid
        PDF_CONVERSION_TIMEOUT: 5000, // Minimum valid
        PDF_TEMP_DIR: '/valid/path',
      };

      await expect(createTestingModule(validConfig)).resolves.toBeDefined();
      
      const config = service.getConfig();
      expect(config.density).toBe(72);
      expect(config.width).toBe(100);
      expect(config.height).toBe(5000);
      expect(config.maxPages).toBe(10);
      expect(config.timeout).toBe(5000);
    });
  });

  describe('Format Validation', () => {
    it('should use default format for invalid format values', async () => {
      const invalidFormats = ['gif', 'bmp', 'tiff', 'invalid'];

      for (const format of invalidFormats) {
        await createTestingModule({ PDF_CONVERSION_FORMAT: format });
        expect(service.getFormat()).toBe(PDF_CONVERSION_DEFAULTS.FORMAT);
      }
    });

    it('should accept valid format values', async () => {
      const validFormats = [
        { input: 'png', expected: 'png' },
        { input: 'PNG', expected: 'png' },
        { input: 'jpg', expected: 'jpg' },
        { input: 'JPG', expected: 'jpg' },
        { input: 'jpeg', expected: 'jpg' },
        { input: 'JPEG', expected: 'jpg' },
      ];

      for (const { input, expected } of validFormats) {
        await createTestingModule({ PDF_CONVERSION_FORMAT: input });
        expect(service.getFormat()).toBe(expected);
      }
    });
  });

  describe('PDF2pic Options', () => {
    beforeEach(async () => {
      const customConfig = {
        PDF_CONVERSION_DPI: 150,
        PDF_CONVERSION_FORMAT: 'jpg',
        PDF_CONVERSION_WIDTH: 1800,
        PDF_CONVERSION_HEIGHT: 1200,
      };

      await createTestingModule(customConfig);
    });

    it('should generate correct pdf2pic options', () => {
      const options = service.getPdf2picOptions('test_page', '/temp/path');

      expect(options).toEqual({
        density: 150,
        saveFilename: 'test_page',
        savePath: '/temp/path',
        format: 'jpg',
        width: 1800,
        height: 1200,
      });
    });

    it('should use provided filename and path parameters', () => {
      const options = service.getPdf2picOptions('custom_name', '/custom/path');

      expect(options.saveFilename).toBe('custom_name');
      expect(options.savePath).toBe('/custom/path');
    });
  });

  describe('Configuration Immutability', () => {
    beforeEach(async () => {
      await createTestingModule();
    });

    it('should return a copy of configuration to prevent external modification', () => {
      const config1 = service.getConfig();
      const config2 = service.getConfig();

      expect(config1).toEqual(config2);
      expect(config1).not.toBe(config2); // Different object references

      // Modify the returned config
      config1.density = 999;

      // Original config should remain unchanged
      const config3 = service.getConfig();
      expect(config3.density).toBe(PDF_CONVERSION_DEFAULTS.DENSITY);
    });
  });

  describe('Error Handling', () => {
    it('should throw comprehensive error message for multiple validation failures', async () => {
      const invalidConfig = {
        PDF_CONVERSION_DPI: 50, // Invalid
        PDF_CONVERSION_WIDTH: 50, // Invalid
        PDF_CONVERSION_MAX_PAGES: 15, // Invalid
        PDF_TEMP_DIR: '', // Invalid
      };

      await expect(createTestingModule(invalidConfig)).rejects.toThrow(
        /PDF conversion configuration validation failed/
      );
    });
  });
});
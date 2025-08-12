import { validate } from 'class-validator';
import { FileUploadOptionsDto, FileUploadDto } from './file-upload.dto';

describe('FileUploadDto', () => {
  describe('FileUploadOptionsDto', () => {
    it('should validate with default values', async () => {
      const options = new FileUploadOptionsDto();
      const errors = await validate(options);

      expect(errors).toHaveLength(0);
      expect(options.generateSummary).toBe(true);
      expect(options.maxSummaryLength).toBe(200);
    });

    it('should validate with custom values', async () => {
      const options = new FileUploadOptionsDto();
      options.generateSummary = false;
      options.maxSummaryLength = 500;

      const errors = await validate(options);

      expect(errors).toHaveLength(0);
      expect(options.generateSummary).toBe(false);
      expect(options.maxSummaryLength).toBe(500);
    });

    it('should reject maxSummaryLength below minimum', async () => {
      const options = new FileUploadOptionsDto();
      options.maxSummaryLength = 25; // Below minimum of 50

      const errors = await validate(options);

      expect(errors).toHaveLength(1);
      expect(errors[0].property).toBe('maxSummaryLength');
      expect(errors[0].constraints).toHaveProperty('min');
    });

    it('should reject maxSummaryLength above maximum', async () => {
      const options = new FileUploadOptionsDto();
      options.maxSummaryLength = 1500; // Above maximum of 1000

      const errors = await validate(options);

      expect(errors).toHaveLength(1);
      expect(errors[0].property).toBe('maxSummaryLength');
      expect(errors[0].constraints).toHaveProperty('max');
    });

    it('should reject non-boolean generateSummary', async () => {
      const options = new FileUploadOptionsDto();
      (options as any).generateSummary = 'true'; // String instead of boolean

      const errors = await validate(options);

      expect(errors).toHaveLength(1);
      expect(errors[0].property).toBe('generateSummary');
      expect(errors[0].constraints).toHaveProperty('isBoolean');
    });

    it('should reject non-number maxSummaryLength', async () => {
      const options = new FileUploadOptionsDto();
      (options as any).maxSummaryLength = '200'; // String instead of number

      const errors = await validate(options);

      expect(errors).toHaveLength(1);
      expect(errors[0].property).toBe('maxSummaryLength');
      expect(errors[0].constraints).toHaveProperty('isNumber');
    });

    it('should allow undefined optional properties', async () => {
      const options = new FileUploadOptionsDto();
      options.generateSummary = undefined;
      options.maxSummaryLength = undefined;

      const errors = await validate(options);

      expect(errors).toHaveLength(0);
    });
  });

  describe('FileUploadDto Interface', () => {
    it('should create a valid file upload dto', () => {
      const mockFile: Express.Multer.File = {
        fieldname: 'file',
        originalname: 'test-document.pdf',
        encoding: '7bit',
        mimetype: 'application/pdf',
        size: 1024,
        destination: '/tmp',
        filename: 'test-document-123.pdf',
        path: '/tmp/test-document-123.pdf',
        buffer: Buffer.from('mock file content'),
        stream: undefined as any,
      };

      const options = new FileUploadOptionsDto();
      options.generateSummary = true;
      options.maxSummaryLength = 300;

      const fileUploadDto: FileUploadDto = {
        file: mockFile,
        options: options,
      };

      expect(fileUploadDto.file).toBe(mockFile);
      expect(fileUploadDto.options).toBe(options);
      expect(fileUploadDto.file.originalname).toBe('test-document.pdf');
      expect(fileUploadDto.options?.generateSummary).toBe(true);
      expect(fileUploadDto.options?.maxSummaryLength).toBe(300);
    });

    it('should work without options', () => {
      const mockFile: Express.Multer.File = {
        fieldname: 'file',
        originalname: 'image.png',
        encoding: '7bit',
        mimetype: 'image/png',
        size: 2048,
        destination: '/tmp',
        filename: 'image-456.png',
        path: '/tmp/image-456.png',
        buffer: Buffer.from('mock image content'),
        stream: undefined as any,
      };

      const fileUploadDto: FileUploadDto = {
        file: mockFile,
      };

      expect(fileUploadDto.file).toBe(mockFile);
      expect(fileUploadDto.options).toBeUndefined();
    });
  });
});

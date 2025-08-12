import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException } from '@nestjs/common';
import { UploadController } from './upload.controller';
import { UploadService } from './upload.service';
import { FileValidationService } from './file-validation.service';
import { FileUploadOptionsDto } from '../common/dto/file-upload.dto';

describe('UploadController', () => {
  let controller: UploadController;
  let uploadService: UploadService;
  let fileValidationService: FileValidationService;

  const mockUploadService = {
    processUpload: jest.fn(),
  };

  const mockFileValidationService = {
    validateFile: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [UploadController],
      providers: [
        {
          provide: UploadService,
          useValue: mockUploadService,
        },
        {
          provide: FileValidationService,
          useValue: mockFileValidationService,
        },
      ],
    }).compile();

    controller = module.get<UploadController>(UploadController);
    uploadService = module.get<UploadService>(UploadService);
    fileValidationService = module.get<FileValidationService>(
      FileValidationService,
    );
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  describe('uploadDocument', () => {
    const mockFile: Express.Multer.File = {
      fieldname: 'file',
      originalname: 'test.png',
      encoding: '7bit',
      mimetype: 'image/png',
      size: 1024,
      destination: '/tmp',
      filename: 'test.png',
      path: '/tmp/test.png',
      buffer: Buffer.from('test'),
      stream: null,
    };

    const mockOptions: FileUploadOptionsDto = {
      generateSummary: true,
      maxSummaryLength: 200,
    };

    it('should successfully upload a valid file', async () => {
      const mockTaskId = 'test-task-id-123';
      mockFileValidationService.validateFile.mockResolvedValue(undefined);
      mockUploadService.processUpload.mockResolvedValue(mockTaskId);

      const result = await controller.uploadDocument(mockFile, mockOptions);

      expect(fileValidationService.validateFile).toHaveBeenCalledWith(mockFile);
      expect(uploadService.processUpload).toHaveBeenCalledWith(
        mockFile,
        mockOptions,
      );
      expect(result).toEqual({
        statusCode: 200,
        message: 'File uploaded successfully',
        taskId: mockTaskId,
        fileName: 'test.png',
        fileSize: 1024,
      });
    });

    it('should throw BadRequestException when no file is provided', async () => {
      await expect(
        controller.uploadDocument(null, mockOptions),
      ).rejects.toThrow(new BadRequestException('No file provided'));

      expect(fileValidationService.validateFile).not.toHaveBeenCalled();
      expect(uploadService.processUpload).not.toHaveBeenCalled();
    });

    it('should throw BadRequestException when file validation fails', async () => {
      const validationError = new BadRequestException('Invalid file type');
      mockFileValidationService.validateFile.mockRejectedValue(validationError);

      await expect(
        controller.uploadDocument(mockFile, mockOptions),
      ).rejects.toThrow(new BadRequestException('Invalid file type'));

      expect(fileValidationService.validateFile).toHaveBeenCalledWith(mockFile);
      expect(uploadService.processUpload).not.toHaveBeenCalled();
    });

    it('should handle upload service errors', async () => {
      mockFileValidationService.validateFile.mockResolvedValue(undefined);
      mockUploadService.processUpload.mockRejectedValue(
        new Error('Upload failed'),
      );

      await expect(
        controller.uploadDocument(mockFile, mockOptions),
      ).rejects.toThrow(new BadRequestException('Upload failed'));

      expect(fileValidationService.validateFile).toHaveBeenCalledWith(mockFile);
      expect(uploadService.processUpload).toHaveBeenCalledWith(
        mockFile,
        mockOptions,
      );
    });

    it('should work without options', async () => {
      const mockTaskId = 'test-task-id-456';
      mockFileValidationService.validateFile.mockResolvedValue(undefined);
      mockUploadService.processUpload.mockResolvedValue(mockTaskId);

      const result = await controller.uploadDocument(mockFile);

      expect(fileValidationService.validateFile).toHaveBeenCalledWith(mockFile);
      expect(uploadService.processUpload).toHaveBeenCalledWith(
        mockFile,
        undefined,
      );
      expect(result).toEqual({
        statusCode: 200,
        message: 'File uploaded successfully',
        taskId: mockTaskId,
        fileName: 'test.png',
        fileSize: 1024,
      });
    });
  });
});

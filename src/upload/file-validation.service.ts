import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { extname } from 'path';
import { readFileSync } from 'fs';
import {
  FileValidationException,
  FileSizeException,
  FileTypeException,
  ValidationException,
} from '../common/exceptions';

@Injectable()
export class FileValidationService {
  private readonly supportedFormats: string[];
  private readonly maxFileSize: number;

  // MIME type signatures for file validation
  private readonly mimeSignatures: Record<string, Buffer[]> = {
    png: [Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])],
    jpg: [
      Buffer.from([0xff, 0xd8, 0xff, 0xe0]),
      Buffer.from([0xff, 0xd8, 0xff, 0xe1]),
      Buffer.from([0xff, 0xd8, 0xff, 0xe2]),
      Buffer.from([0xff, 0xd8, 0xff, 0xe3]),
      Buffer.from([0xff, 0xd8, 0xff, 0xe8]),
    ],
    jpeg: [
      Buffer.from([0xff, 0xd8, 0xff, 0xe0]),
      Buffer.from([0xff, 0xd8, 0xff, 0xe1]),
      Buffer.from([0xff, 0xd8, 0xff, 0xe2]),
      Buffer.from([0xff, 0xd8, 0xff, 0xe3]),
      Buffer.from([0xff, 0xd8, 0xff, 0xe8]),
    ],
    pdf: [Buffer.from([0x25, 0x50, 0x44, 0x46])], // %PDF
  };

  private readonly mimeTypeMap: Record<string, string[]> = {
    png: ['image/png'],
    jpg: ['image/jpeg'],
    jpeg: ['image/jpeg'],
    pdf: ['application/pdf'],
  };

  constructor(private readonly configService: ConfigService) {
    this.supportedFormats = this.configService.get<string[]>(
      'app.supportedFormats',
    ) || ['png', 'jpg', 'jpeg', 'pdf'];
    this.maxFileSize = this.parseFileSize(
      this.configService.get<string>('app.maxFileSize') || '10MB',
    );
  }

  /**
   * Validate uploaded file against all criteria
   */
  async validateFile(file: Express.Multer.File): Promise<void> {
    await this.validateFileType(file);
    this.validateFileSize(file);
    await this.validateMimeType(file);
    await this.validateFileSignature(file);
  }

  /**
   * Validate file type based on extension
   */
  async validateFileType(file: Express.Multer.File): Promise<void> {
    const fileExtension = extname(file.originalname).toLowerCase().slice(1);

    if (!fileExtension) {
      throw new FileValidationException(
        'File must have an extension',
        file.originalname,
      );
    }

    if (!this.supportedFormats.includes(fileExtension)) {
      throw new FileTypeException(
        file.originalname,
        fileExtension,
        this.supportedFormats,
      );
    }
  }

  /**
   * Validate file size
   */
  validateFileSize(file: Express.Multer.File): void {
    if (file.size > this.maxFileSize) {
      throw new FileSizeException(
        file.originalname,
        file.size,
        this.maxFileSize,
      );
    }

    if (file.size === 0) {
      throw new FileValidationException(
        'File cannot be empty',
        file.originalname,
      );
    }
  }

  /**
   * Validate MIME type matches file extension
   */
  async validateMimeType(file: Express.Multer.File): Promise<void> {
    const fileExtension = extname(file.originalname).toLowerCase().slice(1);
    const allowedMimeTypes = this.mimeTypeMap[fileExtension];

    if (!allowedMimeTypes) {
      throw new FileValidationException(
        `No MIME type mapping found for ${fileExtension}`,
        file.originalname,
      );
    }

    if (!allowedMimeTypes.includes(file.mimetype)) {
      throw new FileValidationException(
        `Invalid MIME type ${file.mimetype} for ${fileExtension} file. Expected: ${allowedMimeTypes.join(', ')}`,
        file.originalname,
      );
    }
  }

  /**
   * Validate file signature (magic bytes) to prevent file type spoofing
   */
  async validateFileSignature(file: Express.Multer.File): Promise<void> {
    if (!file.path) {
      throw new FileValidationException(
        'File path is required for signature validation',
        file.originalname,
      );
    }

    const fileExtension = extname(file.originalname).toLowerCase().slice(1);
    const expectedSignatures = this.mimeSignatures[fileExtension];

    if (!expectedSignatures) {
      throw new FileValidationException(
        `No signature validation available for ${fileExtension}`,
        file.originalname,
      );
    }

    try {
      // Read the first few bytes of the file
      const fileBuffer = readFileSync(file.path);
      const fileHeader = fileBuffer.slice(
        0,
        Math.max(...expectedSignatures.map((sig) => sig.length)),
      );

      // Check if any of the expected signatures match
      const isValidSignature = expectedSignatures.some((signature) => {
        return fileHeader.slice(0, signature.length).equals(signature);
      });

      if (!isValidSignature) {
        throw new FileValidationException(
          `File signature does not match expected format for ${fileExtension} file`,
          file.originalname,
        );
      }
    } catch (error) {
      if (error instanceof FileValidationException) {
        throw error;
      }
      throw new FileValidationException(
        `Failed to validate file signature: ${error.message}`,
        file.originalname,
      );
    }
  }

  /**
   * Get supported file formats
   */
  getSupportedFormats(): string[] {
    return [...this.supportedFormats];
  }

  /**
   * Get maximum file size in bytes
   */
  getMaxFileSize(): number {
    return this.maxFileSize;
  }

  /**
   * Parse file size string (e.g., "10MB", "5GB") to bytes
   */
  private parseFileSize(sizeStr: string): number {
    const units: Record<string, number> = {
      B: 1,
      KB: 1024,
      MB: 1024 * 1024,
      GB: 1024 * 1024 * 1024,
    };

    const match = sizeStr.match(/^(\d+(?:\.\d+)?)\s*([A-Z]{1,2})$/i);
    if (!match) {
      throw new ValidationException(`Invalid file size format: ${sizeStr}`);
    }

    const [, size, unit] = match;
    const multiplier = units[unit.toUpperCase()];

    if (!multiplier) {
      throw new ValidationException(`Unknown file size unit: ${unit}`);
    }

    return parseFloat(size) * multiplier;
  }
}

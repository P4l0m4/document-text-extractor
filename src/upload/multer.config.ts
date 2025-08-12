import { MulterOptions } from '@nestjs/platform-express/multer/interfaces/multer-options.interface';
import { diskStorage } from 'multer';
import { extname, join } from 'path';
import { v4 as uuidv4 } from 'uuid';
import { BadRequestException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { existsSync, mkdirSync } from 'fs';
import { ValidationException } from '../common/exceptions';

export const createMulterConfig = (
  configService: ConfigService,
): MulterOptions => {
  const tempDir = configService.get<string>('app.tempDir') || './temp';
  const maxFileSize = parseFileSize(
    configService.get<string>('app.maxFileSize') || '10MB',
  );
  const supportedFormats = configService.get<string[]>(
    'app.supportedFormats',
  ) || ['png', 'jpg', 'jpeg', 'pdf'];

  // Ensure temp directory exists
  if (!existsSync(tempDir)) {
    mkdirSync(tempDir, { recursive: true });
  }

  return {
    storage: diskStorage({
      destination: (req, file, cb) => {
        cb(null, tempDir);
      },
      filename: (req, file, cb) => {
        const uniqueSuffix = uuidv4();
        const fileExtension = extname(file.originalname);
        cb(null, `${uniqueSuffix}${fileExtension}`);
      },
    }),
    fileFilter: (req, file, cb) => {
      const fileExtension = extname(file.originalname).toLowerCase().slice(1);
      const mimeTypeMap: Record<string, string[]> = {
        png: ['image/png'],
        jpg: ['image/jpeg'],
        jpeg: ['image/jpeg'],
        pdf: ['application/pdf'],
      };

      // Check file extension
      if (!supportedFormats.includes(fileExtension)) {
        return cb(
          new BadRequestException(
            `Unsupported file type. Supported formats: ${supportedFormats.join(', ')}`,
          ),
          false,
        );
      }

      // Check MIME type
      const allowedMimeTypes = mimeTypeMap[fileExtension];
      if (!allowedMimeTypes || !allowedMimeTypes.includes(file.mimetype)) {
        return cb(
          new BadRequestException(
            `Invalid MIME type for ${fileExtension} file. Expected: ${allowedMimeTypes?.join(', ')}`,
          ),
          false,
        );
      }

      cb(null, true);
    },
    limits: {
      fileSize: maxFileSize,
      files: 1, // Only allow one file per request
    },
  };
};

/**
 * Parse file size string (e.g., "10MB", "5GB") to bytes
 */
function parseFileSize(sizeStr: string): number {
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

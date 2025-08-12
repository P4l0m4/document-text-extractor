import { HttpException, HttpStatus } from '@nestjs/common';

export class ValidationException extends HttpException {
  constructor(message: string, taskId?: string) {
    super(
      {
        statusCode: HttpStatus.BAD_REQUEST,
        message,
        error: 'Validation Error',
        timestamp: new Date().toISOString(),
        taskId,
      },
      HttpStatus.BAD_REQUEST,
    );
  }
}

export class FileValidationException extends ValidationException {
  constructor(message: string, fileName?: string, taskId?: string) {
    const fullMessage = fileName ? `File '${fileName}': ${message}` : message;
    super(fullMessage, taskId);
  }
}

export class FileSizeException extends FileValidationException {
  constructor(
    fileName: string,
    actualSize: number,
    maxSize: number,
    taskId?: string,
  ) {
    const message = `File size ${actualSize} bytes exceeds maximum allowed size of ${maxSize} bytes`;
    super(message, fileName, taskId);
  }
}

export class FileTypeException extends FileValidationException {
  constructor(
    fileName: string,
    actualType: string,
    allowedTypes: string[],
    taskId?: string,
  ) {
    const message = `File type '${actualType}' is not supported. Allowed types: ${allowedTypes.join(', ')}`;
    super(message, fileName, taskId);
  }
}

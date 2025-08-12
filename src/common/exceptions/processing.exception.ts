import { HttpException, HttpStatus } from '@nestjs/common';

export class ProcessingException extends HttpException {
  constructor(message: string, taskId?: string) {
    super(
      {
        statusCode: HttpStatus.UNPROCESSABLE_ENTITY,
        message,
        error: 'Processing Error',
        timestamp: new Date().toISOString(),
        taskId,
      },
      HttpStatus.UNPROCESSABLE_ENTITY,
    );
  }
}

export class AIModelException extends ProcessingException {
  constructor(message: string, taskId?: string) {
    super(`AI model error: ${message}`, taskId);
  }
}

export class TextExtractionException extends ProcessingException {
  constructor(message: string, taskId?: string) {
    super(`Text extraction failed: ${message}`, taskId);
  }
}

export class SummarizationException extends ProcessingException {
  constructor(message: string, taskId?: string) {
    super(`Summarization failed: ${message}`, taskId);
  }
}

export class DocumentCorruptedException extends ProcessingException {
  constructor(fileName: string, taskId?: string) {
    super(
      `Document '${fileName}' appears to be corrupted or unreadable`,
      taskId,
    );
  }
}

export class UnsupportedDocumentException extends ProcessingException {
  constructor(fileName: string, reason: string, taskId?: string) {
    super(`Document '${fileName}' cannot be processed: ${reason}`, taskId);
  }
}

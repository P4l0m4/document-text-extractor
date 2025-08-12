import { HttpStatus } from '@nestjs/common';
import {
  ProcessingException,
  AIModelException,
  TextExtractionException,
  SummarizationException,
  DocumentCorruptedException,
  UnsupportedDocumentException,
} from './processing.exception';

describe('Processing Exceptions', () => {
  describe('ProcessingException', () => {
    it('should create a processing exception with correct properties', () => {
      const message = 'Processing failed';
      const taskId = 'task-123';
      const exception = new ProcessingException(message, taskId);

      expect(exception.getStatus()).toBe(HttpStatus.UNPROCESSABLE_ENTITY);

      const response = exception.getResponse() as any;
      expect(response.statusCode).toBe(HttpStatus.UNPROCESSABLE_ENTITY);
      expect(response.message).toBe(message);
      expect(response.error).toBe('Processing Error');
      expect(response.taskId).toBe(taskId);
      expect(response.timestamp).toBeDefined();
    });

    it('should create a processing exception without taskId', () => {
      const message = 'Processing failed';
      const exception = new ProcessingException(message);

      const response = exception.getResponse() as any;
      expect(response.taskId).toBeUndefined();
      expect(response.message).toBe(message);
    });
  });

  describe('AIModelException', () => {
    it('should create an AI model exception with prefixed message', () => {
      const message = 'Model initialization failed';
      const taskId = 'task-456';
      const exception = new AIModelException(message, taskId);

      const response = exception.getResponse() as any;
      expect(response.message).toBe(`AI model error: ${message}`);
      expect(response.taskId).toBe(taskId);
      expect(response.statusCode).toBe(HttpStatus.UNPROCESSABLE_ENTITY);
    });

    it('should create an AI model exception without taskId', () => {
      const message = 'Model not available';
      const exception = new AIModelException(message);

      const response = exception.getResponse() as any;
      expect(response.message).toBe(`AI model error: ${message}`);
      expect(response.taskId).toBeUndefined();
    });
  });

  describe('TextExtractionException', () => {
    it('should create a text extraction exception with prefixed message', () => {
      const message = 'OCR processing failed';
      const taskId = 'task-789';
      const exception = new TextExtractionException(message, taskId);

      const response = exception.getResponse() as any;
      expect(response.message).toBe(`Text extraction failed: ${message}`);
      expect(response.taskId).toBe(taskId);
    });

    it('should create a text extraction exception without taskId', () => {
      const message = 'Image quality too low';
      const exception = new TextExtractionException(message);

      const response = exception.getResponse() as any;
      expect(response.message).toBe(`Text extraction failed: ${message}`);
      expect(response.taskId).toBeUndefined();
    });
  });

  describe('SummarizationException', () => {
    it('should create a summarization exception with prefixed message', () => {
      const message = 'Text too short for summarization';
      const taskId = 'task-101';
      const exception = new SummarizationException(message, taskId);

      const response = exception.getResponse() as any;
      expect(response.message).toBe(`Summarization failed: ${message}`);
      expect(response.taskId).toBe(taskId);
    });

    it('should create a summarization exception without taskId', () => {
      const message = 'Language model unavailable';
      const exception = new SummarizationException(message);

      const response = exception.getResponse() as any;
      expect(response.message).toBe(`Summarization failed: ${message}`);
      expect(response.taskId).toBeUndefined();
    });
  });

  describe('DocumentCorruptedException', () => {
    it('should create a document corrupted exception with filename', () => {
      const fileName = 'corrupted-file.pdf';
      const taskId = 'task-202';
      const exception = new DocumentCorruptedException(fileName, taskId);

      const response = exception.getResponse() as any;
      expect(response.message).toBe(
        `Document '${fileName}' appears to be corrupted or unreadable`,
      );
      expect(response.taskId).toBe(taskId);
    });

    it('should create a document corrupted exception without taskId', () => {
      const fileName = 'bad-file.pdf';
      const exception = new DocumentCorruptedException(fileName);

      const response = exception.getResponse() as any;
      expect(response.message).toContain(fileName);
      expect(response.message).toContain('corrupted or unreadable');
      expect(response.taskId).toBeUndefined();
    });
  });

  describe('UnsupportedDocumentException', () => {
    it('should create an unsupported document exception with reason', () => {
      const fileName = 'encrypted.pdf';
      const reason = 'Document is password protected';
      const taskId = 'task-303';
      const exception = new UnsupportedDocumentException(
        fileName,
        reason,
        taskId,
      );

      const response = exception.getResponse() as any;
      expect(response.message).toBe(
        `Document '${fileName}' cannot be processed: ${reason}`,
      );
      expect(response.taskId).toBe(taskId);
    });

    it('should create an unsupported document exception without taskId', () => {
      const fileName = 'complex.pdf';
      const reason = 'Contains unsupported elements';
      const exception = new UnsupportedDocumentException(fileName, reason);

      const response = exception.getResponse() as any;
      expect(response.message).toContain(fileName);
      expect(response.message).toContain(reason);
      expect(response.taskId).toBeUndefined();
    });
  });
});

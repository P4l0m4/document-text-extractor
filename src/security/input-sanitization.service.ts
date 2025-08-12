import { Injectable, Logger } from '@nestjs/common';

@Injectable()
export class InputSanitizationService {
  private readonly logger = new Logger(InputSanitizationService.name);

  /**
   * Sanitize string input by removing potentially dangerous characters
   */
  sanitizeString(input: string): string {
    if (!input || typeof input !== 'string') {
      return '';
    }

    // Remove null bytes and control characters
    let sanitized = input.replace(/[\x00-\x1F\x7F]/g, '');

    // Remove potentially dangerous HTML/script tags
    sanitized = sanitized.replace(
      /<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi,
      '',
    );
    sanitized = sanitized.replace(
      /<iframe\b[^<]*(?:(?!<\/iframe>)<[^<]*)*<\/iframe>/gi,
      '',
    );
    sanitized = sanitized.replace(
      /<object\b[^<]*(?:(?!<\/object>)<[^<]*)*<\/object>/gi,
      '',
    );
    sanitized = sanitized.replace(
      /<embed\b[^<]*(?:(?!<\/embed>)<[^<]*)*<\/embed>/gi,
      '',
    );

    // Remove javascript: and data: URLs
    sanitized = sanitized.replace(/javascript:/gi, '');
    sanitized = sanitized.replace(/data:/gi, '');

    // Limit length to prevent DoS
    if (sanitized.length > 10000) {
      sanitized = sanitized.substring(0, 10000);
      this.logger.warn('Input truncated due to excessive length');
    }

    return sanitized.trim();
  }

  /**
   * Sanitize filename to prevent path traversal attacks
   */
  sanitizeFilename(filename: string): string {
    if (!filename || typeof filename !== 'string') {
      return 'unknown';
    }

    // Remove path separators and dangerous characters
    let sanitized = filename.replace(/[\/\\:*?"<>|]/g, '_');

    // Remove leading dots to prevent hidden files
    sanitized = sanitized.replace(/^\.+/, '');

    // Remove null bytes and control characters
    sanitized = sanitized.replace(/[\x00-\x1F\x7F]/g, '');

    // Limit length
    if (sanitized.length > 255) {
      const ext = sanitized.substring(sanitized.lastIndexOf('.'));
      const name = sanitized.substring(0, 255 - ext.length);
      sanitized = name + ext;
    }

    // Ensure we have a valid filename
    if (!sanitized || sanitized.length === 0) {
      sanitized = 'sanitized_file';
    }

    return sanitized;
  }

  /**
   * Sanitize file path to prevent directory traversal
   */
  sanitizeFilePath(filePath: string): string {
    if (!filePath || typeof filePath !== 'string') {
      return '';
    }

    // Remove path traversal attempts
    let sanitized = filePath.replace(/\.\./g, '');

    // Remove null bytes and control characters
    sanitized = sanitized.replace(/[\x00-\x1F\x7F]/g, '');

    // Normalize path separators
    sanitized = sanitized.replace(/\\/g, '/');

    // Remove multiple consecutive slashes
    sanitized = sanitized.replace(/\/+/g, '/');

    // Remove leading slash if present
    sanitized = sanitized.replace(/^\//, '');

    return sanitized;
  }

  /**
   * Validate and sanitize task ID
   */
  sanitizeTaskId(taskId: string): string {
    if (!taskId || typeof taskId !== 'string') {
      return '';
    }

    // Only allow alphanumeric characters, hyphens, and underscores
    const sanitized = taskId.replace(/[^a-zA-Z0-9\-_]/g, '');

    // Limit length
    return sanitized.substring(0, 100);
  }

  /**
   * Sanitize numeric input
   */
  sanitizeNumber(input: any, min?: number, max?: number): number | null {
    const num = Number(input);

    if (isNaN(num) || !isFinite(num)) {
      return null;
    }

    if (min !== undefined && num < min) {
      return min;
    }

    if (max !== undefined && num > max) {
      return max;
    }

    return num;
  }

  /**
   * Sanitize boolean input
   */
  sanitizeBoolean(input: any): boolean {
    if (typeof input === 'boolean') {
      return input;
    }

    if (typeof input === 'string') {
      const lower = input.toLowerCase().trim();
      return lower === 'true' || lower === '1' || lower === 'yes';
    }

    if (typeof input === 'number') {
      return input !== 0;
    }

    return false;
  }

  /**
   * Sanitize object by recursively sanitizing all string properties
   */
  sanitizeObject(obj: any): any {
    if (obj === null || obj === undefined) {
      return obj;
    }

    if (typeof obj === 'string') {
      return this.sanitizeString(obj);
    }

    if (typeof obj === 'number' || typeof obj === 'boolean') {
      return obj;
    }

    if (Array.isArray(obj)) {
      return obj.map((item) => this.sanitizeObject(item));
    }

    if (typeof obj === 'object') {
      const sanitized: any = {};
      for (const [key, value] of Object.entries(obj)) {
        const sanitizedKey = this.sanitizeString(key);
        sanitized[sanitizedKey] = this.sanitizeObject(value);
      }
      return sanitized;
    }

    return obj;
  }
}

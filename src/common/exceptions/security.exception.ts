import { HttpException, HttpStatus } from '@nestjs/common';

export class SecurityException extends HttpException {
  constructor(
    message: string,
    statusCode: HttpStatus = HttpStatus.FORBIDDEN,
    taskId?: string,
  ) {
    super(
      {
        statusCode,
        message,
        error: 'Security Error',
        timestamp: new Date().toISOString(),
        taskId,
      },
      statusCode,
    );
  }
}

export class MaliciousFileException extends SecurityException {
  constructor(fileName: string, reason: string, taskId?: string) {
    super(
      `File '${fileName}' rejected due to security concerns: ${reason}`,
      HttpStatus.FORBIDDEN,
      taskId,
    );
  }
}

export class UnauthorizedAccessException extends SecurityException {
  constructor(resource: string, taskId?: string) {
    super(
      `Unauthorized access attempt to resource: ${resource}`,
      HttpStatus.UNAUTHORIZED,
      taskId,
    );
  }
}

export class RateLimitExceededException extends SecurityException {
  constructor(limit: number, window: string, taskId?: string) {
    super(
      `Rate limit exceeded: ${limit} requests per ${window}`,
      HttpStatus.TOO_MANY_REQUESTS,
      taskId,
    );
  }
}

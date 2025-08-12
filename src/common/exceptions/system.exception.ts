import { HttpException, HttpStatus } from '@nestjs/common';

export class SystemException extends HttpException {
  constructor(
    message: string,
    statusCode: HttpStatus = HttpStatus.INTERNAL_SERVER_ERROR,
    taskId?: string,
  ) {
    super(
      {
        statusCode,
        message,
        error: 'System Error',
        timestamp: new Date().toISOString(),
        taskId,
      },
      statusCode,
    );
  }
}

export class ResourceExhaustedException extends SystemException {
  constructor(resource: string, taskId?: string) {
    super(
      `System resource exhausted: ${resource}`,
      HttpStatus.SERVICE_UNAVAILABLE,
      taskId,
    );
  }
}

export class FileSystemException extends SystemException {
  constructor(operation: string, path: string, taskId?: string) {
    super(
      `File system error during ${operation} on path: ${path}`,
      HttpStatus.INTERNAL_SERVER_ERROR,
      taskId,
    );
  }
}

export class QueueException extends SystemException {
  constructor(message: string, taskId?: string) {
    super(
      `Queue system error: ${message}`,
      HttpStatus.SERVICE_UNAVAILABLE,
      taskId,
    );
  }
}

export class TaskNotFoundException extends SystemException {
  constructor(taskId: string) {
    super(`Task with ID '${taskId}' not found`, HttpStatus.NOT_FOUND, taskId);
  }
}

export class ServiceUnavailableException extends SystemException {
  constructor(service: string, taskId?: string) {
    super(
      `Service '${service}' is currently unavailable`,
      HttpStatus.SERVICE_UNAVAILABLE,
      taskId,
    );
  }
}

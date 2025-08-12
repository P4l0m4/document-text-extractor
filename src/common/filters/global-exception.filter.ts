import {
  ExceptionFilter,
  Catch,
  ArgumentsHost,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { Request, Response } from 'express';
import {
  ValidationException,
  ProcessingException,
  SystemException,
  SecurityException,
} from '../exceptions';

@Catch()
export class GlobalExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(GlobalExceptionFilter.name);

  catch(exception: unknown, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();

    let status: HttpStatus;
    let message: string;
    let error: string;
    let taskId: string | undefined;

    // Handle different types of exceptions
    if (exception instanceof ValidationException) {
      status = exception.getStatus();
      const exceptionResponse = exception.getResponse() as any;
      message = exceptionResponse.message || exception.message;
      error = 'Validation Error';
      taskId = exceptionResponse.taskId;
    } else if (exception instanceof ProcessingException) {
      status = exception.getStatus();
      const exceptionResponse = exception.getResponse() as any;
      message = exceptionResponse.message || exception.message;
      error = 'Processing Error';
      taskId = exceptionResponse.taskId;
    } else if (exception instanceof SystemException) {
      status = exception.getStatus();
      const exceptionResponse = exception.getResponse() as any;
      message = exceptionResponse.message || exception.message;
      error = 'System Error';
      taskId = exceptionResponse.taskId;
    } else if (exception instanceof SecurityException) {
      status = exception.getStatus();
      const exceptionResponse = exception.getResponse() as any;
      message = exceptionResponse.message || exception.message;
      error = 'Security Error';
      taskId = exceptionResponse.taskId;
    } else if (exception instanceof HttpException) {
      status = exception.getStatus();
      const exceptionResponse = exception.getResponse();

      if (typeof exceptionResponse === 'object' && exceptionResponse !== null) {
        message = (exceptionResponse as any).message || exception.message;
        error = (exceptionResponse as any).error || 'Http Exception';
      } else {
        message = (exceptionResponse as string) || exception.message;
        error = 'Http Exception';
      }
    } else {
      // Handle unexpected errors
      status = HttpStatus.INTERNAL_SERVER_ERROR;
      message = 'Internal server error';
      error = 'Internal Server Error';

      // Log the full error for debugging
      this.logger.error('Unexpected error occurred:', exception);
    }

    // Log the error (without sensitive information)
    this.logger.error(
      `${request.method} ${request.url} - ${status} - ${error}: ${message}`,
      exception instanceof Error ? exception.stack : undefined,
    );

    // Prepare error response
    const errorResponse: any = {
      statusCode: status,
      message,
      error,
      timestamp: new Date().toISOString(),
      path: request.url,
    };

    // Add taskId if available
    if (taskId) {
      errorResponse.taskId = taskId;
    }

    // Add validation details for validation errors
    if (
      exception instanceof HttpException &&
      status === HttpStatus.BAD_REQUEST
    ) {
      const exceptionResponse = exception.getResponse();
      if (
        typeof exceptionResponse === 'object' &&
        (exceptionResponse as any).message
      ) {
        const validationMessage = (exceptionResponse as any).message;
        if (Array.isArray(validationMessage)) {
          errorResponse.validationErrors = validationMessage;
        }
      }
    }

    // Don't expose internal error details in production
    if (
      process.env.NODE_ENV === 'production' &&
      status === HttpStatus.INTERNAL_SERVER_ERROR
    ) {
      errorResponse.message = 'Internal server error';
    }

    response.status(status).json(errorResponse);
  }
}

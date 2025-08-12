import { ErrorResponse } from './error-response.interface';

describe('ErrorResponse Interface', () => {
  it('should create a valid error response', () => {
    const errorResponse: ErrorResponse = {
      statusCode: 400,
      message: 'Invalid file type',
      error: 'Bad Request',
      timestamp: '2024-01-15T10:30:00.000Z',
      path: '/api/documents/upload',
    };

    expect(errorResponse.statusCode).toBe(400);
    expect(errorResponse.message).toBe('Invalid file type');
    expect(errorResponse.error).toBe('Bad Request');
    expect(errorResponse.timestamp).toBe('2024-01-15T10:30:00.000Z');
    expect(errorResponse.path).toBe('/api/documents/upload');
  });

  it('should support optional taskId property', () => {
    const errorResponse: ErrorResponse = {
      statusCode: 500,
      message: 'Processing failed',
      error: 'Internal Server Error',
      timestamp: '2024-01-15T10:35:00.000Z',
      path: '/api/tasks/task-123/result',
      taskId: 'task-123',
    };

    expect(errorResponse.taskId).toBe('task-123');
  });

  it('should work without optional taskId', () => {
    const errorResponse: ErrorResponse = {
      statusCode: 404,
      message: 'Task not found',
      error: 'Not Found',
      timestamp: '2024-01-15T10:40:00.000Z',
      path: '/api/tasks/nonexistent/status',
    };

    expect(errorResponse.taskId).toBeUndefined();
    expect(errorResponse.statusCode).toBe(404);
  });

  it('should handle different HTTP status codes', () => {
    const responses: ErrorResponse[] = [
      {
        statusCode: 400,
        message: 'Validation failed',
        error: 'Bad Request',
        timestamp: '2024-01-15T10:45:00.000Z',
        path: '/api/documents/upload',
      },
      {
        statusCode: 413,
        message: 'File too large',
        error: 'Payload Too Large',
        timestamp: '2024-01-15T10:46:00.000Z',
        path: '/api/documents/upload',
      },
      {
        statusCode: 415,
        message: 'Unsupported media type',
        error: 'Unsupported Media Type',
        timestamp: '2024-01-15T10:47:00.000Z',
        path: '/api/documents/upload',
      },
    ];

    expect(responses[0].statusCode).toBe(400);
    expect(responses[1].statusCode).toBe(413);
    expect(responses[2].statusCode).toBe(415);
  });
});

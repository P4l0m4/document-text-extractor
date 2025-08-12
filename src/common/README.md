# Error Handling Documentation

This document describes the comprehensive error handling system implemented in the document processing API.

## Overview

The error handling system provides:

- Standardized error responses across all endpoints
- Proper HTTP status codes for different error types
- Secure error messages that don't expose sensitive information
- Comprehensive logging for debugging
- Task-specific error tracking

## Components

### 1. Exception Classes

#### Validation Exceptions (`validation.exception.ts`)

- `ValidationException`: Base class for validation errors (400 Bad Request)
- `FileValidationException`: File-specific validation errors
- `FileSizeException`: File size limit violations
- `FileTypeException`: Unsupported file type errors

#### Processing Exceptions (`processing.exception.ts`)

- `ProcessingException`: Base class for processing errors (422 Unprocessable Entity)
- `AIModelException`: AI model-related errors
- `TextExtractionException`: OCR and text extraction failures
- `SummarizationException`: Text summarization failures
- `DocumentCorruptedException`: Corrupted document errors
- `UnsupportedDocumentException`: Unsupported document format errors

#### System Exceptions (`system.exception.ts`)

- `SystemException`: Base class for system errors (500 Internal Server Error)
- `ResourceExhaustedException`: Resource exhaustion errors (503 Service Unavailable)
- `FileSystemException`: File system operation errors
- `QueueException`: Queue system errors (503 Service Unavailable)
- `TaskNotFoundException`: Task not found errors (404 Not Found)
- `ServiceUnavailableException`: Service unavailability errors (503 Service Unavailable)

#### Security Exceptions (`security.exception.ts`)

- `SecurityException`: Base class for security errors (403 Forbidden)
- `MaliciousFileException`: Malicious file detection errors
- `UnauthorizedAccessException`: Unauthorized access attempts (401 Unauthorized)
- `RateLimitExceededException`: Rate limit violations (429 Too Many Requests)

### 2. Global Exception Filter (`global-exception.filter.ts`)

The global exception filter automatically handles all exceptions and provides:

- Consistent error response format
- Appropriate HTTP status codes
- Error categorization and detection
- Secure error logging
- Timestamp and request path tracking

### 3. Error Response Interface (`error-response.interface.ts`)

Standardized error response format:

```typescript
interface ErrorResponse {
  statusCode: number;
  message: string;
  error: string;
  timestamp: string;
  path: string;
  taskId?: string;
}
```

## Usage Examples

### Throwing Validation Errors

```typescript
import { FileTypeException, FileSizeException } from '../common/exceptions';

// File type validation
if (!allowedTypes.includes(file.mimetype)) {
  throw new FileTypeException(
    file.originalname,
    file.mimetype,
    allowedTypes,
    taskId,
  );
}

// File size validation
if (file.size > maxSize) {
  throw new FileSizeException(file.originalname, file.size, maxSize, taskId);
}
```

### Throwing Processing Errors

```typescript
import {
  AIModelException,
  TextExtractionException,
} from '../common/exceptions';

// AI model errors
try {
  const result = await this.aiModel.process(document);
} catch (error) {
  throw new AIModelException('Model failed to process document', taskId);
}

// Text extraction errors
if (!extractedText || extractedText.length === 0) {
  throw new TextExtractionException(
    'No text could be extracted from document',
    taskId,
  );
}
```

### Throwing System Errors

```typescript
import { FileSystemException, QueueException } from '../common/exceptions';

// File system errors
try {
  await fs.writeFile(path, data);
} catch (error) {
  throw new FileSystemException('write', path, taskId);
}

// Queue errors
if (!this.queue.isReady()) {
  throw new QueueException('Queue service is not available', taskId);
}
```

### Throwing Security Errors

```typescript
import {
  MaliciousFileException,
  RateLimitExceededException,
} from '../common/exceptions';

// Malicious file detection
if (this.containsMalware(file)) {
  throw new MaliciousFileException(
    file.originalname,
    'Malware signature detected',
    taskId,
  );
}

// Rate limiting
if (this.isRateLimited(clientId)) {
  throw new RateLimitExceededException(100, '1 hour');
}
```

## Error Response Examples

### Validation Error Response

```json
{
  "statusCode": 400,
  "message": "File 'document.txt': File type 'text/plain' is not supported. Allowed types: image/png, image/jpeg, application/pdf",
  "error": "Validation Error",
  "timestamp": "2024-01-15T10:30:00.000Z",
  "path": "/api/documents/upload",
  "taskId": "task-123"
}
```

### Processing Error Response

```json
{
  "statusCode": 422,
  "message": "AI model error: Model failed to initialize",
  "error": "Processing Error",
  "timestamp": "2024-01-15T10:35:00.000Z",
  "path": "/api/documents/upload",
  "taskId": "task-456"
}
```

### System Error Response

```json
{
  "statusCode": 404,
  "message": "Task with ID 'nonexistent-task' not found",
  "error": "Not Found",
  "timestamp": "2024-01-15T10:40:00.000Z",
  "path": "/api/tasks/nonexistent-task/status",
  "taskId": "nonexistent-task"
}
```

### Security Error Response

```json
{
  "statusCode": 403,
  "message": "File 'suspicious.exe' rejected due to security concerns: Contains executable code",
  "error": "Security Error",
  "timestamp": "2024-01-15T10:45:00.000Z",
  "path": "/api/documents/upload",
  "taskId": "task-789"
}
```

## Best Practices

### 1. Use Appropriate Exception Types

- Choose the most specific exception class for your error
- Include taskId when available for better traceability
- Provide clear, actionable error messages

### 2. Error Message Guidelines

- Be specific about what went wrong
- Include relevant context (file names, limits, etc.)
- Don't expose sensitive system information
- Use consistent language and terminology

### 3. HTTP Status Code Guidelines

- 400 Bad Request: Client-side validation errors
- 401 Unauthorized: Authentication required
- 403 Forbidden: Access denied or security violations
- 404 Not Found: Resource not found
- 422 Unprocessable Entity: Processing failures
- 429 Too Many Requests: Rate limiting
- 500 Internal Server Error: Unexpected system errors
- 503 Service Unavailable: Service temporarily unavailable

### 4. Logging Considerations

- The global exception filter automatically logs all errors
- Sensitive information is not included in logs
- Stack traces are logged for debugging but not exposed to clients
- Include taskId in logs for correlation

### 5. Testing Error Handling

- Test all error scenarios in your unit tests
- Verify correct HTTP status codes
- Check error message quality and consistency
- Ensure no sensitive information is exposed
- Test error response format compliance

## Configuration

The error handling system is automatically configured when the global exception filter is registered in `main.ts`:

```typescript
app.useGlobalFilters(new GlobalExceptionFilter());
```

No additional configuration is required. The system will automatically:

- Catch all unhandled exceptions
- Format error responses consistently
- Log errors appropriately
- Return proper HTTP status codes

## Monitoring and Debugging

### Error Logs

All errors are logged with the following information:

- HTTP status code
- Error message
- Stack trace (for debugging)
- Request path
- Timestamp

### Error Tracking

- Use taskId to correlate errors with specific processing tasks
- Monitor error patterns to identify system issues
- Track error rates by endpoint and error type

### Health Monitoring

- Monitor 5xx error rates for system health
- Track 4xx error rates for client issues
- Set up alerts for unusual error patterns

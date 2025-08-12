# Frontend API Testing Guide

This guide shows you how to test the Document Processing API from your frontend application.

## API Overview

The API runs on `http://localhost:3000` (or your configured port) and provides the following endpoints:

### 📋 Available Endpoints

1. **Document Upload**: `POST /api/documents/upload`
2. **Task Status**: `GET /api/tasks/{taskId}/status`
3. **Task Result**: `GET /api/tasks/{taskId}/result`
4. **Health Check**: `GET /health`
5. **Root**: `GET /`

## 🚀 Quick Start Examples

### 1. JavaScript/TypeScript (Vanilla)

```javascript
// Upload a document
async function uploadDocument(file, options = {}) {
  const formData = new FormData();
  formData.append('file', file);

  // Optional: Add processing options
  if (options.extractText !== undefined) {
    formData.append('extractText', options.extractText.toString());
  }
  if (options.summarize !== undefined) {
    formData.append('summarize', options.summarize.toString());
  }

  try {
    const response = await fetch('http://localhost:3000/api/documents/upload', {
      method: 'POST',
      body: formData,
      headers: {
        // Don't set Content-Type - let browser set it with boundary
      },
    });

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const result = await response.json();
    console.log('Upload successful:', result);
    return result.taskId;
  } catch (error) {
    console.error('Upload failed:', error);
    throw error;
  }
}

// Check task status
async function checkTaskStatus(taskId) {
  try {
    const response = await fetch(
      `http://localhost:3000/api/tasks/${taskId}/status`,
    );

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const status = await response.json();
    console.log('Task status:', status);
    return status;
  } catch (error) {
    console.error('Status check failed:', error);
    throw error;
  }
}

// Get task result
async function getTaskResult(taskId) {
  try {
    const response = await fetch(
      `http://localhost:3000/api/tasks/${taskId}/result`,
    );

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const result = await response.json();
    console.log('Task result:', result);
    return result;
  } catch (error) {
    console.error('Result fetch failed:', error);
    throw error;
  }
}

// Complete workflow example
async function processDocument(file) {
  try {
    // 1. Upload document
    const taskId = await uploadDocument(file, {
      extractText: true,
      summarize: true,
    });

    // 2. Poll for completion
    let status;
    do {
      await new Promise((resolve) => setTimeout(resolve, 2000)); // Wait 2 seconds
      status = await checkTaskStatus(taskId);
    } while (status.status === 'processing' || status.status === 'pending');

    // 3. Get result if completed
    if (status.status === 'completed') {
      const result = await getTaskResult(taskId);
      return result;
    } else {
      throw new Error(`Task failed: ${status.error}`);
    }
  } catch (error) {
    console.error('Document processing failed:', error);
    throw error;
  }
}
```

### 2. React Example

```jsx
import React, { useState, useCallback } from 'react';

const DocumentUploader = () => {
  const [file, setFile] = useState(null);
  const [taskId, setTaskId] = useState(null);
  const [status, setStatus] = useState(null);
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const handleFileChange = (event) => {
    setFile(event.target.files[0]);
    setError(null);
  };

  const uploadDocument = useCallback(async () => {
    if (!file) return;

    setLoading(true);
    setError(null);

    const formData = new FormData();
    formData.append('file', file);
    formData.append('extractText', 'true');
    formData.append('summarize', 'true');

    try {
      const response = await fetch(
        'http://localhost:3000/api/documents/upload',
        {
          method: 'POST',
          body: formData,
        },
      );

      if (!response.ok) {
        throw new Error(`Upload failed: ${response.status}`);
      }

      const data = await response.json();
      setTaskId(data.taskId);

      // Start polling for status
      pollTaskStatus(data.taskId);
    } catch (err) {
      setError(err.message);
      setLoading(false);
    }
  }, [file]);

  const pollTaskStatus = useCallback(async (id) => {
    try {
      const response = await fetch(
        `http://localhost:3000/api/tasks/${id}/status`,
      );
      const statusData = await response.json();

      setStatus(statusData);

      if (statusData.status === 'completed') {
        // Get the result
        const resultResponse = await fetch(
          `http://localhost:3000/api/tasks/${id}/result`,
        );
        const resultData = await resultResponse.json();
        setResult(resultData);
        setLoading(false);
      } else if (statusData.status === 'failed') {
        setError(statusData.error || 'Processing failed');
        setLoading(false);
      } else {
        // Continue polling
        setTimeout(() => pollTaskStatus(id), 2000);
      }
    } catch (err) {
      setError(err.message);
      setLoading(false);
    }
  }, []);

  return (
    <div className="document-uploader">
      <h2>Document Processing Test</h2>

      <div className="upload-section">
        <input
          type="file"
          accept=".pdf,.png,.jpg,.jpeg"
          onChange={handleFileChange}
          disabled={loading}
        />
        <button onClick={uploadDocument} disabled={!file || loading}>
          {loading ? 'Processing...' : 'Upload & Process'}
        </button>
      </div>

      {error && (
        <div className="error">
          <strong>Error:</strong> {error}
        </div>
      )}

      {taskId && (
        <div className="task-info">
          <h3>Task ID: {taskId}</h3>
          {status && (
            <div>
              <p>
                <strong>Status:</strong> {status.status}
              </p>
              <p>
                <strong>Progress:</strong> {status.progress}%
              </p>
              <p>
                <strong>File:</strong> {status.fileName}
              </p>
            </div>
          )}
        </div>
      )}

      {result && (
        <div className="result">
          <h3>Processing Result:</h3>
          <pre>{JSON.stringify(result, null, 2)}</pre>
        </div>
      )}
    </div>
  );
};

export default DocumentUploader;
```

### 3. Vue.js Example

```vue
<template>
  <div class="document-uploader">
    <h2>Document Processing Test</h2>

    <div class="upload-section">
      <input
        type="file"
        accept=".pdf,.png,.jpg,.jpeg"
        @change="handleFileChange"
        :disabled="loading"
      />
      <button @click="uploadDocument" :disabled="!file || loading">
        {{ loading ? 'Processing...' : 'Upload & Process' }}
      </button>
    </div>

    <div v-if="error" class="error"><strong>Error:</strong> {{ error }}</div>

    <div v-if="taskId" class="task-info">
      <h3>Task ID: {{ taskId }}</h3>
      <div v-if="status">
        <p><strong>Status:</strong> {{ status.status }}</p>
        <p><strong>Progress:</strong> {{ status.progress }}%</p>
        <p><strong>File:</strong> {{ status.fileName }}</p>
      </div>
    </div>

    <div v-if="result" class="result">
      <h3>Processing Result:</h3>
      <pre>{{ JSON.stringify(result, null, 2) }}</pre>
    </div>
  </div>
</template>

<script>
export default {
  name: 'DocumentUploader',
  data() {
    return {
      file: null,
      taskId: null,
      status: null,
      result: null,
      loading: false,
      error: null,
    };
  },
  methods: {
    handleFileChange(event) {
      this.file = event.target.files[0];
      this.error = null;
    },

    async uploadDocument() {
      if (!this.file) return;

      this.loading = true;
      this.error = null;

      const formData = new FormData();
      formData.append('file', this.file);
      formData.append('extractText', 'true');
      formData.append('summarize', 'true');

      try {
        const response = await fetch(
          'http://localhost:3000/api/documents/upload',
          {
            method: 'POST',
            body: formData,
          },
        );

        if (!response.ok) {
          throw new Error(`Upload failed: ${response.status}`);
        }

        const data = await response.json();
        this.taskId = data.taskId;

        // Start polling for status
        this.pollTaskStatus(data.taskId);
      } catch (err) {
        this.error = err.message;
        this.loading = false;
      }
    },

    async pollTaskStatus(id) {
      try {
        const response = await fetch(
          `http://localhost:3000/api/tasks/${id}/status`,
        );
        const statusData = await response.json();

        this.status = statusData;

        if (statusData.status === 'completed') {
          // Get the result
          const resultResponse = await fetch(
            `http://localhost:3000/api/tasks/${id}/result`,
          );
          const resultData = await resultResponse.json();
          this.result = resultData;
          this.loading = false;
        } else if (statusData.status === 'failed') {
          this.error = statusData.error || 'Processing failed';
          this.loading = false;
        } else {
          // Continue polling
          setTimeout(() => this.pollTaskStatus(id), 2000);
        }
      } catch (err) {
        this.error = err.message;
        this.loading = false;
      }
    },
  },
};
</script>
```

### 4. Nuxt 3 Example (Composables)

```typescript
// composables/useDocumentProcessor.ts
export const useDocumentProcessor = () => {
  const config = useRuntimeConfig();
  const apiBase = config.public.apiUrl || 'http://localhost:3000';

  const uploadDocument = async (file: File, options: any = {}) => {
    const formData = new FormData();
    formData.append('file', file);

    Object.keys(options).forEach((key) => {
      formData.append(key, options[key].toString());
    });

    const { data } = await $fetch(`${apiBase}/api/documents/upload`, {
      method: 'POST',
      body: formData,
    });

    return data;
  };

  const getTaskStatus = async (taskId: string) => {
    return await $fetch(`${apiBase}/api/tasks/${taskId}/status`);
  };

  const getTaskResult = async (taskId: string) => {
    return await $fetch(`${apiBase}/api/tasks/${taskId}/result`);
  };

  const processDocument = async (file: File, options: any = {}) => {
    // Upload
    const uploadResult = await uploadDocument(file, options);
    const taskId = uploadResult.taskId;

    // Poll for completion
    return new Promise((resolve, reject) => {
      const poll = async () => {
        try {
          const status = await getTaskStatus(taskId);

          if (status.status === 'completed') {
            const result = await getTaskResult(taskId);
            resolve(result);
          } else if (status.status === 'failed') {
            reject(new Error(status.error || 'Processing failed'));
          } else {
            setTimeout(poll, 2000);
          }
        } catch (error) {
          reject(error);
        }
      };

      poll();
    });
  };

  return {
    uploadDocument,
    getTaskStatus,
    getTaskResult,
    processDocument,
  };
};
```

```vue
<!-- pages/test-api.vue -->
<template>
  <div class="container">
    <h1>API Testing Page</h1>

    <div class="upload-form">
      <input
        ref="fileInput"
        type="file"
        accept=".pdf,.png,.jpg,.jpeg"
        @change="handleFileSelect"
      />

      <div class="options">
        <label>
          <input v-model="extractText" type="checkbox" />
          Extract Text
        </label>
        <label>
          <input v-model="summarize" type="checkbox" />
          Summarize
        </label>
      </div>

      <button @click="processFile" :disabled="!selectedFile || processing">
        {{ processing ? 'Processing...' : 'Process Document' }}
      </button>
    </div>

    <div v-if="error" class="error">
      {{ error }}
    </div>

    <div v-if="result" class="result">
      <h2>Result:</h2>
      <pre>{{ JSON.stringify(result, null, 2) }}</pre>
    </div>
  </div>
</template>

<script setup>
const { processDocument } = useDocumentProcessor();

const selectedFile = ref(null);
const extractText = ref(true);
const summarize = ref(false);
const processing = ref(false);
const error = ref(null);
const result = ref(null);

const handleFileSelect = (event) => {
  selectedFile.value = event.target.files[0];
  error.value = null;
  result.value = null;
};

const processFile = async () => {
  if (!selectedFile.value) return;

  processing.value = true;
  error.value = null;

  try {
    const options = {
      extractText: extractText.value,
      summarize: summarize.value,
    };

    result.value = await processDocument(selectedFile.value, options);
  } catch (err) {
    error.value = err.message;
  } finally {
    processing.value = false;
  }
};
</script>
```

## 🧪 Testing with cURL

For quick API testing from command line:

```bash
# Health check
curl http://localhost:3000/health

# Upload a document
curl -X POST \
  -F "file=@/path/to/your/document.pdf" \
  -F "extractText=true" \
  -F "summarize=true" \
  http://localhost:3000/api/documents/upload

# Check task status (replace TASK_ID with actual ID)
curl http://localhost:3000/api/tasks/TASK_ID/status

# Get task result
curl http://localhost:3000/api/tasks/TASK_ID/result
```

## 🧪 Testing with Postman

1. **Upload Document**:
   - Method: `POST`
   - URL: `http://localhost:3000/api/documents/upload`
   - Body: `form-data`
     - Key: `file`, Type: `File`, Value: Select your PDF/image
     - Key: `extractText`, Type: `Text`, Value: `true`
     - Key: `summarize`, Type: `Text`, Value: `true`

2. **Check Status**:
   - Method: `GET`
   - URL: `http://localhost:3000/api/tasks/{taskId}/status`

3. **Get Result**:
   - Method: `GET`
   - URL: `http://localhost:3000/api/tasks/{taskId}/result`

## 📊 API Response Examples

### Upload Response

```json
{
  "success": true,
  "taskId": "uuid-task-id-here",
  "message": "File uploaded successfully and queued for processing"
}
```

### Status Response

```json
{
  "taskId": "uuid-task-id-here",
  "status": "processing",
  "progress": 45,
  "fileName": "document.pdf",
  "fileType": "application/pdf",
  "createdAt": "2024-01-15T10:30:00Z",
  "updatedAt": "2024-01-15T10:31:00Z",
  "error": null
}
```

### Result Response (Completed)

```json
{
  "taskId": "uuid-task-id-here",
  "status": "completed",
  "result": {
    "extractedText": "Document content here...",
    "summary": "Brief summary of the document...",
    "metadata": {
      "pageCount": 5,
      "processingTime": 2340,
      "confidence": 95.2
    }
  },
  "fileName": "document.pdf",
  "fileType": "application/pdf",
  "completedAt": "2024-01-15T10:32:00Z"
}
```

## 🔧 Configuration

### Environment Variables

Make sure your API is configured with:

```bash
# Server
PORT=3000
NODE_ENV=development

# CORS (for frontend testing)
CORS_ORIGIN=http://localhost:3001  # Your frontend URL

# File upload limits
MAX_FILE_SIZE=10485760  # 10MB
ALLOWED_FILE_TYPES=image/png,image/jpg,image/jpeg,application/pdf
```

### Frontend Configuration

In your frontend app, you might want to configure:

```javascript
// config.js
export const API_CONFIG = {
  baseUrl:
    process.env.NODE_ENV === 'production'
      ? 'https://your-api-domain.com'
      : 'http://localhost:3000',
  timeout: 30000,
  maxFileSize: 10 * 1024 * 1024, // 10MB
  allowedTypes: ['application/pdf', 'image/png', 'image/jpg', 'image/jpeg'],
};
```

## 🚨 Error Handling

Common error responses:

```json
// File too large
{
  "statusCode": 400,
  "message": "File size exceeds limit",
  "error": "Bad Request"
}

// Invalid file type
{
  "statusCode": 400,
  "message": "Invalid file type. Allowed: PDF, PNG, JPG, JPEG",
  "error": "Bad Request"
}

// Task not found
{
  "statusCode": 404,
  "message": "Task with ID xyz not found",
  "error": "Not Found"
}

// Processing failed
{
  "taskId": "uuid-task-id-here",
  "status": "failed",
  "error": "OCR processing failed: insufficient image quality"
}
```

## 🎯 Best Practices

1. **File Validation**: Always validate file size and type on frontend before upload
2. **Progress Feedback**: Show upload progress and processing status to users
3. **Error Handling**: Implement proper error handling and user feedback
4. **Polling Strategy**: Use exponential backoff for status polling to reduce server load
5. **Timeout Handling**: Set reasonable timeouts for long-running operations
6. **Security**: Never expose sensitive data in client-side code

## 🔍 Debugging Tips

1. **Check Network Tab**: Use browser dev tools to inspect requests/responses
2. **CORS Issues**: Ensure CORS is properly configured for your frontend domain
3. **File Upload Issues**: Check file size limits and content types
4. **API Logs**: Check server logs for detailed error information
5. **Health Endpoint**: Use `/health` to verify API is running

This guide should help you get started with testing the Document Processing API from your frontend application. The API supports both regular PDFs and scanned PDFs with OCR processing, and includes comprehensive error handling and monitoring capabilities.

import { registerAs } from '@nestjs/config';

export default registerAs('app', () => ({
  port: parseInt(process.env.PORT || '3000', 10),
  maxFileSize: process.env.MAX_FILE_SIZE || '10MB',
  supportedFormats: process.env.SUPPORTED_FORMATS?.split(',') || [
    'png',
    'jpg',
    'jpeg',
    'pdf',
  ],
  maxConcurrentJobs: parseInt(process.env.MAX_CONCURRENT_JOBS || '10', 10),
  tempDir: process.env.TEMP_DIR || '/tmp/document-processing',
  aiModelPath: process.env.AI_MODEL_PATH || '/models/local-model',
  cleanupInterval: parseInt(process.env.CLEANUP_INTERVAL || '300000', 10), // 5 minutes
  frontendUrl: process.env.FRONTEND_URL || 'http://localhost:3001',
  shutdownTimeout: parseInt(process.env.SHUTDOWN_TIMEOUT || '30000', 10), // 30 seconds
}));

import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import * as request from 'supertest';
import { App } from 'supertest/types';
import { AppModule } from '../src/app.module';
import * as path from 'path';
import * as fs from 'fs';

describe('Upload Controller (e2e)', () => {
  let app: INestApplication<App>;

  beforeEach(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    await app.init();
  });

  afterEach(async () => {
    await app.close();
  });

  describe('POST /api/documents/upload', () => {
    it('should successfully upload a valid PNG file', async () => {
      // Create a minimal valid PNG file buffer
      const pngBuffer = Buffer.from([
        0x89,
        0x50,
        0x4e,
        0x47,
        0x0d,
        0x0a,
        0x1a,
        0x0a, // PNG signature
        0x00,
        0x00,
        0x00,
        0x0d, // IHDR chunk length
        0x49,
        0x48,
        0x44,
        0x52, // IHDR
        0x00,
        0x00,
        0x00,
        0x01, // width: 1
        0x00,
        0x00,
        0x00,
        0x01, // height: 1
        0x08,
        0x02,
        0x00,
        0x00,
        0x00, // bit depth, color type, compression, filter, interlace
        0x90,
        0x77,
        0x53,
        0xde, // CRC
        0x00,
        0x00,
        0x00,
        0x00, // IEND chunk length
        0x49,
        0x45,
        0x4e,
        0x44, // IEND
        0xae,
        0x42,
        0x60,
        0x82, // CRC
      ]);

      const response = await request(app.getHttpServer())
        .post('/api/documents/upload')
        .attach('file', pngBuffer, 'test.png')
        .expect(200);

      expect(response.body).toHaveProperty('statusCode', 200);
      expect(response.body).toHaveProperty(
        'message',
        'File uploaded successfully',
      );
      expect(response.body).toHaveProperty('taskId');
      expect(response.body).toHaveProperty('fileName', 'test.png');
      expect(response.body).toHaveProperty('fileSize');
      expect(response.body.taskId).toMatch(
        /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i,
      );
    });

    it('should successfully upload a valid JPEG file', async () => {
      // Create a minimal valid JPEG file buffer
      const jpegBuffer = Buffer.from([
        0xff,
        0xd8,
        0xff,
        0xe0, // JPEG signature
        0x00,
        0x10, // length
        0x4a,
        0x46,
        0x49,
        0x46,
        0x00, // JFIF
        0x01,
        0x01,
        0x01,
        0x00,
        0x48,
        0x00,
        0x48,
        0x00,
        0x00,
        0xff,
        0xd9, // End of image
      ]);

      const response = await request(app.getHttpServer())
        .post('/api/documents/upload')
        .attach('file', jpegBuffer, 'test.jpg')
        .expect(200);

      expect(response.body).toHaveProperty('statusCode', 200);
      expect(response.body).toHaveProperty('taskId');
      expect(response.body).toHaveProperty('fileName', 'test.jpg');
    });

    it('should successfully upload a valid PDF file', async () => {
      // Create a minimal valid PDF file buffer
      const pdfBuffer = Buffer.from([
        0x25,
        0x50,
        0x44,
        0x46,
        0x2d,
        0x31,
        0x2e,
        0x34, // %PDF-1.4
        0x0a,
        0x25,
        0xe2,
        0xe3,
        0xcf,
        0xd3,
        0x0a, // binary comment
        0x0a,
        0x31,
        0x20,
        0x30,
        0x20,
        0x6f,
        0x62,
        0x6a,
        0x0a, // 1 0 obj
        0x3c,
        0x3c,
        0x0a,
        0x2f,
        0x54,
        0x79,
        0x70,
        0x65,
        0x20,
        0x2f,
        0x43,
        0x61,
        0x74,
        0x61,
        0x6c,
        0x6f,
        0x67,
        0x0a, // <</Type /Catalog
        0x2f,
        0x50,
        0x61,
        0x67,
        0x65,
        0x73,
        0x20,
        0x32,
        0x20,
        0x30,
        0x20,
        0x52,
        0x0a, // /Pages 2 0 R
        0x3e,
        0x3e,
        0x0a,
        0x65,
        0x6e,
        0x64,
        0x6f,
        0x62,
        0x6a,
        0x0a, // >>endobj
      ]);

      const response = await request(app.getHttpServer())
        .post('/api/documents/upload')
        .attach('file', pdfBuffer, 'test.pdf')
        .expect(200);

      expect(response.body).toHaveProperty('statusCode', 200);
      expect(response.body).toHaveProperty('taskId');
      expect(response.body).toHaveProperty('fileName', 'test.pdf');
    });

    it('should reject upload when no file is provided', async () => {
      const response = await request(app.getHttpServer())
        .post('/api/documents/upload')
        .expect(400);

      expect(response.body).toHaveProperty('statusCode', 400);
      expect(response.body).toHaveProperty('message', 'No file provided');
    });

    it('should reject unsupported file types', async () => {
      const txtBuffer = Buffer.from('This is a text file');

      const response = await request(app.getHttpServer())
        .post('/api/documents/upload')
        .attach('file', txtBuffer, 'test.txt')
        .expect(400);

      expect(response.body).toHaveProperty('statusCode', 400);
      expect(response.body.message).toContain('Unsupported file type');
    });

    it('should reject files that are too large', async () => {
      // Create a buffer larger than the configured max size (assuming 10MB default)
      const largeBuffer = Buffer.alloc(11 * 1024 * 1024); // 11MB
      // Add PNG signature to make it a valid PNG format
      largeBuffer[0] = 0x89;
      largeBuffer[1] = 0x50;
      largeBuffer[2] = 0x4e;
      largeBuffer[3] = 0x47;

      const response = await request(app.getHttpServer())
        .post('/api/documents/upload')
        .attach('file', largeBuffer, 'large.png')
        .expect(400);

      expect(response.body).toHaveProperty('statusCode', 400);
      expect(response.body.message).toContain('exceeds maximum allowed size');
    });

    it('should reject empty files', async () => {
      const emptyBuffer = Buffer.alloc(0);

      const response = await request(app.getHttpServer())
        .post('/api/documents/upload')
        .attach('file', emptyBuffer, 'empty.png')
        .expect(400);

      expect(response.body).toHaveProperty('statusCode', 400);
      expect(response.body.message).toContain('File cannot be empty');
    });

    it('should reject files with invalid MIME types', async () => {
      // Create a file with PNG extension but wrong MIME type
      const fakeBuffer = Buffer.from('fake content');

      const response = await request(app.getHttpServer())
        .post('/api/documents/upload')
        .field('Content-Type', 'text/plain')
        .attach('file', fakeBuffer, 'fake.png')
        .expect(400);

      expect(response.body).toHaveProperty('statusCode', 400);
    });

    it('should accept upload options', async () => {
      const pngBuffer = Buffer.from([
        0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00, 0x00, 0x00, 0x0d,
        0x49, 0x48, 0x44, 0x52, 0x00, 0x00, 0x00, 0x01, 0x00, 0x00, 0x00, 0x01,
        0x08, 0x02, 0x00, 0x00, 0x00, 0x90, 0x77, 0x53, 0xde, 0x00, 0x00, 0x00,
        0x00, 0x49, 0x45, 0x4e, 0x44, 0xae, 0x42, 0x60, 0x82,
      ]);

      const response = await request(app.getHttpServer())
        .post('/api/documents/upload')
        .attach('file', pngBuffer, 'test.png')
        .field('generateSummary', 'true')
        .field('maxSummaryLength', '300')
        .expect(200);

      expect(response.body).toHaveProperty('statusCode', 200);
      expect(response.body).toHaveProperty('taskId');
    });
  });
});

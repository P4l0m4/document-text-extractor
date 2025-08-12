import { Test, TestingModule } from '@nestjs/testing';
import { InputSanitizationService } from './input-sanitization.service';

describe('InputSanitizationService', () => {
  let service: InputSanitizationService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [InputSanitizationService],
    }).compile();

    service = module.get<InputSanitizationService>(InputSanitizationService);
  });

  describe('sanitizeString', () => {
    it('should remove HTML tags', () => {
      const input = '<script>alert("xss")</script>Hello World<div>test</div>';
      const result = service.sanitizeString(input);
      expect(result).toBe('Hello Worldtest');
    });

    it('should remove script tags completely', () => {
      const input = '<script src="malicious.js"></script>Safe content';
      const result = service.sanitizeString(input);
      expect(result).toBe('Safe content');
    });

    it('should remove dangerous characters', () => {
      const input = 'Hello<>&"\'World';
      const result = service.sanitizeString(input);
      expect(result).toBe('HelloWorld');
    });

    it('should trim whitespace', () => {
      const input = '   Hello World   ';
      const result = service.sanitizeString(input);
      expect(result).toBe('Hello World');
    });

    it('should handle null and undefined inputs', () => {
      expect(service.sanitizeString(null as any)).toBe('');
      expect(service.sanitizeString(undefined as any)).toBe('');
    });

    it('should handle non-string inputs', () => {
      expect(service.sanitizeString(123 as any)).toBe('');
      expect(service.sanitizeString({} as any)).toBe('');
    });

    it('should handle empty string', () => {
      expect(service.sanitizeString('')).toBe('');
    });
  });

  describe('sanitizeFilename', () => {
    it('should remove path separators', () => {
      const input = '../../../etc/passwd';
      const result = service.sanitizeFilename(input);
      expect(result).toBe('etcpasswd');
    });

    it('should remove dangerous characters', () => {
      const input = 'file:name*with?dangerous<chars>|.txt';
      const result = service.sanitizeFilename(input);
      expect(result).toBe('filenamewithdangerouschars.txt');
    });

    it('should remove leading dots', () => {
      const input = '...hidden-file.txt';
      const result = service.sanitizeFilename(input);
      expect(result).toBe('hidden-file.txt');
    });

    it('should limit filename length', () => {
      const longFilename = 'a'.repeat(300) + '.txt';
      const result = service.sanitizeFilename(longFilename);
      expect(result.length).toBeLessThanOrEqual(255);
    });

    it('should handle null and undefined inputs', () => {
      expect(service.sanitizeFilename(null as any)).toBe('');
      expect(service.sanitizeFilename(undefined as any)).toBe('');
    });

    it('should handle valid filenames', () => {
      const input = 'document.pdf';
      const result = service.sanitizeFilename(input);
      expect(result).toBe('document.pdf');
    });
  });

  describe('sanitizeTaskId', () => {
    it('should allow valid UUID format', () => {
      const input = '123e4567-e89b-12d3-a456-426614174000';
      const result = service.sanitizeTaskId(input);
      expect(result).toBe('123e4567-e89b-12d3-a456-426614174000');
    });

    it('should remove non-alphanumeric and non-hyphen characters', () => {
      const input = '123e4567-e89b-12d3-a456-426614174000!@#$%^&*()';
      const result = service.sanitizeTaskId(input);
      expect(result).toBe('123e4567-e89b-12d3-a456-426614174000');
    });

    it('should handle malicious input', () => {
      const input = '<script>alert("xss")</script>123-abc';
      const result = service.sanitizeTaskId(input);
      expect(result).toBe('scriptalertxssscript123-abc');
    });

    it('should handle null and undefined inputs', () => {
      expect(service.sanitizeTaskId(null as any)).toBe('');
      expect(service.sanitizeTaskId(undefined as any)).toBe('');
    });

    it('should handle empty string', () => {
      expect(service.sanitizeTaskId('')).toBe('');
    });
  });

  describe('sanitizeObject', () => {
    it('should sanitize string properties', () => {
      const input = {
        name: '<script>alert("xss")</script>John',
        description: 'Hello<>&"\'World',
      };
      const result = service.sanitizeObject(input);
      expect(result.name).toBe('John');
      expect(result.description).toBe('HelloWorld');
    });

    it('should sanitize nested objects', () => {
      const input = {
        user: {
          name: '<script>alert("xss")</script>John',
          profile: {
            bio: 'Hello<>&"\'World',
          },
        },
      };
      const result = service.sanitizeObject(input);
      expect(result.user.name).toBe('John');
      expect(result.user.profile.bio).toBe('HelloWorld');
    });

    it('should sanitize arrays', () => {
      const input = {
        tags: ['<script>tag1</script>', 'tag2<>&"\'', 'tag3'],
      };
      const result = service.sanitizeObject(input);
      expect(result.tags).toEqual(['', 'tag2', 'tag3']);
    });

    it('should handle mixed data types', () => {
      const input = {
        name: '<script>John</script>',
        age: 30,
        active: true,
        tags: ['<script>tag1</script>', 'tag2'],
        metadata: null,
        undefined: undefined,
      };
      const result = service.sanitizeObject(input);
      expect(result.name).toBe('');
      expect(result.age).toBe(30);
      expect(result.active).toBe(true);
      expect(result.tags).toEqual(['', 'tag2']);
      expect(result.metadata).toBeNull();
      expect(result.undefined).toBeUndefined();
    });

    it('should sanitize object keys', () => {
      const input = {
        '<script>malicious</script>key': 'value',
        normal_key: 'value2',
      };
      const result = service.sanitizeObject(input);
      expect(result['key']).toBe('value');
      expect(result['normal_key']).toBe('value2');
    });

    it('should handle null and undefined inputs', () => {
      expect(service.sanitizeObject(null)).toBeNull();
      expect(service.sanitizeObject(undefined)).toBeUndefined();
    });

    it('should handle primitive values', () => {
      expect(service.sanitizeObject('<script>test</script>')).toBe('');
      expect(service.sanitizeObject(123)).toBe(123);
      expect(service.sanitizeObject(true)).toBe(true);
    });

    it('should handle empty objects and arrays', () => {
      expect(service.sanitizeObject({})).toEqual({});
      expect(service.sanitizeObject([])).toEqual([]);
    });
  });
});

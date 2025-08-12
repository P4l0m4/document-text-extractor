import { Test, TestingModule } from '@nestjs/testing';
import { ConfigModule, ConfigService } from '@nestjs/config';
import configuration from './configuration';
import { EnvironmentVariables } from './validation';
import { plainToClass, validateSync } from 'class-transformer';

function validate(config: Record<string, unknown>) {
  const validatedConfig = plainToClass(EnvironmentVariables, config, {
    enableImplicitConversion: true,
  });
  const errors = validateSync(validatedConfig, {
    skipMissingProperties: false,
  });

  if (errors.length > 0) {
    throw new Error(errors.toString());
  }
  return validatedConfig;
}

describe('Configuration', () => {
  let configService: ConfigService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      imports: [
        ConfigModule.forRoot({
          load: [configuration],
          validate,
        }),
      ],
    }).compile();

    configService = module.get<ConfigService>(ConfigService);
  });

  it('should load default configuration values', () => {
    expect(configService.get<number>('app.port')).toBe(3000);
    expect(configService.get<string>('app.maxFileSize')).toBe('10MB');
    expect(configService.get<string[]>('app.supportedFormats')).toEqual([
      'png',
      'jpg',
      'jpeg',
      'pdf',
    ]);
    expect(configService.get<number>('app.maxConcurrentJobs')).toBe(10);
  });

  it('should validate environment variables', () => {
    const validConfig = {
      PORT: '3000',
      MAX_FILE_SIZE: '10MB',
      SUPPORTED_FORMATS: 'png,jpg,jpeg,pdf',
      MAX_CONCURRENT_JOBS: '10',
    };

    expect(() => validate(validConfig)).not.toThrow();
  });

  it('should reject invalid port values', () => {
    const invalidConfig = {
      PORT: '99999', // Invalid port
    };

    expect(() => validate(invalidConfig)).toThrow();
  });
});

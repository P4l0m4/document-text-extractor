import {
  IsInt,
  IsOptional,
  IsString,
  Min,
  Max,
  IsUrl,
  IsBoolean,
  IsIn,
} from 'class-validator';
import { Transform } from 'class-transformer';

export class EnvironmentVariables {
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(65535)
  @Transform(({ value }) => parseInt(value, 10))
  PORT?: number = 3000;

  @IsOptional()
  @IsString()
  MAX_FILE_SIZE?: string = '10MB';

  @IsOptional()
  @IsString()
  SUPPORTED_FORMATS?: string = 'png,jpg,jpeg,pdf';

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(50)
  @Transform(({ value }) => parseInt(value, 10))
  MAX_CONCURRENT_JOBS?: number = 10;

  @IsOptional()
  @IsString()
  TEMP_DIR?: string = '/tmp/document-processing';

  @IsOptional()
  @IsString()
  AI_MODEL_PATH?: string = '/models/local-model';

  @IsOptional()
  @IsInt()
  @Min(60000) // Minimum 1 minute
  @Transform(({ value }) => parseInt(value, 10))
  CLEANUP_INTERVAL?: number = 300000;

  @IsOptional()
  @IsString()
  FRONTEND_URL?: string = 'http://localhost:3000';

  @IsOptional()
  @IsInt()
  @Min(60000) // Minimum 1 minute
  @Transform(({ value }) => parseInt(value, 10))
  RATE_LIMIT_WINDOW_MS?: number = 900000; // 15 minutes

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(1000)
  @Transform(({ value }) => parseInt(value, 10))
  RATE_LIMIT_MAX_REQUESTS?: number = 100;

  // Enhanced security rate limiting configuration
  @IsOptional()
  @IsInt()
  @Min(1000) // Minimum 1 second
  @Transform(({ value }) => parseInt(value, 10))
  SECURITY_RATE_LIMIT_WINDOW_MS?: number = 1000; // 1 second

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(100)
  @Transform(({ value }) => parseInt(value, 10))
  SECURITY_RATE_LIMIT_MAX?: number = 3;

  // CORS allowed origins configuration
  @IsOptional()
  @IsString()
  SECURITY_CORS_ALLOWED_ORIGINS?: string =
    'https://supernotaire.fr,http://localhost:3001';

  // PDF Conversion Configuration
  @IsOptional()
  @IsBoolean()
  @Transform(({ value }) => {
    if (typeof value === 'string') {
      return value.toLowerCase() === 'true';
    }
    return Boolean(value);
  })
  PDF_CONVERSION_ENABLED?: boolean = true;

  @IsOptional()
  @IsInt()
  @Min(72)
  @Max(600)
  @Transform(({ value }) => parseInt(value, 10))
  PDF_CONVERSION_DPI?: number = 200;

  @IsOptional()
  @IsString()
  @IsIn(['png', 'jpg', 'jpeg'])
  PDF_CONVERSION_FORMAT?: string = 'png';

  @IsOptional()
  @IsInt()
  @Min(100)
  @Max(5000)
  @Transform(({ value }) => parseInt(value, 10))
  PDF_CONVERSION_WIDTH?: number = 2000;

  @IsOptional()
  @IsInt()
  @Min(100)
  @Max(5000)
  @Transform(({ value }) => parseInt(value, 10))
  PDF_CONVERSION_HEIGHT?: number = 2000;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(10)
  @Transform(({ value }) => parseInt(value, 10))
  PDF_CONVERSION_MAX_PAGES?: number = 1;

  @IsOptional()
  @IsInt()
  @Min(5000)
  @Max(300000)
  @Transform(({ value }) => parseInt(value, 10))
  PDF_CONVERSION_TIMEOUT?: number = 30000;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(10)
  @Transform(({ value }) => parseInt(value, 10))
  PDF_CONVERSION_MAX_CONCURRENT?: number = 3;

  @IsOptional()
  @IsString()
  PDF_TEMP_DIR?: string = '/tmp/document-processing/pdf-conversion';

  @IsOptional()
  @IsBoolean()
  @Transform(({ value }) => {
    if (typeof value === 'string') {
      return value.toLowerCase() === 'true';
    }
    return Boolean(value);
  })
  DEPENDENCY_CHECK_ON_STARTUP?: boolean = true;
}

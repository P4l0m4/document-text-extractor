import {
  IsOptional,
  IsBoolean,
  IsNumber,
  IsString,
  Min,
  Max,
} from 'class-validator';
import { Transform } from 'class-transformer';

export class FileUploadOptionsDto {
  @IsOptional()
  @IsBoolean()
  @Transform(({ value }) => {
    if (typeof value === 'string') {
      return value.toLowerCase() === 'true';
    }
    return Boolean(value);
  })
  generateSummary?: boolean = true;

  @IsOptional()
  @IsNumber()
  @Min(50)
  @Max(1000)
  @Transform(({ value }) => parseInt(value, 10))
  maxSummaryLength?: number = 200;

  @IsOptional()
  @IsString()
  summaryType?: 'extractive' | 'abstractive' = 'extractive';
}

import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { AiModelService } from './ai-model.service';
import { AiModelPoolService } from './ai-model-pool.service';
import { DependencyDetectionService } from './dependency-detection.service';
import { PdfConversionConfigService } from './pdf-conversion-config.service';
import { ScannedPdfMetricsService } from './scanned-pdf-metrics.service';
import { CommonModule } from '../common';

@Module({
  imports: [ConfigModule, CommonModule],
  providers: [
    AiModelService, 
    AiModelPoolService, 
    DependencyDetectionService, 
    PdfConversionConfigService,
    ScannedPdfMetricsService,
  ],
  exports: [
    AiModelService, 
    AiModelPoolService, 
    DependencyDetectionService, 
    PdfConversionConfigService,
    ScannedPdfMetricsService,
  ],
})
export class AiModule {}
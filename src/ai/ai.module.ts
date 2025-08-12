import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { AiModelService } from './ai-model.service';
import { AiModelPoolService } from './ai-model-pool.service';
import { DependencyDetectionService } from './dependency-detection.service';
import { PdfConversionConfigService } from './pdf-conversion-config.service';
import { ScannedPdfMetricsService } from './scanned-pdf-metrics.service';
import { ScannedPdfPerformanceMonitorService } from './performance-monitor.service';
import { OptimizedTempFileService } from './optimized-temp-file.service';
import { MemoryOptimizerService } from './memory-optimizer.service';
import { MetricsDashboardService } from './metrics-dashboard.service';
import { CommonModule } from '../common';
import { AiController } from './ai-controller';

@Module({
  imports: [ConfigModule, CommonModule],
  controllers: [AiController],
  providers: [
    AiModelService,
    AiModelPoolService,
    DependencyDetectionService,
    PdfConversionConfigService,
    ScannedPdfMetricsService,
    ScannedPdfPerformanceMonitorService,
    OptimizedTempFileService,
    MemoryOptimizerService,
    MetricsDashboardService,
  ],
  exports: [
    AiModelService,
    AiModelPoolService,
    DependencyDetectionService,
    PdfConversionConfigService,
    ScannedPdfMetricsService,
    ScannedPdfPerformanceMonitorService,
    OptimizedTempFileService,
    MemoryOptimizerService,
    MetricsDashboardService,
  ],
})
export class AiModule {}

import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { OptimizedFileIOService } from './services/optimized-file-io.service';
import { FileCleanupService } from './services/file-cleanup.service';
import { PerformanceMonitorService } from './monitoring/performance-monitor.service';
import { MetricsService } from './metrics/metrics.service';
import { MetricsInterceptor } from './interceptors/metrics.interceptor';
import { GracefulShutdownService } from './shutdown/graceful-shutdown.service';

@Module({
  imports: [ConfigModule],
  providers: [
    OptimizedFileIOService,
    FileCleanupService,
    PerformanceMonitorService,
    MetricsService,
    MetricsInterceptor,
    GracefulShutdownService,
  ],
  exports: [
    OptimizedFileIOService,
    FileCleanupService,
    PerformanceMonitorService,
    MetricsService,
    MetricsInterceptor,
    GracefulShutdownService,
  ],
})
export class CommonModule {}

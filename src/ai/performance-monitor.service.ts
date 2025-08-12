import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

export interface MemoryUsage {
  rss: number; // Resident Set Size
  heapTotal: number;
  heapUsed: number;
  external: number;
  arrayBuffers: number;
}

export interface PerformanceAlert {
  type: 'memory' | 'processing_time' | 'temp_files' | 'error_rate';
  severity: 'warning' | 'critical';
  message: string;
  value: number;
  threshold: number;
  timestamp: Date;
  sessionId?: string;
}

export interface PerformanceThresholds {
  memoryUsageMB: {
    warning: number;
    critical: number;
  };
  processingTimeMs: {
    warning: number;
    critical: number;
  };
  tempFileCount: {
    warning: number;
    critical: number;
  };
  errorRatePercent: {
    warning: number;
    critical: number;
  };
}

@Injectable()
export class ScannedPdfPerformanceMonitorService {
  private readonly logger = new Logger(ScannedPdfPerformanceMonitorService.name);
  
  private readonly thresholds: PerformanceThresholds;
  private readonly alerts: PerformanceAlert[] = [];
  private readonly maxAlerts = 100;
  
  // Memory monitoring
  private memorySnapshots: Array<{ timestamp: Date; usage: MemoryUsage }> = [];
  private readonly maxMemorySnapshots = 50;
  
  // Performance tracking
  private processingTimes: Array<{ timestamp: Date; duration: number; sessionId: string }> = [];
  private readonly maxProcessingTimes = 100;
  
  // Temp file tracking
  private tempFileOperations: Array<{ timestamp: Date; operation: 'create' | 'cleanup'; count: number; path?: string }> = [];
  private readonly maxTempFileOperations = 200;

  constructor(private readonly configService: ConfigService) {
    this.thresholds = this.loadThresholds();
    this.startMemoryMonitoring();
    this.logThresholds();
  }

  /**
   * Load performance thresholds from configuration
   */
  private loadThresholds(): PerformanceThresholds {
    return {
      memoryUsageMB: {
        warning: this.configService.get<number>('PERF_MEMORY_WARNING_MB') || 512,
        critical: this.configService.get<number>('PERF_MEMORY_CRITICAL_MB') || 1024,
      },
      processingTimeMs: {
        warning: this.configService.get<number>('PERF_PROCESSING_WARNING_MS') || 15000,
        critical: this.configService.get<number>('PERF_PROCESSING_CRITICAL_MS') || 30000,
      },
      tempFileCount: {
        warning: this.configService.get<number>('PERF_TEMP_FILES_WARNING') || 50,
        critical: this.configService.get<number>('PERF_TEMP_FILES_CRITICAL') || 100,
      },
      errorRatePercent: {
        warning: this.configService.get<number>('PERF_ERROR_RATE_WARNING') || 10,
        critical: this.configService.get<number>('PERF_ERROR_RATE_CRITICAL') || 25,
      },
    };
  }

  /**
   * Start periodic memory monitoring
   */
  private startMemoryMonitoring(): void {
    const interval = this.configService.get<number>('PERF_MEMORY_CHECK_INTERVAL_MS') || 30000; // 30 seconds
    
    setInterval(() => {
      this.captureMemorySnapshot();
    }, interval);

    this.logger.log(`🔍 Memory monitoring started with ${interval}ms interval`);
  }

  /**
   * Capture current memory usage snapshot
   */
  private captureMemorySnapshot(): void {
    const usage = process.memoryUsage();
    const snapshot = {
      timestamp: new Date(),
      usage: {
        rss: usage.rss,
        heapTotal: usage.heapTotal,
        heapUsed: usage.heapUsed,
        external: usage.external,
        arrayBuffers: usage.arrayBuffers,
      },
    };

    this.memorySnapshots.push(snapshot);
    
    // Keep only recent snapshots
    if (this.memorySnapshots.length > this.maxMemorySnapshots) {
      this.memorySnapshots.shift();
    }

    // Check for memory alerts
    this.checkMemoryThresholds(snapshot.usage);
  }

  /**
   * Check memory usage against thresholds and generate alerts
   */
  private checkMemoryThresholds(usage: MemoryUsage): void {
    const heapUsedMB = usage.heapUsed / 1024 / 1024;
    const rssMB = usage.rss / 1024 / 1024;

    // Check heap usage
    if (heapUsedMB > this.thresholds.memoryUsageMB.critical) {
      this.createAlert('memory', 'critical', 
        `Heap memory usage critical: ${heapUsedMB.toFixed(1)}MB`, 
        heapUsedMB, this.thresholds.memoryUsageMB.critical);
    } else if (heapUsedMB > this.thresholds.memoryUsageMB.warning) {
      this.createAlert('memory', 'warning', 
        `Heap memory usage high: ${heapUsedMB.toFixed(1)}MB`, 
        heapUsedMB, this.thresholds.memoryUsageMB.warning);
    }

    // Check RSS usage
    if (rssMB > this.thresholds.memoryUsageMB.critical * 1.5) {
      this.createAlert('memory', 'critical', 
        `RSS memory usage critical: ${rssMB.toFixed(1)}MB`, 
        rssMB, this.thresholds.memoryUsageMB.critical * 1.5);
    }
  }

  /**
   * Record processing time and check thresholds
   */
  recordProcessingTime(sessionId: string, duration: number): void {
    const record = {
      timestamp: new Date(),
      duration,
      sessionId,
    };

    this.processingTimes.push(record);
    
    // Keep only recent processing times
    if (this.processingTimes.length > this.maxProcessingTimes) {
      this.processingTimes.shift();
    }

    // Check processing time thresholds
    if (duration > this.thresholds.processingTimeMs.critical) {
      this.createAlert('processing_time', 'critical', 
        `Processing time critical: ${duration}ms for session ${sessionId}`, 
        duration, this.thresholds.processingTimeMs.critical, sessionId);
    } else if (duration > this.thresholds.processingTimeMs.warning) {
      this.createAlert('processing_time', 'warning', 
        `Processing time high: ${duration}ms for session ${sessionId}`, 
        duration, this.thresholds.processingTimeMs.warning, sessionId);
    }
  }

  /**
   * Record temporary file operation
   */
  recordTempFileOperation(operation: 'create' | 'cleanup', count: number = 1, path?: string): void {
    const record = {
      timestamp: new Date(),
      operation,
      count,
      path,
    };

    this.tempFileOperations.push(record);
    
    // Keep only recent operations
    if (this.tempFileOperations.length > this.maxTempFileOperations) {
      this.tempFileOperations.shift();
    }

    // Check temp file count thresholds
    const currentTempFiles = this.getCurrentTempFileCount();
    if (currentTempFiles > this.thresholds.tempFileCount.critical) {
      this.createAlert('temp_files', 'critical', 
        `Temporary file count critical: ${currentTempFiles} files`, 
        currentTempFiles, this.thresholds.tempFileCount.critical);
    } else if (currentTempFiles > this.thresholds.tempFileCount.warning) {
      this.createAlert('temp_files', 'warning', 
        `Temporary file count high: ${currentTempFiles} files`, 
        currentTempFiles, this.thresholds.tempFileCount.warning);
    }
  }

  /**
   * Calculate current temporary file count based on operations
   */
  private getCurrentTempFileCount(): number {
    const recentOperations = this.tempFileOperations.filter(
      op => Date.now() - op.timestamp.getTime() < 300000 // Last 5 minutes
    );

    const created = recentOperations
      .filter(op => op.operation === 'create')
      .reduce((sum, op) => sum + op.count, 0);

    const cleaned = recentOperations
      .filter(op => op.operation === 'cleanup')
      .reduce((sum, op) => sum + op.count, 0);

    return Math.max(0, created - cleaned);
  }

  /**
   * Create and store performance alert
   */
  private createAlert(
    type: PerformanceAlert['type'], 
    severity: PerformanceAlert['severity'], 
    message: string, 
    value: number, 
    threshold: number, 
    sessionId?: string
  ): void {
    const alert: PerformanceAlert = {
      type,
      severity,
      message,
      value,
      threshold,
      timestamp: new Date(),
      sessionId,
    };

    this.alerts.push(alert);
    
    // Keep only recent alerts
    if (this.alerts.length > this.maxAlerts) {
      this.alerts.shift();
    }

    // Log alert based on severity
    const icon = severity === 'critical' ? '🚨' : '⚠️';
    const logMethod = severity === 'critical' ? 'error' : 'warn';
    
    this.logger[logMethod](`${icon} PERFORMANCE ALERT [${type.toUpperCase()}]: ${message}`);
  }

  /**
   * Get current memory usage
   */
  getCurrentMemoryUsage(): MemoryUsage {
    return process.memoryUsage();
  }

  /**
   * Get memory usage statistics
   */
  getMemoryStats(): {
    current: MemoryUsage;
    average: MemoryUsage;
    peak: MemoryUsage;
    snapshots: number;
  } {
    const current = this.getCurrentMemoryUsage();
    
    if (this.memorySnapshots.length === 0) {
      return {
        current,
        average: current,
        peak: current,
        snapshots: 0,
      };
    }

    const snapshots = this.memorySnapshots.map(s => s.usage);
    
    const average: MemoryUsage = {
      rss: snapshots.reduce((sum, s) => sum + s.rss, 0) / snapshots.length,
      heapTotal: snapshots.reduce((sum, s) => sum + s.heapTotal, 0) / snapshots.length,
      heapUsed: snapshots.reduce((sum, s) => sum + s.heapUsed, 0) / snapshots.length,
      external: snapshots.reduce((sum, s) => sum + s.external, 0) / snapshots.length,
      arrayBuffers: snapshots.reduce((sum, s) => sum + s.arrayBuffers, 0) / snapshots.length,
    };

    const peak: MemoryUsage = {
      rss: Math.max(...snapshots.map(s => s.rss)),
      heapTotal: Math.max(...snapshots.map(s => s.heapTotal)),
      heapUsed: Math.max(...snapshots.map(s => s.heapUsed)),
      external: Math.max(...snapshots.map(s => s.external)),
      arrayBuffers: Math.max(...snapshots.map(s => s.arrayBuffers)),
    };

    return {
      current,
      average,
      peak,
      snapshots: this.memorySnapshots.length,
    };
  }

  /**
   * Get processing time statistics
   */
  getProcessingTimeStats(): {
    count: number;
    average: number;
    median: number;
    p95: number;
    p99: number;
    min: number;
    max: number;
  } {
    if (this.processingTimes.length === 0) {
      return {
        count: 0,
        average: 0,
        median: 0,
        p95: 0,
        p99: 0,
        min: 0,
        max: 0,
      };
    }

    const durations = this.processingTimes.map(pt => pt.duration).sort((a, b) => a - b);
    const count = durations.length;
    
    return {
      count,
      average: durations.reduce((sum, d) => sum + d, 0) / count,
      median: durations[Math.floor(count / 2)],
      p95: durations[Math.floor(count * 0.95)],
      p99: durations[Math.floor(count * 0.99)],
      min: durations[0],
      max: durations[count - 1],
    };
  }

  /**
   * Get recent alerts
   */
  getRecentAlerts(count: number = 10): PerformanceAlert[] {
    return this.alerts.slice(-count).reverse();
  }

  /**
   * Get alerts by type and severity
   */
  getAlertsByType(type?: PerformanceAlert['type'], severity?: PerformanceAlert['severity']): PerformanceAlert[] {
    return this.alerts.filter(alert => {
      if (type && alert.type !== type) return false;
      if (severity && alert.severity !== severity) return false;
      return true;
    });
  }

  /**
   * Get comprehensive performance dashboard data
   */
  getPerformanceDashboard(): {
    memory: ReturnType<typeof this.getMemoryStats>;
    processingTimes: ReturnType<typeof this.getProcessingTimeStats>;
    tempFiles: {
      current: number;
      recentOperations: number;
      createOperations: number;
      cleanupOperations: number;
    };
    alerts: {
      total: number;
      critical: number;
      warnings: number;
      recent: PerformanceAlert[];
    };
    thresholds: PerformanceThresholds;
  } {
    const recentTempOps = this.tempFileOperations.filter(
      op => Date.now() - op.timestamp.getTime() < 300000 // Last 5 minutes
    );

    return {
      memory: this.getMemoryStats(),
      processingTimes: this.getProcessingTimeStats(),
      tempFiles: {
        current: this.getCurrentTempFileCount(),
        recentOperations: recentTempOps.length,
        createOperations: recentTempOps.filter(op => op.operation === 'create').length,
        cleanupOperations: recentTempOps.filter(op => op.operation === 'cleanup').length,
      },
      alerts: {
        total: this.alerts.length,
        critical: this.alerts.filter(a => a.severity === 'critical').length,
        warnings: this.alerts.filter(a => a.severity === 'warning').length,
        recent: this.getRecentAlerts(5),
      },
      thresholds: this.thresholds,
    };
  }

  /**
   * Log performance thresholds on startup
   */
  private logThresholds(): void {
    this.logger.log('🎯 Performance Monitoring Thresholds:');
    this.logger.log(`   Memory: Warning ${this.thresholds.memoryUsageMB.warning}MB, Critical ${this.thresholds.memoryUsageMB.critical}MB`);
    this.logger.log(`   Processing Time: Warning ${this.thresholds.processingTimeMs.warning}ms, Critical ${this.thresholds.processingTimeMs.critical}ms`);
    this.logger.log(`   Temp Files: Warning ${this.thresholds.tempFileCount.warning}, Critical ${this.thresholds.tempFileCount.critical}`);
    this.logger.log(`   Error Rate: Warning ${this.thresholds.errorRatePercent.warning}%, Critical ${this.thresholds.errorRatePercent.critical}%`);
  }

  /**
   * Force garbage collection if available (for memory optimization)
   */
  forceGarbageCollection(): boolean {
    if (global.gc) {
      this.logger.debug('🗑️ Forcing garbage collection');
      global.gc();
      return true;
    }
    return false;
  }

  /**
   * Log comprehensive performance summary
   */
  logPerformanceSummary(): void {
    const dashboard = this.getPerformanceDashboard();
    
    this.logger.log('📊 === PERFORMANCE MONITORING SUMMARY ===');
    
    // Memory stats
    const memMB = (bytes: number) => (bytes / 1024 / 1024).toFixed(1);
    this.logger.log('🧠 Memory Usage:');
    this.logger.log(`   Current Heap: ${memMB(dashboard.memory.current.heapUsed)}MB / ${memMB(dashboard.memory.current.heapTotal)}MB`);
    this.logger.log(`   Current RSS: ${memMB(dashboard.memory.current.rss)}MB`);
    this.logger.log(`   Average Heap: ${memMB(dashboard.memory.average.heapUsed)}MB`);
    this.logger.log(`   Peak Heap: ${memMB(dashboard.memory.peak.heapUsed)}MB`);
    
    // Processing time stats
    this.logger.log('⏱️ Processing Times:');
    this.logger.log(`   Count: ${dashboard.processingTimes.count}`);
    this.logger.log(`   Average: ${dashboard.processingTimes.average.toFixed(0)}ms`);
    this.logger.log(`   Median: ${dashboard.processingTimes.median}ms`);
    this.logger.log(`   95th Percentile: ${dashboard.processingTimes.p95}ms`);
    this.logger.log(`   Max: ${dashboard.processingTimes.max}ms`);
    
    // Temp files
    this.logger.log('📁 Temporary Files:');
    this.logger.log(`   Current Count: ${dashboard.tempFiles.current}`);
    this.logger.log(`   Recent Creates: ${dashboard.tempFiles.createOperations}`);
    this.logger.log(`   Recent Cleanups: ${dashboard.tempFiles.cleanupOperations}`);
    
    // Alerts
    this.logger.log('🚨 Alerts:');
    this.logger.log(`   Total: ${dashboard.alerts.total}`);
    this.logger.log(`   Critical: ${dashboard.alerts.critical}`);
    this.logger.log(`   Warnings: ${dashboard.alerts.warnings}`);
    
    if (dashboard.alerts.recent.length > 0) {
      this.logger.log('   Recent Alerts:');
      dashboard.alerts.recent.forEach(alert => {
        const icon = alert.severity === 'critical' ? '🚨' : '⚠️';
        this.logger.log(`     ${icon} ${alert.type}: ${alert.message}`);
      });
    }
    
    this.logger.log('='.repeat(50));
  }
}
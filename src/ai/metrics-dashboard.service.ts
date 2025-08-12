import { Injectable, Logger } from '@nestjs/common';
import { ScannedPdfMetricsService } from './scanned-pdf-metrics.service';
import { ScannedPdfPerformanceMonitorService } from './performance-monitor.service';
import { OptimizedTempFileService } from './optimized-temp-file.service';
import { MemoryOptimizerService } from './memory-optimizer.service';

export interface MetricsDashboardData {
  timestamp: Date;
  overview: {
    totalProcessingAttempts: number;
    successRate: number;
    averageProcessingTime: number;
    activeProcessingSessions: number;
  };
  performance: {
    memory: {
      current: {
        heapUsedMB: number;
        heapTotalMB: number;
        rssMB: number;
        heapUtilization: number;
      };
      optimization: {
        gcCount: number;
        timeSinceLastGc: number;
        bufferPoolSize: number;
        recommendations: string[];
      };
    };
    processingTimes: {
      average: number;
      median: number;
      p95: number;
      p99: number;
      slowestSessions: Array<{
        sessionId: string;
        duration: number;
        timestamp: Date;
      }>;
    };
    alerts: {
      total: number;
      critical: number;
      warnings: number;
      recent: Array<{
        type: string;
        severity: string;
        message: string;
        timestamp: Date;
      }>;
    };
  };
  scannedPdfProcessing: {
    detectionAccuracy: {
      scannedDetections: number;
      textBasedDetections: number;
      totalAnalyzed: number;
      scannedPercentage: number;
    };
    processingMethods: {
      directTextExtractions: number;
      pdfToImageConversions: number;
      fallbackProcessing: number;
      methodBreakdown: Record<string, number>;
    };
    errorAnalysis: {
      dependencyErrors: number;
      conversionErrors: number;
      ocrErrors: number;
      systemErrors: number;
      totalErrors: number;
      errorRate: number;
    };
    recentSessions: Array<{
      sessionId: string;
      processingMethod: string;
      isScannedPdf: boolean;
      duration: number;
      success: boolean;
      timestamp: Date;
    }>;
  };
  resourceUsage: {
    tempFiles: {
      current: number;
      totalSize: string;
      byType: Record<string, number>;
      scheduledForCleanup: number;
      utilizationPercent: number;
    };
    systemHealth: {
      memoryPressure: boolean;
      tempFilesPressure: boolean;
      processingBacklog: boolean;
      overallHealth: 'healthy' | 'warning' | 'critical';
    };
  };
  trends: {
    hourlyStats: Array<{
      hour: string;
      attempts: number;
      successes: number;
      averageTime: number;
    }>;
    processingMethodTrends: Array<{
      method: string;
      count: number;
      percentage: number;
    }>;
  };
}

@Injectable()
export class MetricsDashboardService {
  private readonly logger = new Logger(MetricsDashboardService.name);
  
  private dashboardHistory: MetricsDashboardData[] = [];
  private readonly maxHistoryEntries = 24; // Keep 24 hours of hourly data

  constructor(
    private readonly scannedPdfMetrics: ScannedPdfMetricsService,
    private readonly performanceMonitor: ScannedPdfPerformanceMonitorService,
    private readonly tempFileService: OptimizedTempFileService,
    private readonly memoryOptimizer: MemoryOptimizerService,
  ) {
    // Start periodic dashboard updates
    this.startPeriodicUpdates();
  }

  /**
   * Get current comprehensive dashboard data
   */
  getCurrentDashboard(): MetricsDashboardData {
    const timestamp = new Date();
    
    // Get data from all services
    const scannedPdfMetrics = this.scannedPdfMetrics.getMetrics();
    const recentSessionStats = this.scannedPdfMetrics.getRecentSessionStats(10);
    const performanceDashboard = this.performanceMonitor.getPerformanceDashboard();
    const tempFileStats = this.tempFileService.getTempFileStats();
    const memoryStatus = this.memoryOptimizer.getMemoryStatus();

    // Calculate derived metrics
    const totalAnalyzed = scannedPdfMetrics.scannedPdfDetections + scannedPdfMetrics.textBasedPdfDetections;
    const scannedPercentage = totalAnalyzed > 0 ? (scannedPdfMetrics.scannedPdfDetections / totalAnalyzed) * 100 : 0;
    const totalErrors = scannedPdfMetrics.dependencyErrors + scannedPdfMetrics.conversionErrors + 
                       scannedPdfMetrics.ocrErrors + scannedPdfMetrics.systemErrors;
    const errorRate = scannedPdfMetrics.totalProcessingAttempts > 0 ? 
                     (totalErrors / scannedPdfMetrics.totalProcessingAttempts) * 100 : 0;

    // Determine system health
    const systemHealth = this.calculateSystemHealth(performanceDashboard, tempFileStats, memoryStatus);

    // Build dashboard data
    const dashboardData: MetricsDashboardData = {
      timestamp,
      overview: {
        totalProcessingAttempts: scannedPdfMetrics.totalProcessingAttempts,
        successRate: this.scannedPdfMetrics.getSuccessRate(),
        averageProcessingTime: scannedPdfMetrics.averageProcessingTime,
        activeProcessingSessions: 0, // Would need to track active sessions
      },
      performance: {
        memory: {
          current: {
            heapUsedMB: memoryStatus.usageMB.heapUsed,
            heapTotalMB: memoryStatus.usageMB.heapTotal,
            rssMB: memoryStatus.usageMB.rss,
            heapUtilization: (memoryStatus.usageMB.heapUsed / memoryStatus.usageMB.heapTotal) * 100,
          },
          optimization: {
            gcCount: memoryStatus.gcStats.count,
            timeSinceLastGc: memoryStatus.gcStats.timeSinceLastGc,
            bufferPoolSize: memoryStatus.bufferPoolSize,
            recommendations: memoryStatus.recommendations,
          },
        },
        processingTimes: {
          average: performanceDashboard.processingTimes.average,
          median: performanceDashboard.processingTimes.median,
          p95: performanceDashboard.processingTimes.p95,
          p99: performanceDashboard.processingTimes.p99,
          slowestSessions: recentSessionStats.sessions
            .filter(s => s.totalDuration)
            .sort((a, b) => (b.totalDuration || 0) - (a.totalDuration || 0))
            .slice(0, 5)
            .map(s => ({
              sessionId: s.sessionId,
              duration: s.totalDuration || 0,
              timestamp: new Date(s.startTime),
            })),
        },
        alerts: {
          total: performanceDashboard.alerts.total,
          critical: performanceDashboard.alerts.critical,
          warnings: performanceDashboard.alerts.warnings,
          recent: performanceDashboard.alerts.recent.map(alert => ({
            type: alert.type,
            severity: alert.severity,
            message: alert.message,
            timestamp: alert.timestamp,
          })),
        },
      },
      scannedPdfProcessing: {
        detectionAccuracy: {
          scannedDetections: scannedPdfMetrics.scannedPdfDetections,
          textBasedDetections: scannedPdfMetrics.textBasedPdfDetections,
          totalAnalyzed,
          scannedPercentage,
        },
        processingMethods: {
          directTextExtractions: scannedPdfMetrics.directTextExtractions,
          pdfToImageConversions: scannedPdfMetrics.pdfToImageConversions,
          fallbackProcessing: scannedPdfMetrics.fallbackProcessing,
          methodBreakdown: recentSessionStats.methodBreakdown,
        },
        errorAnalysis: {
          dependencyErrors: scannedPdfMetrics.dependencyErrors,
          conversionErrors: scannedPdfMetrics.conversionErrors,
          ocrErrors: scannedPdfMetrics.ocrErrors,
          systemErrors: scannedPdfMetrics.systemErrors,
          totalErrors,
          errorRate,
        },
        recentSessions: recentSessionStats.sessions.map(s => ({
          sessionId: s.sessionId,
          processingMethod: s.processingMethod,
          isScannedPdf: s.isScannedPdf,
          duration: s.totalDuration || 0,
          success: s.finalResult === 'success',
          timestamp: new Date(s.startTime),
        })),
      },
      resourceUsage: {
        tempFiles: {
          current: tempFileStats.totalFiles,
          totalSize: this.formatBytes(tempFileStats.totalSize),
          byType: tempFileStats.byType,
          scheduledForCleanup: tempFileStats.scheduledForCleanup,
          utilizationPercent: this.calculateTempFileUtilization(tempFileStats),
        },
        systemHealth,
      },
      trends: {
        hourlyStats: this.calculateHourlyStats(),
        processingMethodTrends: this.calculateProcessingMethodTrends(recentSessionStats.methodBreakdown),
      },
    };

    return dashboardData;
  }

  /**
   * Get dashboard data with historical trends
   */
  getDashboardWithHistory(): {
    current: MetricsDashboardData;
    history: MetricsDashboardData[];
    trends: {
      successRateTrend: number;
      averageTimeTrend: number;
      memoryUsageTrend: number;
    };
  } {
    const current = this.getCurrentDashboard();
    
    // Calculate trends from history
    const trends = this.calculateTrends();

    return {
      current,
      history: [...this.dashboardHistory],
      trends,
    };
  }

  /**
   * Get performance summary for logging
   */
  getPerformanceSummary(): {
    overview: string;
    performance: string;
    resources: string;
    recommendations: string[];
  } {
    const dashboard = this.getCurrentDashboard();
    
    const overview = `Processing: ${dashboard.overview.totalProcessingAttempts} attempts, ` +
                    `${dashboard.overview.successRate.toFixed(1)}% success rate, ` +
                    `${dashboard.overview.averageProcessingTime.toFixed(0)}ms avg time`;

    const performance = `Memory: ${dashboard.performance.memory.current.heapUsedMB.toFixed(1)}MB heap ` +
                       `(${dashboard.performance.memory.current.heapUtilization.toFixed(1)}% utilization), ` +
                       `${dashboard.performance.alerts.critical} critical alerts`;

    const resources = `Temp Files: ${dashboard.resourceUsage.tempFiles.current} files ` +
                     `(${dashboard.resourceUsage.tempFiles.totalSize}), ` +
                     `System Health: ${dashboard.resourceUsage.systemHealth.overallHealth}`;

    const recommendations = [
      ...dashboard.performance.memory.optimization.recommendations,
      ...(dashboard.resourceUsage.systemHealth.overallHealth !== 'healthy' ? 
          ['System health degraded - consider optimization'] : []),
      ...(dashboard.scannedPdfProcessing.errorAnalysis.errorRate > 10 ? 
          ['High error rate detected - investigate failures'] : []),
    ];

    return {
      overview,
      performance,
      resources,
      recommendations,
    };
  }

  /**
   * Export dashboard data for external monitoring
   */
  exportMetrics(): {
    timestamp: string;
    metrics: Record<string, number>;
    labels: Record<string, string>;
  } {
    const dashboard = this.getCurrentDashboard();
    
    return {
      timestamp: dashboard.timestamp.toISOString(),
      metrics: {
        // Processing metrics
        'processing_attempts_total': dashboard.overview.totalProcessingAttempts,
        'processing_success_rate': dashboard.overview.successRate,
        'processing_time_avg_ms': dashboard.overview.averageProcessingTime,
        
        // Memory metrics
        'memory_heap_used_mb': dashboard.performance.memory.current.heapUsedMB,
        'memory_heap_total_mb': dashboard.performance.memory.current.heapTotalMB,
        'memory_rss_mb': dashboard.performance.memory.current.rssMB,
        'memory_heap_utilization_percent': dashboard.performance.memory.current.heapUtilization,
        'memory_gc_count': dashboard.performance.memory.optimization.gcCount,
        
        // Processing time metrics
        'processing_time_median_ms': dashboard.performance.processingTimes.median,
        'processing_time_p95_ms': dashboard.performance.processingTimes.p95,
        'processing_time_p99_ms': dashboard.performance.processingTimes.p99,
        
        // Alert metrics
        'alerts_total': dashboard.performance.alerts.total,
        'alerts_critical': dashboard.performance.alerts.critical,
        'alerts_warnings': dashboard.performance.alerts.warnings,
        
        // PDF processing metrics
        'pdf_scanned_detections': dashboard.scannedPdfProcessing.detectionAccuracy.scannedDetections,
        'pdf_text_based_detections': dashboard.scannedPdfProcessing.detectionAccuracy.textBasedDetections,
        'pdf_scanned_percentage': dashboard.scannedPdfProcessing.detectionAccuracy.scannedPercentage,
        'pdf_direct_extractions': dashboard.scannedPdfProcessing.processingMethods.directTextExtractions,
        'pdf_to_image_conversions': dashboard.scannedPdfProcessing.processingMethods.pdfToImageConversions,
        'pdf_fallback_processing': dashboard.scannedPdfProcessing.processingMethods.fallbackProcessing,
        
        // Error metrics
        'errors_dependency': dashboard.scannedPdfProcessing.errorAnalysis.dependencyErrors,
        'errors_conversion': dashboard.scannedPdfProcessing.errorAnalysis.conversionErrors,
        'errors_ocr': dashboard.scannedPdfProcessing.errorAnalysis.ocrErrors,
        'errors_system': dashboard.scannedPdfProcessing.errorAnalysis.systemErrors,
        'error_rate_percent': dashboard.scannedPdfProcessing.errorAnalysis.errorRate,
        
        // Resource metrics
        'temp_files_current': dashboard.resourceUsage.tempFiles.current,
        'temp_files_scheduled_cleanup': dashboard.resourceUsage.tempFiles.scheduledForCleanup,
        'temp_files_utilization_percent': dashboard.resourceUsage.tempFiles.utilizationPercent,
      },
      labels: {
        'service': 'document-processing-api',
        'component': 'scanned-pdf-processing',
        'health': dashboard.resourceUsage.systemHealth.overallHealth,
      },
    };
  }

  /**
   * Start periodic dashboard updates
   */
  private startPeriodicUpdates(): void {
    // Update dashboard every hour
    setInterval(() => {
      this.updateDashboardHistory();
    }, 3600000); // 1 hour

    this.logger.log('📊 Started periodic dashboard updates (1 hour interval)');
  }

  /**
   * Update dashboard history
   */
  private updateDashboardHistory(): void {
    const currentDashboard = this.getCurrentDashboard();
    
    this.dashboardHistory.push(currentDashboard);
    
    // Keep only recent history
    if (this.dashboardHistory.length > this.maxHistoryEntries) {
      this.dashboardHistory.shift();
    }

    this.logger.log(`📊 Updated dashboard history (${this.dashboardHistory.length} entries)`);
  }

  /**
   * Calculate system health based on various metrics
   */
  private calculateSystemHealth(
    performanceDashboard: any,
    tempFileStats: any,
    memoryStatus: any
  ): MetricsDashboardData['resourceUsage']['systemHealth'] {
    let healthScore = 100;
    const issues: string[] = [];

    // Memory pressure check
    const memoryPressure = memoryStatus.usageMB.rss > 512 || 
                          (memoryStatus.usageMB.heapUsed / memoryStatus.usageMB.heapTotal) > 0.8;
    if (memoryPressure) {
      healthScore -= 30;
      issues.push('memory pressure');
    }

    // Temp files pressure check
    const tempFilesPressure = tempFileStats.totalFiles > 50 || 
                             tempFileStats.totalSize > 100 * 1024 * 1024; // 100MB
    if (tempFilesPressure) {
      healthScore -= 20;
      issues.push('temp files pressure');
    }

    // Processing backlog check (based on alerts)
    const processingBacklog = performanceDashboard.alerts.critical > 0;
    if (processingBacklog) {
      healthScore -= 25;
      issues.push('processing backlog');
    }

    // High error rate check
    const highErrorRate = performanceDashboard.alerts.warnings > 5;
    if (highErrorRate) {
      healthScore -= 15;
      issues.push('high error rate');
    }

    let overallHealth: 'healthy' | 'warning' | 'critical';
    if (healthScore >= 80) {
      overallHealth = 'healthy';
    } else if (healthScore >= 60) {
      overallHealth = 'warning';
    } else {
      overallHealth = 'critical';
    }

    return {
      memoryPressure,
      tempFilesPressure,
      processingBacklog,
      overallHealth,
    };
  }

  /**
   * Calculate temporary file utilization percentage
   */
  private calculateTempFileUtilization(tempFileStats: any): number {
    const maxFiles = 100; // From config
    const maxSize = 500 * 1024 * 1024; // 500MB from config
    
    const fileUtilization = (tempFileStats.totalFiles / maxFiles) * 100;
    const sizeUtilization = (tempFileStats.totalSize / maxSize) * 100;
    
    return Math.max(fileUtilization, sizeUtilization);
  }

  /**
   * Calculate hourly statistics
   */
  private calculateHourlyStats(): MetricsDashboardData['trends']['hourlyStats'] {
    // This would ideally use historical data
    // For now, return mock data structure
    const hours = [];
    const now = new Date();
    
    for (let i = 23; i >= 0; i--) {
      const hour = new Date(now.getTime() - i * 3600000);
      hours.push({
        hour: hour.toISOString().substring(11, 16), // HH:MM format
        attempts: 0, // Would be calculated from historical data
        successes: 0,
        averageTime: 0,
      });
    }
    
    return hours;
  }

  /**
   * Calculate processing method trends
   */
  private calculateProcessingMethodTrends(methodBreakdown: Record<string, number>): MetricsDashboardData['trends']['processingMethodTrends'] {
    const total = Object.values(methodBreakdown).reduce((sum, count) => sum + count, 0);
    
    return Object.entries(methodBreakdown).map(([method, count]) => ({
      method,
      count,
      percentage: total > 0 ? (count / total) * 100 : 0,
    }));
  }

  /**
   * Calculate trends from historical data
   */
  private calculateTrends(): {
    successRateTrend: number;
    averageTimeTrend: number;
    memoryUsageTrend: number;
  } {
    if (this.dashboardHistory.length < 2) {
      return {
        successRateTrend: 0,
        averageTimeTrend: 0,
        memoryUsageTrend: 0,
      };
    }

    const recent = this.dashboardHistory.slice(-6); // Last 6 hours
    const older = this.dashboardHistory.slice(-12, -6); // 6 hours before that

    const recentAvgSuccessRate = recent.reduce((sum, d) => sum + d.overview.successRate, 0) / recent.length;
    const olderAvgSuccessRate = older.length > 0 ? older.reduce((sum, d) => sum + d.overview.successRate, 0) / older.length : recentAvgSuccessRate;

    const recentAvgTime = recent.reduce((sum, d) => sum + d.overview.averageProcessingTime, 0) / recent.length;
    const olderAvgTime = older.length > 0 ? older.reduce((sum, d) => sum + d.overview.averageProcessingTime, 0) / older.length : recentAvgTime;

    const recentAvgMemory = recent.reduce((sum, d) => sum + d.performance.memory.current.heapUsedMB, 0) / recent.length;
    const olderAvgMemory = older.length > 0 ? older.reduce((sum, d) => sum + d.performance.memory.current.heapUsedMB, 0) / older.length : recentAvgMemory;

    return {
      successRateTrend: recentAvgSuccessRate - olderAvgSuccessRate,
      averageTimeTrend: recentAvgTime - olderAvgTime,
      memoryUsageTrend: recentAvgMemory - olderAvgMemory,
    };
  }

  /**
   * Format bytes to human readable string
   */
  private formatBytes(bytes: number): string {
    if (bytes === 0) return '0 B';
    
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    
    return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`;
  }

  /**
   * Log comprehensive dashboard summary
   */
  logDashboardSummary(): void {
    const summary = this.getPerformanceSummary();
    
    this.logger.log('📊 === METRICS DASHBOARD SUMMARY ===');
    this.logger.log(`📈 Overview: ${summary.overview}`);
    this.logger.log(`⚡ Performance: ${summary.performance}`);
    this.logger.log(`💾 Resources: ${summary.resources}`);
    
    if (summary.recommendations.length > 0) {
      this.logger.log('💡 Recommendations:');
      summary.recommendations.forEach(rec => {
        this.logger.log(`   • ${rec}`);
      });
    }
    
    this.logger.log('='.repeat(50));
  }
}
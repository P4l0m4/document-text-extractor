import { Injectable, Logger } from '@nestjs/common';

export interface ScannedPdfProcessingMetrics {
  // Processing counts
  totalProcessingAttempts: number;
  successfulProcessing: number;
  failedProcessing: number;
  
  // Processing method breakdown
  directTextExtractions: number;
  pdfToImageConversions: number;
  fallbackProcessing: number;
  
  // Performance metrics
  averageProcessingTime: number;
  averageConversionTime: number;
  averageOcrTime: number;
  
  // Error tracking
  dependencyErrors: number;
  conversionErrors: number;
  ocrErrors: number;
  systemErrors: number;
  
  // Resource usage
  tempFilesCreated: number;
  tempFilesCleanedUp: number;
  
  // Detection accuracy
  scannedPdfDetections: number;
  textBasedPdfDetections: number;
  
  // Last reset timestamp
  lastResetTime: Date;
}

export interface ProcessingStageMetrics {
  stage: 'pdf_analysis' | 'dependency_check' | 'conversion' | 'ocr' | 'cleanup';
  startTime: number;
  endTime?: number;
  duration?: number;
  success: boolean;
  errorMessage?: string;
}

export interface ProcessingSessionMetrics {
  sessionId: string;
  pdfPath: string;
  startTime: number;
  endTime?: number;
  totalDuration?: number;
  stages: ProcessingStageMetrics[];
  finalResult: 'success' | 'failure' | 'partial';
  processingMethod: 'direct' | 'pdf-to-image' | 'fallback';
  isScannedPdf: boolean;
  textLength: number;
  confidence: number;
  tempFilesCreated: number;
  errorType?: string;
}

@Injectable()
export class ScannedPdfMetricsService {
  private readonly logger = new Logger(ScannedPdfMetricsService.name);
  
  private metrics: ScannedPdfProcessingMetrics = {
    totalProcessingAttempts: 0,
    successfulProcessing: 0,
    failedProcessing: 0,
    directTextExtractions: 0,
    pdfToImageConversions: 0,
    fallbackProcessing: 0,
    averageProcessingTime: 0,
    averageConversionTime: 0,
    averageOcrTime: 0,
    dependencyErrors: 0,
    conversionErrors: 0,
    ocrErrors: 0,
    systemErrors: 0,
    tempFilesCreated: 0,
    tempFilesCleanedUp: 0,
    scannedPdfDetections: 0,
    textBasedPdfDetections: 0,
    lastResetTime: new Date(),
  };

  private activeSessions: Map<string, ProcessingSessionMetrics> = new Map();
  private completedSessions: ProcessingSessionMetrics[] = [];
  private readonly maxCompletedSessions = 100; // Keep last 100 sessions for analysis

  /**
   * Start a new processing session and return session ID
   */
  startProcessingSession(pdfPath: string): string {
    const sessionId = `session_${Date.now()}_${Math.random().toString(36).substring(2, 11)}`;
    
    const session: ProcessingSessionMetrics = {
      sessionId,
      pdfPath,
      startTime: Date.now(),
      stages: [],
      finalResult: 'failure', // Default to failure, will be updated on success
      processingMethod: 'direct', // Default, will be updated
      isScannedPdf: false, // Default, will be updated
      textLength: 0,
      confidence: 0,
      tempFilesCreated: 0,
    };

    this.activeSessions.set(sessionId, session);
    this.metrics.totalProcessingAttempts++;
    
    this.logger.debug(`📊 Started processing session: ${sessionId} for ${pdfPath}`);
    
    return sessionId;
  }

  /**
   * Start a processing stage within a session
   */
  startProcessingStage(
    sessionId: string, 
    stage: ProcessingStageMetrics['stage']
  ): void {
    const session = this.activeSessions.get(sessionId);
    if (!session) {
      this.logger.warn(`⚠️ Attempted to start stage ${stage} for unknown session: ${sessionId}`);
      return;
    }

    const stageMetrics: ProcessingStageMetrics = {
      stage,
      startTime: Date.now(),
      success: false, // Default to false, will be updated on completion
    };

    session.stages.push(stageMetrics);
    
    this.logger.debug(`🔄 Started processing stage: ${stage} for session ${sessionId}`);
  }

  /**
   * Complete a processing stage within a session
   */
  completeProcessingStage(
    sessionId: string, 
    stage: ProcessingStageMetrics['stage'],
    success: boolean,
    errorMessage?: string
  ): void {
    const session = this.activeSessions.get(sessionId);
    if (!session) {
      this.logger.warn(`⚠️ Attempted to complete stage ${stage} for unknown session: ${sessionId}`);
      return;
    }

    // Find the most recent stage of this type that hasn't been completed
    const stageMetrics = session.stages
      .filter(s => s.stage === stage && !s.endTime)
      .pop();

    if (!stageMetrics) {
      this.logger.warn(`⚠️ No active stage ${stage} found for session: ${sessionId}`);
      return;
    }

    stageMetrics.endTime = Date.now();
    stageMetrics.duration = stageMetrics.endTime - stageMetrics.startTime;
    stageMetrics.success = success;
    stageMetrics.errorMessage = errorMessage;

    const statusIcon = success ? '✅' : '❌';
    this.logger.debug(`${statusIcon} Completed processing stage: ${stage} for session ${sessionId} in ${stageMetrics.duration}ms`);
  }

  /**
   * Complete a processing session with final results
   */
  completeProcessingSession(
    sessionId: string,
    result: {
      success: boolean;
      processingMethod: ProcessingSessionMetrics['processingMethod'];
      isScannedPdf: boolean;
      textLength: number;
      confidence: number;
      tempFilesCreated: number;
      errorType?: string;
    }
  ): void {
    const session = this.activeSessions.get(sessionId);
    if (!session) {
      this.logger.warn(`⚠️ Attempted to complete unknown session: ${sessionId}`);
      return;
    }

    // Update session with final results
    session.endTime = Date.now();
    session.totalDuration = session.endTime - session.startTime;
    session.finalResult = result.success ? 'success' : 'failure';
    session.processingMethod = result.processingMethod;
    session.isScannedPdf = result.isScannedPdf;
    session.textLength = result.textLength;
    session.confidence = result.confidence;
    session.tempFilesCreated = result.tempFilesCreated;
    session.errorType = result.errorType;

    // Update aggregate metrics
    this.updateAggregateMetrics(session);

    // Move session to completed sessions
    this.activeSessions.delete(sessionId);
    this.completedSessions.push(session);

    // Keep only the most recent sessions
    if (this.completedSessions.length > this.maxCompletedSessions) {
      this.completedSessions.shift();
    }

    const statusIcon = result.success ? '✅' : '❌';
    const methodIcon = this.getMethodIcon(result.processingMethod);
    
    this.logger.log(`${statusIcon} ${methodIcon} Processing session completed: ${sessionId}`);
    this.logger.log(`📊 Duration: ${session.totalDuration}ms, Method: ${result.processingMethod}, Scanned: ${result.isScannedPdf}, Text: ${result.textLength} chars, Confidence: ${result.confidence}%`);
  }

  /**
   * Record PDF analysis results
   */
  recordPdfAnalysis(sessionId: string, isScannedPdf: boolean, reason: string): void {
    if (isScannedPdf) {
      this.metrics.scannedPdfDetections++;
    } else {
      this.metrics.textBasedPdfDetections++;
    }

    this.logger.log(`🔍 PDF Analysis [${sessionId}]: ${isScannedPdf ? 'SCANNED' : 'TEXT-BASED'} - ${reason}`);
  }

  /**
   * Record temporary file operations
   */
  recordTempFileOperation(sessionId: string, operation: 'created' | 'cleaned', count: number = 1): void {
    if (operation === 'created') {
      this.metrics.tempFilesCreated += count;
    } else {
      this.metrics.tempFilesCleanedUp += count;
    }

    const session = this.activeSessions.get(sessionId);
    if (session && operation === 'created') {
      session.tempFilesCreated += count;
    }

    this.logger.debug(`📁 Temp files ${operation} [${sessionId}]: ${count} files`);
  }

  /**
   * Record error by type
   */
  recordError(sessionId: string, errorType: 'dependency' | 'conversion' | 'ocr' | 'system', errorMessage: string): void {
    switch (errorType) {
      case 'dependency':
        this.metrics.dependencyErrors++;
        break;
      case 'conversion':
        this.metrics.conversionErrors++;
        break;
      case 'ocr':
        this.metrics.ocrErrors++;
        break;
      case 'system':
        this.metrics.systemErrors++;
        break;
    }

    this.logger.error(`❌ Error recorded [${sessionId}]: ${errorType} - ${errorMessage}`);
  }

  /**
   * Get current metrics snapshot
   */
  getMetrics(): ScannedPdfProcessingMetrics {
    return { ...this.metrics };
  }

  /**
   * Get processing success rate
   */
  getSuccessRate(): number {
    if (this.metrics.totalProcessingAttempts === 0) return 0;
    return (this.metrics.successfulProcessing / this.metrics.totalProcessingAttempts) * 100;
  }

  /**
   * Get recent session statistics
   */
  getRecentSessionStats(count: number = 10): {
    sessions: ProcessingSessionMetrics[];
    averageDuration: number;
    successRate: number;
    methodBreakdown: Record<string, number>;
  } {
    const recentSessions = this.completedSessions.slice(-count);
    
    const averageDuration = recentSessions.length > 0
      ? recentSessions.reduce((sum, s) => sum + (s.totalDuration || 0), 0) / recentSessions.length
      : 0;

    const successfulSessions = recentSessions.filter(s => s.finalResult === 'success').length;
    const successRate = recentSessions.length > 0 ? (successfulSessions / recentSessions.length) * 100 : 0;

    const methodBreakdown = recentSessions.reduce((acc, session) => {
      acc[session.processingMethod] = (acc[session.processingMethod] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    return {
      sessions: recentSessions,
      averageDuration,
      successRate,
      methodBreakdown,
    };
  }

  /**
   * Reset metrics (useful for testing or periodic resets)
   */
  resetMetrics(): void {
    this.metrics = {
      totalProcessingAttempts: 0,
      successfulProcessing: 0,
      failedProcessing: 0,
      directTextExtractions: 0,
      pdfToImageConversions: 0,
      fallbackProcessing: 0,
      averageProcessingTime: 0,
      averageConversionTime: 0,
      averageOcrTime: 0,
      dependencyErrors: 0,
      conversionErrors: 0,
      ocrErrors: 0,
      systemErrors: 0,
      tempFilesCreated: 0,
      tempFilesCleanedUp: 0,
      scannedPdfDetections: 0,
      textBasedPdfDetections: 0,
      lastResetTime: new Date(),
    };

    this.completedSessions = [];
    this.activeSessions.clear();

    this.logger.log('📊 Metrics reset successfully');
  }

  /**
   * Log comprehensive metrics summary
   */
  logMetricsSummary(): void {
    const successRate = this.getSuccessRate();
    const recentStats = this.getRecentSessionStats();

    this.logger.log('📊 === SCANNED PDF PROCESSING METRICS SUMMARY ===');
    this.logger.log(`📈 Total Processing Attempts: ${this.metrics.totalProcessingAttempts}`);
    this.logger.log(`✅ Successful Processing: ${this.metrics.successfulProcessing} (${successRate.toFixed(1)}%)`);
    this.logger.log(`❌ Failed Processing: ${this.metrics.failedProcessing}`);
    this.logger.log('');
    this.logger.log('🔄 Processing Method Breakdown:');
    this.logger.log(`   📄 Direct Text Extraction: ${this.metrics.directTextExtractions}`);
    this.logger.log(`   🖼️ PDF-to-Image Conversion: ${this.metrics.pdfToImageConversions}`);
    this.logger.log(`   🔄 Fallback Processing: ${this.metrics.fallbackProcessing}`);
    this.logger.log('');
    this.logger.log('⏱️ Performance Metrics:');
    this.logger.log(`   Average Processing Time: ${this.metrics.averageProcessingTime.toFixed(0)}ms`);
    this.logger.log(`   Average Conversion Time: ${this.metrics.averageConversionTime.toFixed(0)}ms`);
    this.logger.log(`   Average OCR Time: ${this.metrics.averageOcrTime.toFixed(0)}ms`);
    this.logger.log('');
    this.logger.log('🔍 Detection Accuracy:');
    this.logger.log(`   Scanned PDF Detections: ${this.metrics.scannedPdfDetections}`);
    this.logger.log(`   Text-based PDF Detections: ${this.metrics.textBasedPdfDetections}`);
    this.logger.log('');
    this.logger.log('❌ Error Breakdown:');
    this.logger.log(`   Dependency Errors: ${this.metrics.dependencyErrors}`);
    this.logger.log(`   Conversion Errors: ${this.metrics.conversionErrors}`);
    this.logger.log(`   OCR Errors: ${this.metrics.ocrErrors}`);
    this.logger.log(`   System Errors: ${this.metrics.systemErrors}`);
    this.logger.log('');
    this.logger.log('📁 Resource Usage:');
    this.logger.log(`   Temp Files Created: ${this.metrics.tempFilesCreated}`);
    this.logger.log(`   Temp Files Cleaned Up: ${this.metrics.tempFilesCleanedUp}`);
    this.logger.log(`   Cleanup Rate: ${this.metrics.tempFilesCreated > 0 ? ((this.metrics.tempFilesCleanedUp / this.metrics.tempFilesCreated) * 100).toFixed(1) : 0}%`);
    this.logger.log('');
    this.logger.log(`📅 Metrics Period: Since ${this.metrics.lastResetTime.toISOString()}`);
    this.logger.log('='.repeat(50));
  }

  /**
   * Update aggregate metrics based on completed session
   */
  private updateAggregateMetrics(session: ProcessingSessionMetrics): void {
    // Update success/failure counts
    if (session.finalResult === 'success') {
      this.metrics.successfulProcessing++;
    } else {
      this.metrics.failedProcessing++;
    }

    // Update processing method counts
    switch (session.processingMethod) {
      case 'direct':
        this.metrics.directTextExtractions++;
        break;
      case 'pdf-to-image':
        this.metrics.pdfToImageConversions++;
        break;
      case 'fallback':
        this.metrics.fallbackProcessing++;
        break;
    }

    // Update average processing times
    if (session.totalDuration) {
      this.metrics.averageProcessingTime = this.calculateRunningAverage(
        this.metrics.averageProcessingTime,
        session.totalDuration,
        this.metrics.totalProcessingAttempts
      );
    }

    // Update conversion and OCR times from stages
    const conversionStage = session.stages.find(s => s.stage === 'conversion' && s.duration);
    if (conversionStage?.duration) {
      this.metrics.averageConversionTime = this.calculateRunningAverage(
        this.metrics.averageConversionTime,
        conversionStage.duration,
        this.metrics.pdfToImageConversions
      );
    }

    const ocrStage = session.stages.find(s => s.stage === 'ocr' && s.duration);
    if (ocrStage?.duration) {
      this.metrics.averageOcrTime = this.calculateRunningAverage(
        this.metrics.averageOcrTime,
        ocrStage.duration,
        this.metrics.pdfToImageConversions + this.metrics.fallbackProcessing
      );
    }
  }

  /**
   * Calculate running average
   */
  private calculateRunningAverage(currentAverage: number, newValue: number, count: number): number {
    if (count <= 1) return newValue;
    return ((currentAverage * (count - 1)) + newValue) / count;
  }

  /**
   * Get icon for processing method
   */
  private getMethodIcon(method: ProcessingSessionMetrics['processingMethod']): string {
    switch (method) {
      case 'direct': return '📄';
      case 'pdf-to-image': return '🖼️';
      case 'fallback': return '🔄';
      default: return '❓';
    }
  }
}
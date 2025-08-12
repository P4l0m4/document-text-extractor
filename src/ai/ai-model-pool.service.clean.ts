import {
  Injectable,
  Logger,
  OnModuleInit,
  OnModuleDestroy,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  TextExtractionResult,
  SummarizationOptions,
  SummarizationResult,
} from './interfaces/ai-model.interface';
import {
  AIModelException,
  TextExtractionException,
} from '../common/exceptions';
import { DependencyDetectionService } from './dependency-detection.service';
import { PdfConversionConfigService } from './pdf-conversion-config.service';
import { ScannedPdfMetricsService } from './scanned-pdf-metrics.service';

interface PooledWorker {
  id: string;
  busy: boolean;
  tesseractWorker?: any;
  lastUsed: number;
}

interface PdfConversionRequest {
  id: string;
  pdfPath: string;
  pageCount: number;
  sessionId?: string;
  resolve: (result: TextExtractionResult) => void;
  reject: (error: Error) => void;
  timestamp: number;
}

interface PdfConversionWorker {
  id: string;
  busy: boolean;
  lastUsed: number;
}

@Injectable()
export class AiModelPoolService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(AiModelPoolService.name);
  private readonly workers: Map<string, PooledWorker> = new Map();
  private readonly maxPoolSize: number;
  private readonly idleTimeout: number = 300000; // 5 minutes
  private cleanupInterval: NodeJS.Timeout;
  private metricsInterval: NodeJS.Timeout;

  // PDF-to-image conversion concurrency management
  private readonly pdfConversionWorkers: Map<string, PdfConversionWorker> =
    new Map();
  private readonly pdfConversionQueue: PdfConversionRequest[] = [];
  private readonly maxConcurrentPdfConversions: number;
  private readonly pdfConversionTimeout: number = 120000; // 2 minutes
  private activePdfConversions: number = 0;

  constructor(
    private readonly configService: ConfigService,
    private readonly dependencyDetectionService: DependencyDetectionService,
    private readonly pdfConversionConfigService: PdfConversionConfigService,
    private readonly metricsService: ScannedPdfMetricsService,
  ) {
    this.maxPoolSize =
      this.configService.get<number>('app.maxConcurrentJobs') || 10;
    this.maxConcurrentPdfConversions =
      this.configService.get<number>('PDF_CONVERSION_MAX_CONCURRENT') || 3;
  }

  async onModuleInit() {
    this.logger.log(
      `Initializing AI model pool with max size: ${this.maxPoolSize}`,
    );

    // Log PDF conversion feature status
    const isPdfConversionEnabled = this.pdfConversionConfigService.isEnabled();
    this.logger.log(
      `PDF-to-image conversion feature: ${isPdfConversionEnabled ? 'ENABLED' : 'DISABLED'}`,
    );

    if (!isPdfConversionEnabled) {
      this.logger.warn(
        'PDF-to-image conversion is disabled. Scanned PDFs will use graceful degradation.',
      );
    }

    // Check system dependencies at startup if enabled
    const checkDependenciesOnStartup =
      this.configService.get<boolean>('DEPENDENCY_CHECK_ON_STARTUP') !== false;
    if (checkDependenciesOnStartup) {
      await this.checkSystemDependenciesAtStartup();
    }

    // Pre-warm the pool with 2 workers
    await this.preWarmPool(2);

    // Start cleanup interval for idle workers
    this.cleanupInterval = setInterval(() => {
      void this.cleanupIdleWorkers();
    }, 60000); // Check every minute

    // Start metrics logging interval (every 15 minutes)
    this.metricsInterval = setInterval(() => {
      this.metricsService.logMetricsSummary();
    }, 900000); // 15 minutes
  }

  async onModuleDestroy() {
    this.logger.log('Shutting down AI model pool');

    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
    }

    if (this.metricsInterval) {
      clearInterval(this.metricsInterval);
    }

    // Terminate all workers
    const terminationPromises = Array.from(this.workers.values()).map(
      (worker) => this.terminateWorker(worker),
    );

    await Promise.all(terminationPromises);
    this.workers.clear();
  }

  /**
   * Get an available worker from the pool
   */
  private async getWorker(): Promise<PooledWorker> {
    // Find an available worker
    for (const worker of this.workers.values()) {
      if (!worker.busy) {
        worker.busy = true;
        worker.lastUsed = Date.now();
        return worker;
      }
    }

    // If no available worker and pool not at max size, create new one
    if (this.workers.size < this.maxPoolSize) {
      const worker = await this.createWorker();
      worker.busy = true;
      return worker;
    }

    // Wait for a worker to become available
    return new Promise((resolve, reject) => {
      const checkInterval = setInterval(() => {
        for (const worker of this.workers.values()) {
          if (!worker.busy) {
            clearInterval(checkInterval);
            worker.busy = true;
            worker.lastUsed = Date.now();
            resolve(worker);
            return;
          }
        }
      }, 100);

      // Timeout after 30 seconds
      setTimeout(() => {
        clearInterval(checkInterval);
        reject(
          new AIModelException('Timeout waiting for available AI model worker'),
        );
      }, 30000);
    });
  }

  /**
   * Release a worker back to the pool
   */
  private releaseWorker(worker: PooledWorker) {
    worker.busy = false;
    worker.lastUsed = Date.now();
  }

  private async createWorker(): Promise<PooledWorker> {
    const workerId = `worker-${Date.now()}-${Math.random().toString(36).substring(2, 11)}`;
    try {
      const Tesseract = (await import('tesseract.js')) as any;
      const path = await import('path');

      const tesseractWorker = await Tesseract.createWorker({
        // Indique où trouver eng.traineddata (répertoire local dans l'image)
        langPath: path.join(process.cwd(), 'tessdata'),
        logger: (m: any) => {
          if (m.status === 'loading api' || m.status === 'initializing api') {
            this.logger.debug(
              `Worker ${workerId}: ${m.status} - ${Math.round((m.progress ?? 0) * 100)}%`,
            );
          }
        },
      });

      // API compatible v4/v5 : on charge/initialise explicitement
      if (typeof tesseractWorker.loadLanguage === 'function') {
        await tesseractWorker.loadLanguage('eng+fra');
        await tesseractWorker.initialize('eng+fra');
      }

      const worker: PooledWorker = {
        id: workerId,
        busy: false,
        tesseractWorker,
        lastUsed: Date.now(),
      };

      this.workers.set(workerId, worker);
      this.logger.log(`Created new AI model worker: ${workerId}`);
      return worker;
    } catch (error: any) {
      const msg =
        error?.message ??
        (typeof error === 'string' ? error : JSON.stringify(error));
      this.logger.error(`Failed to create AI model worker: ${msg}`);
      throw new AIModelException(`Failed to create AI model worker: ${msg}`);
    }
  }

  /**
   * Pre-warm the pool with initial workers
   */
  private async preWarmPool(count: number) {
    const promises = Array.from({ length: count }, () => this.createWorker());
    await Promise.all(promises);
    this.logger.log(`Pre-warmed pool with ${count} workers`);
  }

  /**
   * Clean up idle workers
   */
  private async cleanupIdleWorkers() {
    const now = Date.now();
    const workersToRemove: string[] = [];

    for (const [workerId, worker] of this.workers.entries()) {
      if (!worker.busy && now - worker.lastUsed > this.idleTimeout) {
        workersToRemove.push(workerId);
      }
    }

    // Keep at least 1 worker alive
    if (this.workers.size - workersToRemove.length < 1) {
      workersToRemove.pop();
    }

    for (const workerId of workersToRemove) {
      const worker = this.workers.get(workerId);
      if (worker) {
        await this.terminateWorker(worker);
        this.workers.delete(workerId);
        this.logger.debug(`Cleaned up idle worker: ${workerId}`);
      }
    }
  }

  /**
   * Terminate a worker
   */
  private async terminateWorker(worker: PooledWorker) {
    try {
      if (worker.tesseractWorker) {
        await worker.tesseractWorker.terminate();
      }
    } catch (error) {
      this.logger.warn(`Error terminating worker ${worker.id}:`, error);
    }
  }

  /**
   * Extract text from image using pooled worker
   */
  async extractTextFromImage(imagePath: string): Promise<TextExtractionResult> {
    const startTime = Date.now();
    let worker: PooledWorker | undefined;

    try {
      worker = await this.getWorker();
      this.logger.log(
        `Using worker ${worker.id} for OCR processing: ${imagePath}`,
      );

      const { data } = await worker.tesseractWorker.recognize(imagePath);
      const processingTime = Date.now() - startTime;

      const result: TextExtractionResult = {
        text: data.text.trim(),
        confidence: data.confidence,
        metadata: {
          processingTime,
          language: 'eng',
          workerId: worker.id,
        },
      };

      this.logger.log(
        `OCR completed by worker ${worker.id} in ${processingTime}ms with confidence: ${data.confidence}%`,
      );

      return result;
    } catch (error) {
      this.logger.error(
        `Failed to extract text from image: ${error.message}`,
        error.stack,
      );
      throw new TextExtractionException(
        `OCR processing failed: ${error.message}`,
      );
    } finally {
      if (worker) {
        this.releaseWorker(worker);
      }
    }
  }

  /**
   * Extract text from PDF with basic processing
   */
  async extractTextFromPdf(pdfPath: string): Promise<TextExtractionResult> {
    const startTime = Date.now();

    // Start metrics tracking session
    const sessionId = this.metricsService.startProcessingSession(pdfPath);
    this.metricsService.startProcessingStage(sessionId, 'pdf_analysis');

    try {
      const pdfParse = (await import('pdf-parse')) as any;
      const fs = await import('fs');

      this.logger.log(`Starting PDF text extraction for: ${pdfPath}`);

      const dataBuffer = fs.readFileSync(pdfPath);
      const pdfData = await pdfParse(dataBuffer, {
        max: 0,
        version: 'v1.10.100',
      });

      const extractedText = pdfData.text.trim();
      const processingTime = Date.now() - startTime;

      this.logger.log(
        `PDF extraction completed in ${processingTime}ms, ${pdfData.numpages} pages processed`,
      );

      // Complete PDF analysis stage
      this.metricsService.completeProcessingStage(
        sessionId,
        'pdf_analysis',
        true,
      );

      // Enhanced scanned PDF detection
      const textLength = extractedText.length;
      const wordCount = extractedText
        .split(/\s+/)
        .filter((word) => word.length > 0).length;
      const averageWordsPerPage =
        pdfData.numpages > 0 ? wordCount / pdfData.numpages : 0;
      const textDensity =
        pdfData.numpages > 0 ? textLength / pdfData.numpages : 0;

      // Enhanced detection logic
      let isScannedPdf = false;
      let reason = '';

      if (textLength === 0) {
        isScannedPdf = true;
        reason = 'No extractable text found';
      } else if (wordCount < 20) {
        isScannedPdf = true;
        reason = `Too few total words (${wordCount} < 20)`;
      } else if (averageWordsPerPage < 50) {
        isScannedPdf = true;
        reason = `Low word density (${averageWordsPerPage.toFixed(1)} words/page < 50)`;
      } else if (textDensity < 200) {
        isScannedPdf = true;
        reason = `Low character density (${textDensity.toFixed(1)} chars/page < 200)`;
      } else {
        isScannedPdf = false;
        reason = `Sufficient text content detected (${wordCount} words, ${averageWordsPerPage.toFixed(1)} words/page)`;
      }

      this.logger.log(
        `PDF Analysis: ${wordCount} words, ${averageWordsPerPage.toFixed(1)} words/page, ${textDensity.toFixed(1)} chars/page → ${isScannedPdf ? 'SCANNED' : 'TEXT-BASED'}`,
      );

      this.metricsService.recordPdfAnalysis(sessionId, isScannedPdf, reason);

      // Complete the processing session
      this.metricsService.completeProcessingSession(sessionId, {
        success: true,
        processingMethod: 'direct',
        isScannedPdf,
        textLength: extractedText.length,
        confidence: 100,
        tempFilesCreated: 0,
      });

      return {
        text: extractedText,
        confidence: 100,
        metadata: {
          pageCount: pdfData.numpages,
          processingTime,
          isScannedPdf,
          ocrMethod: 'direct',
          originalPageCount: pdfData.numpages,
          processedPages: pdfData.numpages,
          textDensity,
          averageWordsPerPage,
          detectionReason: reason,
        },
      };
    } catch (error) {
      // Complete PDF analysis stage with failure
      this.metricsService.completeProcessingStage(
        sessionId,
        'pdf_analysis',
        false,
        error.message,
      );
      this.metricsService.recordError(sessionId, 'system', error.message);

      // Complete the processing session with failure
      this.metricsService.completeProcessingSession(sessionId, {
        success: false,
        processingMethod: 'direct',
        isScannedPdf: false,
        textLength: 0,
        confidence: 0,
        tempFilesCreated: 0,
        errorType: 'system',
      });

      this.logger.error(
        `Failed to extract text from PDF: ${error.message}`,
        error.stack,
      );
      throw new TextExtractionException(
        `PDF processing failed: ${error.message}`,
      );
    }
  }

  private summarizeText(
    text: string,
    options: SummarizationOptions = {},
  ): SummarizationResult {
    const sentences = text.split(/[.!?]+/).filter((s) => s.trim().length > 0);
    const maxSentences = options.maxLength
      ? Math.min(Math.floor(options.maxLength / 50), 3)
      : 3;

    const raw = sentences.slice(0, Math.max(1, maxSentences)).join('. ').trim();
    const tldr = raw ? (raw.endsWith('.') ? raw : raw + '.') : '';

    return {
      tldr,
      summary: tldr, // alias
      originalLength: text.length,
      summaryLength: tldr.length,
      compressionRatio: text.length > 0 ? tldr.length / text.length : 0,
    };
  }

  /**
   * Generate summary using basic implementation
   */
  async generateSummary(
    text: string,
    options: SummarizationOptions = {},
  ): Promise<SummarizationResult> {
    return this.summarizeText(text, options);
  }

  /**
   * Get pool statistics for monitoring
   */
  getPoolStats(): {
    totalWorkers: number;
    busyWorkers: number;
    idleWorkers: number;
    maxPoolSize: number;
    utilizationRate: number;
  } {
    const busyWorkers = Array.from(this.workers.values()).filter(
      (w) => w.busy,
    ).length;

    const utilizationRate =
      this.workers.size > 0 ? (busyWorkers / this.workers.size) * 100 : 0;

    return {
      totalWorkers: this.workers.size,
      busyWorkers,
      idleWorkers: this.workers.size - busyWorkers,
      maxPoolSize: this.maxPoolSize,
      utilizationRate,
    };
  }

  /**
   * Get concurrency statistics for monitoring
   */
  getConcurrencyStats(): {
    active: number;
    queued: number;
    maxConcurrent: number;
  } {
    return {
      active: this.activePdfConversions,
      queued: this.pdfConversionQueue.length,
      maxConcurrent: this.maxConcurrentPdfConversions,
    };
  }

  /**
   * Get queue information for monitoring
   */
  getQueueInfo(): {
    size: number;
    oldestRequest: number | null;
  } {
    const oldestRequest =
      this.pdfConversionQueue.length > 0
        ? this.pdfConversionQueue[0].timestamp
        : null;

    return {
      size: this.pdfConversionQueue.length,
      oldestRequest,
    };
  }

  /**
   * Check system dependencies at startup
   */
  private async checkSystemDependenciesAtStartup(): Promise<void> {
    try {
      this.logger.log(
        'Checking system dependencies for PDF-to-image conversion...',
      );

      const dependencies =
        await this.dependencyDetectionService.checkSystemDependencies();

      this.logger.log('System Dependencies Status:');
      this.logger.log(
        `  GraphicsMagick: ${dependencies.graphicsMagick.available ? 'Available' : 'Not Available'}`,
      );
      this.logger.log(
        `  ImageMagick: ${dependencies.imageMagick.available ? 'Available' : 'Not Available'}`,
      );
      this.logger.log(
        `  pdf2pic: ${dependencies.pdf2pic.available ? 'Available' : 'Not Available'}`,
      );

      const hasAnyDependency =
        dependencies.graphicsMagick.available ||
        dependencies.imageMagick.available;

      if (!hasAnyDependency) {
        this.logger.warn(
          'No image processing dependencies found. PDF-to-image conversion will be limited.',
        );
        this.logger.warn(
          'To enable PDF-to-image conversion, install GraphicsMagick or ImageMagick:',
        );

        this.logger.warn(
          '   Ubuntu/Debian: sudo apt-get install graphicsmagick',
        );
        this.logger.warn('   macOS: brew install graphicsmagick');
        this.logger.warn(
          '   Windows: Download from http://www.graphicsmagick.org/',
        );
      }
    } catch (error) {
      this.logger.error(
        'Failed to check system dependencies: ' + error.message,
      );
      this.logger.warn('Continuing startup without dependency verification');
    }
  }
}

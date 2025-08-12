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
  SummarizationException,
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

@Injectable()
export class AiModelPoolService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(AiModelPoolService.name);
  private readonly workers: Map<string, PooledWorker> = new Map();
  private readonly maxPoolSize: number;
  private readonly idleTimeout: number = 300000; // 5 minutes
  private cleanupInterval: NodeJS.Timeout;
  private metricsInterval: NodeJS.Timeout;

  constructor(
    private readonly configService: ConfigService,
    private readonly dependencyDetectionService: DependencyDetectionService,
    private readonly pdfConversionConfigService: PdfConversionConfigService,
    private readonly metricsService: ScannedPdfMetricsService,
  ) {
    this.maxPoolSize =
      this.configService.get<number>('app.maxConcurrentJobs') || 10;
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
      // Dynamic import to handle potential module loading issues
      const Tesseract = (await import('tesseract.js')) as any;

      const tesseractWorker = await Tesseract.createWorker('eng', 1, {
        logger: (m: any) => {
          if (m.status === 'loading api' || m.status === 'initializing api') {
            this.logger.debug(
              `Worker ${workerId}: ${m.status} - ${Math.round(m.progress * 100)}%`,
            );
          }
        },
      });

      const worker: PooledWorker = {
        id: workerId,
        busy: false,
        tesseractWorker,
        lastUsed: Date.now(),
      };

      this.workers.set(workerId, worker);
      this.logger.log(`Created new AI model worker: ${workerId}`);

      return worker;
    } catch (error) {
      this.logger.error(`Failed to create AI model worker: ${error.message}`);
      throw new AIModelException(
        `Failed to create AI model worker: ${error.message}`,
      );
    }
  }

  private async preWarmPool(count: number) {
    const promises = Array.from({ length: count }, () => this.createWorker());
    await Promise.all(promises);
    this.logger.log(`Pre-warmed pool with ${count} workers`);
  }

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

  private async terminateWorker(worker: PooledWorker) {
    try {
      if (worker.tesseractWorker) {
        await worker.tesseractWorker.terminate();
      }
    } catch (error) {
      this.logger.warn(`Error terminating worker ${worker.id}:`, error);
    }
  }

  private async toSummaryPages(
    extractedText: string,
    pdfPath?: string,
  ): Promise<Array<{ pageNumber: number; pageText: string }>> {
    const text = (extractedText || '').trim();

    // 1) Cas le plus simple : texte OCR déjà assemblé avec des balises de page
    //    Format attendu: "--- Page 1 ---\n...contenu...\n--- Page 2 ---\n..."
    const pageMatches = Array.from(
      text.matchAll(
        /---\s*Page\s+(\d+)\s*---([\s\S]*?)(?=(?:---\s*Page\s+\d+\s*---)|$)/gi,
      ),
    );

    if (pageMatches.length > 0) {
      return pageMatches
        .map((m) => ({
          pageNumber: Number(m[1]),
          pageText: (m[2] || '').trim(),
        }))
        .sort((a, b) => a.pageNumber - b.pageNumber);
    }

    // 2) Pas de marqueurs -> tenter de relire le PDF page par page si on a le chemin
    if (pdfPath) {
      const fs = await import('fs');
      const pdfParseMod = await import('pdf-parse');
      const pdfParse = (pdfParseMod as any).default || (pdfParseMod as any);

      const pages: string[] = [];
      const dataBuffer = fs.readFileSync(pdfPath);

      await pdfParse(dataBuffer, {
        // Rendu personnalisé par page
        pagerender: (pageData: any) =>
          pageData.getTextContent().then((tc: any) => {
            const joined = (tc.items || [])
              .map((it: any) => (typeof it?.str === 'string' ? it.str : ''))
              .join(' ')
              .replace(/\u00A0/g, ' ')
              .replace(/[ \t]+\n/g, '\n')
              .replace(/[ \t]{2,}/g, ' ')
              .trim();
            pages.push(joined);
            return joined;
          }),
      });

      if (pages.length > 0) {
        return pages.map((pTxt, i) => ({
          pageNumber: i + 1,
          pageText: pTxt || '',
        }));
      }
    }

    // 3) Fallback : tout le texte en page 1
    return [{ pageNumber: 1, pageText: text }];
  }

  async extractTextFromImage(imagePath: string): Promise<TextExtractionResult> {
    const startTime = Date.now();
    const fs = await import('fs');
    const path = await import('path');

    // 1) Validation avant toute alloc
    if (!imagePath || typeof imagePath !== 'string') {
      throw new TextExtractionException(
        `OCR processing failed: invalid imagePath (${String(imagePath)})`,
      );
    }
    if (!fs.existsSync(imagePath)) {
      throw new TextExtractionException(
        `OCR processing failed: image file not found (${imagePath})`,
      );
    }

    let worker: PooledWorker | undefined;
    let langUsed = 'eng';

    try {
      worker = await this.getWorker();
      this.logger.log(
        `Using worker ${worker.id} for OCR processing: ${path.basename(imagePath)}`,
      );

      // Premier passage (par défaut)
      let { data } = await worker.tesseractWorker.recognize(imagePath);
      let text = (data?.text ?? '').trim();
      let confidence = Number.isFinite(data?.confidence) ? data.confidence : 0;

      // Fallback si texte trop court ou confiance faible
      if (text.length < 5 || confidence < 40) {
        try {
          // Ajuste le mode de segmentation si dispo (6 = SINGLE_BLOCK)
          if (typeof worker.tesseractWorker.setParameters === 'function') {
            await worker.tesseractWorker.setParameters({
              tessedit_pageseg_mode: 6,
            });
          }
          // Charge la langue FR en plus si l'API du worker le permet
          if (typeof worker.tesseractWorker.loadLanguage === 'function') {
            await worker.tesseractWorker.loadLanguage('eng+fra');
            await worker.tesseractWorker.initialize('eng+fra');
            langUsed = 'eng+fra';
          }

          ({ data } = await worker.tesseractWorker.recognize(imagePath));
          const fallbackText = (data?.text ?? '').trim();
          const fallbackConf = Number.isFinite(data?.confidence)
            ? data.confidence
            : 0;

          // Garde le meilleur des deux passages
          if (fallbackText.length > text.length || fallbackConf > confidence) {
            text = fallbackText || text;
            confidence = Math.max(confidence, fallbackConf);
          }
        } catch (fallbackErr: any) {
          this.logger.warn(
            `OCR fallback failed: ${
              fallbackErr?.message || String(fallbackErr)
            }`,
          );
        }
      }

      return {
        text,
        confidence,
        metadata: {
          processingTime: Date.now() - startTime,
          language: langUsed,
          workerId: worker.id,
        },
      };
    } catch (error: any) {
      const msg =
        error?.message ??
        (typeof error === 'string' ? error : JSON.stringify(error));
      this.logger.error(
        `Failed to extract text from image: ${msg}`,
        error?.stack,
      );
      throw new TextExtractionException(`OCR processing failed: ${msg}`);
    } finally {
      if (worker) this.releaseWorker(worker);
    }
  }

  async extractTextFromPdf(
    pdfPath: string,
    onProgress?: (p: number) => void, // 👈 nouveau (optionnel)
  ): Promise<TextExtractionResult> {
    const startTime = Date.now();
    this.logger.log(`Starting PDF text extraction for: ${pdfPath}`);

    const sessionId = this.metricsService.startProcessingSession(pdfPath);
    this.metricsService.startProcessingStage(sessionId, 'pdf_analysis');

    const fs = await import('fs');
    let result: TextExtractionResult;
    let pdfData: any;

    try {
      let pdfParse: any;
      try {
        // eslint-disable-next-line @typescript-eslint/no-var-requires
        pdfParse = require('pdf-parse');
      } catch {
        const mod = await import('pdf-parse');
        pdfParse = mod.default || mod;
      }
      if (typeof pdfParse !== 'function') {
        throw new Error('pdf-parse is not a function');
      }

      // lecture & parse
      const dataBuffer = fs.readFileSync(pdfPath);
      pdfData = await pdfParse(dataBuffer, { max: 100, version: 'v1.10.100' });
      const extractedText = (pdfData.text || '').trim();

      this.logger.log(
        `PDF parsed: ${pdfData.numpages} pages, ${extractedText.length} chars`,
      );

      onProgress?.(20);

      const isScannedPdf =
        extractedText.length === 0 || extractedText.length < 50;

      this.logger.log(
        `PDF analysis: ${pdfData.numpages} pages, ${extractedText.length} chars, isScannedPdf: ${isScannedPdf}`,
      );

      if (isScannedPdf) {
        this.logger.log('PDF appears to be scanned - using OCR for all pages');

        onProgress?.(25);

        // OCR (pdftoppm/tesseract)
        result = await this.convertPdfToImageAndOcr(pdfPath, sessionId);

        // ⬅ summary depuis le texte OCR (contient déjà "--- Page n ---")
        result.summary = await this.toSummaryPages(result.text);

        this.metricsService.recordPdfAnalysis(
          sessionId,
          true,
          'Converted to image and processed with OCR',
        );
        this.metricsService.completeProcessingSession(sessionId, {
          success: true,
          processingMethod: 'pdf-to-image',
          isScannedPdf: true,
          textLength: result.text.length,
          confidence: result.confidence,
          tempFilesCreated: result.metadata.pageCount,
        });
      } else {
        this.logger.log(
          `PDF is text-based - using direct extraction from all ${pdfData.numpages} pages`,
        );

        const summary = await this.toSummaryPages(extractedText, pdfPath);

        result = {
          text: extractedText,
          confidence: extractedText.length > 0 ? 100 : 50,
          metadata: {
            pageCount: pdfData.numpages,
            processingTime: Date.now() - startTime,
            isScannedPdf: false,
            ocrMethod: 'direct',
            originalPageCount: pdfData.numpages,
            processedPages: pdfData.numpages,
          },
          summary,
        };

        onProgress?.(60);

        this.logger.debug(
          `Built summary pages: isArray=${Array.isArray(result.summary)} len=${result.summary?.length ?? 0}`,
        );

        this.metricsService.recordPdfAnalysis(
          sessionId,
          false,
          'Sufficient text content for direct extraction',
        );
        this.metricsService.completeProcessingSession(sessionId, {
          success: true,
          processingMethod: 'direct',
          isScannedPdf: false,
          textLength: result.text.length,
          confidence: result.confidence,
          tempFilesCreated: 0,
        });
      }

      // ─── CLEANUP (après avoir construit summary) ───
      try {
        fs.unlinkSync(pdfPath);
        this.logger.log(`Deleted source PDF: ${pdfPath}`);
      } catch (e: any) {
        if (e.code !== 'ENOENT') {
          this.logger.warn(`Error deleting ${pdfPath}: ${e.message}`);
        }
      }

      return result;
    } catch (error: any) {
      this.metricsService.completeProcessingStage(
        sessionId,
        'pdf_analysis',
        false,
        error.message,
      );
      this.metricsService.recordError(sessionId, 'system', error.message);

      this.logger.error(
        `Failed to extract text from PDF: ${error.message}`,
        error.stack,
      );
      throw new TextExtractionException(
        `PDF processing failed: ${error.message}`,
      );
    }
  }

  private async convertPdfToImageAndOcr(
    pdfPath: string,
    sessionId: string,
    onProgress?: (p: number) => void,
  ): Promise<TextExtractionResult> {
    const startTime = Date.now();
    const fs = await import('fs');
    const path = await import('path');
    const { execFile } = await import('child_process');

    const tmpFiles: string[] = [];
    let conversionDir = '';

    try {
      const pdfParseMod = await import('pdf-parse');
      const pdfParse = (pdfParseMod as any).default || (pdfParseMod as any);
      const dataBuffer = fs.readFileSync(pdfPath);
      const pdfInfo = await pdfParse(dataBuffer, { max: 0 });
      const totalPages: number = pdfInfo?.numpages ?? 0;
      if (!totalPages)
        throw new Error('Impossible de déterminer le nombre de pages du PDF');
      this.logger.log(`PDF → ${totalPages} page(s)`);

      conversionDir = path.join(
        process.cwd(),
        'temp',
        `pdf-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      );
      fs.mkdirSync(conversionDir, { recursive: true });

      const outPrefix = path.join(conversionDir, 'page'); // => page-1.jpg
      const args = [
        '-jpeg',
        '-r',
        '200',
        '-f',
        '1',
        '-l',
        String(totalPages),
        pdfPath,
        outPrefix,
      ];

      await new Promise<void>((resolve, reject) => {
        execFile('pdftoppm', args, (err) => {
          if (err)
            reject(new Error(`pdftoppm a échoué: ${err.message || err}`));
          else resolve();
        });
      });

      const files = fs.readdirSync(conversionDir);
      this.logger.debug(`Images générées: ${files.join(', ')}`);

      const imgFiles = files
        .filter((f) => /^page-\d+\.jpg$/i.test(f))
        .map((f) => {
          const m = f.match(/^page-(\d+)\.jpg$/i);
          return {
            page: Number(m?.[1] || 0),
            path: path.join(conversionDir, f),
          };
        })
        .filter((x) => x.page > 0)
        .sort((a, b) => a.page - b.page);

      if (imgFiles.length === 0) {
        throw new Error(
          'Aucune image générée par pdftoppm (vérifiez poppler-utils).',
        );
      }
      if (imgFiles.length !== totalPages) {
        this.logger.warn(
          `Nombre d'images générées (${imgFiles.length}) différent du nombre de pages (${totalPages}).`,
        );
      }
      for (const f of imgFiles) tmpFiles.push(f.path);

      const parallelism = Math.max(1, Math.min(this.maxPoolSize ?? 6, 6));
      this.logger.log(`OCR en parallèle avec ${parallelism} thread(s) max`);

      onProgress?.(30);

      const total = imgFiles.length;
      let done = 0;
      let index = 0;
      let lastProgress = 0;

      const ocrTexts: {
        page: number;
        text: string;
        confidence: number;
        file: string;
      }[] = [];

      // const worker = async () => {
      //   for (;;) {
      //     const current = imgFiles[index++];
      //     if (!current) break;

      //     if (!current.path || !fs.existsSync(current.path)) {
      //       this.logger.warn(`Image absente avant OCR: ${current.path}`);
      //       ocrTexts.push({
      //         page: current.page,
      //         text: '',
      //         confidence: 0,
      //         file: current.path,
      //       });
      //       continue;
      //     }

      //     try {
      //       this.logger.log(
      //         `OCR page ${current.page}/${totalPages} → ${current.path}`,
      //       );
      //       const pageOcr = await this.extractTextFromImage(current.path);
      //       ocrTexts.push({
      //         page: current.page,
      //         text: pageOcr.text,
      //         confidence: pageOcr.confidence ?? 0,
      //         file: current.path,
      //       });
      //     } catch (e: any) {
      //       this.logger.warn(
      //         `Échec OCR page ${current.page}: ${e?.message || e}`,
      //       );
      //       ocrTexts.push({
      //         page: current.page,
      //         text: '',
      //         confidence: 0,
      //         file: current.path,
      //       });
      //     }
      //   }
      // };

      const worker = async () => {
        for (;;) {
          const current = imgFiles[index++];
          if (!current) break;

          if (!current.path || !fs.existsSync(current.path)) {
            this.logger.warn(`Image absente avant OCR: ${current.path}`);
            ocrTexts.push({
              page: current.page,
              text: '',
              confidence: 0,
              file: current.path,
            });
            // ✅ on compte quand même cette page
            done++;
            if (onProgress) {
              const p = 30 + Math.floor((done / total) * 30); // 30 → 60
              if (p !== lastProgress) {
                lastProgress = p;
                onProgress(Math.min(60, p));
              }
            }
            continue;
          }

          try {
            this.logger.log(
              `OCR page ${current.page}/${totalPages} → ${current.path}`,
            );
            const pageOcr = await this.extractTextFromImage(current.path);
            ocrTexts.push({
              page: current.page,
              text: pageOcr.text,
              confidence: pageOcr.confidence ?? 0,
              file: current.path,
            });
          } catch (e: any) {
            this.logger.warn(
              `Échec OCR page ${current.page}: ${e?.message || e}`,
            );
            ocrTexts.push({
              page: current.page,
              text: '',
              confidence: 0,
              file: current.path,
            });
          } finally {
            // ✅ qu'il y ait eu succès ou erreur, la page est "faite"
            done++;
            if (onProgress) {
              const p = 30 + Math.floor((done / total) * 30); // 30 → 60
              if (p !== lastProgress) {
                lastProgress = p;
                onProgress(Math.min(60, p));
              }
            }
          }
        }
      };

      await Promise.all(Array.from({ length: parallelism }, () => worker()));

      onProgress?.(60);

      ocrTexts.sort((a, b) => a.page - b.page);
      const combinedText = ocrTexts
        .map((r) => `--- Page ${r.page} ---\n${r.text}`)
        .join('\n\n');
      const avgConfidence = ocrTexts.length
        ? Math.round(
            ocrTexts.reduce(
              (s, r) => s + (isFinite(r.confidence) ? r.confidence : 0),
              0,
            ) / ocrTexts.length,
          )
        : 0;

      const processingTime = Date.now() - startTime;

      // 7) Nettoyage
      for (const f of tmpFiles) {
        try {
          fs.unlinkSync(f);
        } catch {}
      }
      try {
        (fs as any).rmSync?.(conversionDir, { recursive: true, force: true });
      } catch {}

      return {
        text: combinedText,
        confidence: avgConfidence,
        metadata: {
          pageCount: totalPages,
          processingTime,
          isScannedPdf: true,
          ocrMethod: 'pdf-to-image', // ✅ conforme au type union
          originalPageCount: totalPages,
          processedPages: ocrTexts.length,
          tempFilesCreated: imgFiles.length,
          language: 'eng',
        },
      };
    } catch (error: any) {
      // cleanup en cas d’erreur
      try {
        for (const f of tmpFiles) {
          try {
            fs.unlinkSync(f);
          } catch {}
        }
        if (conversionDir) {
          (fs as any).rmSync?.(conversionDir, { recursive: true, force: true });
        }
      } catch {}
      const msg =
        error?.message ??
        (typeof error === 'string' ? error : JSON.stringify(error));
      this.logger.error(
        `convertPdfToImageAndOcr a échoué: ${msg}`,
        error?.stack,
      );
      throw new TextExtractionException(`OCR PDF échoué: ${msg}`);
    }
  }

  /**
   * Summarize text using basic implementation
   */
  summarizeText(
    text: string,
    options: SummarizationOptions = {},
  ): SummarizationResult {
    try {
      // Basic summarization - just take first few sentences
      const sentences = text.split(/[.!?]+/).filter((s) => s.trim().length > 0);
      const maxSentences = options.maxLength
        ? Math.min(options.maxLength / 50, 3)
        : 3;
      const summary = sentences.slice(0, maxSentences).join('. ') + '.';

      return {
        tldr: summary.trim(),
        originalLength: text.length,
        summaryLength: summary.length,
        compressionRatio: summary.length / text.length,
      };
    } catch (error) {
      this.logger.error(`Failed to summarize text: ${error.message}`);
      throw new SummarizationException(
        `Text summarization failed: ${error.message}`,
      );
    }
  }

  /**
   * Generate summary using basic implementation
   */
  generateSummary(
    text: string,
    options: SummarizationOptions = {},
  ): SummarizationResult {
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
      active: 0,
      queued: 0,
      maxConcurrent: this.maxPoolSize,
    };
  }

  /**
   * Get queue information for monitoring
   */
  getQueueInfo(): {
    size: number;
    oldestRequest: number | null;
  } {
    return {
      size: 0,
      oldestRequest: null,
    };
  }
}

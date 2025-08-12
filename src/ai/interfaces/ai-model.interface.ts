export interface PageSummaryItem {
  pageNumber: number;
  pageText: string;
}

export interface TextExtractionResult {
  text: string;
  confidence: number;
  metadata: {
    pageCount?: number;
    processingTime: number;
    language?: string;
    workerId?: string;
    isScannedPdf?: boolean;
    ocrMethod?: 'direct' | 'pdf-to-image' | 'direct_fallback';
    originalPageCount?: number;
    processedPages?: number;
    tempFilesCreated?: number;
    [k: string]: any;
  };
  summary?: PageSummaryItem[];
}

export interface SummarizationOptions {
  maxLength?: number;
  language?: string;
  summaryType?: 'extractive' | 'abstractive';
  keywordCount?: number;
}

export interface SummarizationResult {
  tldr: string;
  originalLength: number;
  summaryLength: number;
  compressionRatio: number;
  summary?: string;
}

export interface IAiModelService {
  extractTextFromImage(imagePath: string): Promise<TextExtractionResult>;
  extractTextFromPdf(pdfPath: string): Promise<TextExtractionResult>;
  generateSummary(
    text: string,
    options?: SummarizationOptions,
  ): Promise<SummarizationResult>;
}

// Re-export dependency interfaces
export * from './dependency.interface';

// Re-export PDF conversion interfaces
export * from './pdf-conversion.interface';

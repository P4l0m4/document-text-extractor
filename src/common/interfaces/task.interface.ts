export enum TaskStatus {
  PENDING = 'pending',
  PROCESSING = 'processing',
  COMPLETED = 'completed',
  FAILED = 'failed',
}

export interface Task {
  id: string;
  status: TaskStatus;
  fileName: string;
  fileType: string;
  createdAt: Date;
  updatedAt: Date;
  progress?: number;
  result?: ProcessingResult;
  error?: string;
}

export interface PageSummaryItem {
  pageNumber: number;
  pageText: string;
}

export interface ProcessingResult {
  extractedText: string;
  summary: PageSummaryItem[];
  tldr?: string;
  metadata: {
    pageCount?: number;
    fileSize: number;
    processingTime: number;
    confidence?: number;
    isScannedPdf?: boolean;
    ocrMethod?: 'direct' | 'pdf-to-image' | 'direct_fallback';
    conversionTime?: number;
    ocrTime?: number;
    originalPageCount?: number;
    processedPages?: number;
    tempFilesCreated?: number;
    conversionSupported?: boolean;
    fallbackUsed?: boolean;
    systemDependencies?: {
      graphicsMagick: boolean;
      imageMagick: boolean;
      pdf2pic: boolean;
    };
    workerId?: string;
    language?: string;
  };
}

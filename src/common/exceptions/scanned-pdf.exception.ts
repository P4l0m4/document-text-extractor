import { HttpException, HttpStatus } from '@nestjs/common';
import { ProcessingException } from './processing.exception';

/**
 * Interface for detailed scanned PDF error information
 */
export interface ScannedPdfErrorDetails {
  errorType: 'dependency' | 'conversion' | 'ocr' | 'system';
  pdfPath?: string;
  pageCount?: number;
  attemptedPages?: number;
  failedAt?: string;
  dependencyStatus?: {
    pdf2pic: {
      available: boolean;
      version?: string;
      installationInstructions: string;
    };
    graphicsMagick: {
      available: boolean;
      version?: string;
      path?: string;
      installationInstructions: string;
    };
    imageMagick: {
      available: boolean;
      version?: string;
      path?: string;
      installationInstructions: string;
    };
  };
  conversionDetails?: {
    conversionTime?: number;
    tempFilesCreated?: string[];
    cleanupAttempted?: boolean;
    cleanupSuccessful?: boolean;
  };
  installationHelp?: {
    platform: string;
    instructions: string[];
    downloadLinks: string[];
  };
  partialResults?: {
    directTextAvailable: boolean;
    directTextLength: number;
    fallbackUsed: boolean;
  };
}

/**
 * Base exception for scanned PDF processing errors
 */
export class ScannedPdfException extends ProcessingException {
  public readonly details: ScannedPdfErrorDetails;

  constructor(
    message: string,
    details: ScannedPdfErrorDetails,
    taskId?: string,
  ) {
    super(`Scanned PDF processing failed: ${message}`, taskId);
    this.details = details;
  }

  /**
   * Get a user-friendly error message with actionable guidance
   */
  getUserFriendlyMessage(): string {
    const { errorType, dependencyStatus, installationHelp } = this.details;

    switch (errorType) {
      case 'dependency':
        let message = 'PDF-to-image conversion is not available due to missing dependencies:\n';
        
        if (dependencyStatus) {
          if (!dependencyStatus.pdf2pic.available) {
            message += `• pdf2pic library: ${dependencyStatus.pdf2pic.installationInstructions}\n`;
          }
          
          if (!dependencyStatus.graphicsMagick.available && !dependencyStatus.imageMagick.available) {
            message += '• Image processing backend: Install either GraphicsMagick or ImageMagick\n';
            message += `  - GraphicsMagick: ${dependencyStatus.graphicsMagick.installationInstructions}\n`;
            message += `  - ImageMagick: ${dependencyStatus.imageMagick.installationInstructions}\n`;
          }
        }

        if (installationHelp) {
          message += `\nFor ${installationHelp.platform}:\n`;
          installationHelp.instructions.forEach((instruction, index) => {
            message += `${index + 1}. ${instruction}\n`;
          });
        }

        return message;

      case 'conversion':
        return `PDF-to-image conversion failed: ${this.message}. This may be due to a corrupted PDF file, insufficient system resources, or configuration issues with the image processing backend.`;

      case 'ocr':
        return `OCR processing failed after successful PDF-to-image conversion: ${this.message}. This may be due to poor image quality or OCR engine issues.`;

      case 'system':
        return `System error during scanned PDF processing: ${this.message}. This may be due to file system permissions, memory constraints, or temporary file management issues.`;

      default:
        return this.message;
    }
  }

  /**
   * Check if partial results are available
   */
  hasPartialResults(): boolean {
    return this.details.partialResults?.directTextAvailable === true;
  }

  /**
   * Get partial results if available
   */
  getPartialResults(): { directTextLength: number; fallbackUsed: boolean } | null {
    if (!this.hasPartialResults()) {
      return null;
    }

    return {
      directTextLength: this.details.partialResults!.directTextLength,
      fallbackUsed: this.details.partialResults!.fallbackUsed,
    };
  }
}

/**
 * Exception for missing system dependencies
 */
export class DependencyException extends ScannedPdfException {
  constructor(
    missingDependencies: string[],
    dependencyStatus: ScannedPdfErrorDetails['dependencyStatus'],
    installationHelp: ScannedPdfErrorDetails['installationHelp'],
    taskId?: string,
  ) {
    const message = `Missing required dependencies: ${missingDependencies.join(', ')}`;
    
    super(
      message,
      {
        errorType: 'dependency',
        dependencyStatus,
        installationHelp,
      },
      taskId,
    );
  }
}

/**
 * Exception for PDF-to-image conversion failures
 */
export class ConversionException extends ScannedPdfException {
  constructor(
    message: string,
    pdfPath: string,
    pageCount: number,
    conversionDetails: ScannedPdfErrorDetails['conversionDetails'],
    taskId?: string,
  ) {
    super(
      message,
      {
        errorType: 'conversion',
        pdfPath,
        pageCount,
        conversionDetails,
      },
      taskId,
    );
  }
}

/**
 * Exception for OCR processing failures after successful conversion
 */
export class OcrException extends ScannedPdfException {
  constructor(
    message: string,
    pdfPath: string,
    pageCount: number,
    attemptedPages: number,
    failedAt: string,
    taskId?: string,
  ) {
    super(
      message,
      {
        errorType: 'ocr',
        pdfPath,
        pageCount,
        attemptedPages,
        failedAt,
      },
      taskId,
    );
  }
}

/**
 * Exception for system-level errors during scanned PDF processing
 */
export class ScannedPdfSystemException extends ScannedPdfException {
  constructor(
    message: string,
    pdfPath: string,
    conversionDetails?: ScannedPdfErrorDetails['conversionDetails'],
    taskId?: string,
  ) {
    super(
      message,
      {
        errorType: 'system',
        pdfPath,
        conversionDetails,
      },
      taskId,
    );
  }
}

/**
 * Exception for partial processing results with fallback
 */
export class PartialProcessingException extends ScannedPdfException {
  constructor(
    message: string,
    pdfPath: string,
    partialResults: ScannedPdfErrorDetails['partialResults'],
    originalError: ScannedPdfErrorDetails,
    taskId?: string,
  ) {
    super(
      message,
      {
        ...originalError,
        pdfPath,
        partialResults,
      },
      taskId,
    );
  }
}
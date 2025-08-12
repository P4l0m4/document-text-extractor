import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PdfConversionConfig, PDF_CONVERSION_DEFAULTS } from './interfaces/pdf-conversion.interface';

@Injectable()
export class PdfConversionConfigService {
  private readonly logger = new Logger(PdfConversionConfigService.name);
  private readonly config: PdfConversionConfig;

  constructor(private readonly configService: ConfigService) {
    this.config = this.loadConfiguration();
    this.validateConfiguration();
    this.logConfiguration();
  }

  /**
   * Get the complete PDF conversion configuration
   */
  getConfig(): PdfConversionConfig {
    return { ...this.config };
  }

  /**
   * Get specific configuration value
   */
  getDensity(): number {
    return this.config.density;
  }

  getFormat(): 'png' | 'jpg' {
    return this.config.format;
  }

  getWidth(): number {
    return this.config.width;
  }

  getHeight(): number {
    return this.config.height;
  }

  getMaxPages(): number {
    return this.config.maxPages;
  }

  getTempDir(): string {
    return this.config.tempDir;
  }

  getTimeout(): number {
    return this.config.timeout;
  }

  isEnabled(): boolean {
    return this.config.enabled;
  }

  /**
   * Load configuration from environment variables with defaults
   */
  private loadConfiguration(): PdfConversionConfig {
    const tempDir = this.configService.get<string>('TEMP_DIR') || '/tmp/document-processing';
    
    return {
      density: this.configService.get<number>('PDF_CONVERSION_DPI') || PDF_CONVERSION_DEFAULTS.DENSITY,
      format: this.validateFormat(
        this.configService.get<string>('PDF_CONVERSION_FORMAT') || PDF_CONVERSION_DEFAULTS.FORMAT
      ),
      width: this.configService.get<number>('PDF_CONVERSION_WIDTH') || PDF_CONVERSION_DEFAULTS.WIDTH,
      height: this.configService.get<number>('PDF_CONVERSION_HEIGHT') || PDF_CONVERSION_DEFAULTS.HEIGHT,
      maxPages: this.configService.get<number>('PDF_CONVERSION_MAX_PAGES') || PDF_CONVERSION_DEFAULTS.MAX_PAGES,
      tempDir: this.configService.get<string>('PDF_TEMP_DIR') || `${tempDir}/pdf-conversion`,
      timeout: this.configService.get<number>('PDF_CONVERSION_TIMEOUT') || PDF_CONVERSION_DEFAULTS.TIMEOUT,
      enabled: this.configService.get<boolean>('PDF_CONVERSION_ENABLED') !== false, // Default to true unless explicitly disabled
    };
  }

  /**
   * Validate format parameter
   */
  private validateFormat(format: string): 'png' | 'jpg' {
    const normalizedFormat = format.toLowerCase();
    if (normalizedFormat === 'png' || normalizedFormat === 'jpg' || normalizedFormat === 'jpeg') {
      return normalizedFormat === 'jpeg' ? 'jpg' : normalizedFormat as 'png' | 'jpg';
    }
    
    this.logger.warn(`Invalid PDF_CONVERSION_FORMAT: ${format}. Using default: ${PDF_CONVERSION_DEFAULTS.FORMAT}`);
    return PDF_CONVERSION_DEFAULTS.FORMAT;
  }

  /**
   * Validate the loaded configuration
   */
  private validateConfiguration(): void {
    const errors: string[] = [];

    // Validate density (DPI)
    if (this.config.density < 72 || this.config.density > 600) {
      errors.push(`PDF_CONVERSION_DPI must be between 72 and 600, got: ${this.config.density}`);
    }

    // Validate dimensions
    if (this.config.width < 100 || this.config.width > 5000) {
      errors.push(`PDF_CONVERSION_WIDTH must be between 100 and 5000, got: ${this.config.width}`);
    }

    if (this.config.height < 100 || this.config.height > 5000) {
      errors.push(`PDF_CONVERSION_HEIGHT must be between 100 and 5000, got: ${this.config.height}`);
    }

    // Validate max pages
    if (this.config.maxPages < 1 || this.config.maxPages > 10) {
      errors.push(`PDF_CONVERSION_MAX_PAGES must be between 1 and 10, got: ${this.config.maxPages}`);
    }

    // Validate timeout
    if (this.config.timeout < 5000 || this.config.timeout > 300000) {
      errors.push(`PDF_CONVERSION_TIMEOUT must be between 5000 and 300000 ms, got: ${this.config.timeout}`);
    }

    // Validate temp directory
    if (!this.config.tempDir || this.config.tempDir.trim().length === 0) {
      errors.push('PDF_TEMP_DIR cannot be empty');
    }

    if (errors.length > 0) {
      const errorMessage = `PDF conversion configuration validation failed:\n${errors.join('\n')}`;
      this.logger.error(errorMessage);
      throw new Error(errorMessage);
    }
  }

  /**
   * Log the current configuration for debugging
   */
  private logConfiguration(): void {
    this.logger.log('PDF Conversion Configuration:');
    this.logger.log(`  Enabled: ${this.config.enabled}`);
    this.logger.log(`  DPI: ${this.config.density}`);
    this.logger.log(`  Format: ${this.config.format}`);
    this.logger.log(`  Dimensions: ${this.config.width}x${this.config.height}`);
    this.logger.log(`  Max Pages: ${this.config.maxPages}`);
    this.logger.log(`  Timeout: ${this.config.timeout}ms`);
    this.logger.log(`  Temp Directory: ${this.config.tempDir}`);
  }

  /**
   * Get configuration for pdf2pic library
   */
  getPdf2picOptions(saveFilename: string, savePath: string) {
    return {
      density: this.config.density,
      saveFilename,
      savePath,
      format: this.config.format,
      width: this.config.width,
      height: this.config.height,
    };
  }
}
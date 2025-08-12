export interface PdfConversionConfig {
  density: number; // DPI for image conversion (default: 200)
  format: 'png' | 'jpg'; // Output image format (default: 'png')
  width: number; // Max image width (default: 2000)
  height: number; // Max image height (default: 2000)
  maxPages: number; // Max pages to process (default: 1)
  tempDir: string; // Temporary directory for images
  timeout: number; // Conversion timeout in milliseconds (default: 30000)
  enabled: boolean; // Whether PDF conversion is enabled (default: true)
}

export interface PdfConversionDefaults {
  readonly DENSITY: number;
  readonly FORMAT: 'png' | 'jpg';
  readonly WIDTH: number;
  readonly HEIGHT: number;
  readonly MAX_PAGES: number;
  readonly TIMEOUT: number;
  readonly ENABLED: boolean;
}

export const PDF_CONVERSION_DEFAULTS: PdfConversionDefaults = {
  DENSITY: 200,
  FORMAT: 'png',
  WIDTH: 2000,
  HEIGHT: 2000,
  MAX_PAGES: 1,
  TIMEOUT: 30000,
  ENABLED: true,
} as const;
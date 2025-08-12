// TypeScript definitions for pdf2pic
declare module 'pdf2pic' {
  export interface ConversionOptions {
    density?: number;
    saveFilename?: string;
    savePath?: string;
    format?: 'png' | 'jpg' | 'jpeg';
    width?: number;
    height?: number;
    quality?: number;
  }

  export interface ConversionResult {
    name?: string;
    size: number | string;
    path?: string;
    page: number;
    base64?: string;
  }

  export interface Converter {
    (pageNumber?: number): Promise<ConversionResult>;
    bulk(startPage: number, endPage: number): Promise<ConversionResult[]>;
  }

  export function fromPath(
    pdfPath: string,
    options?: ConversionOptions,
  ): Converter;
  export function fromBuffer(
    buffer: Buffer,
    options?: ConversionOptions,
  ): Converter;
}

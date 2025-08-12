declare module 'pdf-parse' {
  export interface PDFData {
    text: string;
    numpages: number;
    info: any;
    metadata: any;
  }

  export interface PDFParseOptions {
    max?: number;
    version?: string;
  }

  function pdfParse(
    buffer: Buffer,
    options?: PDFParseOptions,
  ): Promise<PDFData>;

  export default pdfParse;
}

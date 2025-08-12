declare module 'tesseract.js' {
  export interface RecognizeResult {
    data: {
      text: string;
      confidence: number;
    };
  }

  export interface Worker {
    recognize(image: string): Promise<RecognizeResult>;
    terminate(): Promise<void>;
  }

  export function createWorker(
    lang: string,
    oem?: number,
    options?: {
      logger?: (m: any) => void;
    },
  ): Promise<Worker>;

  export function recognize(
    image: string,
    lang: string,
    options?: {
      logger?: (m: any) => void;
    },
  ): Promise<RecognizeResult>;
}

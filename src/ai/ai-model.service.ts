import { Injectable, Logger } from '@nestjs/common';
import {
  IAiModelService,
  TextExtractionResult,
  SummarizationOptions,
  SummarizationResult,
} from './interfaces/ai-model.interface';
import { SummarizationException } from '../common/exceptions';
import { AiModelPoolService } from './ai-model-pool.service';

@Injectable()
export class AiModelService implements IAiModelService {
  private readonly logger = new Logger(AiModelService.name);

  constructor(private readonly pool: AiModelPoolService) {}

  async processPdf(
    pdfPath: string,
  ): Promise<TextExtractionResult & { tldr: string }> {
    const extraction = await this.pool.extractTextFromPdf(pdfPath); // => { text, metadata, summary: [{pageNumber,pageText}] }
    const short = await this.generateSummary(extraction.text); // => { summary: string, ... }
    return { ...extraction, tldr: short.summary }; // => summary[] intact + tldr séparé
  }

  /**
   * Extraction texte PDF — on délègue au pool pour bénéficier de la détection scanné/texte
   * et de la construction du summary[] par pages.
   */
  async extractTextFromPdf(pdfPath: string): Promise<TextExtractionResult> {
    return this.pool.extractTextFromPdf(pdfPath);
  }

  async extractTextFromImage(imagePath: string): Promise<TextExtractionResult> {
    return this.pool.extractTextFromImage(imagePath);
  }

  /**
   * Generate summary from extracted text
   * Supports both extractive and abstractive summarization approaches
   * In production, abstractive would use a local language model
   */
  async generateSummary(
    text: string,
    options: SummarizationOptions = {},
  ): Promise<SummarizationResult> {
    const maxLength = options.maxLength ?? 200;
    const summaryType = options.summaryType ?? 'extractive';
    const keywordCount = options.keywordCount ?? 5;

    try {
      this.logger.log(
        `Starting ${summaryType} summarization, target length: ${maxLength} characters`,
      );

      if (!text || text.trim().length === 0) {
        throw new SummarizationException('Input text is empty or invalid');
      }

      let summary = '';
      if (summaryType === 'extractive') {
        summary = await this.generateExtractiveSummary(text, maxLength);
      } else {
        summary = await this.generateAbstractiveSummary(
          text,
          maxLength,
          keywordCount,
        );
      }

      const tldr = summary.trim();

      return {
        tldr,
        summary: tldr,
        originalLength: text.length,
        summaryLength: tldr.length,
        compressionRatio: text.length > 0 ? tldr.length / text.length : 0,
      };
    } catch (error) {
      this.logger.error(
        `Failed to generate summary: ${error.message}`,
        error.stack,
      );
      if (error instanceof SummarizationException) throw error;
      throw new SummarizationException(
        `Summarization failed: ${error.message}`,
      );
    }
  }

  /**
   * Generate extractive summary by selecting important sentences
   */
  private async generateExtractiveSummary(
    text: string,
    maxLength: number,
  ): Promise<string> {
    const sentences = text.split(/[.!?]+/).filter((s) => s.trim().length > 0);

    if (sentences.length === 0) {
      return (
        text.substring(0, maxLength).trim() +
        (text.length > maxLength ? '...' : '')
      );
    }

    // Score sentences based on position and word frequency
    const scoredSentences = sentences.map((sentence, index) => {
      const words = sentence
        .toLowerCase()
        .split(/\s+/)
        .filter((w) => w.length > 3);
      const positionScore = 1 - index / sentences.length; // Earlier sentences get higher scores
      const lengthScore = Math.min(sentence.length / 100, 1); // Prefer medium-length sentences
      const wordScore = words.length / 20; // More content words = higher score

      return {
        sentence: sentence.trim(),
        score: positionScore * 0.4 + lengthScore * 0.3 + wordScore * 0.3,
        index,
      };
    });

    // Sort by score and select top sentences that fit within maxLength
    scoredSentences.sort((a, b) => b.score - a.score);

    let summary = '';
    const selectedSentences: { sentence: string; index: number }[] = [];

    for (const item of scoredSentences) {
      const potentialAddition = (summary ? '. ' : '') + item.sentence;
      if (summary.length + potentialAddition.length <= maxLength) {
        selectedSentences.push(item);
        summary += potentialAddition;
      }
    }

    // Sort selected sentences by original order
    selectedSentences.sort((a, b) => a.index - b.index);
    summary = selectedSentences.map((s) => s.sentence).join('. ');

    if (summary) {
      summary += '.';
    } else {
      // Fallback: take first sentence or truncate
      summary = sentences[0] || text.substring(0, maxLength).trim();
      if (text.length > maxLength) {
        summary += '...';
      }
    }

    return summary;
  }

  /**
   * Generate abstractive summary using keyword-based approach
   * In production, this would use a local language model
   */
  private async generateAbstractiveSummary(
    text: string,
    maxLength: number,
    keywordCount: number,
  ): Promise<string> {
    // Extract key phrases and concepts
    const words = text
      .toLowerCase()
      .replace(/[^\w\s]/g, ' ')
      .split(/\s+/)
      .filter((w) => w.length > 3);

    // Simple frequency analysis for key terms
    const wordFreq = new Map<string, number>();
    words.forEach((word) => {
      wordFreq.set(word, (wordFreq.get(word) || 0) + 1);
    });

    // Get top keywords
    const keywords = Array.from(wordFreq.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, keywordCount)
      .map(([word]) => word);

    // Find sentences containing the most keywords
    const sentences = text.split(/[.!?]+/).filter((s) => s.trim().length > 0);
    const keywordSentences = sentences
      .map((sentence) => {
        const sentenceWords = sentence.toLowerCase().split(/\s+/);
        const keywordMatches = keywords.filter((keyword) =>
          sentenceWords.some((word) => word.includes(keyword)),
        ).length;

        return {
          sentence: sentence.trim(),
          keywordScore: keywordMatches,
          length: sentence.length,
        };
      })
      .filter((item) => item.keywordScore > 0)
      .sort((a, b) => b.keywordScore - a.keywordScore);

    // Build summary from keyword-rich sentences
    let summary = '';
    for (const item of keywordSentences) {
      const addition = (summary ? '. ' : '') + item.sentence;
      if (summary.length + addition.length <= maxLength) {
        summary += addition;
      } else {
        break;
      }
    }

    if (!summary && sentences.length > 0) {
      // Fallback to first sentence
      summary = sentences[0];
    }

    if (summary && !summary.endsWith('.')) {
      summary += '.';
    }

    // If still too long, truncate
    if (summary.length > maxLength) {
      summary = summary.substring(0, maxLength - 3).trim() + '...';
    }

    return summary || 'Unable to generate summary from the provided text.';
  }
}

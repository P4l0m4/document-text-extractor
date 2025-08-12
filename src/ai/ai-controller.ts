import {
  Controller,
  Post,
  UseInterceptors,
  UploadedFile,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { AiModelService } from './ai-model.service';

@Controller('ai')
export class AiController {
  constructor(private readonly ai: AiModelService) {}

  // POST /ai/process-pdf  (form-data key: "file")
  @Post('process-pdf')
  @UseInterceptors(FileInterceptor('file'))
  async processPdf(@UploadedFile() file: Express.Multer.File) {
    // 👉 renvoie summary[] (par pages) + tldr (résumé court)
    return this.ai.processPdf(file.path);
  }
}

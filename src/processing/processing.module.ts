import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ProcessingService } from './processing.service';
import { TaskModule } from '../task/task.module';
import { AiModule } from '../ai/ai.module';
import { CommonModule } from '../common';

@Module({
  imports: [ConfigModule, CommonModule, TaskModule, AiModule],
  providers: [ProcessingService],
  exports: [ProcessingService],
})
export class ProcessingModule {}

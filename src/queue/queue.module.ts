import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { QueueService } from './queue.service';
import { CommonModule } from '../common';

@Module({
  imports: [ConfigModule, CommonModule],
  providers: [QueueService],
  exports: [QueueService],
})
export class QueueModule {}

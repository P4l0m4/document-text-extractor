import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { MulterModule } from '@nestjs/platform-express';
import { UploadController } from './upload.controller';
import { UploadService } from './upload.service';
import { TaskModule } from '../task/task.module';
import { QueueModule } from '../queue/queue.module';
import { ProcessingModule } from '../processing/processing.module';
import { CommonModule } from '../common';

@Module({
  imports: [
    ConfigModule,
    CommonModule,
    TaskModule,
    QueueModule,
    ProcessingModule,
    MulterModule.register({
      dest: './uploads',
    }),
  ],
  controllers: [UploadController],
  providers: [UploadService],
  exports: [UploadService],
})
export class UploadModule {}

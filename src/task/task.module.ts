import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { TaskController } from './task.controller';
import { TaskService } from './task.service';
import { CommonModule } from '../common';

@Module({
  imports: [ConfigModule, CommonModule],
  controllers: [TaskController],
  providers: [TaskService],
  exports: [TaskService],
})
export class TaskModule {}

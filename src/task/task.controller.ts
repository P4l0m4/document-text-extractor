import { Controller, Get, Param, NotFoundException } from '@nestjs/common';
import { TaskService } from './task.service';
import { TaskStatus } from '../common/interfaces/task.interface';

@Controller('api/tasks')
export class TaskController {
  constructor(private readonly taskService: TaskService) {}

  @Get(':taskId/status')
  async getTaskStatus(@Param('taskId') taskId: string) {
    try {
      const task = this.taskService.getTask(taskId);

      return {
        taskId: task.id,
        status: task.status,
        progress: task.progress,
        fileName: task.fileName,
        fileType: task.fileType,
        createdAt: task.createdAt,
        updatedAt: task.updatedAt,
        error: task.error,
      };
    } catch (error) {
      throw new NotFoundException(`Task with ID ${taskId} not found`);
    }
  }

  @Get(':taskId/result')
  async getTaskResult(@Param('taskId') taskId: string) {
    try {
      const task = this.taskService.getTask(taskId);

      if (task.status !== TaskStatus.COMPLETED) {
        return {
          taskId: task.id,
          status: task.status,
          message:
            task.status === TaskStatus.FAILED
              ? `Task failed: ${task.error}`
              : 'Task is not yet completed',
        };
      }

      return {
        taskId: task.id,
        status: task.status,
        result: task.result,
        fileName: task.fileName,
        fileType: task.fileType,
        completedAt: task.updatedAt,
      };
    } catch (error) {
      throw new NotFoundException(`Task with ID ${taskId} not found`);
    }
  }
}

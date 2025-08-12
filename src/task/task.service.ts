import { Injectable } from '@nestjs/common';
import {
  Task,
  TaskStatus,
  ProcessingResult,
} from '../common/interfaces/task.interface';
import { TaskNotFoundException } from '../common/exceptions';

@Injectable()
export class TaskService {
  private tasks: Map<string, Task> = new Map();

  /**
   * Create a new task
   */
  createTask(id: string, fileName: string, fileType: string): Task {
    const task: Task = {
      id,
      status: TaskStatus.PENDING,
      fileName,
      fileType,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    this.tasks.set(id, task);
    return task;
  }

  /**
   * Get a task by ID
   */
  getTask(id: string): Task {
    const task = this.tasks.get(id);
    if (!task) {
      throw new TaskNotFoundException(id);
    }
    return task;
  }

  /**
   * Get all tasks
   */
  getAllTasks(): Task[] {
    return Array.from(this.tasks.values());
  }

  /**
   * Update task status
   */
  updateTaskStatus(id: string, status: TaskStatus, progress?: number): Task {
    const task = this.getTask(id);
    task.status = status;
    task.updatedAt = new Date();

    if (progress !== undefined) {
      task.progress = progress;
    }

    this.tasks.set(id, task);
    return task;
  }

  /**
   * Update task with processing result
   */
  updateTaskResult(id: string, result: ProcessingResult): Task {
    const task = this.getTask(id);
    task.status = TaskStatus.COMPLETED;
    task.result = result;
    task.updatedAt = new Date();
    task.progress = 100;

    this.tasks.set(id, task);
    return task;
  }

  /**
   * Update task with error
   */
  updateTaskError(id: string, error: string): Task {
    const task = this.getTask(id);
    task.status = TaskStatus.FAILED;
    task.error = error;
    task.updatedAt = new Date();

    this.tasks.set(id, task);
    return task;
  }

  /**
   * Delete a task
   */
  deleteTask(id: string): boolean {
    const exists = this.tasks.has(id);
    if (exists) {
      this.tasks.delete(id);
    }
    return exists;
  }

  /**
   * Check if task exists
   */
  taskExists(id: string): boolean {
    return this.tasks.has(id);
  }

  /**
   * Get task count
   */
  getTaskCount(): number {
    return this.tasks.size;
  }

  /**
   * Clear all tasks (useful for testing)
   */
  clearAllTasks(): void {
    this.tasks.clear();
  }
}

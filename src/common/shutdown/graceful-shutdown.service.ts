import { Injectable, Logger, OnApplicationShutdown } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

export interface ShutdownHook {
  name: string;
  priority: number; // Lower numbers execute first
  hook: () => Promise<void>;
}

@Injectable()
export class GracefulShutdownService implements OnApplicationShutdown {
  private readonly logger = new Logger(GracefulShutdownService.name);
  private shutdownHooks: ShutdownHook[] = [];
  private isShuttingDown = false;
  private shutdownTimeout: number;

  constructor(private readonly configService: ConfigService) {
    this.shutdownTimeout = this.configService.get<number>(
      'app.shutdownTimeout',
      30000,
    );
    this.setupSignalHandlers();
  }

  registerShutdownHook(
    name: string,
    hook: () => Promise<void>,
    priority: number = 100,
  ): void {
    this.shutdownHooks.push({ name, hook, priority });
    this.shutdownHooks.sort((a, b) => a.priority - b.priority);
    this.logger.log(
      `Registered shutdown hook: ${name} (priority: ${priority})`,
    );
  }

  async onApplicationShutdown(signal?: string): Promise<void> {
    if (this.isShuttingDown) {
      this.logger.warn(
        'Shutdown already in progress, ignoring additional shutdown signal',
      );
      return;
    }

    this.isShuttingDown = true;
    this.logger.log(
      `Graceful shutdown initiated${signal ? ` by signal: ${signal}` : ''}`,
    );

    const shutdownPromise = this.executeShutdownHooks();
    const timeoutPromise = new Promise<void>((_, reject) => {
      setTimeout(() => {
        reject(new Error(`Shutdown timeout after ${this.shutdownTimeout}ms`));
      }, this.shutdownTimeout);
    });

    try {
      await Promise.race([shutdownPromise, timeoutPromise]);
      this.logger.log('Graceful shutdown completed successfully');
    } catch (error) {
      this.logger.error('Graceful shutdown failed or timed out', error);
      // Force exit if graceful shutdown fails
      process.exit(1);
    }
  }

  private async executeShutdownHooks(): Promise<void> {
    this.logger.log(`Executing ${this.shutdownHooks.length} shutdown hooks`);

    for (const { name, hook } of this.shutdownHooks) {
      try {
        this.logger.log(`Executing shutdown hook: ${name}`);
        const startTime = Date.now();
        await hook();
        const duration = Date.now() - startTime;
        this.logger.log(`Shutdown hook '${name}' completed in ${duration}ms`);
      } catch (error) {
        this.logger.error(`Shutdown hook '${name}' failed:`, error);
        // Continue with other hooks even if one fails
      }
    }
  }

  private setupSignalHandlers(): void {
    // Handle SIGTERM (Docker, Kubernetes)
    process.on('SIGTERM', () => {
      this.logger.log('Received SIGTERM signal');
      this.onApplicationShutdown('SIGTERM');
    });

    // Handle SIGINT (Ctrl+C)
    process.on('SIGINT', () => {
      this.logger.log('Received SIGINT signal');
      this.onApplicationShutdown('SIGINT');
    });

    // Handle uncaught exceptions
    process.on('uncaughtException', (error) => {
      this.logger.error('Uncaught exception:', error);
      this.onApplicationShutdown('uncaughtException');
    });

    // Handle unhandled promise rejections
    process.on('unhandledRejection', (reason, promise) => {
      this.logger.error('Unhandled promise rejection:', reason);
      this.onApplicationShutdown('unhandledRejection');
    });
  }

  isShutdownInProgress(): boolean {
    return this.isShuttingDown;
  }
}

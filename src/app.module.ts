import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { UploadModule } from './upload/upload.module';
import { TaskModule } from './task/task.module';
import { ProcessingModule } from './processing/processing.module';
import { QueueModule } from './queue/queue.module';
import { AiModule } from './ai/ai.module';
import { CommonModule } from './common';
import { SecurityModule } from './security';
import { HealthModule } from './health/health.module';
import { MonitoringModule } from './monitoring/monitoring.module';
import configuration from './config/configuration';
import securityConfig from './config/security.config';
import { EnvironmentVariables } from './config/validation';
import { plainToClass } from 'class-transformer';
import { validateSync } from 'class-validator';
import { SystemException } from './common/exceptions';

function validate(config: Record<string, unknown>) {
  const validatedConfig = plainToClass(EnvironmentVariables, config, {
    enableImplicitConversion: true,
  });
  const errors = validateSync(validatedConfig, {
    skipMissingProperties: false,
  });

  if (errors.length > 0) {
    throw new SystemException(
      `Configuration validation failed: ${errors.toString()}`,
    );
  }
  return validatedConfig;
}

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      load: [configuration, securityConfig],
      validate,
    }),
    CommonModule,
    SecurityModule,
    HealthModule,
    MonitoringModule,
    UploadModule,
    TaskModule,
    ProcessingModule,
    QueueModule,
    AiModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}

import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { HealthController } from './health.controller';
import { CommonModule } from '../common';

@Module({
  imports: [ConfigModule, CommonModule],
  controllers: [HealthController],
  providers: [],
  exports: [],
})
export class HealthModule {}

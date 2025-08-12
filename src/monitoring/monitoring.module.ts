import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { CommonModule } from '../common';

@Module({
  imports: [ConfigModule, CommonModule],
  providers: [],
  exports: [],
})
export class MonitoringModule {}

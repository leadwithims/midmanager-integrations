import { Module } from '@nestjs/common';
import { MetricsController } from './metrics.controller';
import { SyncModule } from '../sync/sync.module';
import { PrismaModule } from '../../prisma/prisma.module';

@Module({
  imports: [SyncModule, PrismaModule],
  controllers: [MetricsController],
})
export class MetricsModule {}

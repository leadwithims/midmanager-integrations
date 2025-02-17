import { Module } from '@nestjs/common';
import { MetricProcessorService } from './services/metric-processor.service';
import { ZamolxisApiService } from './services/zamolxis-api.service';
import { PrismaModule } from '../prisma/prisma.module';

@Module({
    imports: [PrismaModule],
    providers: [MetricProcessorService, ZamolxisApiService],
    exports: [MetricProcessorService, ZamolxisApiService],
})
export class SyncModule { }
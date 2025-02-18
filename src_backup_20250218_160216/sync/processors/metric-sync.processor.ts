import { Process, Processor } from '@nestjs/bull';
import { Injectable } from '@nestjs/common';
import { Job } from 'bull';
import { ZamolxisApiService } from '../services/zamolxis-api.service';

@Injectable()
@Processor('metric-sync')
export class MetricSyncProcessor {
    constructor(private readonly zamolxisApiService: ZamolxisApiService) { }

    @Process('sync-pending')
    async handleMetricSync(job: Job) {
        await this.zamolxisApiService.syncMetrics();
        return { success: true };
    }
}
import { Controller, Get, Post, Query, Logger } from '@nestjs/common';
import { MetricProcessorService } from '../../sync/services/metric-processor.service';
import { ZamolxisApiService } from '../../sync/services/zamolxis-api.service';
import { PrismaService } from '../../prisma/prisma.service';

@Controller('metrics')
export class MetricsController {
    private readonly logger = new Logger(MetricsController.name);

    constructor(
        private readonly metricProcessor: MetricProcessorService,
        private readonly zamolxisApi: ZamolxisApiService,
        private readonly prisma: PrismaService,
    ) { }

    @Post('process')
    async triggerProcessing() {
        const processedCount = await this.metricProcessor.processMetrics();
        return {
            success: true,
            processedCount
        };
    }

    @Get('status')
    async getStatus() {
        const [
            pendingProcessing,
            processingFailed,
            readyForSync,
            syncFailed
        ] = await Promise.all([
            this.prisma.engineeringMetric.count({
                where: { processed: false }
            }),
            this.prisma.engineeringMetric.count({
                where: {
                    processError: { not: null },
                    processAttempts: { lt: 3 }
                }
            }),
            this.prisma.engineeringMetric.count({
                where: {
                    readyForSync: true,
                    syncStatus: 'PENDING'
                }
            }),
            this.prisma.engineeringMetric.count({
                where: { syncStatus: 'FAILED' }
            })
        ]);

        return {
            metrics: {
                pendingProcessing,
                processingFailed,
                readyForSync,
                syncFailed
            },
            lastProcessed: await this.getLastProcessedMetrics(),
            recentErrors: await this.getRecentErrors()
        };
    }

    @Get('errors')
    async getErrors(@Query('limit') limit: string = '10') {
        const errors = await this.prisma.engineeringMetric.findMany({
            where: {
                OR: [
                    { processError: { not: null } },
                    { syncError: { not: null } }
                ]
            },
            select: {
                id: true,
                metricName: true,
                processError: true,
                syncError: true,
                processAttempts: true,
                retryCount: true,
                createdAt: true,
                updatedAt: true
            },
            orderBy: {
                updatedAt: 'desc'
            },
            take: parseInt(limit, 10)
        });

        return { errors };
    }

    private async getLastProcessedMetrics(limit: number = 5) {
        return this.prisma.engineeringMetric.findMany({
            where: {
                processed: true,
                processError: null
            },
            select: {
                id: true,
                metricName: true,
                processedAt: true,
                processedData: true
            },
            orderBy: {
                processedAt: 'desc'
            },
            take: limit
        });
    }

    private async getRecentErrors(limit: number = 5) {
        return this.prisma.engineeringMetric.findMany({
            where: {
                OR: [
                    { processError: { not: null } },
                    { syncError: { not: null } }
                ]
            },
            select: {
                id: true,
                metricName: true,
                processError: true,
                syncError: true,
                updatedAt: true
            },
            orderBy: {
                updatedAt: 'desc'
            },
            take: limit
        });
    }
}
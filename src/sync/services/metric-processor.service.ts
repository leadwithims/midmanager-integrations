import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class MetricProcessorService {
    private readonly logger = new Logger(MetricProcessorService.name);

    constructor(private readonly prisma: PrismaService) { }

    async processMetrics(batchSize: number = 50): Promise<number> {
        try {
            const unprocessedMetrics = await this.prisma.engineeringMetric.findMany({
                where: {
                    processed: false
                },
                take: batchSize,
                orderBy: {
                    createdAt: 'asc'
                }
            });

            for (const metric of unprocessedMetrics) {
                await this.processMetric(metric);
            }

            return unprocessedMetrics.length;
        } catch (error) {
            this.logger.error('Error processing metrics batch:', error);
            throw error;
        }
    }

    private async processMetric(metric: any) {
        try {
            const processedData = await this.calculateMetricInsights(metric);

            await this.prisma.engineeringMetric.update({
                where: { id: metric.id },
                data: {
                    processed: true,
                    processedAt: new Date(),
                    processedData: processedData,
                    readyForSync: true
                }
            });

            this.logger.log(`Successfully processed metric ${metric.id}`);
        } catch (error) {
            this.logger.error(`Error processing metric ${metric.id}:`, error);

            await this.prisma.engineeringMetric.update({
                where: { id: metric.id },
                data: {
                    processError: error.message,
                    processAttempts: (metric.processAttempts || 0) + 1
                }
            });
        }
    }

    private async calculateMetricInsights(metric: any) {
        return {
            originalValue: metric.value,
            normalizedValue: metric.value,
            timestamp: metric.timestamp,
            type: metric.metricName
        };
    }
}
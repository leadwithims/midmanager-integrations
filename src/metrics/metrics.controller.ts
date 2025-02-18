import {
  Controller,
  Get,
  Post,
  Query,
  Logger,
  HttpException,
  HttpStatus,
} from '@nestjs/common';
import { MetricProcessorService } from '../sync/services/metric-processor.service';
import { ZamolxisApiService } from '../sync/services/zamolxis-api.service';
import { PrismaService } from '../../prisma/prisma.service';
import {
  MetricError,
  ProcessedMetric,
  MetricsStatus,
} from './interfaces/metric.interface';

@Controller('metrics')
export class MetricsController {
  private readonly logger = new Logger(MetricsController.name);

  constructor(
    private readonly metricProcessor: MetricProcessorService,
    private readonly zamolxisApi: ZamolxisApiService,
    private readonly prisma: PrismaService,
  ) {}

  @Post('process')
  async triggerProcessing(): Promise<{
    success: boolean;
    processedCount: number;
  }> {
    try {
      const processedCount = await this.metricProcessor.processMetrics();
      this.logger.log(`Successfully processed ${processedCount} metrics`);

      return {
        success: true,
        processedCount,
      };
    } catch (error) {
      this.logger.error('Error triggering metric processing:', error);
      throw new HttpException(
        'Failed to process metrics',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  @Get('status')
  async getStatus(): Promise<MetricsStatus> {
    try {
      const [pendingProcessing, processingFailed, readyForSync, syncFailed] =
        await Promise.all([
          this.prisma.engineeringMetric.count({
            where: { processed: false },
          }),
          this.prisma.engineeringMetric.count({
            where: {
              processError: { not: null },
              processAttempts: { lt: 3 },
            },
          }),
          this.prisma.engineeringMetric.count({
            where: {
              readyForSync: true,
              syncStatus: 'PENDING',
            },
          }),
          this.prisma.engineeringMetric.count({
            where: { syncStatus: 'FAILED' },
          }),
        ]);

      const [lastProcessed, recentErrors] = await Promise.all([
        this.getLastProcessedMetrics(),
        this.getRecentErrors(),
      ]);

      return {
        metrics: {
          pendingProcessing,
          processingFailed,
          readyForSync,
          syncFailed,
        },
        lastProcessed,
        recentErrors,
      };
    } catch (error) {
      this.logger.error('Error fetching metrics status:', error);
      throw new HttpException(
        'Failed to fetch metrics status',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  @Get('errors')
  async getErrors(
    @Query('limit') limit: string = '10',
  ): Promise<{ errors: MetricError[] }> {
    try {
      const parsedLimit = Math.min(parseInt(limit, 10), 100); // Cap at 100 records

      if (isNaN(parsedLimit) || parsedLimit <= 0) {
        throw new HttpException(
          'Invalid limit parameter',
          HttpStatus.BAD_REQUEST,
        );
      }

      const errors = await this.prisma.engineeringMetric.findMany({
        where: {
          OR: [{ processError: { not: null } }, { syncError: { not: null } }],
        },
        select: {
          id: true,
          metricName: true,
          processError: true,
          syncError: true,
          processAttempts: true,
          retryCount: true,
          createdAt: true,
          updatedAt: true,
        },
        orderBy: {
          updatedAt: 'desc',
        },
        take: parsedLimit,
      });

      return { errors };
    } catch (error) {
      if (error instanceof HttpException) {
        throw error;
      }

      this.logger.error('Error fetching metric errors:', error);
      throw new HttpException(
        'Failed to fetch metric errors',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  private async getLastProcessedMetrics(
    limit: number = 5,
  ): Promise<ProcessedMetric[]> {
    return this.prisma.engineeringMetric.findMany({
      where: {
        processed: true,
        processError: null,
      },
      select: {
        id: true,
        metricName: true,
        processedAt: true,
        processedData: true,
      },
      orderBy: {
        processedAt: 'desc',
      },
      take: limit,
    });
  }

  private async getRecentErrors(limit: number = 5): Promise<MetricError[]> {
    return this.prisma.engineeringMetric.findMany({
      where: {
        OR: [{ processError: { not: null } }, { syncError: { not: null } }],
      },
      select: {
        id: true,
        metricName: true,
        processError: true,
        syncError: true,
        updatedAt: true,
      },
      orderBy: {
        updatedAt: 'desc',
      },
      take: limit,
    });
  }
}

import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Cron, CronExpression } from '@nestjs/schedule';
import { PrismaService } from '../../../prisma/prisma.service';
import axios from 'axios';

@Injectable()
export class ZamolxisApiService {
  private readonly logger = new Logger(ZamolxisApiService.name);
  private readonly enabled: boolean;
  private readonly apiUrl: string;
  private readonly apiToken: string;

  constructor(
    private readonly configService: ConfigService,
    private readonly prisma: PrismaService,
  ) {
    this.enabled = this.configService.get<boolean>('zamolxis.enabled') ?? false;
    this.apiUrl = this.configService.get<string>('zamolxis.apiUrl') ?? '';
    this.apiToken = this.configService.get<string>('zamolxis.apiToken') ?? '';
  }

  @Cron(CronExpression.EVERY_5_MINUTES)
  async scheduledSync() {
    if (!this.enabled) {
      this.logger.log('Zamolxis API sync is disabled');
      return;
    }

    await this.syncMetrics();
  }

  async syncMetrics() {
    try {
      const pendingMetrics = await this.prisma.engineeringMetric.findMany({
        where: {
          readyForSync: true,
          syncStatus: 'PENDING',
        },
        take: 50,
        orderBy: {
          createdAt: 'asc',
        },
      });

      for (const metric of pendingMetrics) {
        try {
          await axios.post(
            `${this.apiUrl}/engineering`,
            {
              metricName: metric.metricName,
              value: metric.value,
              unit: metric.unit,
              timestamp: metric.timestamp,
              category: metric.category,
              metadata: metric.metadata,
            },
            {
              headers: {
                Authorization: `Bearer ${this.apiToken}`,
              },
            },
          );

          await this.prisma.engineeringMetric.update({
            where: { id: metric.id },
            data: {
              syncStatus: 'SYNCED',
              syncedAt: new Date(),
              syncError: null,
            },
          });
        } catch (error) {
          this.logger.error(`Failed to sync metric ${metric.id}:`, error);

          await this.prisma.engineeringMetric.update({
            where: { id: metric.id },
            data: {
              syncStatus: 'FAILED',
              syncError: error.message,
            },
          });
        }
      }
    } catch (error) {
      this.logger.error('Error in metric sync process:', error);
      throw error;
    }
  }
}

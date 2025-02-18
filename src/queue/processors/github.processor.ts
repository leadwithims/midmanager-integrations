import { Injectable, Logger } from '@nestjs/common';
import { Processor, Process } from '@nestjs/bull';
import { Job } from 'bull';
import { PrismaService } from '../../../prisma/prisma.service';
import { GitHubService } from '../../integrations/github/github.service';

interface SyncMetricsJobData {
  tenantId: string;
}

@Injectable()
@Processor('github-sync')
export class GithubProcessor {
  private readonly logger = new Logger(GithubProcessor.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly githubService: GitHubService,
  ) {}

  @Process('sync-metrics')
  async handleMetricsSync(job: Job<SyncMetricsJobData>): Promise<any> {
    const { tenantId } = job.data;
    this.logger.log(`Processing GitHub metrics for tenant: ${tenantId}`);

    try {
      const { data: repositories } = await this.githubService.getRepositories();

      const metric = await this.prisma.engineeringMetric.create({
        data: {
          metricName: 'github_repositories',
          value: repositories.length,
          unit: 'count',
          timestamp: new Date(),
          category: 'engineering',
          metadata: repositories,
        },
      });

      this.logger.log(`Successfully created metric: ${metric.id}`);
      return { success: true, metricId: metric.id };
    } catch (error) {
      this.logger.error(
        `Error processing GitHub metrics for tenant ${tenantId}:`,
        error,
      );
      throw error;
    }
  }
}

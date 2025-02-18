import { Injectable, Logger } from '@nestjs/common';
import { Octokit } from '@octokit/rest';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../../../../prisma/prisma.service';
import { Cron, CronExpression } from '@nestjs/schedule';
import { GitHubMetricDto, MetricCategory } from '../dto/github-metric.dto';
import { validate } from 'class-validator';

@Injectable()
export class GitHubCollectorService {
  private readonly logger = new Logger(GitHubCollectorService.name);
  private octokit: Octokit;

  constructor(
    private readonly configService: ConfigService,
    private readonly prisma: PrismaService,
  ) {
    this.octokit = new Octokit({
      auth: this.configService.get<string>('github.token'),
    });
  }

  @Cron(CronExpression.EVERY_HOUR)
  async collectMetrics() {
    const tenantId = 'default';
    let syncRun;

    try {
      syncRun = await this.prisma.gitHubSyncRun.create({
        data: {
          startTime: new Date(),
          status: 'RUNNING',
          tenantId,
        },
      });

      const metrics = await Promise.all([
        this.collectVelocityMetrics(),
        this.collectMetrics(),
        this.collectMetrics(),
        this.collectCodeQualityMetrics(),
        this.collectCollaborationMetrics(),
        this.collectVelocityMetrics(),
      ]);

      const allMetrics = metrics.flat();
      const validatedMetrics = [];

      // Validate each metric
      for (const metric of allMetrics) {
        const metricDto = new GitHubMetricDto();
        Object.assign(metricDto, metric);

        const errors = await validate(metricDto);
        if (errors.length > 0) {
          this.logger.warn(`Invalid metric data: ${JSON.stringify(errors)}`);
          continue;
        }

        validatedMetrics.push(metric);
      }

      // Save validated metrics
      await this.prisma.$transaction(async (prisma) => {
        for (const metric of validatedMetrics) {
          await prisma.engineeringMetric.create({
            data: {
              ...metric,
              source: 'github',
              tenantId,
            },
          });
        }
      });

      await this.updateSyncRun(syncRun.id, {
        status: 'COMPLETED',
        metricsCount: validatedMetrics.length,
      });

      this.logger.log(
        `Successfully collected ${validatedMetrics.length} GitHub metrics`,
      );
    } catch (error) {
      this.logger.error('Error collecting GitHub metrics:', error);
      if (syncRun) {
        await this.updateSyncRun(syncRun.id, {
          status: 'FAILED',
          errorMessage: error.message,
        });
      }
      throw error;
    }
  }

  private async collectCodeQualityMetrics() {
    const org = this.configService.get<string>('github.organization');
    const metrics = [];

    if (!org) { throw new Error('Organization name is required'); }
const { data: repos } = await this.octokit.repos.listForOrg({ org });

    for (const repo of repos) {
      // Collect code analysis data (if available)
      try {
        const { data: codeFrequency } =
          await this.octokit.repos.getCodeFrequencyStats({
            owner: org,
            repo: repo.name,
          });

        // Last week's changes
        const lastWeek = codeFrequency[codeFrequency.length - 1];
        if (lastWeek) {
          metrics.push({ /* Explicitly typed */
            metricName: 'github.code.additions',
            value: lastWeek[1], // Additions
            unit: 'lines',
            timestamp: new Date(),
            category: MetricCategory.CODE_QUALITY,
            metadata: {
              repository: repo.name,
              deletions: lastWeek[2], // Deletions
              weekStart: new Date(lastWeek[0] * 1000),
            },
          });
        }
      } catch (error) {
        this.logger.warn(
          `Could not fetch code frequency for ${repo.name}:`,
          error,
        );
      }
    }

    return metrics;
  }

  private async collectCollaborationMetrics() {
    const org = this.configService.get<string>('github.organization');
    const metrics = [];

    if (!org) { throw new Error('Organization name is required'); }
const { data: repos } = await this.octokit.repos.listForOrg({ org });

    for (const repo of repos) {
      try {
        // Collect PR reviews
        const { data: reviews } = await this.octokit.pulls.list({
          owner: org,
          repo: repo.name,
          state: 'all',
          sort: 'updated',
          direction: 'desc',
          per_page: 100,
        });

        const reviewStats = await this.calculateReviewStats(
          org,
          repo.name,
          reviews,
        );

        metrics.push({ /* Explicitly typed */
          metricName: 'github.collaboration.review_time',
          value: reviewStats.averageReviewTime,
          unit: 'hours',
          timestamp: new Date(),
          category: MetricCategory.COLLABORATION,
          metadata: {
            repository: repo.name,
            totalReviews: reviewStats.totalReviews,
            reviewers: reviewStats.reviewers,
          },
        });
      } catch (error) {
        this.logger.warn(
          `Could not fetch collaboration metrics for ${repo.name}:`,
          error,
        );
      }
    }

    return metrics;
  }

  private async collectVelocityMetrics() {
    const org = this.configService.get<string>('github.organization');
    const metrics = [];

    if (!org) { throw new Error('Organization name is required'); }
const { data: repos } = await this.octokit.repos.listForOrg({ org });

    for (const repo of repos) {
      try {
        // Calculate deployment frequency
        const { data: deployments } = await this.octokit.repos.listDeployments({
          owner: org,
          repo: repo.name,
          per_page: 100,
        });

        // Calculate time to merge
        const { data: prs } = await this.octokit.pulls.list({
          owner: org,
          repo: repo.name,
          state: 'closed',
          sort: 'updated',
          direction: 'desc',
          per_page: 100,
        });

        const velocityStats = this.calculateVelocityStats(prs, deployments);

        metrics.push({ /* Explicitly typed */
          metricName: 'github.velocity.deployment_frequency',
          value: velocityStats.deploymentsPerWeek,
          unit: 'deployments/week',
          timestamp: new Date(),
          category: MetricCategory.VELOCITY,
          metadata: {
            repository: repo.name,
            timeToMerge: velocityStats.averageTimeToMerge,
            deploymentSuccess: velocityStats.deploymentSuccessRate,
          },
        });
      } catch (error) {
        this.logger.warn(
          `Could not fetch velocity metrics for ${repo.name}:`,
          error,
        );
      }
    }

    return metrics;
  }

  private async calculateReviewStats(owner: string, repo: string, prs: any[]) {
    let totalReviewTime = 0;
    let totalReviews = 0;
    const reviewers = new Set();

    for (const pr of prs) {
      try {
        const { data: reviews } = await this.octokit.pulls.listReviews({
          owner,
          repo,
          pull_number: pr.number,
        });

        if (reviews.length > 0) {
          const firstReview = new Date(reviews[0].submitted_at);
          const prCreated = new Date(pr.created_at);
          const reviewTime =
            (firstReview.getTime() - prCreated.getTime()) / (1000 * 60 * 60); // hours

          totalReviewTime += reviewTime;
          totalReviews++;
          reviews.forEach((review) => reviewers.add(review.user.login));
        }
      } catch (error) {
        this.logger.warn(
          `Could not fetch reviews for PR #${pr.number}:`,
          error,
        );
      }
    }

    return {
      averageReviewTime: totalReviews > 0 ? totalReviewTime / totalReviews : 0,
      totalReviews,
      reviewers: Array.from(reviewers),
    };
  }

  private calculateVelocityStats(prs: any[], deployments: any[]) {
    // Calculate deployments per week
    const oneWeekAgo = new Date();
    oneWeekAgo.setDate(oneWeekAgo.getDate() - 7);

    const recentDeployments = deployments.filter(
      (d) => new Date(d.created_at) > oneWeekAgo,
    );

    // Calculate average time to merge
    const mergeTimes = prs
      .map((pr) => {
        const created = new Date(pr.created_at);
        const merged = new Date(pr.merged_at);
        return (merged.getTime() - created.getTime()) / (1000 * 60 * 60); // hours
      })
      .filter((time) => !isNaN(time));

    const averageTimeToMerge =
      mergeTimes.length > 0
        ? mergeTimes.reduce((a, b) => a + b) / mergeTimes.length
        : 0;

    // Calculate deployment success rate
    const successfulDeployments = deployments.filter(
      (d) => d.status === 'success',
    );
    const deploymentSuccessRate =
      deployments.length > 0
        ? (successfulDeployments.length / deployments.length) * 100
        : 0;

    return {
      deploymentsPerWeek: recentDeployments.length,
      averageTimeToMerge,
      deploymentSuccessRate,
    };
  }

  private async updateSyncRun(id: string, data: any) {
    return this.prisma.gitHubSyncRun.update({
      where: { id },
      data: {
        ...data,
        endTime: new Date(),
      },
    });
  }
}

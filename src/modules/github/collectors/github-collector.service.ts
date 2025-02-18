import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Octokit } from '@octokit/rest';
import { BaseCollector } from '../../../core/collectors/base.collector';
import { GitHubMetric, GitHubMetricCategory } from '../dto/github-metric.dto';

@Injectable()
export class GitHubCollectorService extends BaseCollector<GitHubMetric> {
  private readonly octokit: Octokit;
  protected readonly metrics: GitHubMetric[] = [];

  constructor(private readonly configService: ConfigService) {
    super();
    const token = this.configService.get<string>('github.token');
    if (!token) {
      throw new Error('GitHub token not configured');
    }
    this.octokit = new Octokit({ auth: token });
  }

  async collectMetrics(): Promise<GitHubMetric[]> {
    try {
      const org = this.getGithubOrg();

      const { data: repos } = await this.octokit.repos.listForOrg({ org });
      
      for (const repo of repos) {
        if (repo.size) {
          this.metrics.push({
            metricName: 'github.code.size',
            value: repo.size,
            unit: 'kb',
            timestamp: new Date(),
            category: GitHubMetricCategory.CODE,
            metadata: {
              repository: repo.name,
              language: repo.language || 'unknown',
              stars: repo.stargazers_count || 0
            }
          });
        }
      }

      return this.metrics;
    } catch (error) {
      this.logger.error('Failed to collect GitHub metrics:', error);
      return [];
    }
  }

  private getGithubOrg(): string {
    const org = this.configService.get<string>('github.organization');
    if (!org) {
      throw new Error('GitHub organization not configured');
    }
    return org;
  }
}
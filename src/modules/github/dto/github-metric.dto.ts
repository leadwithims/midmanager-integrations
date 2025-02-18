import { BaseMetric } from '../../../core/interfaces/metrics/base-metric.interface';

export enum GitHubMetricCategory {
  CODE = 'code',
  COLLABORATION = 'collaboration',
  VELOCITY = 'velocity'
}

export interface GitHubMetric extends BaseMetric {
  category: GitHubMetricCategory;
}
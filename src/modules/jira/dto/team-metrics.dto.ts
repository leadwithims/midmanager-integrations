import { BaseMetric } from '../../../core/interfaces/metrics/base-metric.interface';

export interface TeamMember {
  accountId: string;
  displayName: string;
  emailAddress: string;
}

export interface Team {
  id: string;
  name: string;
  members: TeamMember[];
}

export enum TeamMetricCategory {
  TEAM_PERFORMANCE = 'team_performance',
  USER_PERFORMANCE = 'user_performance',
}

export interface TeamMetric extends BaseMetric {
  metadata: {
    teamId: string;
    teamName: string;
    [key: string]: any;
  };
}

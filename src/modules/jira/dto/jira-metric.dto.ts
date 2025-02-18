import { BaseMetric } from '../../../core/interfaces/metrics/base-metric.interface';

export enum JiraMetricCategory {
  STATUS = 'status',
  TIME_TRACKING = 'time_tracking',
  SPRINT = 'sprint',
  WORKLOAD = 'workload',
  TEAM = 'team'
}

export interface JiraMetric extends BaseMetric {
  category: JiraMetricCategory;
}

export interface StatusChange {
  timestamp: Date;
  fromStatus: string;
  toStatus: string;
}

export interface StatusTimeBreakdown {
  issueKey: string;
  timeInStatuses: Record<string, number>;
  totalActiveTime: number;
}

export interface TimeTrackingData {
  originalEstimate: number;
  timeSpent: number;
  issueType: string;
}
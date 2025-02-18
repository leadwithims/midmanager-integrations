import { Injectable } from '@nestjs/common';
import { JiraMetricDto, JiraMetricCategory } from '../dto/jira-metric.dto';
import { StatusTimeBreakdown } from '../dto/status-time.dto';

@Injectable()
export class JiraMetricMapper {
  mapStatusTimeMetric(
    breakdown: StatusTimeBreakdown,
    issue: any,
  ): JiraMetricDto {
    return {
      metricName: 'jira.issue.flow_time',
      value: breakdown.totalActiveTime / (1000 * 60 * 60), // Convert to hours
      unit: 'hours',
      timestamp: new Date(),
      category: JiraMetricCategory.TIME_TRACKING,
      metadata: {
        issueKey: issue.key,
        issueType: issue.fields.issuetype.name,
        statusBreakdown: breakdown.timeInStatuses,
      },
    };
  }

  mapAggregateStatusMetric(metrics: JiraMetricDto[]): JiraMetricDto {
    const totalTime = metrics.reduce((acc, metric) => acc + metric.value, 0);

    return {
      metricName: 'jira.status.time_distribution',
      value: totalTime,
      unit: 'hours',
      timestamp: new Date(),
      category: JiraMetricCategory.TIME_TRACKING,
      metadata: {
        totalIssues: metrics.length,
        averageTime: totalTime / metrics.length,
      },
    };
  }

  mapTimeTrackingMetric(analysis: any, issueCount: number): JiraMetricDto {
    return {
      metricName: 'jira.time.estimate_accuracy',
      value:
        analysis.totalEstimated > 0
          ? (analysis.totalSpent / analysis.totalEstimated) * 100
          : 0,
      unit: 'percentage',
      timestamp: new Date(),
      category: JiraMetricCategory.TIME_TRACKING,
      metadata: {
        totalEstimatedHours: analysis.totalEstimated / 3600,
        totalSpentHours: analysis.totalSpent / 3600,
        accuracyByType: analysis.accuracyByType,
        issueCount,
      },
    };
  }
}

import { Injectable } from '@nestjs/common';
import { JiraMetric, JiraMetricCategory } from '../dto/jira-metric.dto';
import { StatusTimeBreakdown } from '../interfaces/status.interface';

@Injectable()
export class JiraMetricMapper {
  mapStatusTimeMetric(breakdown: StatusTimeBreakdown, issue: any): JiraMetric {
    return {
      metricName: 'jira.status.time',
      value: breakdown.totalActiveTime / (1000 * 60 * 60), // Convert to hours
      unit: 'hours',
      timestamp: new Date(),
      category: JiraMetricCategory.STATUS,
      metadata: {
        issueKey: issue.key,
        issueType: issue.fields.issuetype.name,
        statusBreakdown: breakdown.timeInStatuses
      }
    };
  }

  mapAggregateStatusMetric(metrics: JiraMetric[]): JiraMetric {
    const totalTime = metrics.reduce((acc, metric) => acc + metric.value, 0);

    return {
      metricName: 'jira.status.distribution',
      value: totalTime,
      unit: 'hours',
      timestamp: new Date(),
      category: JiraMetricCategory.STATUS,
      metadata: {
        totalIssues: metrics.length,
        averageTime: totalTime / metrics.length
      }
    };
  }

  mapTimeTrackingMetric(analysis: any, issueCount: number): JiraMetric {
    return {
      metricName: 'jira.time.tracking',
      value: analysis.totalEstimated > 0 ?
        (analysis.totalSpent / analysis.totalEstimated) * 100 : 0,
      unit: 'percentage',
      timestamp: new Date(),
      category: JiraMetricCategory.TIME_TRACKING,
      metadata: {
        totalEstimatedHours: analysis.totalEstimated / 3600,
        totalSpentHours: analysis.totalSpent / 3600,
        accuracyByType: analysis.accuracyByType,
        issueCount
      }
    };
  }
}
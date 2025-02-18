import { Injectable } from '@nestjs/common';
import { BaseJiraCollector } from './base-jira.collector';
import { StatusTimeAnalyzer } from '../services/status-time-analyzer.service';
import { TimeTrackingAnalyzer } from '../services/time-tracking-analyzer.service';
import { JiraMetricMapper } from '../services/jira-metric.mapper';
import { StatusManagerService } from '../services/status-manager.service';

@Injectable()
export class StatusTimeCollectorService extends BaseJiraCollector {
  constructor(
    private readonly statusAnalyzer: StatusTimeAnalyzer,
    private readonly timeTrackingAnalyzer: TimeTrackingAnalyzer,
    private readonly metricMapper: JiraMetricMapper,
    private readonly statusManager: StatusManagerService,
  ) {
    super(configService);
  }

  async collectTimeMetrics() {
    const startOfMonth = this.getStartOfMonth();
    
    try {
      const completedIssues = await this.getCompletedIssues(startOfMonth);
      const metrics = await this.analyzeIssues(completedIssues);
      
      await this.saveMetrics(metrics);
      return metrics;
    } catch (error) {
      this.handleError('Error collecting time metrics', error);
      throw error;
    }
  }

  private async analyzeIssues(issues: any[]) {
    const statusMetrics = await this.collectStatusMetrics(issues);
    const timeTrackingMetrics = await this.collectMetrics(issues);
    
    return [...statusMetrics, ...timeTrackingMetrics];
  }

  private async collectStatusMetrics(issues: any[]) {
    const statusMetrics = [];

    for (const issue of issues) {
      try {
        const projectKey = issue.fields.project.key;
        const activeStatuses = await this.statusManager.getActiveStatuses(projectKey);
        
        const changelog = await this.jira.getIssueChangelog(issue.id);
        const statusBreakdown = await this.statusAnalyzer.analyzeIssueStatuses(
          issue,
          changelog,
          activeStatuses
        );

        statusMetrics.push(
          this.metricMapper.mapStatusTimeMetric(statusBreakdown, issue)
        );
      } catch (error) {
        this.handleError(`Error analyzing status times for issue ${issue.key}`, error);
      }
    }

    return [
      ...statusMetrics,
      this.metricMapper.mapAggregateStatusMetric(statusMetrics)
    ];
  }

  private async collectMetrics(issues: any[]) {
    const timeTrackingData = issues.map(issue => ({
      originalEstimate: issue.fields.timeoriginalestimate || 0,
      timeSpent: issue.fields.timespent || 0,
      issueType: issue.fields.issuetype.name
    }));

    const analysis = this.timeTrackingAnalyzer.analyzeTimeTracking(timeTrackingData);
    return [this.metricMapper.mapTimeTrackingMetric(analysis, issues.length)];
  }
}

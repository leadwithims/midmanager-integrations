import { Injectable } from '@nestjs/common';
import { BaseCollector } from '../../../core/collectors/base.collector';
import { JiraMetric } from '../dto/jira-metric.dto';
import { BaseJiraService } from '../services/base-jira.service';
import { StatusManagerService } from '../services/status-manager.service';
import { StatusTimeAnalyzer } from '../services/status-time-analyzer.service';
import { JiraMetricMapper } from '../services/jira-metric.mapper';
import { TimeTrackingAnalyzer } from '../services/time-tracking-analyzer.service';

@Injectable()
export class StatusTimeCollectorService extends BaseCollector<JiraMetric> {
  constructor(
    private readonly jiraService: BaseJiraService,
    private readonly statusManager: StatusManagerService,
    private readonly statusAnalyzer: StatusTimeAnalyzer,
    private readonly metricMapper: JiraMetricMapper,
    private readonly timeTrackingAnalyzer: TimeTrackingAnalyzer,
  ) {
    super();
  }

  async collectMetrics(): Promise<JiraMetric[]> {
    try {
      const startOfMonth = this.getStartOfMonth();
      const jql = `updated >= "${startOfMonth.toISOString()}"`;

      const { issues } = await this.jiraService.jira.searchJira(jql);
      await this.processIssues(issues);

      return this.metrics;
    } catch (error) {
      this.logger.error('Error collecting status time metrics:', error);
      return [];
    }
  }

  private async processIssues(issues: any[]) {
    for (const issue of issues) {
      try {
        const changelog = await this.jiraService.jira.getIssueChangelog(
          issue.id,
        );
        const activeStatuses = await this.statusManager.getActiveStatuses(
          issue.fields.project.key,
        );

        const statusBreakdown = await this.statusAnalyzer.analyzeIssueStatuses(
          issue,
          changelog,
          activeStatuses,
        );

        const metric = this.metricMapper.mapStatusTimeMetric(
          statusBreakdown,
          issue,
        );
        this.addMetric(metric);
      } catch (error) {
        this.logger.warn(`Error processing issue ${issue.key}:`, error);
      }
    }

    // Add aggregate metrics
    const aggregateMetric = this.metricMapper.mapAggregateStatusMetric(
      this.metrics,
    );
    this.addMetric(aggregateMetric);
  }
}

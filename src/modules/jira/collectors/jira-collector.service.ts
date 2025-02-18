import { Injectable } from '@nestjs/common';
import { BaseCollector } from '../../../core/collectors/base.collector';
import { JiraMetric, JiraMetricCategory } from '../dto/jira-metric.dto';
import { PrismaService } from '../../../../prisma/prisma.service';
import { BaseJiraService } from '../services/base-jira.service';

@Injectable()
export class JiraCollectorService extends BaseCollector<JiraMetric> {
  constructor(
    private readonly prismaService: PrismaService,
    private readonly jiraService: BaseJiraService,
  ) {
    super();
  }

  async collectMetrics(): Promise<JiraMetric[]> {
    try {
      await Promise.all([
        this.collectSprintMetrics(),
        this.collectWorkloadMetrics()
      ]);

      return this.metrics;
    } catch (error) {
      this.logger.error('Failed to collect Jira metrics:', error);
      return [];
    }
  }

  private async collectSprintMetrics() {
    try {
      const boards = await this.jiraService.jira.getAllBoards();

      for (const board of boards.values) {
        try {
          const sprints = await this.jiraService.jira.getAllSprints(board.id);
          const activeSprint = sprints.values.find(
            sprint => sprint.state === 'active'
          );

          if (activeSprint) {
            const sprintIssues = await this.jiraService.jira.getBoardIssuesForSprint(
              board.id,
              activeSprint.id
            );

            this.addMetric({
              metricName: 'jira.sprint.progress',
              value: this.calculateSprintProgress(sprintIssues.issues),
              unit: 'percentage',
              timestamp: new Date(),
              category: JiraMetricCategory.SPRINT,
              metadata: {
                boardName: board.name,
                sprintName: activeSprint.name,
                totalIssues: sprintIssues.issues.length,
                completedIssues: sprintIssues.issues.filter(
                  issue => issue.fields.status.statusCategory.key === 'done'
                ).length
              }
            });
          }
        } catch (error) {
          this.logger.warn(
            `Error collecting sprint metrics for board ${board.name}:`,
            error
          );
        }
      }
    } catch (error) {
      this.logger.error('Error collecting sprint metrics:', error);
    }
  }

  private async collectWorkloadMetrics() {
    try {
      const jql = 'status != Done AND assignee IS NOT EMPTY';
      const issues = await this.jiraService.jira.searchJira(jql);

      const assignees = new Map();
      issues.issues.forEach(issue => {
        const assignee = issue.fields.assignee.displayName;
        assignees.set(assignee, (assignees.get(assignee) || 0) + 1);
      });

      this.addMetric({
        metricName: 'jira.workload.distribution',
        value: assignees.size,
        unit: 'count',
        timestamp: new Date(),
        category: JiraMetricCategory.WORKLOAD,
        metadata: {
          assigneeDistribution: Object.fromEntries(assignees),
          averageIssuesPerAssignee: issues.issues.length / assignees.size
        }
      });
    } catch (error) {
      this.logger.error('Error collecting workload metrics:', error);
    }
  }

  private calculateSprintProgress(issues: any[]): number {
    const totalIssues = issues.length;
    if (totalIssues === 0) return 0;

    const completedIssues = issues.filter(
      issue => issue.fields.status.statusCategory.key === 'done'
    ).length;

    return (completedIssues / totalIssues) * 100;
  }
}

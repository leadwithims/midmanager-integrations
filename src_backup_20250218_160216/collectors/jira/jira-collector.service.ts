import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../../../prisma/prisma.service';
import { Cron, CronExpression } from '@nestjs/schedule';
import { JiraMetricDto, JiraMetricCategory } from './dto/jira-metric.dto';
import { validate } from 'class-validator';
import * as JiraApi from 'jira-client';

@Injectable()
export class JiraCollectorService {
  private readonly logger = new Logger(JiraCollectorService.name);
  private jira: JiraApi;

  constructor(
    private readonly configService: ConfigService,
    private readonly prisma: PrismaService,
  ) {
    this.jira = new JiraApi({
      protocol: 'https',
      host: this.configService.get<string>('jira.host'),
      username: this.configService.get<string>('jira.username'),
      password: this.configService.get<string>('jira.apiToken'),
      apiVersion: '3',
      strictSSL: true,
    });
  }

  @Cron(CronExpression.EVERY_HOUR)
  async collectMetrics() {
    const tenantId = 'default';
    let syncRun;

    try {
      syncRun = await this.prisma.jiraSyncRun.create({
        data: {
          startTime: new Date(),
          status: 'RUNNING',
          tenantId,
        },
      });

      const metrics = await Promise.all([
        this.collectIssueMetrics(),
        this.collectSprintMetrics(),
        this.collectVelocityMetrics(),
        this.collectWorkloadMetrics(),
        this.collectSLAMetrics(),
        this.collectTimeTrackingMetrics(),
      ]);

      const allMetrics = metrics.flat();
      const validatedMetrics = [];

      // Validate metrics
      for (const metric of allMetrics) {
        const metricDto = new JiraMetricDto();
        Object.assign(metricDto, metric);

        const errors = await validate(metricDto);
        if (errors.length > 0) {
          this.logger.warn(
            `Invalid Jira metric data: ${JSON.stringify(errors)}`,
          );
          continue;
        }

        validatedMetrics.push(metric);
      }

      // Save metrics
      await this.prisma.$transaction(async (prisma) => {
        for (const metric of validatedMetrics) {
          await prisma.engineeringMetric.create({
            data: {
              ...metric,
              source: 'jira',
              tenantId,
            },
          });
        }
      });

      await this.updateSyncRun(syncRun.id, {
        status: 'COMPLETED',
        metricsCount: validatedMetrics.length,
      });
    } catch (error) {
      this.logger.error('Error collecting Jira metrics:', error);
      if (syncRun) {
        await this.updateSyncRun(syncRun.id, {
          status: 'FAILED',
          errorMessage: error.message,
        });
      }
      throw error;
    }
  }

  private async collectIssueMetrics() {
    const metrics = [];

    try {
      // Get issues created in last 30 days
      const jql = 'created >= -30d';
      const issues = await this.jira.searchJira(jql);

      // Calculate issue statistics
      const issueTypes = new Map();
      const issueStatuses = new Map();
      const priorities = new Map();

      issues.issues.forEach((issue) => {
        // Count by type
        issueTypes.set(
          issue.fields.issuetype.name,
          (issueTypes.get(issue.fields.issuetype.name) || 0) + 1,
        );

        // Count by status
        issueStatuses.set(
          issue.fields.status.name,
          (issueStatuses.get(issue.fields.status.name) || 0) + 1,
        );

        // Count by priority
        if (issue.fields.priority) {
          priorities.set(
            issue.fields.priority.name,
            (priorities.get(issue.fields.priority.name) || 0) + 1,
          );
        }
      });

      metrics.push({
        metricName: 'jira.issues.total',
        value: issues.issues.length,
        unit: 'count',
        timestamp: new Date(),
        category: JiraMetricCategory.ISSUES,
        metadata: {
          byType: Object.fromEntries(issueTypes),
          byStatus: Object.fromEntries(issueStatuses),
          byPriority: Object.fromEntries(priorities),
        },
      });
    } catch (error) {
      this.logger.error('Error collecting issue metrics:', error);
    }

    return metrics;
  }

  private async collectSprintMetrics() {
    const metrics = [];

    try {
      // Note: This requires the Jira Agile REST API
      const boards = await this.jira.getAllBoards();

      for (const board of boards.values) {
        try {
          const sprints = await this.jira.getAllSprints(board.id);
          const activeSprint = sprints.values.find(
            (sprint) => sprint.state === 'active',
          );

          if (activeSprint) {
            const sprintIssues = await this.jira.getBoardIssuesForSprint(
              board.id,
              activeSprint.id,
            );

            metrics.push({
              metricName: 'jira.sprint.progress',
              value: this.calculateSprintProgress(sprintIssues.issues),
              unit: 'percentage',
              timestamp: new Date(),
              category: JiraMetricCategory.SPRINTS,
              metadata: {
                boardName: board.name,
                sprintName: activeSprint.name,
                totalIssues: sprintIssues.issues.length,
                completedIssues: sprintIssues.issues.filter(
                  (issue) => issue.fields.status.statusCategory.key === 'done',
                ).length,
              },
            });
          }
        } catch (error) {
          this.logger.warn(
            `Error collecting sprint metrics for board ${board.name}:`,
            error,
          );
        }
      }
    } catch (error) {
      this.logger.error('Error collecting sprint metrics:', error);
    }

    return metrics;
  }

  private async collectWorkloadMetrics() {
    const metrics = [];

    try {
      const assignees = new Map();
      const jql = 'status != Done AND assignee IS NOT EMPTY';
      const issues = await this.jira.searchJira(jql);

      issues.issues.forEach((issue) => {
        const assignee = issue.fields.assignee.displayName;
        assignees.set(assignee, (assignees.get(assignee) || 0) + 1);
      });

      metrics.push({
        metricName: 'jira.workload.distribution',
        value: assignees.size, // Number of active assignees
        unit: 'count',
        timestamp: new Date(),
        category: JiraMetricCategory.WORKLOAD,
        metadata: {
          assigneeDistribution: Object.fromEntries(assignees),
          averageIssuesPerAssignee: issues.issues.length / assignees.size,
        },
      });
    } catch (error) {
      this.logger.error('Error collecting workload metrics:', error);
    }

    return metrics;
  }

  private calculateSprintProgress(issues: any[]): number {
    const totalIssues = issues.length;
    if (totalIssues === 0) return 0;

    const completedIssues = issues.filter(
      (issue) => issue.fields.status.statusCategory.key === 'done',
    ).length;

    return (completedIssues / totalIssues) * 100;
  }

  private async updateSyncRun(id: string, data: any) {
    return this.prisma.jiraSyncRun.update({
      where: { id },
      data: {
        ...data,
        endTime: new Date(),
      },
    });
  }
}

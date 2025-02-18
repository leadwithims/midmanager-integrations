import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../../../../prisma/prisma.service';
import { BaseCollector } from '../../../core/collectors/base.collector';
import {
  Team,
  TeamMember,
  TeamMetric,
  TeamMetricCategory,
} from '../dto/team-metrics.dto';
import { BaseJiraService } from '../services/base-jira.service';
import axios from 'axios';

@Injectable()
export class TeamMetricsCollectorService extends BaseCollector<TeamMetric> {
  private readonly baseUrl: string;
  private readonly teams: Map<string, Team> = new Map();

  constructor(
    private readonly configService: ConfigService,
    private readonly prisma: PrismaService,
    private readonly jiraService: BaseJiraService,
  ) {
    super();
    const host = this.configService.get<string>('jira.host');
    if (!host) throw new Error('Jira host not configured');
    this.baseUrl = `https://${host}`;
  }

  async collectMetrics(): Promise<TeamMetric[]> {
    try {
      await this.fetchTeams();
      const startOfMonth = this.getStartOfMonth();
      this.metrics = []; // Reset metrics array

      // Collect metrics for each team
      for (const team of this.teams.values()) {
        const teamMetrics = await this.collectMetricsForTeam(
          team,
          startOfMonth,
        );
        this.metrics.push(...teamMetrics);
      }

      await this.saveMetrics(this.metrics);
      return this.metrics;
    } catch (error) {
      this.logger.error('Error collecting team metrics:', error);
      throw error;
    }
  }

  private async fetchTeams() {
    try {
      const response = await axios.get(`${this.baseUrl}/rest/teams/1.0/teams`, {
        headers: {
          Authorization: this.getAuthHeader(),
          Accept: 'application/json',
        },
      });

      for (const team of response.data.values) {
        const members = await this.fetchTeamMembers(team.id);
        this.teams.set(team.id, {
          id: team.id,
          name: team.name,
          members,
        });
      }
    } catch (error) {
      this.logger.error('Error fetching teams:', error);
      throw error;
    }
  }

  private async fetchTeamMembers(teamId: string): Promise<TeamMember[]> {
    try {
      const response = await axios.get(
        `${this.baseUrl}/rest/teams/1.0/team/${teamId}/member`,
        {
          headers: {
            Authorization: this.getAuthHeader(),
            Accept: 'application/json',
          },
        },
      );

      return response.data.values.map((member) => ({
        accountId: member.accountId,
        displayName: member.displayName,
        emailAddress: member.emailAddress,
      }));
    } catch (error) {
      this.logger.error(
        `Error fetching team members for team ${teamId}:`,
        error,
      );
      return [];
    }
  }

  private async collectMetricsForTeam(
    team: Team,
    startDate: Date,
  ): Promise<TeamMetric[]> {
    const metrics: TeamMetric[] = [];

    try {
      const completedIssues = await this.getTeamCompletedIssues(
        team,
        startDate,
      );
      const timeTrackingData = await this.getTeamTimeTracking(team, startDate);

      // Team completion rate
      metrics.push({
        metricName: 'team.completion_rate',
        value: completedIssues.length,
        unit: 'issues',
        timestamp: new Date(),
        category: TeamMetricCategory.TEAM_PERFORMANCE,
        metadata: {
          teamId: team.id,
          teamName: team.name,
          memberCount: team.members.length,
          period: this.getPeriodString(startDate),
        },
      });

      // User-level metrics
      for (const member of team.members) {
        const userIssues = completedIssues.filter(
          (issue) => issue.fields.assignee?.accountId === member.accountId,
        );

        const userTimeTracking = timeTrackingData.filter(
          (log) => log.author.accountId === member.accountId,
        );

        metrics.push({
          metricName: 'user.productivity',
          value: userIssues.length,
          unit: 'issues',
          timestamp: new Date(),
          category: TeamMetricCategory.USER_PERFORMANCE,
          metadata: {
            teamId: team.id,
            teamName: team.name,
            userId: member.accountId,
            userName: member.displayName,
            timeSpent: this.calculateTimeSpent(userTimeTracking),
            issueTypes: this.aggregateIssueTypes(userIssues),
          },
        });
      }

      // Team efficiency
      metrics.push({
        metricName: 'team.efficiency',
        value: this.calculateTeamEfficiency(timeTrackingData, completedIssues),
        unit: 'percentage',
        timestamp: new Date(),
        category: TeamMetricCategory.TEAM_PERFORMANCE,
        metadata: {
          teamId: team.id,
          teamName: team.name,
          totalTimeSpent: this.calculateTotalTimeSpent(timeTrackingData),
          totalEstimated: this.calculateTotalEstimated(completedIssues),
          memberDistribution: this.calculateMemberDistribution(
            timeTrackingData,
            team.members,
          ),
        },
      });

      return metrics;
    } catch (error) {
      this.logger.error(
        `Error collecting metrics for team ${team.name}:`,
        error,
      );
      return metrics;
    }
  }

  private async getTeamCompletedIssues(team: Team, startDate: Date) {
    const memberIds = team.members.map((m) => m.accountId);
    const jql = `assignee in (${memberIds.map((id) => `"${id}"`).join(',')}) 
                 AND status changed to Done 
                 AFTER "${startDate.toISOString().split('T')[0]}"`;

    try {
      const { issues } = await this.jiraService.jira.searchJira(jql, {
        maxResults: 1000,
        fields: [
          'summary',
          'status',
          'issuetype',
          'assignee',
          'created',
          'timeoriginalestimate',
          'timespent',
          'updated',
        ],
      });

      return issues;
    } catch (error) {
      this.logger.error(
        `Error fetching completed issues for team ${team.name}:`,
        error,
      );
      return [];
    }
  }

  private async getTeamTimeTracking(team: Team, startDate: Date) {
    try {
      const response = await axios.get(
        `${this.baseUrl}/rest/api/3/worklog/updated`,
        {
          headers: {
            Authorization: this.getAuthHeader(),
            Accept: 'application/json',
          },
          params: {
            since: startDate.getTime(),
          },
        },
      );

      return response.data.values.filter((log) =>
        team.members.some(
          (member) => member.accountId === log.author.accountId,
        ),
      );
    } catch (error) {
      this.logger.error(
        `Error fetching time tracking for team ${team.name}:`,
        error,
      );
      return [];
    }
  }

  private calculateTeamEfficiency(timeTracking: any[], issues: any[]): number {
    const totalTimeSpent = this.calculateTotalTimeSpent(timeTracking);
    const totalEstimated = this.calculateTotalEstimated(issues);
    return totalEstimated > 0 ? (totalTimeSpent / totalEstimated) * 100 : 0;
  }

  private calculateTimeSpent(timeTracking: any[]): number {
    return (
      timeTracking.reduce((acc, log) => acc + (log.timeSpentSeconds || 0), 0) /
      3600
    );
  }

  private calculateTotalTimeSpent(timeTracking: any[]): number {
    return (
      timeTracking.reduce((acc, log) => acc + (log.timeSpentSeconds || 0), 0) /
      3600
    );
  }

  private calculateTotalEstimated(issues: any[]): number {
    return (
      issues.reduce(
        (acc, issue) => acc + (issue.fields.timeoriginalestimate || 0),
        0,
      ) / 3600
    );
  }

  private calculateMemberDistribution(
    timeTracking: any[],
    members: TeamMember[],
  ) {
    const distribution: Record<
      string,
      { hoursSpent: number; percentage: number }
    > = {};
    const totalTime = timeTracking.reduce(
      (acc, log) => acc + (log.timeSpentSeconds || 0),
      0,
    );

    members.forEach((member) => {
      const memberTime = timeTracking
        .filter((log) => log.author.accountId === member.accountId)
        .reduce((acc, log) => acc + (log.timeSpentSeconds || 0), 0);

      distribution[member.displayName] = {
        hoursSpent: memberTime / 3600,
        percentage: totalTime > 0 ? (memberTime / totalTime) * 100 : 0,
      };
    });

    return distribution;
  }

  private aggregateIssueTypes(issues: any[]): Record<string, number> {
    return issues.reduce((acc, issue) => {
      const type = issue.fields.issuetype.name;
      acc[type] = (acc[type] || 0) + 1;
      return acc;
    }, {});
  }

  private getPeriodString(startDate: Date): string {
    return `${startDate.toISOString().split('T')[0]} to ${new Date().toISOString().split('T')[0]}`;
  }

  private getAuthHeader(): string {
    const username = this.configService.get('jira.username');
    const token = this.configService.get('jira.apiToken');
    if (!username || !token) throw new Error('Jira credentials not configured');
    return `Basic ${Buffer.from(`${username}:${token}`).toString('base64')}`;
  }

  private async saveMetrics(metrics: TeamMetric[]) {
    await this.prisma.$transaction(async (prisma) => {
      for (const metric of metrics) {
        await prisma.engineeringMetric.create({
          data: {
            ...metric,
            source: 'jira_team',
            tenantId: 'default',
          },
        });
      }
    });
  }
}

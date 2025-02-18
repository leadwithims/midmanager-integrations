// src/collectors/jira/services/team-metrics-collector.service.ts
import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../../../../prisma/prisma.service';
import * as JiraApi from 'jira-client';
import axios from 'axios';

interface TeamMember {
  accountId: string;
  displayName: string;
  emailAddress: string;
}

interface Team {
  id: string;
  name: string;
  members: TeamMember[];
}

@Injectable()
export class TeamMetricsCollectorService {
  private readonly logger = new Logger(TeamMetricsCollectorService.name);
  private jira: JiraApi;
  private readonly baseUrl: string;
  private readonly teams: Map<string, Team> = new Map();

  constructor(
    private readonly configService: ConfigService,
    private readonly prisma: PrismaService,
  ) {
    const host = this.configService.get<string>('jira.host');
    this.baseUrl = `https://${host}`;

    this.jira = new JiraApi({
      protocol: 'https',
      host,
      username: this.configService.get<string>('jira.username'),
      password: this.configService.get<string>('jira.apiToken'),
      apiVersion: '3',
      strictSSL: true
    });
  }

  async collectTeamMetrics() {
    try {
      // First, fetch and cache team data
      await this.fetchTeams();
      
      const startOfMonth = new Date();
      startOfMonth.setDate(1);
      startOfMonth.setHours(0, 0, 0, 0);

      const metrics = [];

      // Collect metrics for each team
      for (const team of this.teams.values()) {
        const teamMetrics = await this.collectMetricsForTeam(team, startOfMonth);
        metrics.push(...teamMetrics);
      }

      await this.saveMetrics(metrics);
      return metrics;
    } catch (error) {
      this.logger.error('Error collecting team metrics:', error);
      throw error;
    }
  }

  private async fetchTeams() {
    try {
      // Using Jira Teams API endpoint
      const response = await axios.get(
        `${this.baseUrl}/rest/teams/1.0/teams`,
        {
          headers: {
            'Authorization': `Basic ${Buffer.from(
              `${this.configService.get('jira.username')}:${this.configService.get('jira.apiToken')}`
            ).toString('base64')}`,
            'Accept': 'application/json'
          }
        }
      );

      for (const team of response.data.values) {
        const members = await this.fetchTeamMembers(team.id);
        this.teams.set(team.id, {
          id: team.id,
          name: team.name,
          members
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
            'Authorization': `Basic ${Buffer.from(
              `${this.configService.get('jira.username')}:${this.configService.get('jira.apiToken')}`
            ).toString('base64')}`,
            'Accept': 'application/json'
          }
        }
      );

      return response.data.values.map(member => ({
        accountId: member.accountId,
        displayName: member.displayName,
        emailAddress: member.emailAddress
      }));
    } catch (error) {
      this.logger.error(`Error fetching team members for team ${teamId}:`, error);
      return [];
    }
  }

  private async collectMetricsForTeam(team: Team, startDate: Date) {
    const metrics = [];
    const memberIds = team.members.map(m => m.accountId);

    // Collect completed issues for the team
    const completedIssues = await this.getTeamCompletedIssues(team, startDate);
    
    // Collect time tracking data
    const timeTrackingData = await this.getTeamTimeTracking(team, startDate);

    // Team-level metrics
    metrics.push({
      metricName: 'team.completion_rate',
      value: completedIssues.length,
      unit: 'issues',
      timestamp: new Date(),
      category: 'team_performance',
      metadata: {
        teamId: team.id,
        teamName: team.name,
        memberCount: team.members.length,
        period: `${startDate.toISOString().split('T')[0]} to ${new Date().toISOString().split('T')[0]}`
      }
    });

    // Status time metrics for team
    const statusTimeMetrics = await this.calculateTeamStatusMetrics(completedIssues, team);
    metrics.push(...statusTimeMetrics);

    // User-level metrics within team
    for (const member of team.members) {
      const userIssues = completedIssues.filter(
        issue => issue.fields.assignee?.accountId === member.accountId
      );

      const userTimeTracking = timeTrackingData.filter(
        log => log.author.accountId === member.accountId
      );

      metrics.push({
        metricName: 'user.productivity',
        value: userIssues.length,
        unit: 'issues',
        timestamp: new Date(),
        category: 'user_performance',
        metadata: {
          teamId: team.id,
          teamName: team.name,
          userId: member.accountId,
          userName: member.displayName,
          timeSpent: userTimeTracking.reduce((acc, log) => acc + log.timeSpentSeconds, 0) / 3600,
          issueTypes: this.aggregateIssueTypes(userIssues)
        }
      });
    }

    // Team efficiency metrics
    metrics.push({
      metricName: 'team.efficiency',
      value: this.calculateTeamEfficiency(timeTrackingData, completedIssues),
      unit: 'percentage',
      timestamp: new Date(),
      category: 'team_performance',
      metadata: {
        teamId: team.id,
        teamName: team.name,
        totalTimeSpent: timeTrackingData.reduce((acc, log) => acc + log.timeSpentSeconds, 0) / 3600,
        totalEstimated: completedIssues.reduce((acc, issue) => acc + (issue.fields.timeoriginalestimate || 0), 0) / 3600,
        memberDistribution: this.calculateMemberDistribution(timeTrackingData, team.members)
      }
    });

    return metrics;
  }

  private async getTeamCompletedIssues(team: Team, startDate: Date) {
    const memberIds = team.members.map(m => m.accountId);
    const jql = `assignee in (${memberIds.map(id => `"${id}"`).join(',')}) 
                 AND status changed to Done 
                 AFTER "${startDate.toISOString().split('T')[0]}"`;

    try {
      const { issues } = await this.jira.searchJira(jql, {
        maxResults: 1000,
        fields: [
          'summary',
          'status',
          'issuetype',
          'assignee',
          'created',
          'timeoriginalestimate',
          'timespent',
          'updated'
        ]
      });

      return issues;
    } catch (error) {
      this.logger.error(`Error fetching completed issues for team ${team.name}:`, error);
      return [];
    }
  }

  private async getTeamTimeTracking(team: Team, startDate: Date) {
    try {
      const response = await axios.get(
        `${this.baseUrl}/rest/api/3/worklog/updated`,
        {
          headers: {
            'Authorization': `Basic ${Buffer.from(
              `${this.configService.get('jira.username')}:${this.configService.get('jira.apiToken')}`
            ).toString('base64')}`,
            'Accept': 'application/json'
          },
          params: {
            since: startDate.getTime()
          }
        }
      );

      return response.data.values.filter(log => 
        team.members.some(member => member.accountId === log.author.accountId)
      );
    } catch (error) {
      this.logger.error(`Error fetching time tracking for team ${team.name}:`, error);
      return [];
    }
  }

  private calculateTeamEfficiency(timeTracking: any[], issues: any[]): number {
    const totalTimeSpent = timeTracking.reduce((acc, log) => acc + log.timeSpentSeconds, 0);
    const totalEstimated = issues.reduce((acc, issue) => acc + (issue.fields.timeoriginalestimate || 0), 0);
    
    return totalEstimated > 0 ? (totalTimeSpent / totalEstimated) * 100 : 0;
  }

  private calculateMemberDistribution(timeTracking: any[], members: TeamMember[]) {
    const distribution = {};
    const totalTime = timeTracking.reduce((acc, log) => acc + log.timeSpentSeconds, 0);

    members.forEach(member => {
      const memberTime = timeTracking
        .filter(log => log.author.accountId === member.accountId)
        .reduce((acc, log) => acc + log.timeSpentSeconds, 0);

      distribution[member.displayName] = {
        hoursSpent: memberTime / 3600,
        percentage: totalTime > 0 ? (memberTime / totalTime) * 100 : 0
      };
    });

    return distribution;
  }

  private aggregateIssueTypes(issues: any[]) {
    const typeCount = {};
    issues.forEach(issue => {
      const type = issue.fields.issuetype.name;
      typeCount[type] = (typeCount[type] || 0) + 1;
    });
    return typeCount;
  }

  private async calculateTeamStatusMetrics(issues: any[], team: Team) {
    // Implementation similar to status-time-collector but aggregated by team
    // ... (Previous status time calculation logic)
  }

  private async saveMetrics(metrics: any[]) {
    await this.prisma.$transaction(async (prisma) => {
      for (const metric of metrics) {
        await prisma.engineeringMetric.create({
          data: {
            ...metric,
            source: 'jira_team',
            tenantId: 'default'
          }
        });
      }
    });
  }
}
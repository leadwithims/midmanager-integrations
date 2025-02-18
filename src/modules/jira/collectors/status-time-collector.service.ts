// src/collectors/jira/services/status-time-collector.service.ts
import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../../../../prisma/prisma.service';
import * as JiraApi from 'jira-client';
import { StatusManagerService } from './status-manager.service';

@Injectable()
export class StatusTimeCollectorService {
  constructor(
    private readonly configService: ConfigService,
    private readonly prisma: PrismaService,
    private readonly statusManager: StatusManagerService,
  ) {
    this.jira = new JiraApi({
      protocol: 'https',
      host: this.configService.get<string>('jira.host'),
      username: this.configService.get<string>('jira.username'),
      password: this.configService.get<string>('jira.apiToken'),
      apiVersion: '3',
      strictSSL: true
    });
  }

  async collectTimeMetrics() {
    try {
      const startOfMonth = new Date();
      startOfMonth.setDate(1);
      startOfMonth.setHours(0, 0, 0, 0);

      // Get completed issues for the month
      const completedIssues = await this.getCompletedIssues(startOfMonth);
      
      // Analyze time spent in each status
      const statusTimeMetrics = await this.analyzeStatusTime(completedIssues);
      
      // Get time tracking data
      const timeTrackingMetrics = await this.analyzeTimeTracking(completedIssues);

      await this.saveMetrics([...statusTimeMetrics, ...timeTrackingMetrics]);

      return {
        statusTimeMetrics,
        timeTrackingMetrics
      };
    } catch (error) {
      this.logger.error('Error collecting time metrics:', error);
      throw error;
    }
  }

  private async getCompletedIssues(startDate: Date) {
    const jql = `status changed to Done AFTER "${startDate.toISOString().split('T')[0]}"`;
    
    try {
      const issues = await this.jira.searchJira(jql, {
        maxResults: 1000,
        fields: [
          'summary',
          'status',
          'issuetype',
          'priority',
          'assignee',
          'created',
          'updated',
          'timeoriginalestimate',
          'timeestimate',
          'timespent',
          'components',
          'labels'
        ]
      });

      return issues.issues;
    } catch (error) {
      this.logger.error('Error fetching completed issues:', error);
      throw error;
    }
  }

  private async analyzeStatusTime(issues: any[]) {
    const metrics = [];
    const statusTimes = new Map();

    for (const issue of issues) {
      try {
        const changelog = await this.jira.getIssueChangelog(issue.id);
        const statusChanges = this.extractStatusChanges(changelog.values);
        
        // Calculate time spent in each active status
        for (const status of this.activeStatuses) {
          const timeInStatus = this.calculateTimeInStatus(statusChanges, status);
          statusTimes.set(status, (statusTimes.get(status) || 0) + timeInStatus);
        }

        // Record flow time (excluding ignored statuses)
        const flowTime = this.calculateFlowTime(statusChanges);
        
        metrics.push({
          metricName: 'jira.issue.flow_time',
          value: flowTime / (1000 * 60 * 60), // Convert to hours
          unit: 'hours',
          timestamp: new Date(),
          category: 'time_tracking',
          metadata: {
            issueKey: issue.key,
            issueType: issue.fields.issuetype.name,
            statusBreakdown: this.getStatusBreakdown(statusChanges)
          }
        });
      } catch (error) {
        this.logger.warn(`Error analyzing status times for issue ${issue.key}:`, error);
      }
    }

    // Add aggregate metrics
    metrics.push({
      metricName: 'jira.status.time_distribution',
      value: this.activeStatuses.reduce((acc, status) => acc + (statusTimes.get(status) || 0), 0) / (1000 * 60 * 60),
      unit: 'hours',
      timestamp: new Date(),
      category: 'time_tracking',
      metadata: {
        statusBreakdown: Object.fromEntries(
          Array.from(statusTimes.entries()).map(([status, time]) => [
            status,
            time / (1000 * 60 * 60) // Convert to hours
          ])
        ),
        totalIssues: issues.length
      }
    });

    return metrics;
  }

  private async analyzeTimeTracking(issues: any[]) {
    const metrics = [];
    let totalEstimated = 0;
    let totalSpent = 0;
    const estimateAccuracy = new Map();

    for (const issue of issues) {
      const originalEstimate = issue.fields.timeoriginalestimate || 0; // in seconds
      const timeSpent = issue.fields.timespent || 0; // in seconds
      
      totalEstimated += originalEstimate;
      totalSpent += timeSpent;

      // Calculate estimate accuracy
      if (originalEstimate > 0) {
        const accuracy = (timeSpent / originalEstimate) * 100;
        const issueType = issue.fields.issuetype.name;
        
        if (!estimateAccuracy.has(issueType)) {
          estimateAccuracy.set(issueType, {
            count: 0,
            totalAccuracy: 0
          });
        }
        
        const current = estimateAccuracy.get(issueType);
        estimateAccuracy.set(issueType, {
          count: current.count + 1,
          totalAccuracy: current.totalAccuracy + accuracy
        });
      }
    }

    metrics.push({
      metricName: 'jira.time.estimate_accuracy',
      value: totalEstimated > 0 ? (totalSpent / totalEstimated) * 100 : 0,
      unit: 'percentage',
      timestamp: new Date(),
      category: 'time_tracking',
      metadata: {
        totalEstimatedHours: totalEstimated / 3600,
        totalSpentHours: totalSpent / 3600,
        accuracyByType: Object.fromEntries(
          Array.from(estimateAccuracy.entries()).map(([type, data]) => [
            type,
            data.totalAccuracy / data.count
          ])
        ),
        issueCount: issues.length
      }
    });

    return metrics;
  }

  private extractStatusChanges(changelog: any[]) {
    return changelog
      .filter(log => log.items.some(item => item.field === 'status'))
      .map(log => ({
        timestamp: new Date(log.created),
        fromStatus: log.items.find(item => item.field === 'status').fromString,
        toStatus: log.items.find(item => item.field === 'status').toString
      }))
      .sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime());
  }

  private calculateTimeInStatus(statusChanges: any[], status: string): number {
    let totalTime = 0;
    let statusStartTime: Date | null = null;

    for (const change of statusChanges) {
      if (change.toStatus === status) {
        statusStartTime = change.timestamp;
      } else if (statusStartTime && change.fromStatus === status) {
        totalTime += change.timestamp.getTime() - statusStartTime.getTime();
        statusStartTime = null;
      }
    }

    // If issue is still in the status
    if (statusStartTime) {
      totalTime += new Date().getTime() - statusStartTime.getTime();
    }

    return totalTime;
  }

  private calculateFlowTime(statusChanges: any[]): number {
    let totalTime = 0;
    let lastActiveTime: Date | null = null;

    for (const change of statusChanges) {
      if (!this.ignoredStatuses.includes(change.toStatus)) {
        if (!lastActiveTime) {
          lastActiveTime = change.timestamp;
        }
      } else if (lastActiveTime) {
        totalTime += change.timestamp.getTime() - lastActiveTime.getTime();
        lastActiveTime = null;
      }
    }

    if (lastActiveTime) {
      totalTime += new Date().getTime() - lastActiveTime.getTime();
    }

    return totalTime;
  }

  private getStatusBreakdown(statusChanges: any[]) {
    const breakdown = {};
    let currentStatus = null;
    let statusStartTime = null;

    for (const change of statusChanges) {
      if (currentStatus && statusStartTime) {
        const timeInStatus = change.timestamp.getTime() - statusStartTime.getTime();
        breakdown[currentStatus] = (breakdown[currentStatus] || 0) + timeInStatus;
      }
      
      currentStatus = change.toStatus;
      statusStartTime = change.timestamp;
    }

    return Object.fromEntries(
      Object.entries(breakdown)
        .filter(([status]) => !this.ignoredStatuses.includes(status))
        .map(([status, time]) => [status, time / (1000 * 60 * 60)]) // Convert to hours
    );
  
    async analyzeIssueStatusTime(issue: any) {
        const projectKey = issue.fields.project.key;
        const activeStatuses = await this.statusManager.getActiveStatuses(projectKey);
        
        // Now use activeStatuses for analysis
        const changelog = await this.jira.getIssueChangelog(issue.id);
        const statusChanges = this.extractStatusChanges(changelog.values);
        
        const timeInStatuses = new Map<string, number>();
        
        for (const status of activeStatuses) {
          const timeInStatus = this.calculateTimeInStatus(statusChanges, status);
          if (timeInStatus > 0) {
            timeInStatuses.set(status, timeInStatus);
          }
        }
    
        return {
          issueKey: issue.key,
          timeInStatuses: Object.fromEntries(timeInStatuses),
          totalActiveTime: Array.from(timeInStatuses.values()).reduce((a, b) => a + b, 0)
        };
      }

}
import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import axios from 'axios';

@Injectable()
export class StatusManagerService implements OnModuleInit {
  private readonly logger = new Logger(StatusManagerService.name);
  private statuses: Map<string, string[]> = new Map();
  private readonly ignoredStatuses = ['To Do', 'Done', 'Canceled', 'Abandoned'];

  constructor(private readonly configService: ConfigService) {}

  async onModuleInit() {
    await this.loadStatuses();
  }

  private async loadStatuses() {
    try {
      const host = this.configService.get<string>('jira.host');
      const auth = Buffer.from(
        `${this.configService.get('jira.username')}:${this.configService.get('jira.apiToken')}`,
      ).toString('base64');

      // First, get all projects
      const projectsResponse = await axios.get(
        `https://${host}/rest/api/3/project`,
        {
          headers: {
            Authorization: `Basic ${auth}`,
            Accept: 'application/json',
          },
        },
      );

      // For each project, get its statuses
      for (const project of projectsResponse.data) {
        const statusResponse = await axios.get(
          `https://${host}/rest/api/3/project/${project.id}/statuses`,
          {
            headers: {
              Authorization: `Basic ${auth}`,
              Accept: 'application/json',
            },
          },
        );

        // Extract and store unique statuses for the project
        const projectStatuses = new Set<string>();

        statusResponse.data.forEach((issueType) => {
          issueType.statuses.forEach((status) => {
            if (!this.ignoredStatuses.includes(status.name)) {
              projectStatuses.add(status.name);
            }
          });
        });

        this.statuses.set(project.key, Array.from(projectStatuses));

        this.logger.log(
          `Loaded ${projectStatuses.size} active statuses for project ${project.key}`,
        );
      }
    } catch (error) {
      this.logger.error('Error loading Jira statuses:', error);
      throw error;
    }
  }

  async getActiveStatuses(projectKey: string): Promise<string[]> {
    if (!this.statuses.has(projectKey)) {
      await this.loadStatuses();
    }
    return this.statuses.get(projectKey) || [];
  }

  async getAllActiveStatuses(): Promise<string[]> {
    const allStatuses = new Set<string>();

    for (const projectStatuses of this.statuses.values()) {
      projectStatuses.forEach((status) => allStatuses.add(status));
    }

    return Array.from(allStatuses);
  }

  isStatusIgnored(status: string): boolean {
    return this.ignoredStatuses.includes(status);
  }
}

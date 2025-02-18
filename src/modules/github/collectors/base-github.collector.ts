import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Octokit } from '@octokit/rest';

@Injectable()
export abstract class BaseGithubCollector {
  protected readonly logger: Logger;
  protected readonly octokit: Octokit;

  constructor(protected readonly configService: ConfigService) {
    this.logger = new Logger(this.constructor.name);
    this.octokit = new Octokit({
      auth: this.configService.get<string>('github.token'),
    });
  }

  protected getOrg(): string {
    const org = this.configService.get<string>('github.organization');
    if (!org) {
      throw new Error('GitHub organization is not configured');
    }
    return org;
  }

  protected async executeGithubQuery<T>(
    operation: () => Promise<T>,
    errorMessage: string,
  ): Promise<T> {
    try {
      return await operation();
    } catch (error) {
      this.logger.error(`${errorMessage}: ${error.message}`, error.stack);
      throw error;
    }
  }
}

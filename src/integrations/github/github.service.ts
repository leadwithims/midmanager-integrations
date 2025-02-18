import { Injectable, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Octokit } from '@octokit/rest';

@Injectable()
export class GitHubService implements OnModuleInit {
  private oktokitInstance: Octokit;

  constructor(private readonly configService: ConfigService) {}

  async onModuleInit() {
    const token = this.configService.get<string>('github.token');
    if (!token) {
      throw new Error('GitHub token is not configured');
    }

    this.oktokitInstance = new Octokit({
      auth: token,
    });
  }

  async getRepositories() {
    const organization = this.configService.get<string>('github.organization');
    if (!organization) {
      throw new Error('GitHub organization is not configured');
    }

    return this.oktokitInstance.repos.listForOrg({
      org: organization,
      type: 'all',
    });
  }

  async getContributors(repo: string) {
    const organization = this.configService.get<string>('github.organization');
    if (!organization) {
      throw new Error('GitHub organization is not configured');
    }

    return this.oktokitInstance.repos.listContributors({
      owner: organization,
      repo,
    });
  }
}

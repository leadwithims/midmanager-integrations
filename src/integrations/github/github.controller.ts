import { Controller, Get, Param, UseGuards } from '@nestjs/common';
import { GitHubService } from './github.service';
import { TenantGuard } from '../../common/guards/tenant.guard';
import { CurrentTenant } from '../../common/decorators/tenant.decorator';

@Controller('github')
@UseGuards(TenantGuard)
export class GitHubController {
  constructor(private readonly githubService: GitHubService) {}

  @Get('repositories')
  async getRepositories(@CurrentTenant() tenantId: string) {
    return this.githubService.getRepositories();
  }

  @Get('repositories/:repo/contributors')
  async getContributors(
    @CurrentTenant() tenantId: string,
    @Param('repo') repo: string,
  ) {
    return this.githubService.getContributors(repo);
  }
}

import { Injectable } from '@nestjs/common';
import { Octokit } from '@octokit/rest';

@Injectable()
export class GitHubService {
    private oktokitInstances: Map<string, Octokit> = new Map();

    async getOctokitForTenant(tenantId: string, credentials: any) {
        let octokit = this.oktokitInstances.get(tenantId);

        if (!octokit) {
            octokit = new Octokit({
                auth: credentials.githubCredentials.token,
            });
            this.oktokitInstances.set(tenantId, octokit);
        }

        return octokit;
    }

    async fetchUserContributions(tenantId: string, username: string) {
        const context = await this.tenantService.getTenantContext(tenantId);
        const octokit = await this.getOctokitForTenant(tenantId, context.credentials);

        // All operations now use tenant-specific credentials
        return await octokit.repos.getContributorsStats({
            owner: context.credentials.githubCredentials.organization,
            repo: 'your-repo',
        });
    }
}
import { Module } from '@nestjs/common';
import { GitHubController } from './github.controller';
import { GitHubService } from './services/github.service';
import { TenantModule } from '../../tenant/tenant.module';

@Module({
  imports: [TenantModule],
  controllers: [GitHubController],
  providers: [GitHubService],
  exports: [GitHubService],
})
export class GitHubModule {}

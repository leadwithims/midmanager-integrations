import { Module } from '@nestjs/common';
import { StatusTimeCollectorService } from './collectors/status-time-collector.service';
import { StatusManagerService } from './services/status-manager.service';
import { TeamMetricsCollectorService } from './collectors/team-metrics-collector.service';
import { JiraCollectorService } from './collectors/jira-collector.service';
import { PrismaModule } from '../../../prisma/prisma.module';

@Module({
  imports: [PrismaModule],
  providers: [
    JiraCollectorService,
    StatusTimeCollectorService,
    StatusManagerService,
    TeamMetricsCollectorService,
  ],
  exports: [
    JiraCollectorService,
    StatusTimeCollectorService,
    TeamMetricsCollectorService,
  ],
})
export class JiraModule {}

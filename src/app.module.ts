import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ScheduleModule } from '@nestjs/schedule';
import { PrismaModule } from '../prisma/prisma.module';
import { SyncModule } from './sync/sync.module';
import { MetricsModule } from './modules/metrics/metrics.module';
import { GitHubModule } from './modules/github/github.module';
import { JiraModule } from './modules/jira/jira.module';
import configuration from './core/config/configuration';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      load: [configuration],
    }),
    ScheduleModule.forRoot(),
    PrismaModule,
    SyncModule,
    MetricsModule,
    GitHubModule,
    JiraModule,
  ],
})
export class AppModule { }
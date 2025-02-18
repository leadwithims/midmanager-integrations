import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bull';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { GithubProcessor } from './processors/github.processor';
import { GitHubModule } from '../integrations/github/github.module';
import { PrismaModule } from '../../prisma/prisma.module';

@Module({
  imports: [
    BullModule.forRootAsync({
      imports: [ConfigModule],
      useFactory: (configService: ConfigService) => ({
        redis: {
          host: configService.get<string>('redis.host'),
          port: configService.get<number>('redis.port'),
        },
      }),
      inject: [ConfigService],
    }),
    BullModule.registerQueue({
      name: 'github-sync',
    }),
    GitHubModule,
    PrismaModule,
  ],
  providers: [GithubProcessor],
  exports: [BullModule],
})
export class QueueModule {}

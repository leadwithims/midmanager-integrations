import { Injectable, OnModuleInit } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { RedisService } from '../redis/redis.service';

@Injectable()
export class TenantService implements OnModuleInit {
    private tenantCredentialsCache: Map<string, any> = new Map();

    constructor(
        private prisma: PrismaService,
        private redis: RedisService,
    ) { }

    async onModuleInit() {
        // Pre-load tenant credentials into cache
        await this.loadTenantCredentials();
    }

    private async loadTenantCredentials() {
        const tenants = await this.prisma.tenant.findMany({
            include: {
                TenantCredentials: true,
            },
        });

        for (const tenant of tenants) {
            await this.cacheTenantCredentials(tenant.id, tenant.TenantCredentials);
        }
    }

    private async cacheTenantCredentials(tenantId: string, credentials: any) {
        const cacheKey = `tenant:${tenantId}:credentials`;
        await this.redis.set(cacheKey, JSON.stringify(credentials));
        this.tenantCredentialsCache.set(tenantId, credentials);
    }

    async getTenantContext(tenantId: string) {
        // First check cache
        let credentials = this.tenantCredentialsCache.get(tenantId);

        if (!credentials) {
            // Check Redis
            const cacheKey = `tenant:${tenantId}:credentials`;
            credentials = await this.redis.get(cacheKey);

            if (!credentials) {
                // Load from database
                credentials = await this.prisma.tenantCredentials.findUnique({
                    where: { tenantId },
                });

                if (credentials) {
                    await this.cacheTenantCredentials(tenantId, credentials);
                }
            }
        }

        if (!credentials) {
            throw new Error(`No credentials found for tenant ${tenantId}`);
        }

        return {
            tenantId,
            credentials,
        };
    }
}
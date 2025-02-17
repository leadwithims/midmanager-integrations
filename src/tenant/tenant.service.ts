import { Injectable, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { TenantConfig } from './tenant.interface';

@Injectable()
export class TenantService implements OnModuleInit {
    private defaultTenant: TenantConfig;

    constructor(private configService: ConfigService) { }

    async onModuleInit() {
        const token = this.configService.get<string>('github.token');
        const organization = this.configService.get<string>('github.organization');

        if (!token || !organization) {
            throw new Error('GitHub configuration is incomplete');
        }

        this.defaultTenant = {
            id: 'default',
            name: 'Default Tenant',
            integrations: {
                github: {
                    token,
                    organization,
                },
            },
        };
    }

    async getTenantConfig(tenantId: string = 'default'): Promise<TenantConfig> {
        return this.defaultTenant;
    }

    async validateTenantAccess(tenantId: string): Promise<boolean> {
        return tenantId === 'default';
    }
}
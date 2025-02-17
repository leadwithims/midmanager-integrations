import { Injectable, NestMiddleware } from '@nestjs/common';
import { Request, Response, NextFunction } from 'express';
import { TenantService } from '../tenant/tenant.service';

@Injectable()
export class TenantContextMiddleware implements NestMiddleware {
    constructor(private tenantService: TenantService) { }

    async use(req: Request, res: Response, next: NextFunction) {
        const tenantId = req.headers['x-tenant-id'] as string;
        if (!tenantId) {
            throw new Error('Tenant ID is required');
        }

        // Set tenant context for the request
        req['tenantContext'] = await this.tenantService.getTenantContext(tenantId);
        next();
    }
}
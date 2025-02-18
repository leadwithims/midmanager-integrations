import { Injectable, CanActivate, ExecutionContext } from '@nestjs/common';
import { TenantService } from '../../tenant/tenant.service';

@Injectable()
export class TenantGuard implements CanActivate {
  constructor(private tenantService: TenantService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    const tenantId = request.headers['x-tenant-id'] || 'default';

    return this.tenantService.validateTenantAccess(tenantId);
  }
}

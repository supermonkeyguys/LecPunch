import { Body, Controller, ForbiddenException, Get, Patch, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import type { AuthUser } from '../auth/types/auth-user.type';
import { NetworkPolicyService, type NetworkPolicySnapshot } from './network-policy.service';
import { UpdateNetworkPolicyDto } from './dto/update-network-policy.dto';

@Controller('network-policy')
@UseGuards(JwtAuthGuard)
export class NetworkPolicyController {
  constructor(private readonly networkPolicyService: NetworkPolicyService) {}

  @Get('admin/current')
  async getCurrentPolicy(@CurrentUser() user: AuthUser) {
    this.assertAdmin(user);
    const policy = await this.networkPolicyService.getAdminPolicy(user.teamId);
    return this.mapPolicy(policy);
  }

  @Patch('admin/current')
  async updateCurrentPolicy(@CurrentUser() user: AuthUser, @Body() dto: UpdateNetworkPolicyDto) {
    this.assertAdmin(user);
    const policy = await this.networkPolicyService.updateAdminPolicy(user.teamId, dto);
    return this.mapPolicy(policy);
  }

  private assertAdmin(user: AuthUser) {
    if (user.role !== 'admin') {
      throw new ForbiddenException('Only admins can manage network policy');
    }
  }

  private mapPolicy(policy: NetworkPolicySnapshot) {
    return {
      teamId: policy.teamId,
      source: policy.source,
      allowAnyNetwork: policy.allowAnyNetwork,
      allowedPublicIps: policy.allowedPublicIps,
      allowedCidrs: policy.allowedCidrs,
      trustProxy: policy.trustProxy,
      trustedProxyHops: policy.trustedProxyHops,
      updatedAt: policy.updatedAt ? policy.updatedAt.toISOString() : null
    };
  }
}

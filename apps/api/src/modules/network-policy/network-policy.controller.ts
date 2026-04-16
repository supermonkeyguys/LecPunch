import { Body, Controller, ForbiddenException, Get, Patch, Req, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import type { AuthUser } from '../auth/types/auth-user.type';
import { NetworkPolicyService, type NetworkPolicySnapshot } from './network-policy.service';
import { UpdateNetworkPolicyDto } from './dto/update-network-policy.dto';
import type { Request } from 'express';

@Controller('network-policy')
@UseGuards(JwtAuthGuard)
export class NetworkPolicyController {
  constructor(private readonly networkPolicyService: NetworkPolicyService) {}

  @Get('current-status')
  async getCurrentStatus(@CurrentUser() user: AuthUser, @Req() request: Request) {
    return this.getRequestStatus(user.teamId, request);
  }

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

  @Get('admin/debug')
  async getCurrentDebug(@CurrentUser() user: AuthUser, @Req() request: Request) {
    this.assertAdmin(user);
    return this.getRequestStatus(user.teamId, request);
  }

  private assertAdmin(user: AuthUser) {
    if (user.role !== 'admin') {
      throw new ForbiddenException('Only admins can manage network policy');
    }
  }

  private async getRequestStatus(teamId: string, request: Request) {
    const clientIp = await this.networkPolicyService.getClientIp(teamId, request);
    const isAllowed = await this.networkPolicyService.isIpAllowed(teamId, clientIp);

    return {
      clientIp,
      isAllowed
    };
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

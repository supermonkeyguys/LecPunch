import { Module } from '@nestjs/common';
import { NetworkPolicyService } from './network-policy.service';

@Module({
  providers: [NetworkPolicyService],
  exports: [NetworkPolicyService]
})
export class NetworkPolicyModule {}

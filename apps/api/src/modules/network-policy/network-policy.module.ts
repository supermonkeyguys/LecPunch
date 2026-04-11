import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { NetworkPolicyService } from './network-policy.service';
import { NetworkPolicyController } from './network-policy.controller';
import { NetworkPolicy, NetworkPolicySchema } from './schemas/network-policy.schema';

@Module({
  imports: [MongooseModule.forFeature([{ name: NetworkPolicy.name, schema: NetworkPolicySchema }])],
  providers: [NetworkPolicyService],
  controllers: [NetworkPolicyController],
  exports: [NetworkPolicyService]
})
export class NetworkPolicyModule {}

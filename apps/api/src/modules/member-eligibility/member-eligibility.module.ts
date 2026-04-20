import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { MemberEligibilityService } from './member-eligibility.service';
import { MemberEligibility, MemberEligibilitySchema } from './schemas/member-eligibility.schema';
import { MemberEligibilityController } from './member-eligibility.controller';

@Module({
  imports: [
    MongooseModule.forFeature([{ name: MemberEligibility.name, schema: MemberEligibilitySchema }])
  ],
  controllers: [MemberEligibilityController],
  providers: [MemberEligibilityService],
  exports: [MemberEligibilityService]
})
export class MemberEligibilityModule {}

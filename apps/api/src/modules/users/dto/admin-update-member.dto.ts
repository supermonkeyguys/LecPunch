import { IsIn, IsOptional } from 'class-validator';
import { UserRole, UserStatus } from '@lecpunch/shared';

export class AdminUpdateMemberDto {
  @IsOptional()
  @IsIn(['member', 'admin'])
  role?: UserRole;

  @IsOptional()
  @IsIn(['active', 'disabled'])
  status?: UserStatus;
}

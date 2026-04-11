import { IsArray, IsBoolean, IsInt, IsString, Min } from 'class-validator';

export class UpdateNetworkPolicyDto {
  @IsBoolean()
  allowAnyNetwork!: boolean;

  @IsArray()
  @IsString({ each: true })
  allowedPublicIps!: string[];

  @IsArray()
  @IsString({ each: true })
  allowedCidrs!: string[];

  @IsBoolean()
  trustProxy!: boolean;

  @IsInt()
  @Min(1)
  trustedProxyHops!: number;
}

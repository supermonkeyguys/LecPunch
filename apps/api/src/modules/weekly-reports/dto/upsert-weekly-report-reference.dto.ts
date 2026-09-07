import { IsIn, IsInt, IsOptional, IsString, Matches, Max, MaxLength, Min, NotContains, ValidateIf } from 'class-validator';
import { GITHUB_REPOSITORY_PATH_REGEX } from '../../../common/utils/github.util';

export class UpsertWeeklyReportReferenceDto {
  @IsIn(['generated', 'missing', 'pending'])
  status!: 'generated' | 'missing' | 'pending';

  @ValidateIf((dto: UpsertWeeklyReportReferenceDto) => dto.status === 'generated' || dto.githubPath !== undefined)
  @IsString()
  @MaxLength(256)
  @Matches(GITHUB_REPOSITORY_PATH_REGEX, { message: 'githubPath must be a repository-relative path' })
  @NotContains('..')
  @NotContains('://')
  githubPath?: string;

  @ValidateIf((dto: UpsertWeeklyReportReferenceDto) => dto.status === 'generated' || dto.rawUrl !== undefined)
  @IsString()
  @MaxLength(1_024)
  @Matches(/^https:\/\/raw\.githubusercontent\.com\//, {
    message: 'rawUrl must use raw.githubusercontent.com over HTTPS'
  })
  rawUrl?: string;

  @IsOptional()
  @IsString()
  @Matches(/^[0-9a-f]{7,64}$/i, { message: 'commitSha must be a hexadecimal Git commit SHA' })
  commitSha?: string;

  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(7)
  dailyLogCount?: number;
}

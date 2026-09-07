import { IsBoolean, IsIn, IsOptional, IsString, IsUrl, Matches, MaxLength, NotContains } from 'class-validator';
import {
  GITHUB_REF_REGEX,
  GITHUB_REPOSITORY_PATH_REGEX,
  GITHUB_REPOSITORY_URL_REGEX
} from '../../../common/utils/github.util';

export class UpdateGitHubSourceDto {
  @IsString()
  @Matches(GITHUB_REPOSITORY_URL_REGEX, {
    message: 'repoUrl must be an HTTPS GitHub repository URL without a trailing path'
  })
  repoUrl!: string;

  @IsOptional()
  @IsString()
  @MaxLength(128)
  @Matches(GITHUB_REF_REGEX, { message: 'branch contains unsupported characters' })
  @NotContains('..')
  @NotContains('://')
  branch?: string;

  @IsOptional()
  @IsString()
  @MaxLength(256)
  @Matches(GITHUB_REPOSITORY_PATH_REGEX, { message: 'indexPath must be a repository-relative path' })
  @NotContains('..')
  @NotContains('://')
  indexPath?: string;

  @IsOptional()
  @IsIn(['public'])
  accessMode?: 'public';

  @IsOptional()
  @IsBoolean()
  enabled?: boolean;

  @IsOptional()
  @IsString()
  @MaxLength(255)
  @IsUrl(
    {
      protocols: ['https'],
      require_protocol: true,
      require_host: true,
      require_tld: false,
      require_valid_protocol: true,
      allow_protocol_relative_urls: false
    },
    { message: 'siteUrl must be a public HTTPS URL' }
  )
  @NotContains('@', { message: 'siteUrl must not contain URL credentials' })
  siteUrl?: string | null;
}

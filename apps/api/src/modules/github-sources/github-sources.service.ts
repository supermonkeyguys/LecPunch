import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { UpdateGitHubSourceDto } from './dto/update-github-source.dto';
import { GitHubSource, type GitHubSourceDocument } from './schemas/github-source.schema';
import { UsersService } from '../users/users.service';

@Injectable()
export class GitHubSourcesService {
  constructor(
    @InjectModel(GitHubSource.name)
    private readonly githubSourceModel: Model<GitHubSourceDocument>,
    private readonly usersService: UsersService
  ) {}

  findForUser(userId: string) {
    return this.githubSourceModel.findOne({ userId }).exec();
  }

  async upsertForUser(userId: string, input: UpdateGitHubSourceDto) {
    return this.githubSourceModel
      .findOneAndUpdate(
        { userId },
        {
          $set: {
            repoUrl: input.repoUrl,
            branch: input.branch ?? 'main',
            indexPath: input.indexPath ?? 'lecpunch/index.json',
            accessMode: 'public',
            enabled: input.enabled ?? true,
            siteUrl: input.siteUrl?.trim() ?? null
          },
          $setOnInsert: { userId, verifiedAt: null }
        },
        { new: true, upsert: true, setDefaultsOnInsert: true }
      )
      .exec();
  }

  async deleteForUser(userId: string) {
    await this.githubSourceModel.deleteOne({ userId }).exec();
  }

  async listEnabledForTeam(teamId: string) {
    const members = await this.usersService.listTeamMembers(teamId);
    const memberById = new Map(members.map((member) => [member.id, member]));
    const sources = await this.githubSourceModel
      .find({ userId: { $in: members.map((member) => member.id) }, enabled: true })
      .exec();

    return {
      items: sources
        .map((source) => {
          const member = memberById.get(source.userId);
          if (!member) {
            return null;
          }
          return {
            displayName: member.displayName,
            repoUrl: source.repoUrl,
            siteUrl: source.siteUrl ?? null
          };
        })
        .filter((item): item is { displayName: string; repoUrl: string; siteUrl: string | null } => item !== null)
        .sort((left, right) => left.displayName.localeCompare(right.displayName, 'zh-CN'))
    };
  }

  toItem(source: GitHubSourceDocument) {
    return {
      userId: source.userId,
      repoUrl: source.repoUrl,
      branch: source.branch,
      indexPath: source.indexPath,
      accessMode: source.accessMode,
      enabled: source.enabled,
      siteUrl: source.siteUrl ?? null,
      verifiedAt: source.verifiedAt?.toISOString() ?? null,
      createdAt: source.createdAt.toISOString(),
      updatedAt: source.updatedAt.toISOString()
    };
  }
}

import { BadRequestException, Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { buildRawGitHubUrl, isSafeGitHubRepositoryPath } from '../../common/utils/github.util';
import { parseIsoWeekKey } from '../../common/utils/time.util';
import type { AuthUser } from '../auth/types/auth-user.type';
import { GitHubSourcesService } from '../github-sources/github-sources.service';
import { UsersService } from '../users/users.service';
import { AttendanceService } from '../attendance/attendance.service';
import { UpsertWeeklyReportReferenceDto } from './dto/upsert-weekly-report-reference.dto';
import {
  WeeklyReportReference,
  type WeeklyReportReferenceDocument
} from './schemas/weekly-report-reference.schema';

@Injectable()
export class WeeklyReportsService {
  constructor(
    @InjectModel(WeeklyReportReference.name)
    private readonly weeklyReportReferenceModel: Model<WeeklyReportReferenceDocument>,
    private readonly githubSourcesService: GitHubSourcesService,
    private readonly usersService: UsersService,
    private readonly attendanceService: AttendanceService
  ) {}

  async getMine(user: AuthUser, weekKey: string) {
    this.assertIsoWeekKey(weekKey);
    const [reference, attendanceSummary] = await Promise.all([
      this.weeklyReportReferenceModel.findOne({ userId: user.userId, weekKey }).exec(),
      this.attendanceService.getMyWeeklySummary(user, weekKey)
    ]);
    return {
      week: weekKey,
      item: reference ? this.toItem(reference) : null,
      attendanceSummary
    };
  }

  async upsertMine(user: AuthUser, weekKey: string, input: UpsertWeeklyReportReferenceDto) {
    this.assertIsoWeekKey(weekKey);
    const githubPath = input.githubPath?.trim();
    const rawUrl = input.rawUrl?.trim();
    const requiresSource = input.status === 'generated' || githubPath !== undefined || rawUrl !== undefined;

    if (input.status === 'generated' && (!githubPath || !rawUrl)) {
      throw new BadRequestException({
        code: 'WEEKLY_REPORT_GENERATED_REFERENCE_REQUIRED',
        message: 'A generated weekly report requires githubPath and rawUrl'
      });
    }

    if ((githubPath === undefined) !== (rawUrl === undefined)) {
      throw new BadRequestException({
        code: 'WEEKLY_REPORT_REFERENCE_PAIR_REQUIRED',
        message: 'githubPath and rawUrl must be supplied together'
      });
    }

    if (requiresSource) {
      const source = await this.githubSourcesService.findForUser(user.userId);
      if (!source?.enabled) {
        throw new BadRequestException({
          code: 'GITHUB_SOURCE_REQUIRED',
          message: 'An enabled public GitHub source is required before saving a report reference'
        });
      }
      if (!githubPath || !isSafeGitHubRepositoryPath(githubPath)) {
        throw new BadRequestException({ code: 'WEEKLY_REPORT_PATH_INVALID', message: 'githubPath is invalid' });
      }

      const expectedRawUrl = buildRawGitHubUrl(source.repoUrl, source.branch, githubPath);
      if (!expectedRawUrl || rawUrl !== expectedRawUrl) {
        throw new BadRequestException({
          code: 'WEEKLY_REPORT_RAW_URL_MISMATCH',
          message: 'rawUrl must exactly match the configured public repository, branch, and githubPath'
        });
      }
    }

    const generatedAt = input.status === 'generated' ? new Date() : null;
    const reference = await this.weeklyReportReferenceModel
      .findOneAndUpdate(
        { userId: user.userId, weekKey },
        {
          $set: {
            githubPath: githubPath ?? null,
            rawUrl: rawUrl ?? null,
            commitSha: input.commitSha?.trim() ?? null,
            dailyLogCount: input.dailyLogCount ?? 0,
            status: input.status,
            generatedAt
          },
          $setOnInsert: { userId: user.userId, weekKey }
        },
        { new: true, upsert: true, setDefaultsOnInsert: true }
      )
      .exec();
    return { week: weekKey, item: this.toItem(reference) };
  }

  async listForAdmin(teamId: string, weekKey: string) {
    this.assertIsoWeekKey(weekKey);
    const members = await this.usersService.listTeamMembers(teamId);
    const references = await this.weeklyReportReferenceModel
      .find({ userId: { $in: members.map((member) => member.id) }, weekKey })
      .exec();
    const memberIds = members.map((member) => member.id);
    const attendanceWeekKey = parseIsoWeekKey(weekKey)!.toFormat('yyyy-LL-dd');
    const [adjustmentSummaries, adjustmentsByUserId] = await Promise.all([
      this.attendanceService.getManualAdjustmentSummaries(teamId, memberIds),
      this.attendanceService.getWeekDurationAdjustmentsForUsers(
        teamId,
        memberIds,
        attendanceWeekKey
      )
    ]);
    const referenceByUserId = new Map(references.map((reference) => [reference.userId, reference]));

    return {
      week: weekKey,
      items: members.map((member) => {
        const reference = referenceByUserId.get(member.id);
        return {
          member: {
            userId: member.id,
            username: member.username,
            displayName: member.displayName,
            role: member.role,
            status: member.status
          },
          attendanceAdjustment: {
            manualAdjustmentSeconds:
              adjustmentSummaries.get(`${member.id}:${attendanceWeekKey}`)?.manualAdjustmentSeconds ?? 0,
            adjustmentsCount: adjustmentSummaries.get(`${member.id}:${attendanceWeekKey}`)?.adjustmentsCount ?? 0,
            items: adjustmentsByUserId.get(member.id) ?? []
          },
          ...(reference
            ? this.toItem(reference)
            : {
                githubPath: null,
                rawUrl: null,
                commitSha: null,
                dailyLogCount: 0,
                status: 'missing' as const,
                generatedAt: null,
                updatedAt: null
              })
        };
      })
    };
  }

  private assertIsoWeekKey(weekKey: string) {
    if (!parseIsoWeekKey(weekKey)) {
      throw new BadRequestException({
        code: 'WEEKLY_REPORT_WEEK_INVALID',
        message: 'week must be a valid ISO week in YYYY-Www format'
      });
    }
  }

  private toItem(reference: WeeklyReportReferenceDocument) {
    return {
      githubPath: reference.githubPath,
      rawUrl: reference.rawUrl,
      commitSha: reference.commitSha,
      dailyLogCount: reference.dailyLogCount,
      status: reference.status,
      generatedAt: reference.generatedAt?.toISOString() ?? null,
      updatedAt: reference.updatedAt.toISOString()
    };
  }
}

import {
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { ERROR_CODES, MemberEligibilityStatus } from '@lecpunch/shared';
import { Model } from 'mongoose';
import { MemberEligibility, MemberEligibilityDocument } from './schemas/member-eligibility.schema';

export interface ListMemberEligibilityQuery {
  keyword?: string;
  status?: MemberEligibilityStatus;
  limit?: number;
}

export interface CreateMemberEligibilityInput {
  teamId: string;
  studentId: string;
  realName: string;
  status?: MemberEligibilityStatus;
  note?: string;
}

export interface UpdateMemberEligibilityInput {
  studentId?: string;
  realName?: string;
  status?: MemberEligibilityStatus;
  note?: string | null;
}

@Injectable()
export class MemberEligibilityService {
  constructor(
    @InjectModel(MemberEligibility.name)
    private readonly memberEligibilityModel: Model<MemberEligibilityDocument>
  ) {}

  async assertEligible(teamId: string, studentId: string, realName: string): Promise<MemberEligibilityDocument> {
    const normalizedStudentId = this.normalizeStudentId(studentId);
    const normalizedRealName = this.normalizeRealName(realName);

    const entry = await this.memberEligibilityModel
      .findOne({
        teamId,
        studentId: normalizedStudentId
      })
      .exec();

    if (!entry) {
      throw new ForbiddenException({
        code: ERROR_CODES.AUTH_REGISTRATION_NOT_ELIGIBLE,
        message: 'Student ID is not eligible for registration'
      });
    }

    if (entry.realName !== normalizedRealName) {
      throw new ForbiddenException({
        code: ERROR_CODES.AUTH_REGISTRATION_REALNAME_MISMATCH,
        message: 'Real name does not match the eligibility record'
      });
    }

    if (entry.status === 'blocked') {
      throw new ForbiddenException({
        code: ERROR_CODES.AUTH_REGISTRATION_STUDENT_ID_BLOCKED,
        message: 'Student ID is blocked from registration'
      });
    }

    return entry;
  }

  listEntries(teamId: string, query: ListMemberEligibilityQuery = {}) {
    const filter: Record<string, unknown> = { teamId };

    if (query.status) {
      filter.status = query.status;
    }

    const keyword = query.keyword?.trim();
    if (keyword) {
      const escapedKeyword = keyword.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      filter.$or = [
        { studentId: { $regex: escapedKeyword, $options: 'i' } },
        { realName: { $regex: escapedKeyword, $options: 'i' } }
      ];
    }

    const limit = Math.min(Math.max(query.limit ?? 100, 1), 500);

    return this.memberEligibilityModel
      .find(filter)
      .sort({ updatedAt: -1, studentId: 1 })
      .limit(limit)
      .exec();
  }

  async createEntry(input: CreateMemberEligibilityInput) {
    const payload = {
      teamId: input.teamId,
      studentId: this.normalizeStudentId(input.studentId),
      realName: this.normalizeRealName(input.realName),
      status: input.status ?? 'allowed',
      note: this.normalizeNote(input.note)
    };

    try {
      return await this.memberEligibilityModel.create(payload);
    } catch (error: unknown) {
      if ((error as { code?: number }).code === 11000) {
        throw new ConflictException({
          code: 'MEMBER_ELIGIBILITY_DUPLICATE',
          message: 'Student ID eligibility entry already exists in team'
        });
      }
      throw error;
    }
  }

  async updateEntry(teamId: string, entryId: string, input: UpdateMemberEligibilityInput) {
    await this.assertTeamOwnership(teamId, entryId);

    const set: Record<string, unknown> = {};
    if (input.studentId !== undefined) {
      set.studentId = this.normalizeStudentId(input.studentId);
    }
    if (input.realName !== undefined) {
      set.realName = this.normalizeRealName(input.realName);
    }
    if (input.status !== undefined) {
      set.status = input.status;
    }
    if (input.note !== undefined) {
      set.note = this.normalizeNote(input.note);
    }

    try {
      const updated = await this.memberEligibilityModel
        .findOneAndUpdate({ _id: entryId, teamId }, { $set: set }, { new: true })
        .exec();

      if (!updated) {
        throw new NotFoundException('Member eligibility entry not found');
      }

      return updated;
    } catch (error: unknown) {
      if ((error as { code?: number }).code === 11000) {
        throw new ConflictException({
          code: 'MEMBER_ELIGIBILITY_DUPLICATE',
          message: 'Student ID eligibility entry already exists in team'
        });
      }
      throw error;
    }
  }

  async deleteEntry(teamId: string, entryId: string) {
    await this.assertTeamOwnership(teamId, entryId);
    await this.memberEligibilityModel.findOneAndDelete({ _id: entryId, teamId }).exec();
  }

  private async assertTeamOwnership(teamId: string, entryId: string) {
    const entry = await this.memberEligibilityModel.findById(entryId).exec();
    if (!entry) {
      throw new NotFoundException('Member eligibility entry not found');
    }

    if (entry.teamId !== teamId) {
      throw new ForbiddenException({
        code: ERROR_CODES.ATTENDANCE_CROSS_TEAM_FORBIDDEN,
        message: 'Cannot access member eligibility entries from another team'
      });
    }
  }

  private normalizeStudentId(studentId: string) {
    return studentId.trim();
  }

  private normalizeRealName(realName: string) {
    return realName.trim();
  }

  private normalizeNote(note?: string | null) {
    const normalized = note?.trim();
    return normalized ? normalized : undefined;
  }
}

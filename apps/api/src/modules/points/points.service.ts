import { BadRequestException, Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { PointLedgerEntry, PointLedgerEntryDocument } from './schemas/point-ledger-entry.schema';
import { getIsoWeekKey, getWeekKey, parseIsoWeekKey } from '../../common/utils/time.util';
import { SKIN_PRICE_POINTS } from '../../common/constants/shop.constants';
import type { AuthUser } from '../auth/types/auth-user.type';

const ATTENDANCE_POINTS_PER_MINUTE = 1;
const SECONDS_PER_MINUTE = 60;

export interface SyncAttendancePointsInput {
  teamId: string;
  userId: string;
  attendanceSessionId: string;
  weekKey: string;
  durationSeconds: number;
  isValid: boolean;
}

export interface RecordSkinUnlockExpenseInput {
  teamId: string;
  userId: string;
  skinId: string;
}

@Injectable()
export class PointsService {
  constructor(
    @InjectModel(PointLedgerEntry.name)
    private readonly pointLedgerModel: Model<PointLedgerEntryDocument>
  ) {}

  /**
   * A session's ledger row is the source of truth for attendance points. Updating
   * the row rather than incrementing a user balance makes checkout retries
   * idempotent and lets invalidated sessions be reset to zero safely.
   */
  async syncAttendancePoints(input: SyncAttendancePointsInput): Promise<number> {
    const points = input.isValid
      ? Math.floor(Math.max(0, input.durationSeconds) / SECONDS_PER_MINUTE) * ATTENDANCE_POINTS_PER_MINUTE
      : 0;

    await this.pointLedgerModel
      .findOneAndUpdate(
        { sourceAttendanceSessionId: input.attendanceSessionId },
        {
          $set: {
            teamId: input.teamId,
            userId: input.userId,
            weekKey: input.weekKey,
            sourceType: 'attendance',
            points
          }
        },
        { new: true, upsert: true, setDefaultsOnInsert: true }
      )
      .exec();

    return points;
  }

  async getUserPoints(teamId: string, userId: string) {
    const [summary] = await this.pointLedgerModel
      .aggregate<{ totalPoints: number }>([
        { $match: { teamId, userId } },
        { $group: { _id: null, totalPoints: { $sum: '$points' } } }
      ])
      .exec();

    return { totalPoints: summary?.totalPoints ?? 0 };
  }

  async findSkinUnlockExpense(userId: string, skinId: string) {
    return this.pointLedgerModel.findOne({ sourceAttendanceSessionId: this.getSkinUnlockSourceReference(userId, skinId) }).exec();
  }

  async recordSkinUnlockExpense(input: RecordSkinUnlockExpenseInput): Promise<void> {
    await this.pointLedgerModel.create({
      teamId: input.teamId,
      userId: input.userId,
      weekKey: getWeekKey(new Date()),
      sourceType: 'skin_unlock',
      sourceAttendanceSessionId: this.getSkinUnlockSourceReference(input.userId, input.skinId),
      points: -SKIN_PRICE_POINTS
    });
  }

  async getMyPoints(user: AuthUser, requestedWeek?: string) {
    const week = requestedWeek ?? getIsoWeekKey(new Date());
    const monday = parseIsoWeekKey(week);
    if (!monday) {
      throw new BadRequestException({
        code: 'POINTS_WEEK_INVALID',
        message: 'week must be a valid ISO week in YYYY-Www format'
      });
    }

    const baseMatch = { teamId: user.teamId, userId: user.userId };
    const [allTimeRows, weeklyRows] = await Promise.all([
      this.pointLedgerModel.aggregate<{ totalPoints: number }>([
        { $match: baseMatch },
        { $group: { _id: null, totalPoints: { $sum: '$points' } } }
      ]).exec(),
      this.pointLedgerModel.aggregate<{ totalPoints: number }>([
        { $match: { ...baseMatch, weekKey: monday.toFormat('yyyy-LL-dd') } },
        { $group: { _id: null, totalPoints: { $sum: '$points' } } }
      ]).exec()
    ]);

    return {
      totalPoints: allTimeRows[0]?.totalPoints ?? 0,
      week,
      weekPoints: weeklyRows[0]?.totalPoints ?? 0,
      accrualRate: { focusedMinutes: 1, points: 1 },
      calculatedAt: new Date().toISOString()
    };
  }

  async deleteUserPoints(teamId: string, userId: string): Promise<void> {
    await this.pointLedgerModel.deleteMany({ teamId, userId }).exec();
  }

  private getSkinUnlockSourceReference(userId: string, skinId: string) {
    return `skin_unlock:${userId}:${skinId}`;
  }
}

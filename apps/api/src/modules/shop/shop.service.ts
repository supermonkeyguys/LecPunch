import { BadRequestException, Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import type { AuthUser } from '../auth/types/auth-user.type';
import { PointsService } from '../points/points.service';
import { SKIN_PRICE_POINTS } from './shop.constants';
import { SkinUnlock, type SkinUnlockDocument } from './schemas/skin-unlock.schema';

interface UnlockSkinResult {
  skinId: string;
  unlockedAt: string;
  alreadyUnlocked: boolean;
  pricePoints: number;
  totalPoints: number;
}

@Injectable()
export class ShopService {
  // The deployed topology is one API process. Serialising purchases per user
  // prevents two different skins from both passing the same balance check.
  // Persistent unique indexes still make retries idempotent across restarts.
  private readonly purchaseQueues = new Map<string, Promise<void>>();

  constructor(
    @InjectModel(SkinUnlock.name)
    private readonly skinUnlockModel: Model<SkinUnlockDocument>,
    private readonly pointsService: PointsService
  ) {}

  async getUnlocks(user: AuthUser) {
    const unlocks = await this.skinUnlockModel.find({ userId: user.userId }).sort({ skinId: 1 }).lean().exec();
    return { skinIds: unlocks.map((unlock) => unlock.skinId) };
  }

  async unlock(user: AuthUser, skinId: string): Promise<UnlockSkinResult> {
    return this.withUserPurchaseLock(user.userId, async () => {
      const existing = await this.skinUnlockModel.findOne({ userId: user.userId, skinId }).exec();
      if (existing) {
        const { totalPoints } = await this.pointsService.getUserPoints(user.teamId, user.userId);
        return this.toResult(existing, true, totalPoints);
      }

      const priorExpense = await this.pointsService.findSkinUnlockExpense(user.userId, skinId);
      if (priorExpense) {
        const recovered = await this.upsertUnlock(user.userId, skinId);
        const { totalPoints } = await this.pointsService.getUserPoints(user.teamId, user.userId);
        return this.toResult(recovered, true, totalPoints);
      }

      const { totalPoints } = await this.pointsService.getUserPoints(user.teamId, user.userId);
      if (totalPoints < SKIN_PRICE_POINTS) {
        throw new BadRequestException({
          code: 'SHOP_INSUFFICIENT_POINTS',
          message: `At least ${SKIN_PRICE_POINTS} points are required to unlock a skin`,
          requiredPoints: SKIN_PRICE_POINTS,
          totalPoints
        });
      }

      let recoveredPriorExpense = false;
      try {
        await this.pointsService.recordSkinUnlockExpense({
          teamId: user.teamId,
          userId: user.userId,
          skinId
        });
      } catch (error: unknown) {
        // A duplicate source reference means another request completed the
        // expense. Recover the matching unlock instead of charging again.
        if (!this.isDuplicateKeyError(error)) {
          throw error;
        }
        recoveredPriorExpense = true;
      }

      const unlock = await this.upsertUnlock(user.userId, skinId);
      const balanceAfterUnlock = (await this.pointsService.getUserPoints(user.teamId, user.userId)).totalPoints;
      return this.toResult(unlock, recoveredPriorExpense, balanceAfterUnlock);
    });
  }

  private async upsertUnlock(userId: string, skinId: string): Promise<SkinUnlockDocument> {
    const unlockedAt = new Date();
    const unlock = await this.skinUnlockModel
      .findOneAndUpdate(
        { userId, skinId },
        { $setOnInsert: { userId, skinId, unlockedAt } },
        { new: true, upsert: true, setDefaultsOnInsert: true }
      )
      .exec();
    if (!unlock) {
      throw new Error('Skin unlock upsert did not return a record');
    }
    return unlock;
  }

  private toResult(unlock: SkinUnlockDocument, alreadyUnlocked: boolean, totalPoints: number): UnlockSkinResult {
    return {
      skinId: unlock.skinId,
      unlockedAt: unlock.unlockedAt.toISOString(),
      alreadyUnlocked,
      pricePoints: SKIN_PRICE_POINTS,
      totalPoints
    };
  }

  private isDuplicateKeyError(error: unknown): boolean {
    return typeof error === 'object' && error !== null && 'code' in error && (error as { code?: number }).code === 11000;
  }

  private async withUserPurchaseLock<T>(userId: string, action: () => Promise<T>): Promise<T> {
    const previous = this.purchaseQueues.get(userId) ?? Promise.resolve();
    let releaseCurrent!: () => void;
    const current = new Promise<void>((resolve) => {
      releaseCurrent = resolve;
    });
    this.purchaseQueues.set(userId, current);

    await previous;
    try {
      return await action();
    } finally {
      releaseCurrent();
      if (this.purchaseQueues.get(userId) === current) {
        this.purchaseQueues.delete(userId);
      }
    }
  }
}

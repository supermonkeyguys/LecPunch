import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { NotificationItem, NotificationPayloadMap, NotificationSourceType, NotificationType } from '@lecpunch/shared';
import { Model } from 'mongoose';
import { Notification, NotificationDocument } from './schemas/notification.schema';

export interface CreateNotificationInput<T extends NotificationType = NotificationType> {
  teamId: string;
  userId: string;
  type: T;
  title: string;
  message: string;
  payload: NotificationPayloadMap[T];
  sourceType: NotificationSourceType;
  sourceId: string;
  createdBy: string;
}

export interface ListNotificationsOptions {
  status?: 'unacked' | 'all';
  limit?: number;
}

export interface CreateAttendanceRecordMarkedNotificationInput {
  teamId: string;
  userId: string;
  sourceId: string;
  memberKey: string;
  weekKey: string;
  createdBy: string;
}

@Injectable()
export class NotificationsService {
  constructor(
    @InjectModel(Notification.name)
    private readonly notificationModel: Model<NotificationDocument>
  ) {}

  createModel(input: CreateNotificationInput) {
    return new this.notificationModel({
      ...input,
      acknowledgedAt: null
    });
  }

  async createForAttendanceRecordMarked(input: CreateAttendanceRecordMarkedNotificationInput) {
    const notification = await this.notificationModel.create({
      teamId: input.teamId,
      userId: input.userId,
      type: 'attendance.record_marked',
      title: '打卡记录已被标记',
      message: '管理员标记了一条你的打卡记录，请进入记录页查看详情。',
      payload: {
        recordId: input.sourceId,
        memberKey: input.memberKey,
        weekKey: input.weekKey
      },
      sourceType: 'attendance_record',
      sourceId: input.sourceId,
      createdBy: input.createdBy,
      acknowledgedAt: null
    });

    return this.toNotificationItem(notification);
  }

  async listForUser(teamId: string, userId: string, options: ListNotificationsOptions = {}) {
    const status = options.status ?? 'unacked';
    const limit = Math.min(Math.max(options.limit ?? 20, 1), 100);
    const query: Record<string, unknown> = { teamId, userId };

    if (status === 'unacked') {
      query.acknowledgedAt = null;
    }

    const notifications = await this.notificationModel.find(query).sort({ createdAt: -1 }).limit(limit).exec();
    return notifications.map((notification) => this.toNotificationItem(notification));
  }

  async acknowledge(teamId: string, userId: string, notificationId: string) {
    const notification = await this.notificationModel.findOne({ _id: notificationId, teamId, userId }).exec();
    if (!notification) {
      throw new NotFoundException('Notification not found');
    }

    if (!notification.acknowledgedAt) {
      notification.acknowledgedAt = new Date();
      await notification.save();
    }

    return this.toNotificationItem(notification);
  }

  toNotificationItem(document: Pick<NotificationDocument, 'id' | 'teamId' | 'userId' | 'type' | 'title' | 'message' | 'payload' | 'sourceType' | 'sourceId' | 'createdBy' | 'createdAt' | 'acknowledgedAt'>): NotificationItem {
    return {
      id: document.id,
      teamId: document.teamId,
      userId: document.userId,
      type: document.type,
      title: document.title,
      message: document.message,
      payload: document.payload,
      sourceType: document.sourceType,
      sourceId: document.sourceId,
      createdBy: document.createdBy,
      createdAt: document.createdAt.toISOString(),
      acknowledgedAt: document.acknowledgedAt?.toISOString() ?? null
    };
  }
}

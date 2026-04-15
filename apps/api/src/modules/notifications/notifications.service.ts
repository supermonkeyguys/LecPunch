import { Injectable } from '@nestjs/common';
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

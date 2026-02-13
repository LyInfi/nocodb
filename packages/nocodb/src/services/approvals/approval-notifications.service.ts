import { Injectable, Logger } from '@nestjs/common';
import { AppEvents } from 'nocodb-sdk';
import type { OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import type { NcRequest } from '~/interface/config';
import { AppHooksService } from '~/services/app-hooks/app-hooks.service';
import { NotificationsService } from '~/services/notifications/notifications.service';
import { MailService } from '~/services/mail/mail.service';
import { JobsService } from '~/modules/jobs/jobs.service';
import { JobTypes } from '~/interface/Jobs';
import { MailEvent } from '~/interface/Mail';

// Approval event payload interfaces
export interface ApprovalRequestedEvent {
  instanceId: string;
  flowId: string;
  modelId: string;
  rowId: string;
  stepId: string;
  approver: {
    id: string;
    email: string;
    displayName?: string;
  };
  requester: {
    id: string;
    email: string;
    displayName?: string;
  };
  base: {
    id: string;
    title: string;
  };
  table: {
    id: string;
    title: string;
  };
  title: string;
  description?: string;
  dueAt?: Date;
  req: NcRequest;
}

export interface ApprovalDecisionEvent {
  instanceId: string;
  stepId: string;
  decision: 'approved' | 'rejected';
  approver: {
    id: string;
    email: string;
    displayName?: string;
  };
  requester: {
    id: string;
    email: string;
    displayName?: string;
  };
  base: {
    id: string;
    title: string;
  };
  table: {
    id: string;
    title: string;
  };
  rowId: string;
  title: string;
  comment?: string;
  req: NcRequest;
}

export interface ApprovalCancelledEvent {
  instanceId: string;
  cancelledBy: {
    id: string;
    email: string;
    displayName?: string;
  };
  approvers: Array<{
    id: string;
    email: string;
    displayName?: string;
  }>;
  base: {
    id: string;
    title: string;
  };
  title: string;
  reason?: string;
  req: NcRequest;
}

export interface ApprovalEscalationEvent {
  instanceId: string;
  stepId: string;
  previousApprover: {
    id: string;
    email: string;
    displayName?: string;
  };
  newApprover: {
    id: string;
    email: string;
    displayName?: string;
  };
  base: {
    id: string;
    title: string;
  };
  title: string;
  escalationLevel: number;
  reason: string;
  req: NcRequest;
}

@Injectable()
export class ApprovalNotificationsService implements OnModuleInit, OnModuleDestroy {
  protected logger = new Logger(ApprovalNotificationsService.name);

  constructor(
    protected readonly appHooks: AppHooksService,
    protected readonly notificationsService: NotificationsService,
    protected readonly mailService: MailService,
    protected readonly jobsService: JobsService,
  ) {}

  /**
   * Send in-app notification for approval events
   */
  protected async sendInAppNotification(
    userId: string,
    type: AppEvents,
    body: Record<string, any>,
    req: NcRequest,
  ) {
    try {
      // Use the Notification model directly
      const { Notification } = await import('~/models');
      const { getCircularReplacer } = await import('nocodb-sdk');
      const { PubSubRedis } = await import('~/redis/pubsub-redis');

      const notification = await Notification.insert({
        fk_user_id: userId,
        type,
        body: JSON.parse(JSON.stringify(body, getCircularReplacer())),
      });

      // Publish to Redis for distributed deployments
      if (PubSubRedis.available) {
        await PubSubRedis.publish(
          `notification:${userId}`,
          JSON.stringify(notification, getCircularReplacer()),
        );
      }

      // Send to connected clients via WebSocket/long-polling
      this.notificationsService.sendToConnections(
        userId,
        JSON.stringify(notification, getCircularReplacer()),
      );

      this.logger.debug(`In-app notification sent to user ${userId} for event ${type}`);
    } catch (error) {
      this.logger.error(`Failed to send in-app notification: ${error.message}`);
    }
  }

  /**
   * Send email notification for approval events
   */
  protected async sendEmailNotification(
    mailEvent: MailEvent,
    payload: any,
  ) {
    try {
      await this.mailService.sendMail({ mailEvent, payload });
      this.logger.debug(`Email notification sent for event ${mailEvent}`);
    } catch (error) {
      this.logger.error(`Failed to send email notification: ${error.message}`);
    }
  }

  /**
   * Schedule a reminder job for approval timeout
   */
  protected async scheduleReminder(
    stepId: string,
    instanceId: string,
    approverId: string,
    dueAt: Date,
    reminderInterval: number = 24 * 60 * 60 * 1000, // Default 24 hours
  ) {
    try {
      const delay = Math.max(0, dueAt.getTime() - Date.now() - reminderInterval);

      await this.jobsService.add(
        JobTypes.ApprovalReminder,
        {
          stepId,
          instanceId,
          approverId,
          reminderCount: 0,
        },
        { delay },
      );

      this.logger.debug(`Reminder scheduled for step ${stepId} in ${delay}ms`);
    } catch (error) {
      this.logger.error(`Failed to schedule reminder: ${error.message}`);
    }
  }

  /**
   * Schedule escalation job for approval timeout
   */
  protected async scheduleEscalation(
    stepId: string,
    instanceId: string,
    escalatedToId: string,
    escalationLevel: number,
    escalateAt: Date,
  ) {
    try {
      const delay = Math.max(0, escalateAt.getTime() - Date.now());

      await this.jobsService.add(
        JobTypes.ApprovalEscalation,
        {
          stepId,
          instanceId,
          escalatedToId,
          escalationLevel,
        },
        { delay },
      );

      this.logger.debug(`Escalation scheduled for step ${stepId} in ${delay}ms`);
    } catch (error) {
      this.logger.error(`Failed to schedule escalation: ${error.message}`);
    }
  }

  /**
   * Handle approval requested event
   */
  protected async handleApprovalRequested(data: ApprovalRequestedEvent) {
    const { req, approver, requester, base, table, instanceId, stepId, title, description, dueAt } = data;

    // 1. Send in-app notification to approver
    await this.sendInAppNotification(
      approver.id,
      AppEvents.APPROVAL_REQUESTED,
      {
        instanceId,
        stepId,
        type: 'approval_requested',
        title: `New approval request: ${title}`,
        description,
        requester: {
          id: requester.id,
          email: requester.email,
          displayName: requester.displayName,
        },
        base: {
          id: base.id,
          title: base.title,
        },
        table: {
          id: table.id,
          title: table.title,
        },
        rowId: data.rowId,
        dueAt,
        createdAt: new Date(),
      },
      req,
    );

    // 2. Send email notification to approver
    await this.sendEmailNotification(MailEvent.APPROVAL_REQUESTED, {
      user: approver,
      requester,
      base,
      table,
      title,
      description,
      dueAt,
      rowId: data.rowId,
      req,
    });

    // 3. Schedule reminder if due date is set
    if (dueAt) {
      await this.scheduleReminder(stepId, instanceId, approver.id, dueAt);
    }

    this.logger.log(`Approval requested notification sent for instance ${instanceId}`);
  }

  /**
   * Handle approval decision event (approved/rejected)
   */
  protected async handleApprovalDecision(data: ApprovalDecisionEvent) {
    const { req, approver, requester, base, table, decision, title, comment, instanceId } = data;

    // 1. Send in-app notification to requester
    await this.sendInAppNotification(
      requester.id,
      decision === 'approved' ? AppEvents.APPROVAL_APPROVED : AppEvents.APPROVAL_REJECTED,
      {
        instanceId,
        type: decision === 'approved' ? 'approval_approved' : 'approval_rejected',
        title: `Your approval request was ${decision}`,
        description: title,
        approver: {
          id: approver.id,
          email: approver.email,
          displayName: approver.displayName,
        },
        base: {
          id: base.id,
          title: base.title,
        },
        table: {
          id: table.id,
          title: table.title,
        },
        rowId: data.rowId,
        comment,
        decidedAt: new Date(),
      },
      req,
    );

    // 2. Send email notification to requester
    await this.sendEmailNotification(MailEvent.APPROVAL_DECISION, {
      user: requester,
      approver,
      base,
      table,
      title,
      decision,
      comment,
      rowId: data.rowId,
      req,
    });

    this.logger.log(`Approval ${decision} notification sent for instance ${instanceId}`);
  }

  /**
   * Handle approval cancelled event
   */
  protected async handleApprovalCancelled(data: ApprovalCancelledEvent) {
    const { req, cancelledBy, approvers, base, title, reason, instanceId } = data;

    // Notify all approvers
    for (const approver of approvers) {
      // 1. Send in-app notification
      await this.sendInAppNotification(
        approver.id,
        AppEvents.APPROVAL_CANCELLED,
        {
          instanceId,
          type: 'approval_cancelled',
          title: `Approval request cancelled: ${title}`,
          description: reason,
          cancelledBy: {
            id: cancelledBy.id,
            email: cancelledBy.email,
            displayName: cancelledBy.displayName,
          },
          base: {
            id: base.id,
            title: base.title,
          },
          cancelledAt: new Date(),
        },
        req,
      );

      // 2. Send email notification
      await this.sendEmailNotification(MailEvent.APPROVAL_CANCELLED, {
        user: approver,
        cancelledBy,
        base,
        title,
        reason,
        req,
      });
    }

    this.logger.log(`Approval cancelled notification sent for instance ${instanceId}`);
  }

  /**
   * Handle approval escalation event
   */
  protected async handleApprovalEscalated(data: ApprovalEscalationEvent) {
    const { req, newApprover, base, title, escalationLevel, reason, instanceId, stepId } = data;

    // 1. Send in-app notification to new approver
    await this.sendInAppNotification(
      newApprover.id,
      AppEvents.APPROVAL_ESCALATED,
      {
        instanceId,
        stepId,
        type: 'approval_escalated',
        title: `Approval escalated to you: ${title}`,
        description: reason,
        escalationLevel,
        base: {
          id: base.id,
          title: base.title,
        },
        escalatedAt: new Date(),
      },
      req,
    );

    // 2. Send email notification to new approver
    await this.sendEmailNotification(MailEvent.APPROVAL_ESCALATED, {
      user: newApprover,
      base,
      title,
      escalationLevel,
      reason,
      req,
    });

    this.logger.log(`Approval escalation notification sent for instance ${instanceId}`);
  }

  /**
   * Handle approval reminder event
   */
  protected async handleApprovalReminder(
    stepId: string,
    instanceId: string,
    approverId: string,
  ) {
    // This is called by the job processor
    // Get approval details from database and send reminder
    this.logger.log(`Approval reminder triggered for step ${stepId}`);
  }

  /**
   * Main hook handler for all approval events
   */
  protected async hookHandler({
    event,
    data,
  }: {
    event: AppEvents;
    data: any;
  }) {
    switch (event) {
      case AppEvents.APPROVAL_REQUESTED:
        await this.handleApprovalRequested(data as ApprovalRequestedEvent);
        break;
      case AppEvents.APPROVAL_APPROVED:
      case AppEvents.APPROVAL_REJECTED:
        await this.handleApprovalDecision(data as ApprovalDecisionEvent);
        break;
      case AppEvents.APPROVAL_CANCELLED:
        await this.handleApprovalCancelled(data as ApprovalCancelledEvent);
        break;
      case AppEvents.APPROVAL_ESCALATED:
        await this.handleApprovalEscalated(data as ApprovalEscalationEvent);
        break;
      case AppEvents.APPROVAL_REMINDER:
        // Handled by job processor
        break;
    }
  }

  onModuleInit() {
    // Register event listeners for approval events
    this.appHooks.on(AppEvents.APPROVAL_REQUESTED, (data) =>
      this.hookHandler({ event: AppEvents.APPROVAL_REQUESTED, data }),
    );
    this.appHooks.on(AppEvents.APPROVAL_APPROVED, (data) =>
      this.hookHandler({ event: AppEvents.APPROVAL_APPROVED, data }),
    );
    this.appHooks.on(AppEvents.APPROVAL_REJECTED, (data) =>
      this.hookHandler({ event: AppEvents.APPROVAL_REJECTED, data }),
    );
    this.appHooks.on(AppEvents.APPROVAL_CANCELLED, (data) =>
      this.hookHandler({ event: AppEvents.APPROVAL_CANCELLED, data }),
    );
    this.appHooks.on(AppEvents.APPROVAL_ESCALATED, (data) =>
      this.hookHandler({ event: AppEvents.APPROVAL_ESCALATED, data }),
    );

    this.logger.log('ApprovalNotificationsService initialized');
  }

  onModuleDestroy() {
    this.appHooks.removeAllListener(this.hookHandler);
  }
}

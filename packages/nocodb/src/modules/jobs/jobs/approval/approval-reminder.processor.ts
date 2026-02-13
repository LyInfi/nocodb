import { Injectable, Logger } from '@nestjs/common';
import { Job } from 'bull';
import { AppEvents } from 'nocodb-sdk';
import { JobTypes } from '~/interface/Jobs';
import type { ApprovalReminderJobData } from '~/interface/Jobs';
import { JobsService } from '~/modules/jobs/jobs.service';
import { MailService } from '~/services/mail/mail.service';
import { MailEvent } from '~/interface/Mail';

/**
 * Processor for approval reminder jobs
 * Handles sending reminder notifications for pending approvals
 */
@Injectable()
export class ApprovalReminderProcessor {
  protected logger = new Logger(ApprovalReminderProcessor.name);

  // Maximum number of reminders to send before escalating
  protected readonly MAX_REMINDERS = 3;
  // Interval between reminders (24 hours)
  protected readonly REMINDER_INTERVAL = 24 * 60 * 60 * 1000;

  constructor(
    protected readonly jobsService: JobsService,
    protected readonly mailService: MailService,
  ) {}

  /**
   * Main job handler - called by Bull when job is processed
   */
  async job(job: Job<ApprovalReminderJobData>) {
    const { stepId, instanceId, approverId, reminderCount, context, user, req } = job.data;

    this.logger.log(
      `Processing approval reminder for step ${stepId}, reminder #${reminderCount + 1}`,
    );

    try {
      // Get approval step details from database
      const step = await this.getApprovalStep(stepId);
      if (!step) {
        this.logger.warn(`Approval step ${stepId} not found, skipping reminder`);
        return { success: false, reason: 'step_not_found' };
      }

      // Check if step is still pending
      if (step.status !== 'pending') {
        this.logger.log(`Step ${stepId} is no longer pending (${step.status}), skipping reminder`);
        return { success: false, reason: 'not_pending' };
      }

      // Get approver details
      const approver = await this.getUser(approverId);
      if (!approver) {
        this.logger.warn(`Approver ${approverId} not found, skipping reminder`);
        return { success: false, reason: 'approver_not_found' };
      }

      // Get instance details
      const instance = await this.getApprovalInstance(instanceId);
      if (!instance) {
        this.logger.warn(`Instance ${instanceId} not found, skipping reminder`);
        return { success: false, reason: 'instance_not_found' };
      }

      // Send reminder notification
      await this.sendReminderNotification(step, instance, approver, reminderCount, req);

      // Schedule next reminder if not at max
      if (reminderCount + 1 < this.MAX_REMINDERS) {
        await this.scheduleNextReminder(stepId, instanceId, approverId, reminderCount + 1);
      } else {
        this.logger.log(`Max reminders reached for step ${stepId}, triggering escalation`);
        await this.triggerEscalation(stepId, instanceId, context);
      }

      return { success: true, reminderCount: reminderCount + 1 };
    } catch (error) {
      this.logger.error(`Failed to process approval reminder: ${error.message}`);
      throw error;
    }
  }

  /**
   * Get approval step from database
   */
  protected async getApprovalStep(stepId: string) {
    try {
      // Import dynamically to avoid circular dependencies
      const { default: ncMeta } = await import('~/meta/NcMeta');
      const step = await ncMeta.metaGet2(
        null, // context
        null, // baseId
        'nc_approval_steps',
        stepId,
      );
      return step;
    } catch (error) {
      this.logger.error(`Failed to get approval step: ${error.message}`);
      return null;
    }
  }

  /**
   * Get user from database
   */
  protected async getUser(userId: string) {
    try {
      const { User } = await import('~/models');
      return await User.get({ id: userId });
    } catch (error) {
      this.logger.error(`Failed to get user: ${error.message}`);
      return null;
    }
  }

  /**
   * Get approval instance from database
   */
  protected async getApprovalInstance(instanceId: string) {
    try {
      const { default: ncMeta } = await import('~/meta/NcMeta');
      const instance = await ncMeta.metaGet2(
        null,
        null,
        'nc_approval_instances',
        instanceId,
      );
      return instance;
    } catch (error) {
      this.logger.error(`Failed to get approval instance: ${error.message}`);
      return null;
    }
  }

  /**
   * Send reminder notification (in-app + email)
   */
  protected async sendReminderNotification(
    step: any,
    instance: any,
    approver: any,
    reminderCount: number,
    req: any,
  ) {
    // 1. Send in-app notification
    try {
      const { Notification } = await import('~/models');
      const { getCircularReplacer } = await import('nocodb-sdk');
      const { PubSubRedis } = await import('~/redis/pubsub-redis');

      const notification = await Notification.insert({
        fk_user_id: approver.id,
        type: AppEvents.APPROVAL_REMINDER,
        body: {
          type: 'approval_reminder',
          instanceId: instance.id,
          stepId: step.id,
          title: `Reminder: Approval request is pending`,
          description: `You have a pending approval that requires your attention. Reminder #${reminderCount + 1}`,
          reminderCount: reminderCount + 1,
          base: instance.base,
          dueAt: step.due_at,
          createdAt: new Date(),
        },
      });

      // Publish to Redis for real-time updates
      if (PubSubRedis.available) {
        await PubSubRedis.publish(
          `notification:${approver.id}`,
          JSON.stringify(notification, getCircularReplacer()),
        );
      }

      this.logger.debug(`In-app reminder sent to user ${approver.id}`);
    } catch (error) {
      this.logger.error(`Failed to send in-app reminder: ${error.message}`);
    }

    // 2. Send email reminder
    try {
      await this.mailService.sendMail({
        mailEvent: MailEvent.APPROVAL_REMINDER,
        payload: {
          user: approver,
          step,
          instance,
          reminderCount: reminderCount + 1,
          req,
        },
      });
      this.logger.debug(`Email reminder sent to ${approver.email}`);
    } catch (error) {
      this.logger.error(`Failed to send email reminder: ${error.message}`);
    }
  }

  /**
   * Schedule the next reminder job
   */
  protected async scheduleNextReminder(
    stepId: string,
    instanceId: string,
    approverId: string,
    nextReminderCount: number,
  ) {
    await this.jobsService.add(
      JobTypes.ApprovalReminder,
      {
        stepId,
        instanceId,
        approverId,
        reminderCount: nextReminderCount,
      },
      { delay: this.REMINDER_INTERVAL },
    );

    this.logger.log(`Next reminder scheduled for step ${stepId} in ${this.REMINDER_INTERVAL}ms`);
  }

  /**
   * Trigger escalation when max reminders reached
   */
  protected async triggerEscalation(
    stepId: string,
    instanceId: string,
    context: any,
  ) {
    // This would trigger an escalation job
    // Implementation depends on escalation logic
    this.logger.log(`Triggering escalation for step ${stepId}`);

    // TODO: Implement escalation logic
    // This could involve:
    // 1. Finding the next level approver
    // 2. Creating an escalation job
    // 3. Notifying the original approver about escalation
  }
}

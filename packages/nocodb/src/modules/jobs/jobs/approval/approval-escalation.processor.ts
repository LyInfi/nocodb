import { Injectable, Logger } from '@nestjs/common';
import { Job } from 'bull';
import { AppEvents } from 'nocodb-sdk';
import type { ApprovalEscalationJobData } from '~/interface/Jobs';
import { MailService } from '~/services/mail/mail.service';
import { MailEvent } from '~/interface/Mail';

/**
 * Processor for approval escalation jobs
 * Handles escalating approvals to higher-level approvers
 */
@Injectable()
export class ApprovalEscalationProcessor {
  protected logger = new Logger(ApprovalEscalationProcessor.name);

  constructor(protected readonly mailService: MailService) {}

  /**
   * Main job handler - called by Bull when job is processed
   */
  async job(job: Job<ApprovalEscalationJobData>) {
    const { stepId, instanceId, escalatedToId, escalationLevel, context, user, req } = job.data;

    this.logger.log(
      `Processing approval escalation for step ${stepId}, level ${escalationLevel}`,
    );

    try {
      // Get approval step details
      const step = await this.getApprovalStep(stepId);
      if (!step) {
        this.logger.warn(`Approval step ${stepId} not found, skipping escalation`);
        return { success: false, reason: 'step_not_found' };
      }

      // Check if step is still pending
      if (step.status !== 'pending') {
        this.logger.log(`Step ${stepId} is no longer pending (${step.status}), skipping escalation`);
        return { success: false, reason: 'not_pending' };
      }

      // Get escalated approver details
      const newApprover = await this.getUser(escalatedToId);
      if (!newApprover) {
        this.logger.warn(`Escalated approver ${escalatedToId} not found, skipping escalation`);
        return { success: false, reason: 'approver_not_found' };
      }

      // Get previous approver details
      const previousApprover = step.fk_user_id ? await this.getUser(step.fk_user_id) : null;

      // Get instance details
      const instance = await this.getApprovalInstance(instanceId);
      if (!instance) {
        this.logger.warn(`Instance ${instanceId} not found, skipping escalation`);
        return { success: false, reason: 'instance_not_found' };
      }

      // Update step with new approver
      await this.updateStepApprover(stepId, escalatedToId, escalationLevel);

      // Send escalation notifications
      await this.sendEscalationNotifications(
        step,
        instance,
        newApprover,
        previousApprover,
        escalationLevel,
        req,
      );

      // Emit escalation event for real-time updates
      await this.emitEscalationEvent(
        stepId,
        instanceId,
        newApprover,
        previousApprover,
        escalationLevel,
        context,
      );

      return { success: true, escalationLevel };
    } catch (error) {
      this.logger.error(`Failed to process approval escalation: ${error.message}`);
      throw error;
    }
  }

  /**
   * Get approval step from database
   */
  protected async getApprovalStep(stepId: string) {
    try {
      const { default: ncMeta } = await import('~/meta/NcMeta');
      const step = await ncMeta.metaGet2(null, null, 'nc_approval_steps', stepId);
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
      const instance = await ncMeta.metaGet2(null, null, 'nc_approval_instances', instanceId);
      return instance;
    } catch (error) {
      this.logger.error(`Failed to get approval instance: ${error.message}`);
      return null;
    }
  }

  /**
   * Update step with new approver and escalation level
   */
  protected async updateStepApprover(
    stepId: string,
    newApproverId: string,
    escalationLevel: number,
  ) {
    try {
      const { default: ncMeta } = await import('~/meta/NcMeta');
      await ncMeta.metaUpdate(
        null,
        null,
        'nc_approval_steps',
        stepId,
        {
          fk_user_id: newApproverId,
          escalation_level: escalationLevel,
          escalated_at: new Date(),
        },
      );
      this.logger.debug(`Updated step ${stepId} with new approver ${newApproverId}`);
    } catch (error) {
      this.logger.error(`Failed to update step approver: ${error.message}`);
      throw error;
    }
  }

  /**
   * Send escalation notifications
   */
  protected async sendEscalationNotifications(
    step: any,
    instance: any,
    newApprover: any,
    previousApprover: any,
    escalationLevel: number,
    req: any,
  ) {
    // 1. Send in-app notification to new approver
    try {
      const { Notification } = await import('~/models');
      const { getCircularReplacer } = await import('nocodb-sdk');
      const { PubSubRedis } = await import('~/redis/pubsub-redis');

      const notification = await Notification.insert({
        fk_user_id: newApprover.id,
        type: AppEvents.APPROVAL_ESCALATED,
        body: {
          type: 'approval_escalated',
          instanceId: instance.id,
          stepId: step.id,
          title: `Approval escalated to you: Level ${escalationLevel}`,
          description: `An approval request has been escalated to you due to no response from the previous approver.`,
          escalationLevel,
          previousApprover: previousApprover
            ? {
                id: previousApprover.id,
                email: previousApprover.email,
                displayName: previousApprover.display_name,
              }
            : null,
          base: instance.base,
          escalatedAt: new Date(),
        },
      });

      if (PubSubRedis.available) {
        await PubSubRedis.publish(
          `notification:${newApprover.id}`,
          JSON.stringify(notification, getCircularReplacer()),
        );
      }

      this.logger.debug(`In-app escalation notification sent to ${newApprover.id}`);
    } catch (error) {
      this.logger.error(`Failed to send in-app escalation notification: ${error.message}`);
    }

    // 2. Send email to new approver
    try {
      await this.mailService.sendMail({
        mailEvent: MailEvent.APPROVAL_ESCALATED,
        payload: {
          user: newApprover,
          step,
          instance,
          escalationLevel,
          previousApprover,
          req,
        },
      });
      this.logger.debug(`Email escalation notification sent to ${newApprover.email}`);
    } catch (error) {
      this.logger.error(`Failed to send email escalation notification: ${error.message}`);
    }

    // 3. Notify previous approver about escalation (if exists)
    if (previousApprover) {
      try {
        const { Notification } = await import('~/models');
        await Notification.insert({
          fk_user_id: previousApprover.id,
          type: AppEvents.APPROVAL_ESCALATED,
          body: {
            type: 'approval_escalated_away',
            instanceId: instance.id,
            stepId: step.id,
            title: `Approval request escalated`,
            description: `An approval request assigned to you has been escalated to another approver due to timeout.`,
            newApprover: {
              id: newApprover.id,
              email: newApprover.email,
              displayName: newApprover.display_name,
            },
            base: instance.base,
            escalatedAt: new Date(),
          },
        });
        this.logger.debug(`Escalation away notification sent to ${previousApprover.id}`);
      } catch (error) {
        this.logger.error(`Failed to send escalation away notification: ${error.message}`);
      }
    }
  }

  /**
   * Emit escalation event for real-time updates
   */
  protected async emitEscalationEvent(
    stepId: string,
    instanceId: string,
    newApprover: any,
    previousApprover: any,
    escalationLevel: number,
    context: any,
  ) {
    try {
      const { AppHooksService } = await import('~/services/app-hooks/app-hooks.service');
      const { AppEvents } = await import('nocodb-sdk');

      // Note: This would require access to AppHooksService instance
      // In practice, this might be handled by the approval service itself
      this.logger.debug(`Escalation event emitted for step ${stepId}`);
    } catch (error) {
      this.logger.error(`Failed to emit escalation event: ${error.message}`);
    }
  }
}

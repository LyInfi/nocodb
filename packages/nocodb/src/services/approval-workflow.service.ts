import { Injectable, Logger } from '@nestjs/common';
import type { NcContext, NcRequest } from '~/interface/config';
import {
  ApprovalWorkflow,
  ApprovalInstance,
  DeptLeader,
  ApprovalHistory,
  Model,
} from '~/models';
import { NcError } from '~/helpers/catchError';
import { DatasService } from './datas.service';

export interface ProjectApprovalConfig {
  project_type: string;
  amount_threshold?: number;
  dept_id: string;
  applicant_id: string;
}

export interface ApprovalWorkflowConfig {
  steps: Array<{
    step: number;
    name: string;
    approver_type: 'dept_leader' | 'role' | 'specific_user';
    approver_role?: string;
    approver_users?: string[];
    condition?: {
      field: string;
      operator: string;
      value: any;
    };
  }>;
  auto_approve_threshold?: number;
  require_all_approvers?: boolean;
}

@Injectable()
export class ApprovalWorkflowService {
  protected logger = new Logger(ApprovalWorkflowService.name);

  constructor(protected readonly datasService: DatasService) {}

  /**
   * Get approval workflow by project type
   */
  async getWorkflowByProjectType(
    context: NcContext,
    projectType: string,
  ): Promise<ApprovalWorkflow | null> {
    return await ApprovalWorkflow.getByProjectType(context, projectType);
  }

  /**
   * Create a new approval workflow
   */
  async createWorkflow(
    context: NcContext,
    param: {
      name: string;
      description?: string;
      project_type: string;
      workflow_config: ApprovalWorkflowConfig;
    },
    req: NcRequest,
  ): Promise<ApprovalWorkflow> {
    if (context.schema_locked) {
      NcError.get(context).schemaLocked();
    }

    // Check if workflow already exists for this project type
    const existing = await ApprovalWorkflow.getByProjectType(
      context,
      param.project_type,
    );
    if (existing) {
      NcError.get(context).badRequest(
        `Workflow already exists for project type: ${param.project_type}`,
      );
    }

    return await ApprovalWorkflow.insert(context, {
      ...param,
      base_id: context.base_id,
      is_active: true,
      version: 1,
    });
  }

  /**
   * Update approval workflow
   */
  async updateWorkflow(
    context: NcContext,
    workflowId: string,
    param: {
      name?: string;
      description?: string;
      workflow_config?: ApprovalWorkflowConfig;
      is_active?: boolean;
    },
    req: NcRequest,
  ): Promise<ApprovalWorkflow> {
    if (context.schema_locked) {
      NcError.get(context).schemaLocked();
    }

    const workflow = await ApprovalWorkflow.get(context, workflowId);
    if (!workflow) {
      NcError.get(context).badRequest('Workflow not found');
    }

    return await ApprovalWorkflow.update(context, workflowId, {
      ...param,
      version: (workflow.version || 1) + 1,
    });
  }

  /**
   * List all workflows
   */
  async listWorkflows(
    context: NcContext,
    param: { is_active?: boolean } = {},
  ): Promise<ApprovalWorkflow[]> {
    return await ApprovalWorkflow.list(context, {
      base_id: context.base_id,
      ...param,
    });
  }

  /**
   * Delete a workflow
   */
  async deleteWorkflow(
    context: NcContext,
    workflowId: string,
    req: NcRequest,
  ): Promise<boolean> {
    if (context.schema_locked) {
      NcError.get(context).schemaLocked();
    }

    const workflow = await ApprovalWorkflow.get(context, workflowId);
    if (!workflow) {
      NcError.get(context).badRequest('Workflow not found');
    }

    // Check for active instances
    const activeInstances = await ApprovalInstance.list(context, {
      fk_workflow_id: workflowId,
      status: 'pending',
    });

    if (activeInstances.length > 0) {
      NcError.get(context).badRequest(
        'Cannot delete workflow with active approval instances',
      );
    }

    return await ApprovalWorkflow.delete(context, workflowId);
  }

  /**
   * Trigger approval workflow for a project
   */
  async triggerApproval(
    context: NcContext,
    param: {
      modelId: string;
      rowId: string;
      project_type: string;
      dept_id: string;
      applicant_id: string;
      amount?: number;
    },
    req: NcRequest,
  ): Promise<ApprovalInstance> {
    // 1. Get workflow by project type
    const workflow = await ApprovalWorkflow.getByProjectType(
      context,
      param.project_type,
    );

    if (!workflow) {
      this.logger.warn(
        `No workflow found for project type: ${param.project_type}`,
      );
      throw new Error(`No workflow found for project type: ${param.project_type}`);
    }

    // 2. Parse workflow config
    const config: ApprovalWorkflowConfig =
      typeof workflow.workflow_config === 'string'
        ? JSON.parse(workflow.workflow_config)
        : workflow.workflow_config || { steps: [] };

    // 3. Get department leaders
    const deptLeaders = await DeptLeader.getLeadersForApproval(
      context,
      param.dept_id,
    );

    if (!deptLeaders.length) {
      this.logger.warn(`No leaders found for department: ${param.dept_id}`);
      throw new Error(`No leaders found for department: ${param.dept_id}`);
    }

    // 4. Determine approvers based on workflow steps
    const currentApprovers = this.determineApprovers(
      config,
      deptLeaders,
      param,
    );

    // 5. Create approval instance
    const instance = await ApprovalInstance.insert(context, {
      fk_workflow_id: workflow.id,
      fk_model_id: param.modelId,
      row_id: param.rowId,
      status: 'pending',
      current_approvers: currentApprovers,
      approved_by: [],
      rejected_by: [],
      current_step: 1,
      total_steps: config.steps.length || 1,
      base_id: context.base_id,
      created_by: req.user?.id,
    });

    // 6. Log the submission
    await ApprovalHistory.insert(context, {
      fk_instance_id: instance.id,
      action: 'submit',
      action_by: req.user?.id,
      comments: `Project submitted for approval. Project type: ${param.project_type}`,
      action_data: {
        project_type: param.project_type,
        dept_id: param.dept_id,
        amount: param.amount,
      },
      base_id: context.base_id,
    });

    // 7. Update project status to pending
    await this.updateProjectStatus(
      context,
      param.modelId,
      param.rowId,
      'pending',
    );

    return instance;
  }

  /**
   * Approve a project
   */
  async approveProject(
    context: NcContext,
    param: {
      instanceId: string;
      comments?: string;
    },
    req: NcRequest,
  ): Promise<ApprovalInstance> {
    const instance = await ApprovalInstance.get(context, param.instanceId);
    if (!instance) {
      NcError.get(context).badRequest('Approval instance not found');
    }

    if (instance.status !== 'pending') {
      NcError.get(context).badRequest(
        `Approval is already ${instance.status}`,
      );
    }

    // Check if user is in current approvers
    if (!instance.current_approvers?.includes(req.user?.id)) {
      NcError.get(context).unauthorized(
        'You are not authorized to approve this project',
      );
    }

    // Update approved_by list
    const approvedBy = [...(instance.approved_by || []), req.user?.id];

    // Check if all required approvers have approved
    const allApproved = instance.current_approvers.every((approver) =>
      approvedBy.includes(approver),
    );

    let updatedInstance = instance;

    if (allApproved) {
      // Check if there are more steps
      if (instance.current_step < instance.total_steps) {
        // Move to next step
        const workflow = await ApprovalWorkflow.get(
          context,
          instance.fk_workflow_id,
        );
        const config: ApprovalWorkflowConfig =
          typeof workflow.workflow_config === 'string'
            ? JSON.parse(workflow.workflow_config)
            : workflow.workflow_config;

        const nextStepApprovers = await this.getApproversForStep(
          context,
          config,
          instance.current_step + 1,
        );

        updatedInstance = await ApprovalInstance.update(context, param.instanceId, {
          current_step: instance.current_step + 1,
          current_approvers: nextStepApprovers,
          approved_by: [],
        });
      } else {
        // Complete approval
        updatedInstance = await ApprovalInstance.updateStatus(
          context,
          param.instanceId,
          'approved',
        );

        // Update project status
        await this.updateProjectStatus(
          context,
          instance.fk_model_id,
          instance.row_id,
          'approved',
        );
      }
    } else {
      // Just update approved_by list
      updatedInstance = await ApprovalInstance.update(context, param.instanceId, {
        approved_by: approvedBy,
      });
    }

    // Log the approval
    await ApprovalHistory.insert(context, {
      fk_instance_id: param.instanceId,
      action: 'approve',
      action_by: req.user?.id,
      comments: param.comments,
      base_id: context.base_id,
    });

    return updatedInstance;
  }

  /**
   * Reject a project
   */
  async rejectProject(
    context: NcContext,
    param: {
      instanceId: string;
      comments?: string;
    },
    req: NcRequest,
  ): Promise<ApprovalInstance> {
    const instance = await ApprovalInstance.get(context, param.instanceId);
    if (!instance) {
      NcError.get(context).badRequest('Approval instance not found');
    }

    if (instance.status !== 'pending') {
      NcError.get(context).badRequest(
        `Approval is already ${instance.status}`,
      );
    }

    // Check if user is in current approvers
    if (!instance.current_approvers?.includes(req.user?.id)) {
      NcError.get(context).unauthorized(
        'You are not authorized to reject this project',
      );
    }

    // Update instance status
    const updatedInstance = await ApprovalInstance.updateStatus(
      context,
      param.instanceId,
      'rejected',
    );

    // Update project status
    await this.updateProjectStatus(
      context,
      instance.fk_model_id,
      instance.row_id,
      'rejected',
    );

    // Log the rejection
    await ApprovalHistory.insert(context, {
      fk_instance_id: param.instanceId,
      action: 'reject',
      action_by: req.user?.id,
      comments: param.comments,
      base_id: context.base_id,
    });

    return updatedInstance;
  }

  /**
   * Get pending approvals for a user
   */
  async getPendingApprovals(
    context: NcContext,
    userId: string,
  ): Promise<ApprovalInstance[]> {
    return await ApprovalInstance.listPendingForUser(context, userId);
  }

  /**
   * Get approval history for an instance
   */
  async getApprovalHistory(
    context: NcContext,
    instanceId: string,
  ): Promise<ApprovalHistory[]> {
    return await ApprovalHistory.listByInstance(context, instanceId);
  }

  /**
   * Department leaders management
   */
  async addDeptLeader(
    context: NcContext,
    param: {
      dept_id: string;
      dept_name?: string;
      leader_id: string;
      leader_role?: 'primary' | 'secondary' | 'backup';
      approval_order?: number;
    },
    req: NcRequest,
  ): Promise<DeptLeader> {
    if (context.schema_locked) {
      NcError.get(context).schemaLocked();
    }

    return await DeptLeader.insert(context, {
      ...param,
      base_id: context.base_id,
      is_active: true,
    });
  }

  async updateDeptLeader(
    context: NcContext,
    leaderId: string,
    param: {
      dept_name?: string;
      leader_role?: 'primary' | 'secondary' | 'backup';
      approval_order?: number;
      is_active?: boolean;
    },
    req: NcRequest,
  ): Promise<DeptLeader> {
    if (context.schema_locked) {
      NcError.get(context).schemaLocked();
    }

    return await DeptLeader.update(context, leaderId, param);
  }

  async deleteDeptLeader(
    context: NcContext,
    leaderId: string,
    req: NcRequest,
  ): Promise<boolean> {
    if (context.schema_locked) {
      NcError.get(context).schemaLocked();
    }

    return await DeptLeader.delete(context, leaderId);
  }

  async getDeptLeaders(
    context: NcContext,
    deptId: string): Promise<DeptLeader[]> {
    return await DeptLeader.getByDeptId(context, deptId);
  }

  /**
   * Helper methods
   */
  private determineApprovers(
    config: ApprovalWorkflowConfig,
    deptLeaders: string[],
    param: {
      project_type: string;
      dept_id: string;
      amount?: number;
    },
  ): string[] {
    if (!config.steps || config.steps.length === 0) {
      return deptLeaders;
    }

    const firstStep = config.steps[0];

    // Check conditions
    if (firstStep.condition) {
      const { field, operator, value } = firstStep.condition;
      if (field === 'amount') {
        const amount = param.amount || 0;
        switch (operator) {
          case 'lt':
            if (!(amount < value)) return [];
            break;
          case 'gt':
            if (!(amount > value)) return [];
            break;
          case 'eq':
            if (amount !== value) return [];
            break;
        }
      }
    }

    // Return approvers based on approver_type
    switch (firstStep.approver_type) {
      case 'dept_leader':
        return deptLeaders;
      case 'specific_user':
        return firstStep.approver_users || deptLeaders;
      default:
        return deptLeaders;
    }
  }

  private async getApproversForStep(
    context: NcContext,
    config: ApprovalWorkflowConfig,
    step: number,
  ): Promise<string[]> {
    const stepConfig = config.steps.find((s) => s.step === step);
    if (!stepConfig) return [];

    switch (stepConfig.approver_type) {
      case 'specific_user':
        return stepConfig.approver_users || [];
      case 'role':
        // TODO: Implement role-based approver lookup
        return [];
      default:
        return [];
    }
  }

  private async updateProjectStatus(
    context: NcContext,
    modelId: string,
    rowId: string,
    status: string,
  ): Promise<void> {
    try {
      await this.datasService.dataUpdate(context, {
        body: { status },
        rowId,
        baseName: context.base_id,
        tableName: modelId,
      });
    } catch (e) {
      this.logger.error(`Failed to update project status: ${e.message}`);
    }
  }
}

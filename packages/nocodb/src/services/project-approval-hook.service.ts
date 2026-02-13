import { Inject, Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { IEventEmitter } from '~/modules/event-emitter/event-emitter.interface';
import { ApprovalWorkflowService } from './approval-workflow.service';
import { Model, View } from '~/models';
import { HANDLE_WEBHOOK } from './hook-handler.service';
import type { NcContext } from '~/interface/config';

export const PROJECT_TABLE_NAME = 'projects';
export const PROJECT_TYPE_FIELD = 'project_type';
export const DEPT_ID_FIELD = 'dept_id';
export const APPLICANT_ID_FIELD = 'applicant_id';
export const AMOUNT_FIELD = 'amount';

interface ProjectData {
  id?: string;
  project_type?: string;
  dept_id?: string;
  applicant_id?: string;
  amount?: number;
  [key: string]: any;
}

@Injectable()
export class ProjectApprovalHookService implements OnModuleInit, OnModuleDestroy {
  protected logger = new Logger(ProjectApprovalHookService.name);
  protected unsubscribe: () => void;

  constructor(
    @Inject('IEventEmitter') protected readonly eventEmitter: IEventEmitter,
    protected readonly approvalWorkflowService: ApprovalWorkflowService,
  ) {}

  onModuleInit(): void {
    this.unsubscribe = this.eventEmitter.on(HANDLE_WEBHOOK, async (arg) => {
      try {
        await this.handleProjectHook(arg);
      } catch (e) {
        this.logger.error({
          error: e,
          details: 'Error while handling project approval hook',
        });
      }
    });
  }

  onModuleDestroy() {
    this.unsubscribe?.();
  }

  /**
   * Handle webhook events for project tables
   */
  protected async handleProjectHook(arg: {
    context: NcContext;
    hookName: string;
    prevData: any;
    newData: any;
    user: any;
    viewId: string;
    modelId: string;
    tnPath: string;
  }): Promise<void> {
    const { context, hookName, newData, user, modelId } = arg;

    // Only process after.insert events
    if (hookName !== 'after.insert') {
      return;
    }

    // Get the model to check if it's a projects table
    const model = await Model.get(context, modelId);
    if (!model) {
      return;
    }

    // Check if this is a projects table (case-insensitive)
    const tableName = model.title?.toLowerCase() || '';
    if (!this.isProjectTable(tableName)) {
      return;
    }

    this.logger.log(`Processing project approval for table: ${model.title}`);

    // Extract project data
    const projectData = this.extractProjectData(newData);

    // Validate required fields
    if (!projectData.project_type || !projectData.dept_id) {
      this.logger.warn(
        `Missing required fields for project approval. project_type: ${projectData.project_type}, dept_id: ${projectData.dept_id}`,
      );
      return;
    }

    try {
      // Check if workflow exists for this project type
      const workflow = await this.approvalWorkflowService.getWorkflowByProjectType(
        context,
        projectData.project_type,
      );

      if (!workflow) {
        this.logger.log(
          `No approval workflow configured for project type: ${projectData.project_type}`,
        );
        return;
      }

      // Trigger approval workflow
      const rowId = this.extractRowId(newData, model);
      if (!rowId) {
        this.logger.error('Could not extract row ID from project data');
        return;
      }

      await this.approvalWorkflowService.triggerApproval(
        context,
        {
          modelId,
          rowId,
          project_type: projectData.project_type,
          dept_id: projectData.dept_id,
          applicant_id: projectData.applicant_id || user?.id,
          amount: projectData.amount,
        },
        {
          user,
          ncSiteUrl: context.nc_site_url,
        } as any,
      );

      this.logger.log(
        `Approval workflow triggered for project ${rowId} of type ${projectData.project_type}`,
      );
    } catch (e) {
      this.logger.error({
        error: e,
        details: 'Failed to trigger approval workflow',
        projectData,
      });
    }
  }

  /**
   * Check if table is a project table
   */
  protected isProjectTable(tableName: string): boolean {
    const projectTablePatterns = [
      'projects',
      'project',
      '科研项目',
      '项目',
      'research_project',
      '科研立项',
    ];
    return projectTablePatterns.some((pattern) =>
      tableName.includes(pattern.toLowerCase()),
    );
  }

  /**
   * Extract project data from inserted record
   */
  protected extractProjectData(data: any): ProjectData {
    // Handle both aliased and column-name based data
    const projectType =
      data[PROJECT_TYPE_FIELD] ||
      data.project_type ||
      data.ProjectType ||
      data['项目类型'];

    const deptId =
      data[DEPT_ID_FIELD] ||
      data.dept_id ||
      data.DeptId ||
      data.DepartmentId ||
      data['部门ID'] ||
      data['部门'];

    const applicantId =
      data[APPLICANT_ID_FIELD] ||
      data.applicant_id ||
      data.ApplicantId ||
      data['申请人ID'] ||
      data['申请人'];

    const amount =
      data[AMOUNT_FIELD] ||
      data.amount ||
      data.Amount ||
      data['金额'] ||
      data['项目金额'];

    return {
      ...data,
      project_type: projectType,
      dept_id: deptId,
      applicant_id: applicantId,
      amount: amount ? parseFloat(amount) : undefined,
    };
  }

  /**
   * Extract row ID from data based on model primary key
   */
  protected extractRowId(data: any, model: Model): string | null {
    // Try common ID fields
    const idFields = ['Id', 'ID', 'id', 'RowId', 'row_id', '编号'];

    for (const field of idFields) {
      if (data[field] !== undefined && data[field] !== null) {
        return String(data[field]);
      }
    }

    // Use model primary key if available
    if (model.primaryKey?.title && data[model.primaryKey.title] !== undefined) {
      return String(data[model.primaryKey.title]);
    }

    // Return first non-null value that looks like an ID
    for (const key of Object.keys(data)) {
      if (
        key.toLowerCase().includes('id') &&
        data[key] !== undefined &&
        data[key] !== null
      ) {
        return String(data[key]);
      }
    }

    return null;
  }
}

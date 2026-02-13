import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  Patch,
  Post,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import { GlobalGuard } from '~/guards/global/global.guard';
import { MetaApiLimiterGuard } from '~/guards/meta-api-limiter.guard';
import { Acl } from '~/middlewares/extract-ids/extract-ids.middleware';
import { TenantContext } from '~/decorators/tenant-context.decorator';
import { NcContext, NcRequest } from '~/interface/config';
import { ApprovalWorkflowService } from '~/services/approval-workflow.service';
import { PagedResponseImpl } from '~/helpers/PagedResponse';

@Controller()
@UseGuards(MetaApiLimiterGuard, GlobalGuard)
export class ApprovalWorkflowController {
  constructor(
    private readonly approvalWorkflowService: ApprovalWorkflowService,
  ) {}

  /**
   * Get all approval workflows
   */
  @Get([
    '/api/v1/db/meta/approval-workflows',
    '/api/v2/meta/approval-workflows',
  ])
  @Acl('approvalWorkflowList')
  async listWorkflows(
    @TenantContext() context: NcContext,
    @Query('is_active') isActive?: string,
  ) {
    return new PagedResponseImpl(
      await this.approvalWorkflowService.listWorkflows(context, {
        is_active: isActive !== undefined ? isActive === 'true' : undefined,
      }),
    );
  }

  /**
   * Get workflow by project type
   */
  @Get([
    '/api/v1/db/meta/approval-workflows/by-type/:projectType',
    '/api/v2/meta/approval-workflows/by-type/:projectType',
  ])
  @Acl('approvalWorkflowGet')
  async getWorkflowByType(
    @TenantContext() context: NcContext,
    @Param('projectType') projectType: string,
  ) {
    return await this.approvalWorkflowService.getWorkflowByProjectType(
      context,
      projectType,
    );
  }

  /**
   * Create a new approval workflow
   */
  @Post([
    '/api/v1/db/meta/approval-workflows',
    '/api/v2/meta/approval-workflows',
  ])
  @HttpCode(200)
  @Acl('approvalWorkflowCreate')
  async createWorkflow(
    @TenantContext() context: NcContext,
    @Body()
    body: {
      name: string;
      description?: string;
      project_type: string;
      workflow_config: any;
    },
    @Req() req: NcRequest,
  ) {
    return await this.approvalWorkflowService.createWorkflow(context, body, req);
  }

  /**
   * Update an approval workflow
   */
  @Patch([
    '/api/v1/db/meta/approval-workflows/:workflowId',
    '/api/v2/meta/approval-workflows/:workflowId',
  ])
  @Acl('approvalWorkflowUpdate')
  async updateWorkflow(
    @TenantContext() context: NcContext,
    @Param('workflowId') workflowId: string,
    @Body()
    body: {
      name?: string;
      description?: string;
      workflow_config?: any;
      is_active?: boolean;
    },
    @Req() req: NcRequest,
  ) {
    return await this.approvalWorkflowService.updateWorkflow(
      context,
      workflowId,
      body,
      req,
    );
  }

  /**
   * Delete an approval workflow
   */
  @Delete([
    '/api/v1/db/meta/approval-workflows/:workflowId',
    '/api/v2/meta/approval-workflows/:workflowId',
  ])
  @Acl('approvalWorkflowDelete')
  async deleteWorkflow(
    @TenantContext() context: NcContext,
    @Param('workflowId') workflowId: string,
    @Req() req: NcRequest,
  ) {
    return await this.approvalWorkflowService.deleteWorkflow(
      context,
      workflowId,
      req,
    );
  }

  /**
   * List department leaders
   */
  @Get([
    '/api/v1/db/meta/dept-leaders/:deptId',
    '/api/v2/meta/dept-leaders/:deptId',
  ])
  @Acl('deptLeaderList')
  async getDeptLeaders(
    @TenantContext() context: NcContext,
    @Param('deptId') deptId: string,
  ) {
    return await this.approvalWorkflowService.getDeptLeaders(context, deptId);
  }

  /**
   * Add a department leader
   */
  @Post([
    '/api/v1/db/meta/dept-leaders',
    '/api/v2/meta/dept-leaders',
  ])
  @HttpCode(200)
  @Acl('deptLeaderCreate')
  async addDeptLeader(
    @TenantContext() context: NcContext,
    @Body()
    body: {
      dept_id: string;
      dept_name?: string;
      leader_id: string;
      leader_role?: 'primary' | 'secondary' | 'backup';
      approval_order?: number;
    },
    @Req() req: NcRequest,
  ) {
    return await this.approvalWorkflowService.addDeptLeader(context, body, req);
  }

  /**
   * Update a department leader
   */
  @Patch([
    '/api/v1/db/meta/dept-leaders/:leaderId',
    '/api/v2/meta/dept-leaders/:leaderId',
  ])
  @Acl('deptLeaderUpdate')
  async updateDeptLeader(
    @TenantContext() context: NcContext,
    @Param('leaderId') leaderId: string,
    @Body()
    body: {
      dept_name?: string;
      leader_role?: 'primary' | 'secondary' | 'backup';
      approval_order?: number;
      is_active?: boolean;
    },
    @Req() req: NcRequest,
  ) {
    return await this.approvalWorkflowService.updateDeptLeader(
      context,
      leaderId,
      body,
      req,
    );
  }

  /**
   * Delete a department leader
   */
  @Delete([
    '/api/v1/db/meta/dept-leaders/:leaderId',
    '/api/v2/meta/dept-leaders/:leaderId',
  ])
  @Acl('deptLeaderDelete')
  async deleteDeptLeader(
    @TenantContext() context: NcContext,
    @Param('leaderId') leaderId: string,
    @Req() req: NcRequest,
  ) {
    return await this.approvalWorkflowService.deleteDeptLeader(
      context,
      leaderId,
      req,
    );
  }

  /**
   * Get pending approvals for current user
   */
  @Get([
    '/api/v1/db/meta/approval-instances/pending',
    '/api/v2/meta/approval-instances/pending',
  ])
  @Acl('approvalInstanceListPending')
  async getPendingApprovals(
    @TenantContext() context: NcContext,
    @Req() req: NcRequest,
  ) {
    const userId = req.user?.id;
    if (!userId) {
      return new PagedResponseImpl([]);
    }
    return new PagedResponseImpl(
      await this.approvalWorkflowService.getPendingApprovals(context, userId),
    );
  }

  /**
   * Approve a project
   */
  @Post([
    '/api/v1/db/meta/approval-instances/:instanceId/approve',
    '/api/v2/meta/approval-instances/:instanceId/approve',
  ])
  @HttpCode(200)
  @Acl('approvalInstanceApprove')
  async approveProject(
    @TenantContext() context: NcContext,
    @Param('instanceId') instanceId: string,
    @Body() body: { comments?: string },
    @Req() req: NcRequest,
  ) {
    return await this.approvalWorkflowService.approveProject(
      context,
      { instanceId, comments: body.comments },
      req,
    );
  }

  /**
   * Reject a project
   */
  @Post([
    '/api/v1/db/meta/approval-instances/:instanceId/reject',
    '/api/v2/meta/approval-instances/:instanceId/reject',
  ])
  @HttpCode(200)
  @Acl('approvalInstanceReject')
  async rejectProject(
    @TenantContext() context: NcContext,
    @Param('instanceId') instanceId: string,
    @Body() body: { comments?: string },
    @Req() req: NcRequest,
  ) {
    return await this.approvalWorkflowService.rejectProject(
      context,
      { instanceId, comments: body.comments },
      req,
    );
  }

  /**
   * Get approval history for an instance
   */
  @Get([
    '/api/v1/db/meta/approval-instances/:instanceId/history',
    '/api/v2/meta/approval-instances/:instanceId/history',
  ])
  @Acl('approvalHistoryList')
  async getApprovalHistory(
    @TenantContext() context: NcContext,
    @Param('instanceId') instanceId: string,
  ) {
    return new PagedResponseImpl(
      await this.approvalWorkflowService.getApprovalHistory(context, instanceId),
    );
  }
}

import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Body,
  Param,
  Query,
  UseGuards,
  Request,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiParam,
  ApiQuery,
} from '@nestjs/swagger';
import { ApprovalFlowService } from '../services/approval-flow.service';
import { ApprovalInstanceService } from '../services/approval-instance.service';
import {
  CreateApprovalFlowDto,
  UpdateApprovalFlowDto,
  CreateApprovalNodeDto,
  UpdateApprovalNodeDto,
  CreateConditionDto,
  InitiateApprovalDto,
  ApprovalActionDto,
  ApprovalInstanceQueryDto,
  ApprovalTaskQueryDto,
  ApprovalFlowQueryDto,
} from '../dto';
import { ProjectType, FlowStatus } from '../models/approval-flow.model';
import { InstanceStatus } from '../models/approval-instance.model';

/**
 * 审批流控制器
 * 提供审批流管理和审批操作的 REST API
 */
@ApiTags('审批流')
@ApiBearerAuth()
@UseGuards(AuthGuard('jwt'))
@Controller('/api/v1/approval-flows')
export class ApprovalFlowController {
  constructor(
    private readonly flowService: ApprovalFlowService,
    private readonly instanceService: ApprovalInstanceService,
  ) {}

  // ==================== 审批流管理 ====================

  @Post()
  @ApiOperation({ summary: '创建审批流' })
  @ApiResponse({ status: 201, description: '创建成功' })
  @ApiResponse({ status: 400, description: '参数错误' })
  async createFlow(
    @Body() dto: CreateApprovalFlowDto,
    @Request() req,
  ) {
    return this.flowService.createFlow(dto, req.user.id);
  }

  @Get()
  @ApiOperation({ summary: '获取审批流列表' })
  @ApiQuery({ name: 'projectType', enum: ProjectType, required: false })
  @ApiQuery({ name: 'status', enum: FlowStatus, required: false })
  async listFlows(
    @Query('projectType') projectType?: ProjectType,
    @Query('status') status?: FlowStatus,
  ) {
    return this.flowService.listFlows(projectType, status);
  }

  @Get(':id')
  @ApiOperation({ summary: '获取审批流详情' })
  @ApiParam({ name: 'id', description: '审批流ID' })
  @ApiResponse({ status: 200, description: '获取成功' })
  @ApiResponse({ status: 404, description: '审批流不存在' })
  async getFlow(@Param('id') flowId: string) {
    return this.flowService.getFlow(flowId);
  }

  @Put(':id')
  @ApiOperation({ summary: '更新审批流' })
  @ApiParam({ name: 'id', description: '审批流ID' })
  async updateFlow(
    @Param('id') flowId: string,
    @Body() dto: UpdateApprovalFlowDto,
  ) {
    return this.flowService.updateFlow(flowId, dto);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: '删除审批流' })
  @ApiParam({ name: 'id', description: '审批流ID' })
  async deleteFlow(@Param('id') flowId: string) {
    await this.flowService.deleteFlow(flowId);
  }

  @Post(':id/publish')
  @ApiOperation({ summary: '发布审批流' })
  @ApiParam({ name: 'id', description: '审批流ID' })
  async publishFlow(@Param('id') flowId: string) {
    return this.flowService.publishFlow(flowId);
  }

  @Post(':id/unpublish')
  @ApiOperation({ summary: '停用审批流' })
  @ApiParam({ name: 'id', description: '审批流ID' })
  async unpublishFlow(@Param('id') flowId: string) {
    return this.flowService.unpublishFlow(flowId);
  }

  @Post(':id/copy')
  @ApiOperation({ summary: '复制审批流' })
  @ApiParam({ name: 'id', description: '审批流ID' })
  async copyFlow(
    @Param('id') flowId: string,
    @Body('name') newName: string,
    @Request() req,
  ) {
    return this.flowService.copyFlow(flowId, newName, req.user.id);
  }

  // ==================== 节点管理 ====================

  @Post(':id/nodes')
  @ApiOperation({ summary: '创建审批节点' })
  @ApiParam({ name: 'id', description: '审批流ID' })
  async createNode(
    @Param('id') flowId: string,
    @Body() dto: CreateApprovalNodeDto,
  ) {
    return this.flowService.createNode(flowId, dto);
  }

  @Get(':id/nodes')
  @ApiOperation({ summary: '获取审批节点列表' })
  @ApiParam({ name: 'id', description: '审批流ID' })
  async listNodes(@Param('id') flowId: string) {
    const flow = await this.flowService.getFlow(flowId);
    return flow.nodes;
  }

  @Put('nodes/:nodeId')
  @ApiOperation({ summary: '更新审批节点' })
  @ApiParam({ name: 'nodeId', description: '节点ID' })
  async updateNode(
    @Param('nodeId') nodeId: string,
    @Body() dto: UpdateApprovalNodeDto,
  ) {
    return this.flowService.updateNode(nodeId, dto);
  }

  @Delete('nodes/:nodeId')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: '删除审批节点' })
  @ApiParam({ name: 'nodeId', description: '节点ID' })
  async deleteNode(@Param('nodeId') nodeId: string) {
    await this.flowService.deleteNode(nodeId);
  }

  @Get('nodes/:nodeId')
  @ApiOperation({ summary: '获取节点详情' })
  @ApiParam({ name: 'nodeId', description: '节点ID' })
  async getNode(@Param('nodeId') nodeId: string) {
    return this.flowService.getNode(nodeId);
  }

  // ==================== 条件规则 ====================

  @Post('nodes/:nodeId/conditions')
  @ApiOperation({ summary: '创建条件规则' })
  @ApiParam({ name: 'nodeId', description: '节点ID' })
  async createCondition(
    @Param('nodeId') nodeId: string,
    @Body() dto: CreateConditionDto,
  ) {
    return this.flowService.createCondition(nodeId, dto);
  }

  // ==================== 审批实例 ====================

  @Post('instances')
  @ApiOperation({ summary: '发起审批' })
  async initiate(
    @Body() dto: InitiateApprovalDto,
    @Request() req,
  ) {
    return this.instanceService.initiate(dto, req.user.id);
  }

  @Get('instances')
  @ApiOperation({ summary: '查询审批实例列表' })
  @ApiQuery({ name: 'flowId', required: false })
  @ApiQuery({ name: 'status', enum: InstanceStatus, required: false })
  @ApiQuery({ name: 'initiatedBy', required: false })
  @ApiQuery({ name: 'businessType', required: false })
  @ApiQuery({ name: 'page', type: Number, required: false })
  @ApiQuery({ name: 'limit', type: Number, required: false })
  async listInstances(
    @Query() query: ApprovalInstanceQueryDto,
  ) {
    return this.instanceService.listInstances(query);
  }

  @Get('instances/:id')
  @ApiOperation({ summary: '获取审批实例详情' })
  @ApiParam({ name: 'id', description: '实例ID' })
  async getInstance(@Param('id') instanceId: string) {
    return this.instanceService.getInstance(instanceId);
  }

  @Post('instances/:id/cancel')
  @ApiOperation({ summary: '取消审批' })
  @ApiParam({ name: 'id', description: '实例ID' })
  async cancelInstance(
    @Param('id') instanceId: string,
    @Body('reason') reason: string,
    @Request() req,
  ) {
    return this.instanceService.cancelInstance(
      instanceId,
      req.user.id,
      reason,
    );
  }

  // ==================== 审批任务 ====================

  @Get('tasks/pending')
  @ApiOperation({ summary: '获取我的待审批任务' })
  async getPendingTasks(
    @Query() query: ApprovalTaskQueryDto,
    @Request() req,
  ) {
    return this.instanceService.getPendingTasks(req.user.id, query);
  }

  @Get('tasks/completed')
  @ApiOperation({ summary: '获取我的已审批任务' })
  async getCompletedTasks(
    @Query() query: ApprovalTaskQueryDto,
    @Request() req,
  ) {
    return this.instanceService.getCompletedTasks(req.user.id, query);
  }

  @Post('tasks/:taskId/action')
  @ApiOperation({ summary: '处理审批任务' })
  @ApiParam({ name: 'taskId', description: '任务ID' })
  async processAction(
    @Param('taskId') taskId: string,
    @Body() dto: ApprovalActionDto,
    @Request() req,
  ) {
    return this.instanceService.processAction(taskId, req.user.id, dto);
  }

  @Get('statistics/my')
  @ApiOperation({ summary: '获取我的审批统计' })
  async getStatistics(@Request() req) {
    return this.instanceService.getStatistics(req.user.id);
  }

  // ==================== 审批历史 ====================

  @Get('history/:businessType/:businessId')
  @ApiOperation({ summary: '获取业务对象审批历史' })
  @ApiParam({ name: 'businessType', description: '业务类型' })
  @ApiParam({ name: 'businessId', description: '业务对象ID' })
  async getApprovalHistory(
    @Param('businessType') businessType: string,
    @Param('businessId') businessId: string,
  ) {
    return this.instanceService.getApprovalHistory(businessType, businessId);
  }
}

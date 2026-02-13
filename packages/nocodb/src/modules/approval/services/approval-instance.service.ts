import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import {
  ApprovalInstance,
  InstanceStatus,
} from '../models/approval-instance.model';
import {
  ApprovalTask,
  TaskStatus,
} from '../models/approval-task.model';
import { ApprovalNode } from '../models/approval-node.model';
import { ApprovalFlow } from '../models/approval-flow.model';
import { ApprovalEngineService } from './approval-engine.service';
import {
  InitiateApprovalDto,
  ApprovalActionDto,
  ApprovalInstanceQueryDto,
  ApprovalTaskQueryDto,
} from '../dto';
import Noco from '~/Noco';

/**
 * 带详情的审批实例
 */
export interface InstanceWithDetails extends ApprovalInstance {
  flow?: ApprovalFlow;
  currentNode?: ApprovalNode;
  tasks?: ApprovalTask[];
}

/**
 * 带详情的审批任务
 */
export interface TaskWithDetails extends ApprovalTask {
  flow?: ApprovalFlow;
  instance?: ApprovalInstance;
  node?: ApprovalNode;
}

/**
 * 审批实例服务
 * 负责审批实例的生命周期管理
 */
@Injectable()
export class ApprovalInstanceService {
  private readonly logger = new Logger(ApprovalInstanceService.name);

  constructor(private readonly approvalEngine: ApprovalEngineService) {}

  /**
   * 发起审批
   */
  async initiate(
    dto: InitiateApprovalDto,
    initiatedBy: string,
    ncMeta = Noco.ncMeta,
  ): Promise<ApprovalInstance> {
    let flowId = dto.flowId;

    // 如果没有指定流程，根据项目类型自动选择
    if (!flowId && dto.contextData?.projectType) {
      const flow = await this.approvalEngine.selectFlowByProjectType(
        dto.contextData.projectType,
        ncMeta,
      );
      if (flow) {
        flowId = flow.id;
      }
    }

    if (!flowId) {
      throw new Error('未找到匹配的审批流程');
    }

    return this.approvalEngine.startInstance(
      flowId,
      dto.businessType,
      dto.businessId,
      initiatedBy,
      dto.contextData || {},
      ncMeta,
    );
  }

  /**
   * 获取审批实例详情
   */
  async getInstance(
    instanceId: string,
    ncMeta = Noco.ncMeta,
  ): Promise<InstanceWithDetails> {
    const instance = await ApprovalInstance.get({ id: instanceId }, ncMeta);
    if (!instance) {
      throw new NotFoundException('审批实例不存在');
    }

    const flow = await ApprovalFlow.get({ id: instance.flowId }, ncMeta);
    const tasks = await ApprovalTask.list({ instanceId }, ncMeta);

    let currentNode: ApprovalNode | undefined;
    if (instance.currentNodeId) {
      currentNode = await ApprovalNode.get(
        { id: instance.currentNodeId },
        ncMeta,
      );
    }

    return {
      ...instance,
      flow,
      currentNode,
      tasks,
    };
  }

  /**
   * 查询审批实例列表
   */
  async listInstances(
    query: ApprovalInstanceQueryDto,
    ncMeta = Noco.ncMeta,
  ): Promise<{ items: ApprovalInstance[]; total: number }> {
    const filter = {
      flowId: query.flowId,
      status: query.status,
      initiatedBy: query.initiatedBy,
      businessType: query.businessType,
    };

    // 移除未定义的过滤条件
    Object.keys(filter).forEach((key) => {
      if (filter[key] === undefined) {
        delete filter[key];
      }
    });

    const instances = await ApprovalInstance.list(filter, ncMeta);

    // 简单的分页
    const page = query.page || 1;
    const limit = query.limit || 20;
    const start = (page - 1) * limit;
    const end = start + limit;
    const paginated = instances.slice(start, end);

    return {
      items: paginated,
      total: instances.length,
    };
  }

  /**
   * 处理审批操作
   */
  async processAction(
    taskId: string,
    userId: string,
    dto: ApprovalActionDto,
    ncMeta = Noco.ncMeta,
  ): Promise<ApprovalInstance> {
    const task = await ApprovalTask.get({ id: taskId }, ncMeta);
    if (!task) {
      throw new NotFoundException('审批任务不存在');
    }

    // 验证任务是否分配给当前用户
    if (task.assigneeId !== userId) {
      throw new Error('无权处理此审批任务');
    }

    return this.approvalEngine.processApprovalAction(
      taskId,
      dto.action,
      dto.comment,
      dto.attachments,
      dto.newAssigneeId,
      ncMeta,
    );
  }

  /**
   * 获取用户的待审批任务
   */
  async getPendingTasks(
    userId: string,
    query: ApprovalTaskQueryDto,
    ncMeta = Noco.ncMeta,
  ): Promise<{ items: TaskWithDetails[]; total: number }> {
    const tasks = await ApprovalTask.getPendingByAssignee(userId, ncMeta);

    // 加载详情
    const tasksWithDetails: TaskWithDetails[] = await Promise.all(
      tasks.map(async (task) => {
        const [instance, node] = await Promise.all([
          ApprovalInstance.get({ id: task.instanceId }, ncMeta),
          ApprovalNode.get({ id: task.nodeId }, ncMeta),
        ]);

        const flow = instance
          ? await ApprovalFlow.get({ id: instance.flowId }, ncMeta)
          : undefined;

        return {
          ...task,
          instance,
          node,
          flow,
        };
      }),
    );

    // 分页
    const page = query.page || 1;
    const limit = query.limit || 20;
    const start = (page - 1) * limit;
    const end = start + limit;
    const paginated = tasksWithDetails.slice(start, end);

    return {
      items: paginated,
      total: tasksWithDetails.length,
    };
  }

  /**
   * 获取用户已处理的审批任务
   */
  async getCompletedTasks(
    userId: string,
    query: ApprovalTaskQueryDto,
    ncMeta = Noco.ncMeta,
  ): Promise<{ items: ApprovalTask[]; total: number }> {
    const allTasks = await ApprovalTask.list({ assigneeId: userId }, ncMeta);
    const completedTasks = allTasks.filter((t) => t.isCompleted());

    // 分页
    const page = query.page || 1;
    const limit = query.limit || 20;
    const start = (page - 1) * limit;
    const end = start + limit;
    const paginated = completedTasks.slice(start, end);

    return {
      items: paginated,
      total: completedTasks.length,
    };
  }

  /**
   * 取消审批实例
   */
  async cancelInstance(
    instanceId: string,
    cancelledBy: string,
    reason?: string,
    ncMeta = Noco.ncMeta,
  ): Promise<ApprovalInstance> {
    const instance = await ApprovalInstance.get({ id: instanceId }, ncMeta);
    if (!instance) {
      throw new NotFoundException('审批实例不存在');
    }

    // 验证权限（只有发起人或管理员可以取消）
    if (instance.initiatedBy !== cancelledBy) {
      // TODO: 检查是否是管理员
      throw new Error('无权取消此审批流程');
    }

    if (instance.isCompleted()) {
      throw new Error('审批流程已完成，无法取消');
    }

    return this.approvalEngine.cancelInstance(
      instanceId,
      cancelledBy,
      reason,
      ncMeta,
    );
  }

  /**
   * 获取审批历史
   */
  async getApprovalHistory(
    businessType: string,
    businessId: string,
    ncMeta = Noco.ncMeta,
  ): Promise<InstanceWithDetails | null> {
    const instance = await ApprovalInstance.getByBusinessId(
      businessType,
      businessId,
      ncMeta,
    );

    if (!instance) {
      return null;
    }

    return this.getInstance(instance.id, ncMeta);
  }

  /**
   * 获取审批统计
   */
  async getStatistics(
    userId: string,
    ncMeta = Noco.ncMeta,
  ): Promise<{
    pendingCount: number;
    approvedCount: number;
    rejectedCount: number;
    initiatedCount: number;
  }> {
    const [pendingTasks, allTasks, allInstances] = await Promise.all([
      ApprovalTask.getPendingByAssignee(userId, ncMeta),
      ApprovalTask.list({ assigneeId: userId }, ncMeta),
      ApprovalInstance.list({ initiatedBy: userId }, ncMeta),
    ]);

    const approvedCount = allTasks.filter(
      (t) => t.status === TaskStatus.APPROVED,
    ).length;
    const rejectedCount = allTasks.filter(
      (t) => t.status === TaskStatus.REJECTED,
    ).length;

    return {
      pendingCount: pendingTasks.length,
      approvedCount,
      rejectedCount,
      initiatedCount: allInstances.length,
    };
  }
}

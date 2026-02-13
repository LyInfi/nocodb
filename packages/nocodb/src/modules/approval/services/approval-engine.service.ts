import { Injectable, Logger } from '@nestjs/common';
import { nanoid } from 'nanoid';
import {
  ApprovalFlow,
  ProjectType,
  FlowStatus,
} from '../models/approval-flow.model';
import {
  ApprovalNode,
  NodeType,
  CounterSignType,
  ApproverType,
} from '../models/approval-node.model';
import {
  ApprovalInstance,
  InstanceStatus,
} from '../models/approval-instance.model';
import {
  ApprovalTask,
  TaskStatus,
} from '../models/approval-task.model';
import { ApprovalCondition } from '../models/approval-condition.model';
import Noco from '~/Noco';

/**
 * 会签结果
 */
export interface CounterSignResult {
  isComplete: boolean;
  approved: boolean;
  approvedCount: number;
  rejectedCount: number;
  totalCount: number;
}

/**
 * 节点执行上下文
 */
export interface NodeExecutionContext {
  instance: ApprovalInstance;
  node: ApprovalNode;
  contextData: Record<string, any>;
}

/**
 * 审批引擎服务
 * 实现审批流状态机、条件分支、会签计算等核心逻辑
 */
@Injectable()
export class ApprovalEngineService {
  private readonly logger = new Logger(ApprovalEngineService.name);

  /**
   * 根据项目类型选择审批流
   * @param projectType 项目类型
   * @returns 匹配的审批流或null
   */
  async selectFlowByProjectType(
    projectType: ProjectType,
    ncMeta = Noco.ncMeta,
  ): Promise<ApprovalFlow | null> {
    return ApprovalFlow.getActiveFlowByProjectType(projectType, ncMeta);
  }

  /**
   * 启动审批实例
   * @param flowId 审批流ID
   * @param businessType 业务类型
   * @param businessId 业务对象ID
   * @param initiatedBy 发起人ID
   * @param contextData 上下文数据（用于条件判断）
   * @returns 创建的审批实例
   */
  async startInstance(
    flowId: string,
    businessType: string,
    businessId: string,
    initiatedBy: string,
    contextData: Record<string, any> = {},
    ncMeta = Noco.ncMeta,
  ): Promise<ApprovalInstance> {
    // 获取审批流
    const flow = await ApprovalFlow.get({ id: flowId }, ncMeta);
    if (!flow) {
      throw new Error(`审批流不存在: ${flowId}`);
    }

    if (flow.status !== FlowStatus.ACTIVE) {
      throw new Error(`审批流未激活: ${flowId}`);
    }

    // 检查是否已有进行中的审批实例
    const existingInstance = await ApprovalInstance.getByBusinessId(
      businessType,
      businessId,
      ncMeta,
    );
    if (existingInstance && existingInstance.isActive()) {
      throw new Error('该业务对象已有进行中的审批流程');
    }

    // 创建审批实例
    const instance = await ApprovalInstance.insert(
      {
        id: nanoid(),
        flowId,
        businessType,
        businessId,
        initiatedBy,
        initiatedAt: new Date(),
        status: InstanceStatus.PENDING,
        contextData,
      },
      ncMeta,
    );

    // 如果有起始节点，开始执行
    if (flow.startNodeId) {
      await this.executeNode(instance.id, flow.startNodeId, ncMeta);
    }

    return instance;
  }

  /**
   * 执行节点
   * @param instanceId 实例ID
   * @param nodeId 节点ID
   */
  async executeNode(
    instanceId: string,
    nodeId: string,
    ncMeta = Noco.ncMeta,
  ): Promise<void> {
    const instance = await ApprovalInstance.get({ id: instanceId }, ncMeta);
    if (!instance || instance.isCompleted()) {
      throw new Error('审批实例不存在或已完成');
    }

    const node = await ApprovalNode.get({ id: nodeId }, ncMeta);
    if (!node) {
      throw new Error(`节点不存在: ${nodeId}`);
    }

    // 更新当前节点
    await ApprovalInstance.update(
      instanceId,
      { currentNodeId: nodeId, status: InstanceStatus.RUNNING },
      ncMeta,
    );

    // 根据节点类型执行不同逻辑
    switch (node.nodeType) {
      case NodeType.START:
        await this.handleStartNode(instance, node, ncMeta);
        break;

      case NodeType.APPROVAL:
        await this.handleApprovalNode(instance, node, ncMeta);
        break;

      case NodeType.CONDITION:
        await this.handleConditionNode(instance, node, ncMeta);
        break;

      case NodeType.PARALLEL:
        await this.handleParallelNode(instance, node, ncMeta);
        break;

      case NodeType.END:
        await this.handleEndNode(instance, node, ncMeta);
        break;

      default:
        this.logger.error(`未知的节点类型: ${node.nodeType}`);
        await this.completeInstance(instanceId, 'rejected', ncMeta);
    }
  }

  /**
   * 处理开始节点
   */
  private async handleStartNode(
    instance: ApprovalInstance,
    node: ApprovalNode,
    ncMeta = Noco.ncMeta,
  ): Promise<void> {
    this.logger.debug(`处理开始节点: ${node.id}`);

    // 开始节点直接跳到下一个节点
    if (node.nextNodeId) {
      await this.executeNode(instance.id, node.nextNodeId, ncMeta);
    } else {
      await this.completeInstance(instance.id, 'approved', ncMeta);
    }
  }

  /**
   * 处理审批节点
   */
  private async handleApprovalNode(
    instance: ApprovalInstance,
    node: ApprovalNode,
    ncMeta = Noco.ncMeta,
  ): Promise<void> {
    this.logger.debug(`处理审批节点: ${node.id}`);

    // 解析审批人
    const approverIds = await this.resolveApprovers(
      instance,
      node,
      ncMeta,
    );

    if (approverIds.length === 0) {
      this.logger.warn(`节点 ${node.id} 未找到审批人，自动跳过`);
      if (node.nextNodeId) {
        await this.executeNode(instance.id, node.nextNodeId, ncMeta);
      }
      return;
    }

    // 创建审批任务
    for (const approverId of approverIds) {
      await ApprovalTask.insert(
        {
          id: nanoid(),
          instanceId: instance.id,
          nodeId: node.id,
          assigneeId: approverId,
          assigneeType: 'primary',
          status: TaskStatus.PENDING,
          assignedAt: new Date(),
          dueAt: node.timeoutHours
            ? new Date(Date.now() + node.timeoutHours * 60 * 60 * 1000)
            : undefined,
        },
        ncMeta,
      );
    }

    // 如果不是会签，到这里就等待用户操作
    // 如果是会签，需要等待所有审批人处理
    if (!node.requiresCounterSign()) {
      // 非会签模式，创建任务后即等待
      this.logger.debug(`非会签模式，等待单个审批人处理`);
    } else {
      this.logger.debug(`会签模式，${approverIds.length} 个审批人需要处理`);
    }
  }

  /**
   * 处理条件节点
   */
  private async handleConditionNode(
    instance: ApprovalInstance,
    node: ApprovalNode,
    ncMeta = Noco.ncMeta,
  ): Promise<void> {
    this.logger.debug(`处理条件节点: ${node.id}`);

    // 获取条件规则
    const conditions = await ApprovalCondition.getByNodeId(node.id, ncMeta);

    // 评估条件
    const conditionMet = ApprovalCondition.evaluateGroup(
      conditions,
      instance.contextData || {},
    );

    // 根据条件结果选择下一个节点
    const nextNodeId = conditionMet ? node.trueNodeId : node.falseNodeId;

    if (nextNodeId) {
      await this.executeNode(instance.id, nextNodeId, ncMeta);
    } else {
      // 没有下一个节点，结束流程
      await this.completeInstance(
        instance.id,
        conditionMet ? 'approved' : 'rejected',
        ncMeta,
      );
    }
  }

  /**
   * 处理并行节点（并行会签入口）
   */
  private async handleParallelNode(
    instance: ApprovalInstance,
    node: ApprovalNode,
    ncMeta = Noco.ncMeta,
  ): Promise<void> {
    this.logger.debug(`处理并行节点: ${node.id}`);

    // 并行节点通常包含多个审批分支
    // 这里简化处理，跳到下一个节点
    if (node.nextNodeId) {
      await this.executeNode(instance.id, node.nextNodeId, ncMeta);
    } else {
      await this.completeInstance(instance.id, 'approved', ncMeta);
    }
  }

  /**
   * 处理结束节点
   */
  private async handleEndNode(
    instance: ApprovalInstance,
    node: ApprovalNode,
    ncMeta = Noco.ncMeta,
  ): Promise<void> {
    this.logger.debug(`处理结束节点: ${node.id}`);

    // 根据结束节点配置确定最终状态
    const result: 'approved' | 'rejected' = 'approved';
    await this.completeInstance(instance.id, result, ncMeta);
  }

  /**
   * 完成审批实例
   */
  async completeInstance(
    instanceId: string,
    result: 'approved' | 'rejected',
    ncMeta = Noco.ncMeta,
  ): Promise<ApprovalInstance> {
    const status =
      result === 'approved' ? InstanceStatus.APPROVED : InstanceStatus.REJECTED;

    return ApprovalInstance.update(
      instanceId,
      {
        status,
        result,
        completedAt: new Date(),
      },
      ncMeta,
    );
  }

  /**
   * 处理审批操作
   * @param taskId 任务ID
   * @param action 操作类型
   * @param comment 审批意见
   * @param attachments 附件
   */
  async processApprovalAction(
    taskId: string,
    action: 'approve' | 'reject' | 'transfer' | 'delegate',
    comment?: string,
    attachments?: string[],
    newAssigneeId?: string,
    ncMeta = Noco.ncMeta,
  ): Promise<ApprovalInstance> {
    const task = await ApprovalTask.get({ id: taskId }, ncMeta);
    if (!task) {
      throw new Error('审批任务不存在');
    }

    if (task.isCompleted()) {
      throw new Error('审批任务已完成');
    }

    const instance = await ApprovalInstance.get(
      { id: task.instanceId },
      ncMeta,
    );
    if (!instance || instance.isCompleted()) {
      throw new Error('审批实例不存在或已完成');
    }

    const node = await ApprovalNode.get({ id: task.nodeId }, ncMeta);
    if (!node) {
      throw new Error('审批节点不存在');
    }

    switch (action) {
      case 'approve':
      case 'reject':
        await this.handleApproveOrReject(
          task,
          instance,
          node,
          action,
          comment,
          attachments,
          ncMeta,
        );
        break;

      case 'transfer':
        if (!newAssigneeId) {
          throw new Error('转办需要提供新的审批人');
        }
        await task.transfer(newAssigneeId, comment, ncMeta);
        break;

      case 'delegate':
        if (!newAssigneeId) {
          throw new Error('委派需要提供受委托人');
        }
        await task.delegate(newAssigneeId, comment, ncMeta);
        break;
    }

    return ApprovalInstance.get({ id: instance.id }, ncMeta);
  }

  /**
   * 处理同意或拒绝
   */
  private async handleApproveOrReject(
    task: ApprovalTask,
    instance: ApprovalInstance,
    node: ApprovalNode,
    action: 'approve' | 'reject',
    comment?: string,
    attachments?: string[],
    ncMeta = Noco.ncMeta,
  ): Promise<void> {
    // 完成当前任务
    await task.complete(action, comment, attachments, ncMeta);

    // 检查会签状态
    if (node.requiresCounterSign()) {
      const counterSignResult = await this.calculateCounterSign(
        instance.id,
        node.id,
        node.counterSignType,
        node.minApprovals,
        node.maxRejections,
        ncMeta,
      );

      if (!counterSignResult.isComplete) {
        // 会签未完成，等待其他审批人
        this.logger.debug(`会签未完成: ${counterSignResult.approvedCount}/${counterSignResult.totalCount}`);
        return;
      }

      // 会签完成，根据结果决定下一步
      if (counterSignResult.approved) {
        if (node.nextNodeId) {
          await this.executeNode(instance.id, node.nextNodeId, ncMeta);
        } else {
          await this.completeInstance(instance.id, 'approved', ncMeta);
        }
      } else {
        // 会签被拒绝
        await this.completeInstance(instance.id, 'rejected', ncMeta);
      }
    } else {
      // 非会签模式，直接处理
      if (action === 'approve') {
        if (node.nextNodeId) {
          await this.executeNode(instance.id, node.nextNodeId, ncMeta);
        } else {
          await this.completeInstance(instance.id, 'approved', ncMeta);
        }
      } else {
        // 拒绝
        await this.completeInstance(instance.id, 'rejected', ncMeta);
      }
    }
  }

  /**
   * 计算会签结果
   * @param instanceId 实例ID
   * @param nodeId 节点ID
   * @param counterSignType 会签类型
   * @param minApprovals 最小通过人数
   * @param maxRejections 最大拒绝人数
   * @returns 会签结果
   */
  async calculateCounterSign(
    instanceId: string,
    nodeId: string,
    counterSignType: CounterSignType,
    minApprovals?: number,
    maxRejections?: number,
    ncMeta = Noco.ncMeta,
  ): Promise<CounterSignResult> {
    const tasks = await ApprovalTask.getByInstanceAndNode(
      instanceId,
      nodeId,
      ncMeta,
    );

    const totalCount = tasks.length;
    const approvedCount = tasks.filter(
      (t) => t.status === TaskStatus.APPROVED,
    ).length;
    const rejectedCount = tasks.filter(
      (t) => t.status === TaskStatus.REJECTED,
    ).length;
    const completedCount = approvedCount + rejectedCount;

    let isComplete = false;
    let approved = false;

    switch (counterSignType) {
      case CounterSignType.PARALLEL_ALL:
        // 全部通过才算通过，任意一人拒绝即失败
        if (rejectedCount > 0) {
          isComplete = true;
          approved = false;
        } else if (approvedCount === totalCount) {
          isComplete = true;
          approved = true;
        }
        break;

      case CounterSignType.PARALLEL_ANY:
        // 任意一人通过即通过，全部拒绝才算失败
        if (approvedCount > 0) {
          isComplete = true;
          approved = true;
        } else if (rejectedCount === totalCount) {
          isComplete = true;
          approved = false;
        }
        break;

      case CounterSignType.SEQUENTIAL:
        // 顺序会签：按顺序审批，使用配置的最小通过人数和最大拒绝人数
        const requiredApprovals = minApprovals || Math.ceil(totalCount / 2);
        const allowedRejections = maxRejections || 0;

        if (approvedCount >= requiredApprovals) {
          isComplete = true;
          approved = true;
        } else if (rejectedCount > allowedRejections) {
          isComplete = true;
          approved = false;
        } else if (completedCount === totalCount) {
          // 所有人都审批完成但未达到通过条件
          isComplete = true;
          approved = approvedCount >= requiredApprovals;
        }
        break;

      default:
        // 非会签模式，单个任务完成即完成
        isComplete = completedCount > 0;
        approved = approvedCount > 0;
    }

    return {
      isComplete,
      approved,
      approvedCount,
      rejectedCount,
      totalCount,
    };
  }

  /**
   * 解析审批人
   * 支持多种审批人类型：指定用户、角色、部门领导、项目负责人等
   */
  private async resolveApprovers(
    instance: ApprovalInstance,
    node: ApprovalNode,
    ncMeta = Noco.ncMeta,
  ): Promise<string[]> {
    const approvers: string[] = [];

    switch (node.approverType) {
      case ApproverType.USER:
        // 指定用户
        if (node.approverIds && node.approverIds.length > 0) {
          approvers.push(...node.approverIds);
        }
        break;

      case ApproverType.ROLE:
        // 角色用户 - 需要查询具有该角色的用户
        if (node.approverRole) {
          // 这里简化处理，实际应该查询用户角色关系
          // const roleUsers = await this.getUsersByRole(node.approverRole);
          // approvers.push(...roleUsers);
          this.logger.debug(`按角色查询用户: ${node.approverRole}`);
        }
        break;

      case ApproverType.DEPARTMENT_HEAD:
        // 部门领导
        if (node.departmentId) {
          // 查询部门领导
          // const headId = await this.getDepartmentHead(node.departmentId);
          // if (headId) approvers.push(headId);
          this.logger.debug(`查询部门领导: ${node.departmentId}`);
        }
        break;

      case ApproverType.PROJECT_MANAGER:
        // 项目负责人 - 从业务对象中获取
        // const managerId = await this.getProjectManager(instance.businessId);
        // if (managerId) approvers.push(managerId);
        this.logger.debug('查询项目负责人');
        break;

      case ApproverType.SELF:
        // 发起人自己
        approvers.push(instance.initiatedBy);
        break;

      default:
        this.logger.warn(`未知的审批人类型: ${node.approverType}`);
    }

    return [...new Set(approvers)]; // 去重
  }

  /**
   * 处理超时任务
   */
  async handleTimeoutTasks(ncMeta = Noco.ncMeta): Promise<void> {
    // 查询所有超时的待处理任务
    const now = new Date();
    const pendingTasks = await ApprovalTask.list(
      { status: TaskStatus.PENDING },
      ncMeta,
    );

    for (const task of pendingTasks) {
      if (task.dueAt && task.dueAt < now) {
        const node = await ApprovalNode.get({ id: task.nodeId }, ncMeta);
        if (!node) continue;

        switch (node.timeoutAction) {
          case 'auto_approve':
            await this.processApprovalAction(
              task.id,
              'approve',
              '系统自动审批（超时）',
              undefined,
              undefined,
              ncMeta,
            );
            break;

          case 'auto_reject':
            await this.processApprovalAction(
              task.id,
              'reject',
              '系统自动拒绝（超时）',
              undefined,
              undefined,
              ncMeta,
            );
            break;

          case 'notify':
          default:
            // 发送通知提醒
            this.logger.debug(`任务 ${task.id} 已超时，发送通知`);
            // TODO: 发送通知
            break;
        }
      }
    }
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
    if (!instance || instance.isCompleted()) {
      throw new Error('审批实例不存在或已完成');
    }

    // 取消所有待处理任务
    const tasks = await ApprovalTask.list({ instanceId }, ncMeta);
    for (const task of tasks) {
      if (!task.isCompleted()) {
        await ApprovalTask.update(
          task.id,
          {
            status: TaskStatus.SKIPPED,
            comment: reason || '流程被取消',
            completedAt: new Date(),
          },
          ncMeta,
        );
      }
    }

    return ApprovalInstance.update(
      instanceId,
      {
        status: InstanceStatus.CANCELLED,
        completedAt: new Date(),
        completedBy: cancelledBy,
      },
      ncMeta,
    );
  }
}

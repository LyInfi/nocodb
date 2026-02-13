import { Injectable, Logger, NotFoundException } from '@nestjs/common';
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
} from '../models/approval-node.model';
import { ApprovalCondition } from '../models/approval-condition.model';
import {
  CreateApprovalFlowDto,
  UpdateApprovalFlowDto,
  CreateApprovalNodeDto,
  UpdateApprovalNodeDto,
  CreateConditionDto,
} from '../dto';
import Noco from '~/Noco';

/**
 * 带节点详情的审批流
 */
export interface FlowWithNodes extends ApprovalFlow {
  nodes: ApprovalNode[];
}

/**
 * 带条件的节点
 */
export interface NodeWithConditions extends ApprovalNode {
  conditions: ApprovalCondition[];
}

/**
 * 审批流管理服务
 * 负责审批流的 CRUD 和节点管理
 */
@Injectable()
export class ApprovalFlowService {
  private readonly logger = new Logger(ApprovalFlowService.name);

  /**
   * 创建审批流
   */
  async createFlow(
    dto: CreateApprovalFlowDto,
    createdBy: string,
    ncMeta = Noco.ncMeta,
  ): Promise<ApprovalFlow> {
    const flow = await ApprovalFlow.insert(
      {
        id: nanoid(),
        name: dto.name,
        description: dto.description,
        projectType: dto.projectType,
        version: dto.version || 1,
        status: dto.status || FlowStatus.DRAFT,
        createdBy,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
      ncMeta,
    );

    this.logger.log(`创建审批流: ${flow.id}`);
    return flow;
  }

  /**
   * 更新审批流
   */
  async updateFlow(
    flowId: string,
    dto: UpdateApprovalFlowDto,
    ncMeta = Noco.ncMeta,
  ): Promise<ApprovalFlow> {
    const flow = await ApprovalFlow.get({ id: flowId }, ncMeta);
    if (!flow) {
      throw new NotFoundException('审批流不存在');
    }

    const updated = await ApprovalFlow.update(
      flowId,
      {
        ...dto,
        updatedAt: new Date(),
      },
      ncMeta,
    );

    this.logger.log(`更新审批流: ${flowId}`);
    return updated;
  }

  /**
   * 获取审批流详情
   */
  async getFlow(
    flowId: string,
    ncMeta = Noco.ncMeta,
  ): Promise<FlowWithNodes> {
    const flow = await ApprovalFlow.get({ id: flowId }, ncMeta);
    if (!flow) {
      throw new NotFoundException('审批流不存在');
    }

    const nodes = await ApprovalNode.getByFlowId(flowId, ncMeta);

    return {
      ...flow,
      nodes,
    };
  }

  /**
   * 获取审批流列表
   */
  async listFlows(
    projectType?: ProjectType,
    status?: FlowStatus,
    ncMeta = Noco.ncMeta,
  ): Promise<ApprovalFlow[]> {
    return ApprovalFlow.list({ projectType, status }, ncMeta);
  }

  /**
   * 删除审批流（软删除）
   */
  async deleteFlow(
    flowId: string,
    ncMeta = Noco.ncMeta,
  ): Promise<void> {
    const flow = await ApprovalFlow.get({ id: flowId }, ncMeta);
    if (!flow) {
      throw new NotFoundException('审批流不存在');
    }

    await ApprovalFlow.softDelete(flowId, ncMeta);
    this.logger.log(`删除审批流: ${flowId}`);
  }

  /**
   * 发布审批流
   */
  async publishFlow(
    flowId: string,
    ncMeta = Noco.ncMeta,
  ): Promise<ApprovalFlow> {
    const flow = await ApprovalFlow.get({ id: flowId }, ncMeta);
    if (!flow) {
      throw new NotFoundException('审批流不存在');
    }

    // 验证流程完整性
    await this.validateFlow(flowId, ncMeta);

    // 如果有其他激活的相同项目类型的流程，先停用
    if (flow.projectType) {
      const activeFlows = await ApprovalFlow.list(
        { projectType: flow.projectType, status: FlowStatus.ACTIVE },
        ncMeta,
      );
      for (const activeFlow of activeFlows) {
        if (activeFlow.id !== flowId) {
          await ApprovalFlow.update(
            activeFlow.id,
            { status: FlowStatus.INACTIVE },
            ncMeta,
          );
        }
      }
    }

    return this.updateFlow(flowId, { status: FlowStatus.ACTIVE }, ncMeta);
  }

  /**
   * 停用审批流
   */
  async unpublishFlow(
    flowId: string,
    ncMeta = Noco.ncMeta,
  ): Promise<ApprovalFlow> {
    return this.updateFlow(flowId, { status: FlowStatus.INACTIVE }, ncMeta);
  }

  /**
   * 验证审批流完整性
   */
  private async validateFlow(
    flowId: string,
    ncMeta = Noco.ncMeta,
  ): Promise<void> {
    const nodes = await ApprovalNode.getByFlowId(flowId, ncMeta);

    if (nodes.length === 0) {
      throw new Error('审批流必须至少包含一个节点');
    }

    // 检查是否有开始节点
    const startNodes = nodes.filter((n) => n.nodeType === NodeType.START);
    if (startNodes.length === 0) {
      throw new Error('审批流必须包含开始节点');
    }

    // 检查是否有结束节点
    const endNodes = nodes.filter((n) => n.nodeType === NodeType.END);
    if (endNodes.length === 0) {
      throw new Error('审批流必须包含结束节点');
    }

    // 检查节点连接是否完整
    for (const node of nodes) {
      if (node.nodeType === NodeType.CONDITION) {
        if (!node.trueNodeId && !node.falseNodeId) {
          throw new Error(`条件节点 ${node.name} 必须配置分支`);
        }
      } else if (node.nodeType !== NodeType.END) {
        if (!node.nextNodeId) {
          throw new Error(`节点 ${node.name} 必须配置下一个节点`);
        }
      }
    }
  }

  /**
   * 创建审批节点
   */
  async createNode(
    flowId: string,
    dto: CreateApprovalNodeDto,
    ncMeta = Noco.ncMeta,
  ): Promise<ApprovalNode> {
    const flow = await ApprovalFlow.get({ id: flowId }, ncMeta);
    if (!flow) {
      throw new NotFoundException('审批流不存在');
    }

    const node = await ApprovalNode.insert(
      {
        id: nanoid(),
        flowId,
        name: dto.name,
        nodeType: dto.nodeType,
        approverType: dto.approverType,
        approverIds: dto.approverIds,
        approverRole: dto.approverRole,
        departmentId: dto.departmentId,
        counterSignType: dto.counterSignType || CounterSignType.NONE,
        minApprovals: dto.minApprovals,
        maxRejections: dto.maxRejections,
        nextNodeId: dto.nextNodeId,
        trueNodeId: dto.trueNodeId,
        falseNodeId: dto.falseNodeId,
        order: dto.order,
        timeoutHours: dto.timeoutHours,
        timeoutAction: dto.timeoutAction,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
      ncMeta,
    );

    this.logger.log(`创建审批节点: ${node.id} in flow ${flowId}`);

    // 如果是第一个节点，设置为起始节点
    const nodes = await ApprovalNode.getByFlowId(flowId, ncMeta);
    if (nodes.length === 1 && dto.nodeType === NodeType.START) {
      await ApprovalFlow.update(flowId, { startNodeId: node.id }, ncMeta);
    }

    return node;
  }

  /**
   * 更新审批节点
   */
  async updateNode(
    nodeId: string,
    dto: UpdateApprovalNodeDto,
    ncMeta = Noco.ncMeta,
  ): Promise<ApprovalNode> {
    const node = await ApprovalNode.get({ id: nodeId }, ncMeta);
    if (!node) {
      throw new NotFoundException('审批节点不存在');
    }

    const updated = await ApprovalNode.update(
      nodeId,
      {
        ...dto,
        updatedAt: new Date(),
      },
      ncMeta,
    );

    this.logger.log(`更新审批节点: ${nodeId}`);
    return updated;
  }

  /**
   * 删除审批节点
   */
  async deleteNode(
    nodeId: string,
    ncMeta = Noco.ncMeta,
  ): Promise<void> {
    const node = await ApprovalNode.get({ id: nodeId }, ncMeta);
    if (!node) {
      throw new NotFoundException('审批节点不存在');
    }

    // 更新其他节点的引用
    const nodes = await ApprovalNode.getByFlowId(node.flowId, ncMeta);
    for (const n of nodes) {
      if (n.nextNodeId === nodeId) {
        await ApprovalNode.update(n.id, { nextNodeId: null }, ncMeta);
      }
      if (n.trueNodeId === nodeId) {
        await ApprovalNode.update(n.id, { trueNodeId: null }, ncMeta);
      }
      if (n.falseNodeId === nodeId) {
        await ApprovalNode.update(n.id, { falseNodeId: null }, ncMeta);
      }
    }

    // 删除节点相关的条件
    const conditions = await ApprovalCondition.getByNodeId(nodeId, ncMeta);
    for (const condition of conditions) {
      await ApprovalCondition.delete(condition.id, ncMeta);
    }

    await ApprovalNode.delete(nodeId, ncMeta);
    this.logger.log(`删除审批节点: ${nodeId}`);
  }

  /**
   * 获取节点详情
   */
  async getNode(
    nodeId: string,
    ncMeta = Noco.ncMeta,
  ): Promise<NodeWithConditions> {
    const node = await ApprovalNode.get({ id: nodeId }, ncMeta);
    if (!node) {
      throw new NotFoundException('审批节点不存在');
    }

    const conditions = await ApprovalCondition.getByNodeId(nodeId, ncMeta);

    return {
      ...node,
      conditions,
    };
  }

  /**
   * 创建条件规则
   */
  async createCondition(
    nodeId: string,
    dto: CreateConditionDto,
    ncMeta = Noco.ncMeta,
  ): Promise<ApprovalCondition> {
    const node = await ApprovalNode.get({ id: nodeId }, ncMeta);
    if (!node) {
      throw new NotFoundException('审批节点不存在');
    }

    if (node.nodeType !== NodeType.CONDITION) {
      throw new Error('只有条件节点可以添加条件规则');
    }

    const condition = await ApprovalCondition.insert(
      {
        id: nanoid(),
        nodeId,
        name: dto.name,
        field: dto.field,
        operator: dto.operator,
        value: dto.value,
        valueType: dto.valueType,
        groupId: dto.groupId,
        logicOperator: dto.logicOperator,
        order: dto.order,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
      ncMeta,
    );

    this.logger.log(`创建条件规则: ${condition.id} in node ${nodeId}`);
    return condition;
  }

  /**
   * 复制审批流
   */
  async copyFlow(
    flowId: string,
    newName: string,
    createdBy: string,
    ncMeta = Noco.ncMeta,
  ): Promise<ApprovalFlow> {
    const sourceFlow = await this.getFlow(flowId, ncMeta);

    // 创建新流程
    const newFlow = await this.createFlow(
      {
        name: newName,
        description: sourceFlow.description,
        projectType: sourceFlow.projectType,
        version: 1,
        status: FlowStatus.DRAFT,
      },
      createdBy,
      ncMeta,
    );

    // 复制节点映射
    const nodeIdMap = new Map<string, string>();

    // 按顺序创建节点
    const sortedNodes = sourceFlow.nodes.sort((a, b) => a.order - b.order);

    // 第一轮：创建所有节点
    for (const node of sortedNodes) {
      const newNode = await this.createNode(
        newFlow.id,
        {
          name: node.name,
          nodeType: node.nodeType,
          approverType: node.approverType,
          approverIds: node.approverIds,
          approverRole: node.approverRole,
          departmentId: node.departmentId,
          counterSignType: node.counterSignType,
          minApprovals: node.minApprovals,
          maxRejections: node.maxRejections,
          order: node.order,
          timeoutHours: node.timeoutHours,
          timeoutAction: node.timeoutAction,
        },
        ncMeta,
      );
      nodeIdMap.set(node.id, newNode.id);
    }

    // 第二轮：更新节点连接
    for (const node of sortedNodes) {
      const newNodeId = nodeIdMap.get(node.id);
      if (!newNodeId) continue;

      const update: Partial<ApprovalNode> = {};
      if (node.nextNodeId) {
        update.nextNodeId = nodeIdMap.get(node.nextNodeId) || undefined;
      }
      if (node.trueNodeId) {
        update.trueNodeId = nodeIdMap.get(node.trueNodeId) || undefined;
      }
      if (node.falseNodeId) {
        update.falseNodeId = nodeIdMap.get(node.falseNodeId) || undefined;
      }

      if (Object.keys(update).length > 0) {
        await ApprovalNode.update(newNodeId, update, ncMeta);
      }

      // 复制条件规则
      if (node.nodeType === NodeType.CONDITION) {
        const conditions = await ApprovalCondition.getByNodeId(node.id, ncMeta);
        for (const condition of conditions) {
          await ApprovalCondition.insert(
            {
              id: nanoid(),
              nodeId: newNodeId,
              name: condition.name,
              field: condition.field,
              operator: condition.operator,
              value: condition.value,
              valueType: condition.valueType,
              groupId: condition.groupId,
              logicOperator: condition.logicOperator,
              order: condition.order,
              createdAt: new Date(),
              updatedAt: new Date(),
            },
            ncMeta,
          );
        }
      }
    }

    this.logger.log(`复制审批流: ${flowId} -> ${newFlow.id}`);
    return newFlow;
  }
}

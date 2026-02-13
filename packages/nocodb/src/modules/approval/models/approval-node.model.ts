import { MetaTable } from '~/utils/globals';
import { extractProps } from '~/helpers/extractProps';
import Noco from '~/Noco';

export enum NodeType {
  START = 'start',
  APPROVAL = 'approval',
  CONDITION = 'condition',
  PARALLEL = 'parallel',
  END = 'end',
}

export enum ApproverType {
  USER = 'user',
  ROLE = 'role',
  DEPARTMENT_HEAD = 'department_head',
  PROJECT_MANAGER = 'project_manager',
  SELF = 'self',
}

export enum CounterSignType {
  NONE = 'none',
  PARALLEL_ALL = 'parallel_all',
  PARALLEL_ANY = 'parallel_any',
  SEQUENTIAL = 'sequential',
}

/**
 * 审批节点模型
 * 定义审批流程中的各个节点
 */
export class ApprovalNode {
  id: string;
  flowId: string;
  name: string;
  nodeType: NodeType;

  // 节点配置
  approverType?: ApproverType;
  approverIds?: string[];
  approverRole?: string;
  departmentId?: string;

  // 会签配置
  counterSignType: CounterSignType;
  minApprovals?: number;
  maxRejections?: number;

  // 节点连接
  nextNodeId?: string;
  trueNodeId?: string;  // 条件为真时的下一个节点
  falseNodeId?: string; // 条件为假时的下一个节点

  // 顺序
  order: number;

  // 超时配置
  timeoutHours?: number;
  timeoutAction?: 'auto_approve' | 'auto_reject' | 'notify';

  createdAt: Date;
  updatedAt: Date;

  constructor(data: Partial<ApprovalNode>) {
    Object.assign(this, data);
  }

  protected static castType(node: ApprovalNode): ApprovalNode {
    return node && new ApprovalNode(node);
  }

  public static async insert(
    node: Partial<ApprovalNode>,
    ncMeta = Noco.ncMeta,
  ): Promise<ApprovalNode> {
    const insertObj = extractProps(node, [
      'id',
      'flowId',
      'name',
      'nodeType',
      'approverType',
      'approverIds',
      'approverRole',
      'departmentId',
      'counterSignType',
      'minApprovals',
      'maxRejections',
      'nextNodeId',
      'trueNodeId',
      'falseNodeId',
      'order',
      'timeoutHours',
      'timeoutAction',
    ]);

    const { id } = await ncMeta.metaInsert(
      null,
      null,
      MetaTable.APPROVAL_NODES,
      insertObj,
    );

    return this.get({ id }, ncMeta);
  }

  public static async update(
    nodeId: string,
    update: Partial<ApprovalNode>,
    ncMeta = Noco.ncMeta,
  ): Promise<ApprovalNode> {
    const updateObj = extractProps(update, [
      'name',
      'nodeType',
      'approverType',
      'approverIds',
      'approverRole',
      'departmentId',
      'counterSignType',
      'minApprovals',
      'maxRejections',
      'nextNodeId',
      'trueNodeId',
      'falseNodeId',
      'order',
      'timeoutHours',
      'timeoutAction',
    ]);

    await ncMeta.metaUpdate(
      null,
      null,
      MetaTable.APPROVAL_NODES,
      nodeId,
      updateObj,
    );

    return this.get({ id: nodeId }, ncMeta);
  }

  public static async get(
    { id }: { id: string },
    ncMeta = Noco.ncMeta,
  ): Promise<ApprovalNode> {
    const node = await ncMeta.metaGet(null, null, MetaTable.APPROVAL_NODES, id);
    return this.castType(node);
  }

  public static async getByFlowId(
    flowId: string,
    ncMeta = Noco.ncMeta,
  ): Promise<ApprovalNode[]> {
    const nodes = await ncMeta.metaList(null, null, MetaTable.APPROVAL_NODES, {
      condition: { flowId },
    });
    return nodes.map((n) => this.castType(n));
  }

  public static async delete(
    nodeId: string,
    ncMeta = Noco.ncMeta,
  ): Promise<void> {
    await ncMeta.metaDelete(null, null, MetaTable.APPROVAL_NODES, nodeId);
  }

  /**
   * 判断节点是否需要会签
   */
  public requiresCounterSign(): boolean {
    return this.counterSignType !== CounterSignType.NONE;
  }

  /**
   * 判断是否为并行会签
   */
  public isParallelCounterSign(): boolean {
    return (
      this.counterSignType === CounterSignType.PARALLEL_ALL ||
      this.counterSignType === CounterSignType.PARALLEL_ANY
    );
  }

  /**
   * 判断是否为顺序会签
   */
  public isSequentialCounterSign(): boolean {
    return this.counterSignType === CounterSignType.SEQUENTIAL;
  }
}

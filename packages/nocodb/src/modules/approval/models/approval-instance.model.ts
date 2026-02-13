import { MetaTable } from '~/utils/globals';
import { extractProps } from '~/helpers/extractProps';
import Noco from '~/Noco';

export enum InstanceStatus {
  PENDING = 'pending',
  RUNNING = 'running',
  APPROVED = 'approved',
  REJECTED = 'rejected',
  CANCELLED = 'cancelled',
  ERROR = 'error',
}

/**
 * 审批实例模型
 * 表示一次具体的审批流程执行
 */
export class ApprovalInstance {
  id: string;
  flowId: string;
  currentNodeId?: string;

  // 业务对象
  businessType: string;
  businessId: string;

  // 发起信息
  initiatedBy: string;
  initiatedAt: Date;

  // 状态
  status: InstanceStatus;
  result?: 'approved' | 'rejected';

  // 上下文数据（用于条件判断）
  contextData?: Record<string, any>;

  // 完成信息
  completedAt?: Date;
  completedBy?: string;

  createdAt: Date;
  updatedAt: Date;

  constructor(data: Partial<ApprovalInstance>) {
    Object.assign(this, data);
  }

  protected static castType(instance: ApprovalInstance): ApprovalInstance {
    return instance && new ApprovalInstance(instance);
  }

  public static async insert(
    instance: Partial<ApprovalInstance>,
    ncMeta = Noco.ncMeta,
  ): Promise<ApprovalInstance> {
    const insertObj = extractProps(instance, [
      'id',
      'flowId',
      'currentNodeId',
      'businessType',
      'businessId',
      'initiatedBy',
      'initiatedAt',
      'status',
      'contextData',
    ]);

    const { id } = await ncMeta.metaInsert(
      null,
      null,
      MetaTable.APPROVAL_INSTANCES,
      insertObj,
    );

    return this.get({ id }, ncMeta);
  }

  public static async update(
    instanceId: string,
    update: Partial<ApprovalInstance>,
    ncMeta = Noco.ncMeta,
  ): Promise<ApprovalInstance> {
    const updateObj = extractProps(update, [
      'currentNodeId',
      'status',
      'result',
      'contextData',
      'completedAt',
      'completedBy',
    ]);

    await ncMeta.metaUpdate(
      null,
      null,
      MetaTable.APPROVAL_INSTANCES,
      instanceId,
      updateObj,
    );

    return this.get({ id: instanceId }, ncMeta);
  }

  public static async get(
    { id }: { id: string },
    ncMeta = Noco.ncMeta,
  ): Promise<ApprovalInstance> {
    const instance = await ncMeta.metaGet(
      null,
      null,
      MetaTable.APPROVAL_INSTANCES,
      id,
    );
    return this.castType(instance);
  }

  public static async getByBusinessId(
    businessType: string,
    businessId: string,
    ncMeta = Noco.ncMeta,
  ): Promise<ApprovalInstance | null> {
    const instances = await ncMeta.metaList(
      null,
      null,
      MetaTable.APPROVAL_INSTANCES,
      {
        condition: { businessType, businessId },
      },
    );
    return instances.length > 0 ? this.castType(instances[0]) : null;
  }

  public static async list(
    filter: {
      flowId?: string;
      status?: InstanceStatus;
      initiatedBy?: string;
      businessType?: string;
    } = {},
    ncMeta = Noco.ncMeta,
  ): Promise<ApprovalInstance[]> {
    const instances = await ncMeta.metaList(
      null,
      null,
      MetaTable.APPROVAL_INSTANCES,
      { condition: filter },
    );
    return instances.map((i) => this.castType(i));
  }

  /**
   * 检查实例是否已完成
   */
  public isCompleted(): boolean {
    return [
      InstanceStatus.APPROVED,
      InstanceStatus.REJECTED,
      InstanceStatus.CANCELLED,
      InstanceStatus.ERROR,
    ].includes(this.status);
  }

  /**
   * 检查实例是否处于活动状态
   */
  public isActive(): boolean {
    return [InstanceStatus.PENDING, InstanceStatus.RUNNING].includes(this.status);
  }
}

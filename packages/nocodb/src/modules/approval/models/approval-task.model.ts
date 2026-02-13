import { MetaTable } from '~/utils/globals';
import { extractProps } from '~/helpers/extractProps';
import Noco from '~/Noco';

export enum TaskStatus {
  PENDING = 'pending',
  ASSIGNED = 'assigned',
  IN_PROGRESS = 'in_progress',
  APPROVED = 'approved',
  REJECTED = 'rejected',
  TRANSFERRED = 'transferred',
  DELEGATED = 'delegated',
  SKIPPED = 'skipped',
  TIMEOUT = 'timeout',
}

/**
 * 审批任务模型
 * 表示分配给具体用户的审批任务
 */
export class ApprovalTask {
  id: string;
  instanceId: string;
  nodeId: string;

  // 审批人
  assigneeId: string;
  assigneeType: 'primary' | 'delegate' | 'transfer';

  // 原始审批人（委派/转办时使用）
  originalAssigneeId?: string;

  // 任务状态
  status: TaskStatus;
  action?: 'approve' | 'reject' | 'transfer' | 'delegate';

  // 审批意见
  comment?: string;
  attachments?: string[];

  // 时间戳
  assignedAt: Date;
  startedAt?: Date;
  completedAt?: Date;
  dueAt?: Date;

  // 转办/委派信息
  delegatedTo?: string;
  transferredTo?: string;

  createdAt: Date;
  updatedAt: Date;

  constructor(data: Partial<ApprovalTask>) {
    Object.assign(this, data);
  }

  protected static castType(task: ApprovalTask): ApprovalTask {
    return task && new ApprovalTask(task);
  }

  public static async insert(
    task: Partial<ApprovalTask>,
    ncMeta = Noco.ncMeta,
  ): Promise<ApprovalTask> {
    const insertObj = extractProps(task, [
      'id',
      'instanceId',
      'nodeId',
      'assigneeId',
      'assigneeType',
      'originalAssigneeId',
      'status',
      'assignedAt',
      'dueAt',
    ]);

    const { id } = await ncMeta.metaInsert(
      null,
      null,
      MetaTable.APPROVAL_TASKS,
      insertObj,
    );

    return this.get({ id }, ncMeta);
  }

  public static async update(
    taskId: string,
    update: Partial<ApprovalTask>,
    ncMeta = Noco.ncMeta,
  ): Promise<ApprovalTask> {
    const updateObj = extractProps(update, [
      'status',
      'action',
      'comment',
      'attachments',
      'startedAt',
      'completedAt',
      'delegatedTo',
      'transferredTo',
    ]);

    await ncMeta.metaUpdate(
      null,
      null,
      MetaTable.APPROVAL_TASKS,
      taskId,
      updateObj,
    );

    return this.get({ id: taskId }, ncMeta);
  }

  public static async get(
    { id }: { id: string },
    ncMeta = Noco.ncMeta,
  ): Promise<ApprovalTask> {
    const task = await ncMeta.metaGet(null, null, MetaTable.APPROVAL_TASKS, id);
    return this.castType(task);
  }

  public static async list(
    filter: {
      instanceId?: string;
      nodeId?: string;
      assigneeId?: string;
      status?: TaskStatus;
    } = {},
    ncMeta = Noco.ncMeta,
  ): Promise<ApprovalTask[]> {
    const tasks = await ncMeta.metaList(null, null, MetaTable.APPROVAL_TASKS, {
      condition: filter,
    });
    return tasks.map((t) => this.castType(t));
  }

  public static async getByInstanceAndNode(
    instanceId: string,
    nodeId: string,
    ncMeta = Noco.ncMeta,
  ): Promise<ApprovalTask[]> {
    return this.list({ instanceId, nodeId }, ncMeta);
  }

  public static async getPendingByAssignee(
    assigneeId: string,
    ncMeta = Noco.ncMeta,
  ): Promise<ApprovalTask[]> {
    return this.list(
      {
        assigneeId,
        status: TaskStatus.PENDING,
      },
      ncMeta,
    );
  }

  /**
   * 完成任务
   */
  public async complete(
    action: 'approve' | 'reject',
    comment?: string,
    attachments?: string[],
    ncMeta = Noco.ncMeta,
  ): Promise<void> {
    await ApprovalTask.update(
      this.id,
      {
        status: action === 'approve' ? TaskStatus.APPROVED : TaskStatus.REJECTED,
        action,
        comment,
        attachments,
        completedAt: new Date(),
      },
      ncMeta,
    );
  }

  /**
   * 转办任务
   */
  public async transfer(
    newAssigneeId: string,
    comment?: string,
    ncMeta = Noco.ncMeta,
  ): Promise<ApprovalTask> {
    // 创建新任务给被转办人
    const newTask = await ApprovalTask.insert(
      {
        instanceId: this.instanceId,
        nodeId: this.nodeId,
        assigneeId: newAssigneeId,
        assigneeType: 'transfer',
        originalAssigneeId: this.assigneeId,
        status: TaskStatus.PENDING,
        assignedAt: new Date(),
      },
      ncMeta,
    );

    // 更新原任务状态
    await ApprovalTask.update(
      this.id,
      {
        status: TaskStatus.TRANSFERRED,
        transferredTo: newAssigneeId,
        comment,
        completedAt: new Date(),
      },
      ncMeta,
    );

    return newTask;
  }

  /**
   * 委派任务
   */
  public async delegate(
    delegateId: string,
    comment?: string,
    ncMeta = Noco.ncMeta,
  ): Promise<ApprovalTask> {
    // 创建委派任务
    const delegateTask = await ApprovalTask.insert(
      {
        instanceId: this.instanceId,
        nodeId: this.nodeId,
        assigneeId: delegateId,
        assigneeType: 'delegate',
        originalAssigneeId: this.assigneeId,
        status: TaskStatus.PENDING,
        assignedAt: new Date(),
      },
      ncMeta,
    );

    // 更新原任务状态
    await ApprovalTask.update(
      this.id,
      {
        status: TaskStatus.DELEGATED,
        delegatedTo: delegateId,
        comment,
      },
      ncMeta,
    );

    return delegateTask;
  }

  /**
   * 检查任务是否已完成
   */
  public isCompleted(): boolean {
    return [
      TaskStatus.APPROVED,
      TaskStatus.REJECTED,
      TaskStatus.TRANSFERRED,
      TaskStatus.SKIPPED,
      TaskStatus.TIMEOUT,
    ].includes(this.status);
  }
}

import type { NcContext } from '~/interface/config';
import Noco from '~/Noco';
import {
  CacheDelDirection,
  CacheGetType,
  CacheScope,
  MetaTable,
} from '~/utils/globals';
import NocoCache from '~/cache/NocoCache';
import { extractProps } from '~/helpers/extractProps';

export interface ApprovalInstanceType {
  id?: string;
  fk_workflow_id: string;
  fk_model_id: string;
  row_id: string;
  status?: 'pending' | 'approved' | 'rejected' | 'cancelled';
  current_approvers?: string[];
  approved_by?: string[];
  rejected_by?: string[];
  current_step?: number;
  total_steps?: number;
  comments?: string;
  started_at?: string;
  completed_at?: string;
  base_id?: string;
  fk_workspace_id?: string;
  created_by?: string;
  created_at?: string;
  updated_at?: string;
}

export default class ApprovalInstance implements ApprovalInstanceType {
  id?: string;
  fk_workflow_id: string;
  fk_model_id: string;
  row_id: string;
  status?: 'pending' | 'approved' | 'rejected' | 'cancelled';
  current_approvers?: string[];
  approved_by?: string[];
  rejected_by?: string[];
  current_step?: number;
  total_steps?: number;
  comments?: string;
  started_at?: string;
  completed_at?: string;
  base_id?: string;
  fk_workspace_id?: string;
  created_by?: string;
  created_at?: string;
  updated_at?: string;

  constructor(data: ApprovalInstanceType) {
    Object.assign(this, data);
    // Parse JSON fields if they are strings
    ['current_approvers', 'approved_by', 'rejected_by'].forEach((field) => {
      if (typeof this[field] === 'string') {
        try {
          this[field] = JSON.parse(this[field]);
        } catch (e) {
          this[field] = [];
        }
      }
    });
  }

  public static async get(
    context: NcContext,
    instanceId: string,
    ncMeta = Noco.ncMeta,
  ): Promise<ApprovalInstance | null> {
    let instance =
      instanceId &&
      (await NocoCache.get(
        context,
        `${CacheScope.WORKFLOW_EXECUTION}:${instanceId}`,
        CacheGetType.TYPE_OBJECT,
      ));
    if (!instance) {
      instance = await ncMeta.metaGet2(
        context.workspace_id,
        context.base_id,
        MetaTable.APPROVAL_INSTANCES,
        instanceId,
      );
      if (instanceId && instance) {
        await NocoCache.set(
          context,
          `${CacheScope.WORKFLOW_EXECUTION}:${instanceId}`,
          instance,
        );
      }
    }
    return instance && new ApprovalInstance(instance);
  }

  public static async getByRecord(
    context: NcContext,
    param: {
      fk_model_id: string;
      row_id: string;
    },
    ncMeta = Noco.ncMeta,
  ): Promise<ApprovalInstance | null> {
    const instances = await ncMeta.metaList2(
      context.workspace_id,
      context.base_id,
      MetaTable.APPROVAL_INSTANCES,
      {
        condition: {
          fk_model_id: param.fk_model_id,
          row_id: param.row_id,
        },
        orderBy: {
          created_at: 'desc',
        },
      },
    );
    return instances?.[0] ? new ApprovalInstance(instances[0]) : null;
  }

  public static async list(
    context: NcContext,
    param: {
      fk_workflow_id?: string;
      status?: string;
      created_by?: string;
      base_id?: string;
    } = {},
    ncMeta = Noco.ncMeta,
  ): Promise<ApprovalInstance[]> {
    const condition: any = {
      base_id: param.base_id || context.base_id,
    };
    if (param.fk_workflow_id) condition.fk_workflow_id = param.fk_workflow_id;
    if (param.status) condition.status = param.status;
    if (param.created_by) condition.created_by = param.created_by;

    const instances = await ncMeta.metaList2(
      context.workspace_id,
      context.base_id,
      MetaTable.APPROVAL_INSTANCES,
      {
        condition,
        orderBy: {
          created_at: 'desc',
        },
      },
    );

    return instances?.map((i) => new ApprovalInstance(i)) || [];
  }

  public static async listPendingForUser(
    context: NcContext,
    userId: string,
    ncMeta = Noco.ncMeta,
  ): Promise<ApprovalInstance[]> {
    // Get all pending instances
    const instances = await ncMeta.metaList2(
      context.workspace_id,
      context.base_id,
      MetaTable.APPROVAL_INSTANCES,
      {
        condition: {
          base_id: context.base_id,
          status: 'pending',
        },
      },
    );

    // Filter by current_approvers containing userId
    return instances
      ?.filter((i) => {
        const approvers =
          typeof i.current_approvers === 'string'
            ? JSON.parse(i.current_approvers || '[]')
            : i.current_approvers || [];
        return approvers.includes(userId);
      })
      .map((i) => new ApprovalInstance(i));
  }

  public static async insert(
    context: NcContext,
    instance: Partial<ApprovalInstanceType>,
    ncMeta = Noco.ncMeta,
  ): Promise<ApprovalInstance> {
    const insertObj = extractProps(instance, [
      'fk_workflow_id',
      'fk_model_id',
      'row_id',
      'status',
      'current_approvers',
      'approved_by',
      'rejected_by',
      'current_step',
      'total_steps',
      'comments',
      'started_at',
      'completed_at',
      'base_id',
      'created_by',
    ]);

    // Serialize JSON fields
    ['current_approvers', 'approved_by', 'rejected_by'].forEach((field) => {
      if (insertObj[field] && typeof insertObj[field] === 'object') {
        insertObj[field] = JSON.stringify(insertObj[field]);
      }
    });

    const { id } = await ncMeta.metaInsert2(
      context.workspace_id,
      context.base_id,
      MetaTable.APPROVAL_INSTANCES,
      insertObj,
    );

    return this.get(context, id, ncMeta);
  }

  public static async update(
    context: NcContext,
    instanceId: string,
    instance: Partial<ApprovalInstanceType>,
    ncMeta = Noco.ncMeta,
  ): Promise<ApprovalInstance> {
    const updateObj = extractProps(instance, [
      'status',
      'current_approvers',
      'approved_by',
      'rejected_by',
      'current_step',
      'comments',
      'completed_at',
    ]);

    // Serialize JSON fields
    ['current_approvers', 'approved_by', 'rejected_by'].forEach((field) => {
      if (updateObj[field] && typeof updateObj[field] === 'object') {
        updateObj[field] = JSON.stringify(updateObj[field]);
      }
    });

    await ncMeta.metaUpdate(
      context.workspace_id,
      context.base_id,
      MetaTable.APPROVAL_INSTANCES,
      updateObj,
      instanceId,
    );

    await NocoCache.update(
      context,
      `${CacheScope.WORKFLOW_EXECUTION}:${instanceId}`,
      updateObj,
    );

    return this.get(context, instanceId, ncMeta);
  }

  public static async updateStatus(
    context: NcContext,
    instanceId: string,
    status: 'approved' | 'rejected' | 'cancelled',
    ncMeta = Noco.ncMeta,
  ): Promise<ApprovalInstance> {
    const updateObj: any = { status };
    if (status !== 'pending') {
      updateObj.completed_at = new Date().toISOString();
    }

    await ncMeta.metaUpdate(
      context.workspace_id,
      context.base_id,
      MetaTable.APPROVAL_INSTANCES,
      updateObj,
      instanceId,
    );

    await NocoCache.update(
      context,
      `${CacheScope.WORKFLOW_EXECUTION}:${instanceId}`,
      updateObj,
    );

    return this.get(context, instanceId, ncMeta);
  }

  public static async delete(
    context: NcContext,
    instanceId: string,
    ncMeta = Noco.ncMeta,
  ): Promise<boolean> {
    await NocoCache.deepDel(
      context,
      `${CacheScope.WORKFLOW_EXECUTION}:${instanceId}`,
      CacheDelDirection.CHILD_TO_PARENT,
    );

    await ncMeta.metaDelete(
      context.workspace_id,
      context.base_id,
      MetaTable.APPROVAL_INSTANCES,
      instanceId,
    );

    return true;
  }
}

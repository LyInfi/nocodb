import type { NcContext } from '~/interface/config';
import Noco from '~/Noco';
import { MetaTable } from '~/utils/globals';
import { extractProps } from '~/helpers/extractProps';

export interface ApprovalHistoryType {
  id?: string;
  fk_instance_id: string;
  action: 'submit' | 'approve' | 'reject' | 'comment' | 'escalate' | 'transfer';
  action_by: string;
  comments?: string;
  action_data?: any;
  base_id?: string;
  fk_workspace_id?: string;
  created_at?: string;
}

export default class ApprovalHistory implements ApprovalHistoryType {
  id?: string;
  fk_instance_id: string;
  action: 'submit' | 'approve' | 'reject' | 'comment' | 'escalate' | 'transfer';
  action_by: string;
  comments?: string;
  action_data?: any;
  base_id?: string;
  fk_workspace_id?: string;
  created_at?: string;

  constructor(data: ApprovalHistoryType) {
    Object.assign(this, data);
    if (typeof this.action_data === 'string') {
      try {
        this.action_data = JSON.parse(this.action_data);
      } catch (e) {
        this.action_data = {};
      }
    }
  }

  public static async get(
    context: NcContext,
    historyId: string,
    ncMeta = Noco.ncMeta,
  ): Promise<ApprovalHistory | null> {
    const history = await ncMeta.metaGet2(
      context.workspace_id,
      context.base_id,
      MetaTable.APPROVAL_HISTORY,
      historyId,
    );
    return history && new ApprovalHistory(history);
  }

  public static async listByInstance(
    context: NcContext,
    instanceId: string,
    ncMeta = Noco.ncMeta,
  ): Promise<ApprovalHistory[]> {
    const histories = await ncMeta.metaList2(
      context.workspace_id,
      context.base_id,
      MetaTable.APPROVAL_HISTORY,
      {
        condition: {
          fk_instance_id: instanceId,
        },
        orderBy: {
          created_at: 'desc',
        },
      },
    );
    return histories?.map((h) => new ApprovalHistory(h)) || [];
  }

  public static async insert(
    context: NcContext,
    history: Partial<ApprovalHistoryType>,
    ncMeta = Noco.ncMeta,
  ): Promise<ApprovalHistory> {
    const insertObj = extractProps(history, [
      'fk_instance_id',
      'action',
      'action_by',
      'comments',
      'action_data',
      'base_id',
    ]);

    if (
      insertObj.action_data &&
      typeof insertObj.action_data === 'object'
    ) {
      insertObj.action_data = JSON.stringify(insertObj.action_data);
    }

    const { id } = await ncMeta.metaInsert2(
      context.workspace_id,
      context.base_id,
      MetaTable.APPROVAL_HISTORY,
      insertObj,
    );

    return this.get(context, id, ncMeta);
  }

  public static async deleteByInstance(
    context: NcContext,
    instanceId: string,
    ncMeta = Noco.ncMeta,
  ): Promise<void> {
    await ncMeta.metaDelete(
      context.workspace_id,
      context.base_id,
      MetaTable.APPROVAL_HISTORY,
      {
        fk_instance_id: instanceId,
      },
    );
  }
}

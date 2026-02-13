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

export interface ApprovalWorkflowType {
  id?: string;
  name: string;
  description?: string;
  project_type: string;
  version?: number;
  is_active?: boolean;
  base_id?: string;
  fk_workspace_id?: string;
  workflow_config?: any;
  created_at?: string;
  updated_at?: string;
}

export default class ApprovalWorkflow implements ApprovalWorkflowType {
  id?: string;
  name: string;
  description?: string;
  project_type: string;
  version?: number;
  is_active?: boolean;
  base_id?: string;
  fk_workspace_id?: string;
  workflow_config?: any;
  created_at?: string;
  updated_at?: string;

  constructor(data: ApprovalWorkflowType) {
    Object.assign(this, data);
    if (typeof this.workflow_config === 'string') {
      try {
        this.workflow_config = JSON.parse(this.workflow_config);
      } catch (e) {
        this.workflow_config = {};
      }
    }
  }

  public static async get(
    context: NcContext,
    workflowId: string,
    ncMeta = Noco.ncMeta,
  ): Promise<ApprovalWorkflow | null> {
    let workflow =
      workflowId &&
      (await NocoCache.get(
        context,
        `${CacheScope.WORKFLOW}:${workflowId}`,
        CacheGetType.TYPE_OBJECT,
      ));
    if (!workflow) {
      workflow = await ncMeta.metaGet2(
        context.workspace_id,
        context.base_id,
        MetaTable.APPROVAL_WORKFLOWS,
        workflowId,
      );
      if (workflowId && workflow) {
        await NocoCache.set(
          context,
          `${CacheScope.WORKFLOW}:${workflowId}`,
          workflow,
        );
      }
    }
    return workflow && new ApprovalWorkflow(workflow);
  }

  public static async getByProjectType(
    context: NcContext,
    projectType: string,
    ncMeta = Noco.ncMeta,
  ): Promise<ApprovalWorkflow | null> {
    const workflows = await ncMeta.metaList2(
      context.workspace_id,
      context.base_id,
      MetaTable.APPROVAL_WORKFLOWS,
      {
        condition: {
          project_type: projectType,
          is_active: true,
        },
      },
    );
    return workflows?.[0] ? new ApprovalWorkflow(workflows[0]) : null;
  }

  public static async list(
    context: NcContext,
    param: {
      base_id?: string;
      is_active?: boolean;
    } = {},
    ncMeta = Noco.ncMeta,
  ): Promise<ApprovalWorkflow[]> {
    const cachedList = await NocoCache.getList(context, CacheScope.WORKFLOW, [
      param.base_id || context.base_id,
    ]);
    let { list: workflows } = cachedList;
    const { isNoneList } = cachedList;

    if (!isNoneList && !workflows.length) {
      workflows = await ncMeta.metaList2(
        context.workspace_id,
        context.base_id,
        MetaTable.APPROVAL_WORKFLOWS,
        {
          condition: {
            base_id: param.base_id || context.base_id,
            ...(param.is_active !== undefined && { is_active: param.is_active }),
          },
        },
      );
      await NocoCache.setList(
        context,
        CacheScope.WORKFLOW,
        [param.base_id || context.base_id],
        workflows,
      );
    }

    return workflows?.map((w) => new ApprovalWorkflow(w)) || [];
  }

  public static async insert(
    context: NcContext,
    workflow: Partial<ApprovalWorkflowType>,
    ncMeta = Noco.ncMeta,
  ): Promise<ApprovalWorkflow> {
    const insertObj = extractProps(workflow, [
      'name',
      'description',
      'project_type',
      'version',
      'is_active',
      'base_id',
      'workflow_config',
    ]);

    if (
      insertObj.workflow_config &&
      typeof insertObj.workflow_config === 'object'
    ) {
      insertObj.workflow_config = JSON.stringify(insertObj.workflow_config);
    }

    const { id } = await ncMeta.metaInsert2(
      context.workspace_id,
      context.base_id,
      MetaTable.APPROVAL_WORKFLOWS,
      insertObj,
    );

    return this.get(context, id, ncMeta).then(async (wf) => {
      await NocoCache.appendToList(
        context,
        CacheScope.WORKFLOW,
        [wf.base_id],
        `${CacheScope.WORKFLOW}:${id}`,
      );
      return wf;
    });
  }

  public static async update(
    context: NcContext,
    workflowId: string,
    workflow: Partial<ApprovalWorkflowType>,
    ncMeta = Noco.ncMeta,
  ): Promise<ApprovalWorkflow> {
    const updateObj = extractProps(workflow, [
      'name',
      'description',
      'project_type',
      'version',
      'is_active',
      'workflow_config',
    ]);

    if (
      updateObj.workflow_config &&
      typeof updateObj.workflow_config === 'object'
    ) {
      updateObj.workflow_config = JSON.stringify(updateObj.workflow_config);
    }

    await ncMeta.metaUpdate(
      context.workspace_id,
      context.base_id,
      MetaTable.APPROVAL_WORKFLOWS,
      updateObj,
      workflowId,
    );

    await NocoCache.update(
      context,
      `${CacheScope.WORKFLOW}:${workflowId}`,
      updateObj,
    );

    return this.get(context, workflowId, ncMeta);
  }

  public static async delete(
    context: NcContext,
    workflowId: string,
    ncMeta = Noco.ncMeta,
  ): Promise<boolean> {
    await NocoCache.deepDel(
      context,
      `${CacheScope.WORKFLOW}:${workflowId}`,
      CacheDelDirection.CHILD_TO_PARENT,
    );

    await ncMeta.metaDelete(
      context.workspace_id,
      context.base_id,
      MetaTable.APPROVAL_WORKFLOWS,
      workflowId,
    );

    return true;
  }
}

import { MetaTable } from '~/utils/globals';
import { extractProps } from '~/helpers/extractProps';
import Noco from '~/Noco';
import type { NcContext } from '~/interface/config';

export enum ProjectType {
  BASIC_RESEARCH = 'basic_research',
  CLINICAL_RESEARCH = 'clinical_research',
  TECH_DEVELOPMENT = 'tech_development',
}

export enum FlowStatus {
  ACTIVE = 'active',
  INACTIVE = 'inactive',
  DRAFT = 'draft',
}

/**
 * 审批流定义模型
 * 存储审批流程的模板定义
 */
export class ApprovalFlow {
  id: string;
  name: string;
  description?: string;
  projectType: ProjectType;
  version: number;
  status: FlowStatus;
  startNodeId?: string;
  createdBy: string;
  createdAt: Date;
  updatedAt: Date;
  deletedAt?: Date;

  constructor(data: Partial<ApprovalFlow>) {
    Object.assign(this, data);
  }

  protected static castType(flow: ApprovalFlow): ApprovalFlow {
    return flow && new ApprovalFlow(flow);
  }

  public static async insert(
    flow: Partial<ApprovalFlow>,
    ncMeta = Noco.ncMeta,
  ): Promise<ApprovalFlow> {
    const insertObj = extractProps(flow, [
      'id',
      'name',
      'description',
      'projectType',
      'version',
      'status',
      'startNodeId',
      'createdBy',
    ]);

    const { id } = await ncMeta.metaInsert(
      null,
      null,
      MetaTable.APPROVAL_FLOWS,
      insertObj,
    );

    return this.get({ id }, ncMeta);
  }

  public static async update(
    flowId: string,
    update: Partial<ApprovalFlow>,
    ncMeta = Noco.ncMeta,
  ): Promise<ApprovalFlow> {
    const updateObj = extractProps(update, [
      'name',
      'description',
      'projectType',
      'version',
      'status',
      'startNodeId',
    ]);

    await ncMeta.metaUpdate(
      null,
      null,
      MetaTable.APPROVAL_FLOWS,
      flowId,
      updateObj,
    );

    return this.get({ id: flowId }, ncMeta);
  }

  public static async get(
    { id }: { id: string },
    ncMeta = Noco.ncMeta,
  ): Promise<ApprovalFlow> {
    const flow = await ncMeta.metaGet(null, null, MetaTable.APPROVAL_FLOWS, id);
    return this.castType(flow);
  }

  public static async list(
    filter: { projectType?: ProjectType; status?: FlowStatus } = {},
    ncMeta = Noco.ncMeta,
  ): Promise<ApprovalFlow[]> {
    const flows = await ncMeta.metaList(null, null, MetaTable.APPROVAL_FLOWS, {
      condition: filter,
    });
    return flows.map((f) => this.castType(f));
  }

  public static async getActiveFlowByProjectType(
    projectType: ProjectType,
    ncMeta = Noco.ncMeta,
  ): Promise<ApprovalFlow | null> {
    const flows = await this.list({ projectType, status: FlowStatus.ACTIVE }, ncMeta);
    return flows.length > 0 ? flows[0] : null;
  }

  public static async softDelete(
    flowId: string,
    ncMeta = Noco.ncMeta,
  ): Promise<void> {
    await ncMeta.metaUpdate(
      null,
      null,
      MetaTable.APPROVAL_FLOWS,
      flowId,
      { deletedAt: new Date() },
    );
  }
}

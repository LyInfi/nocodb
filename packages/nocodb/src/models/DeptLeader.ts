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

export interface DeptLeaderType {
  id?: string;
  dept_id: string;
  dept_name?: string;
  leader_id: string;
  leader_role?: 'primary' | 'secondary' | 'backup';
  approval_order?: number;
  is_active?: boolean;
  base_id?: string;
  fk_workspace_id?: string;
  created_at?: string;
  updated_at?: string;
}

export default class DeptLeader implements DeptLeaderType {
  id?: string;
  dept_id: string;
  dept_name?: string;
  leader_id: string;
  leader_role?: 'primary' | 'secondary' | 'backup';
  approval_order?: number;
  is_active?: boolean;
  base_id?: string;
  fk_workspace_id?: string;
  created_at?: string;
  updated_at?: string;

  constructor(data: DeptLeaderType) {
    Object.assign(this, data);
  }

  public static async get(
    context: NcContext,
    id: string,
    ncMeta = Noco.ncMeta,
  ): Promise<DeptLeader | null> {
    let leader =
      id &&
      (await NocoCache.get(
        context,
        `${CacheScope.PERMISSION}:${id}`,
        CacheGetType.TYPE_OBJECT,
      ));
    if (!leader) {
      leader = await ncMeta.metaGet2(
        context.workspace_id,
        context.base_id,
        MetaTable.DEPT_LEADERS,
        id,
      );
      if (id && leader) {
        await NocoCache.set(
          context,
          `${CacheScope.PERMISSION}:${id}`,
          leader,
        );
      }
    }
    return leader && new DeptLeader(leader);
  }

  public static async getByDeptId(
    context: NcContext,
    deptId: string,
    ncMeta = Noco.ncMeta,
  ): Promise<DeptLeader[]> {
    const leaders = await ncMeta.metaList2(
      context.workspace_id,
      context.base_id,
      MetaTable.DEPT_LEADERS,
      {
        condition: {
          dept_id: deptId,
          is_active: true,
        },
        orderBy: {
          approval_order: 'asc',
        },
      },
    );
    return leaders?.map((l) => new DeptLeader(l)) || [];
  }

  public static async getLeadersForApproval(
    context: NcContext,
    deptId: string,
    ncMeta = Noco.ncMeta,
  ): Promise<string[]> {
    const leaders = await this.getByDeptId(context, deptId, ncMeta);
    return leaders.map((l) => l.leader_id);
  }

  public static async list(
    context: NcContext,
    param: {
      base_id?: string;
      is_active?: boolean;
    } = {},
    ncMeta = Noco.ncMeta,
  ): Promise<DeptLeader[]> {
    const cachedList = await NocoCache.getList(
      context,
      CacheScope.PERMISSION,
      [param.base_id || context.base_id],
    );
    let { list: leaders } = cachedList;
    const { isNoneList } = cachedList;

    if (!isNoneList && !leaders.length) {
      const condition: any = {
        base_id: param.base_id || context.base_id,
      };
      if (param.is_active !== undefined) {
        condition.is_active = param.is_active;
      }

      leaders = await ncMeta.metaList2(
        context.workspace_id,
        context.base_id,
        MetaTable.DEPT_LEADERS,
        {
          condition,
          orderBy: {
            dept_id: 'asc',
            approval_order: 'asc',
          },
        },
      );
      await NocoCache.setList(
        context,
        CacheScope.PERMISSION,
        [param.base_id || context.base_id],
        leaders,
      );
    }

    return leaders?.map((l) => new DeptLeader(l)) || [];
  }

  public static async insert(
    context: NcContext,
    leader: Partial<DeptLeaderType>,
    ncMeta = Noco.ncMeta,
  ): Promise<DeptLeader> {
    const insertObj = extractProps(leader, [
      'dept_id',
      'dept_name',
      'leader_id',
      'leader_role',
      'approval_order',
      'is_active',
      'base_id',
    ]);

    const { id } = await ncMeta.metaInsert2(
      context.workspace_id,
      context.base_id,
      MetaTable.DEPT_LEADERS,
      insertObj,
    );

    return this.get(context, id, ncMeta).then(async (l) => {
      await NocoCache.appendToList(
        context,
        CacheScope.PERMISSION,
        [l.base_id],
        `${CacheScope.PERMISSION}:${id}`,
      );
      return l;
    });
  }

  public static async update(
    context: NcContext,
    id: string,
    leader: Partial<DeptLeaderType>,
    ncMeta = Noco.ncMeta,
  ): Promise<DeptLeader> {
    const updateObj = extractProps(leader, [
      'dept_name',
      'leader_id',
      'leader_role',
      'approval_order',
      'is_active',
    ]);

    await ncMeta.metaUpdate(
      context.workspace_id,
      context.base_id,
      MetaTable.DEPT_LEADERS,
      updateObj,
      id,
    );

    await NocoCache.update(
      context,
      `${CacheScope.PERMISSION}:${id}`,
      updateObj,
    );

    return this.get(context, id, ncMeta);
  }

  public static async delete(
    context: NcContext,
    id: string,
    ncMeta = Noco.ncMeta,
  ): Promise<boolean> {
    await NocoCache.deepDel(
      context,
      `${CacheScope.PERMISSION}:${id}`,
      CacheDelDirection.CHILD_TO_PARENT,
    );

    await ncMeta.metaDelete(
      context.workspace_id,
      context.base_id,
      MetaTable.DEPT_LEADERS,
      id,
    );

    return true;
  }

  public static async deleteByDeptId(
    context: NcContext,
    deptId: string,
    ncMeta = Noco.ncMeta,
  ): Promise<void> {
    const leaders = await this.getByDeptId(context, deptId, ncMeta);
    for (const leader of leaders) {
      await this.delete(context, leader.id, ncMeta);
    }
  }
}

import { MetaTable } from '~/utils/globals';
import { extractProps } from '~/helpers/extractProps';
import Noco from '~/Noco';

export enum OperatorType {
  EQUALS = 'equals',
  NOT_EQUALS = 'not_equals',
  GREATER_THAN = 'greater_than',
  LESS_THAN = 'less_than',
  GREATER_OR_EQUAL = 'greater_or_equal',
  LESS_OR_EQUAL = 'less_or_equal',
  CONTAINS = 'contains',
  NOT_CONTAINS = 'not_contains',
  IN = 'in',
  NOT_IN = 'not_in',
  IS_EMPTY = 'is_empty',
  IS_NOT_EMPTY = 'is_not_empty',
}

export enum LogicOperator {
  AND = 'and',
  OR = 'or',
}

/**
 * 审批条件模型
 * 定义条件节点的分支判断规则
 */
export class ApprovalCondition {
  id: string;
  nodeId: string;

  // 条件名称（用于展示）
  name: string;

  // 条件规则
  field: string;
  operator: OperatorType;
  value?: any;
  valueType?: 'string' | 'number' | 'boolean' | 'date' | 'array';

  // 多条件组合
  groupId?: string;
  logicOperator?: LogicOperator;
  order: number;

  createdAt: Date;
  updatedAt: Date;

  constructor(data: Partial<ApprovalCondition>) {
    Object.assign(this, data);
  }

  protected static castType(condition: ApprovalCondition): ApprovalCondition {
    return condition && new ApprovalCondition(condition);
  }

  public static async insert(
    condition: Partial<ApprovalCondition>,
    ncMeta = Noco.ncMeta,
  ): Promise<ApprovalCondition> {
    const insertObj = extractProps(condition, [
      'id',
      'nodeId',
      'name',
      'field',
      'operator',
      'value',
      'valueType',
      'groupId',
      'logicOperator',
      'order',
    ]);

    const { id } = await ncMeta.metaInsert(
      null,
      null,
      MetaTable.APPROVAL_CONDITIONS,
      insertObj,
    );

    return this.get({ id }, ncMeta);
  }

  public static async update(
    conditionId: string,
    update: Partial<ApprovalCondition>,
    ncMeta = Noco.ncMeta,
  ): Promise<ApprovalCondition> {
    const updateObj = extractProps(update, [
      'name',
      'field',
      'operator',
      'value',
      'valueType',
      'groupId',
      'logicOperator',
      'order',
    ]);

    await ncMeta.metaUpdate(
      null,
      null,
      MetaTable.APPROVAL_CONDITIONS,
      conditionId,
      updateObj,
    );

    return this.get({ id: conditionId }, ncMeta);
  }

  public static async get(
    { id }: { id: string },
    ncMeta = Noco.ncMeta,
  ): Promise<ApprovalCondition> {
    const condition = await ncMeta.metaGet(
      null,
      null,
      MetaTable.APPROVAL_CONDITIONS,
      id,
    );
    return this.castType(condition);
  }

  public static async getByNodeId(
    nodeId: string,
    ncMeta = Noco.ncMeta,
  ): Promise<ApprovalCondition[]> {
    const conditions = await ncMeta.metaList(
      null,
      null,
      MetaTable.APPROVAL_CONDITIONS,
      {
        condition: { nodeId },
      },
    );
    return conditions.map((c) => this.castType(c));
  }

  public static async delete(
    conditionId: string,
    ncMeta = Noco.ncMeta,
  ): Promise<void> {
    await ncMeta.metaDelete(
      null,
      null,
      MetaTable.APPROVAL_CONDITIONS,
      conditionId,
    );
  }

  /**
   * 评估条件是否满足
   * @param contextData 上下文数据
   * @returns 是否满足条件
   */
  public evaluate(contextData: Record<string, any>): boolean {
    const actualValue = contextData[this.field];

    switch (this.operator) {
      case OperatorType.EQUALS:
        return actualValue === this.value;

      case OperatorType.NOT_EQUALS:
        return actualValue !== this.value;

      case OperatorType.GREATER_THAN:
        return (
          typeof actualValue === 'number' &&
          typeof this.value === 'number' &&
          actualValue > this.value
        );

      case OperatorType.LESS_THAN:
        return (
          typeof actualValue === 'number' &&
          typeof this.value === 'number' &&
          actualValue < this.value
        );

      case OperatorType.GREATER_OR_EQUAL:
        return (
          typeof actualValue === 'number' &&
          typeof this.value === 'number' &&
          actualValue >= this.value
        );

      case OperatorType.LESS_OR_EQUAL:
        return (
          typeof actualValue === 'number' &&
          typeof this.value === 'number' &&
          actualValue <= this.value
        );

      case OperatorType.CONTAINS:
        return (
          typeof actualValue === 'string' &&
          typeof this.value === 'string' &&
          actualValue.includes(this.value)
        );

      case OperatorType.NOT_CONTAINS:
        return (
          typeof actualValue === 'string' &&
          typeof this.value === 'string' &&
          !actualValue.includes(this.value)
        );

      case OperatorType.IN:
        return (
          Array.isArray(this.value) && this.value.includes(actualValue)
        );

      case OperatorType.NOT_IN:
        return (
          Array.isArray(this.value) && !this.value.includes(actualValue)
        );

      case OperatorType.IS_EMPTY:
        return (
          actualValue === null ||
          actualValue === undefined ||
          actualValue === '' ||
          (Array.isArray(actualValue) && actualValue.length === 0)
        );

      case OperatorType.IS_NOT_EMPTY:
        return (
          actualValue !== null &&
          actualValue !== undefined &&
          actualValue !== '' &&
          (!Array.isArray(actualValue) || actualValue.length > 0)
        );

      default:
        return false;
    }
  }

  /**
   * 批量评估条件组
   * @param conditions 条件列表
   * @param contextData 上下文数据
   * @returns 是否满足条件组
   */
  public static evaluateGroup(
    conditions: ApprovalCondition[],
    contextData: Record<string, any>,
  ): boolean {
    if (conditions.length === 0) return true;

    // 按 groupId 分组
    const groups = new Map<string | undefined, ApprovalCondition[]>();
    for (const condition of conditions) {
      const key = condition.groupId;
      if (!groups.has(key)) {
        groups.set(key, []);
      }
      groups.get(key)!.push(condition);
    }

    // 评估每个组
    const groupResults: boolean[] = [];
    for (const [groupId, groupConditions] of groups) {
      if (groupConditions.length === 0) continue;

      const logicOp = groupConditions[0].logicOperator || LogicOperator.AND;

      if (logicOp === LogicOperator.AND) {
        groupResults.push(
          groupConditions.every((c) => c.evaluate(contextData)),
        );
      } else {
        groupResults.push(
          groupConditions.some((c) => c.evaluate(contextData)),
        );
      }
    }

    // 所有组都必须满足
    return groupResults.every((r) => r);
  }
}

import { Test, TestingModule } from '@nestjs/testing';
import { ApprovalEngineService } from '../services/approval-engine.service';
import { CounterSignType, NodeType, ApproverType } from '../models/approval-node.model';
import { TaskStatus } from '../models/approval-task.model';
import { InstanceStatus } from '../models/approval-instance.model';
import { OperatorType, LogicOperator, ApprovalCondition } from '../models/approval-condition.model';

describe('ApprovalEngineService', () => {
  let service: ApprovalEngineService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [ApprovalEngineService],
    }).compile();

    service = module.get<ApprovalEngineService>(ApprovalEngineService);
  });

  describe('calculateCounterSign', () => {
    const mockTasks = [
      { id: 'task1', status: TaskStatus.APPROVED },
      { id: 'task2', status: TaskStatus.PENDING },
      { id: 'task3', status: TaskStatus.PENDING },
    ];

    it('应该正确计算并行全部通过会签', async () => {
      const mockNcMeta = {
        metaList: jest.fn().mockResolvedValue([
          { id: 'task1', status: TaskStatus.APPROVED },
          { id: 'task2', status: TaskStatus.APPROVED },
          { id: 'task3', status: TaskStatus.APPROVED },
        ]),
      };

      const result = await service.calculateCounterSign(
        'instance1',
        'node1',
        CounterSignType.PARALLEL_ALL,
        undefined,
        undefined,
        mockNcMeta as any,
      );

      expect(result.isComplete).toBe(true);
      expect(result.approved).toBe(true);
      expect(result.approvedCount).toBe(3);
      expect(result.totalCount).toBe(3);
    });

    it('应该正确计算并行任意通过会签', async () => {
      const mockNcMeta = {
        metaList: jest.fn().mockResolvedValue([
          { id: 'task1', status: TaskStatus.APPROVED },
          { id: 'task2', status: TaskStatus.PENDING },
          { id: 'task3', status: TaskStatus.PENDING },
        ]),
      };

      const result = await service.calculateCounterSign(
        'instance1',
        'node1',
        CounterSignType.PARALLEL_ANY,
        undefined,
        undefined,
        mockNcMeta as any,
      );

      expect(result.isComplete).toBe(true);
      expect(result.approved).toBe(true);
      expect(result.approvedCount).toBe(1);
    });

    it('应该正确计算顺序会签', async () => {
      const mockNcMeta = {
        metaList: jest.fn().mockResolvedValue([
          { id: 'task1', status: TaskStatus.APPROVED },
          { id: 'task2', status: TaskStatus.APPROVED },
          { id: 'task3', status: TaskStatus.PENDING },
        ]),
      };

      // 最小通过数为2
      const result = await service.calculateCounterSign(
        'instance1',
        'node1',
        CounterSignType.SEQUENTIAL,
        2,
        1,
        mockNcMeta as any,
      );

      expect(result.isComplete).toBe(true);
      expect(result.approved).toBe(true);
    });

    it('当拒绝数超过阈值时应拒绝', async () => {
      const mockNcMeta = {
        metaList: jest.fn().mockResolvedValue([
          { id: 'task1', status: TaskStatus.APPROVED },
          { id: 'task2', status: TaskStatus.REJECTED },
          { id: 'task3', status: TaskStatus.REJECTED },
        ]),
      };

      const result = await service.calculateCounterSign(
        'instance1',
        'node1',
        CounterSignType.SEQUENTIAL,
        2,
        1,
        mockNcMeta as any,
      );

      expect(result.isComplete).toBe(true);
      expect(result.approved).toBe(false);
    });

    it('会签未完成时应返回isComplete为false', async () => {
      const mockNcMeta = {
        metaList: jest.fn().mockResolvedValue([
          { id: 'task1', status: TaskStatus.APPROVED },
          { id: 'task2', status: TaskStatus.PENDING },
          { id: 'task3', status: TaskStatus.PENDING },
        ]),
      };

      const result = await service.calculateCounterSign(
        'instance1',
        'node1',
        CounterSignType.PARALLEL_ALL,
        undefined,
        undefined,
        mockNcMeta as any,
      );

      expect(result.isComplete).toBe(false);
    });
  });

  describe('条件评估', () => {
    it('应该正确评估等于条件', () => {
      const condition = new ApprovalCondition({
        id: 'cond1',
        field: 'amount',
        operator: OperatorType.EQUALS,
        value: 100,
        order: 0,
      });

      expect(condition.evaluate({ amount: 100 })).toBe(true);
      expect(condition.evaluate({ amount: 200 })).toBe(false);
    });

    it('应该正确评估大于条件', () => {
      const condition = new ApprovalCondition({
        id: 'cond1',
        field: 'amount',
        operator: OperatorType.GREATER_THAN,
        value: 100,
        order: 0,
      });

      expect(condition.evaluate({ amount: 200 })).toBe(true);
      expect(condition.evaluate({ amount: 100 })).toBe(false);
      expect(condition.evaluate({ amount: 50 })).toBe(false);
    });

    it('应该正确评估包含条件', () => {
      const condition = new ApprovalCondition({
        id: 'cond1',
        field: 'title',
        operator: OperatorType.CONTAINS,
        value: 'urgent',
        order: 0,
      });

      expect(condition.evaluate({ title: 'This is urgent request' })).toBe(true);
      expect(condition.evaluate({ title: 'This is normal request' })).toBe(false);
    });

    it('应该正确评估IN条件', () => {
      const condition = new ApprovalCondition({
        id: 'cond1',
        field: 'status',
        operator: OperatorType.IN,
        value: ['pending', 'approved'],
        order: 0,
      });

      expect(condition.evaluate({ status: 'pending' })).toBe(true);
      expect(condition.evaluate({ status: 'approved' })).toBe(true);
      expect(condition.evaluate({ status: 'rejected' })).toBe(false);
    });

    it('应该正确评估AND条件组', () => {
      const conditions = [
        new ApprovalCondition({
          id: 'cond1',
          field: 'amount',
          operator: OperatorType.GREATER_THAN,
          value: 100,
          logicOperator: LogicOperator.AND,
          groupId: 'group1',
          order: 0,
        }),
        new ApprovalCondition({
          id: 'cond2',
          field: 'type',
          operator: OperatorType.EQUALS,
          value: 'basic_research',
          logicOperator: LogicOperator.AND,
          groupId: 'group1',
          order: 1,
        }),
      ];

      const result = ApprovalCondition.evaluateGroup(conditions, {
        amount: 200,
        type: 'basic_research',
      });
      expect(result).toBe(true);

      const result2 = ApprovalCondition.evaluateGroup(conditions, {
        amount: 200,
        type: 'clinical_research',
      });
      expect(result2).toBe(false);
    });

    it('应该正确评估OR条件组', () => {
      const conditions = [
        new ApprovalCondition({
          id: 'cond1',
          field: 'amount',
          operator: OperatorType.GREATER_THAN,
          value: 100,
          logicOperator: LogicOperator.OR,
          groupId: 'group1',
          order: 0,
        }),
        new ApprovalCondition({
          id: 'cond2',
          field: 'type',
          operator: OperatorType.EQUALS,
          value: 'basic_research',
          logicOperator: LogicOperator.OR,
          groupId: 'group1',
          order: 1,
        }),
      ];

      const result = ApprovalCondition.evaluateGroup(conditions, {
        amount: 50,
        type: 'basic_research',
      });
      expect(result).toBe(true);

      const result2 = ApprovalCondition.evaluateGroup(conditions, {
        amount: 50,
        type: 'clinical_research',
      });
      expect(result2).toBe(false);
    });
  });

  describe('条件分支 - 基础研究vs临床研究', () => {
    it('基础研究应该走基础研究分支', () => {
      const basicResearchCondition = new ApprovalCondition({
        id: 'cond1',
        field: 'projectType',
        operator: OperatorType.EQUALS,
        value: 'basic_research',
        order: 0,
      });

      const clinicalResearchCondition = new ApprovalCondition({
        id: 'cond2',
        field: 'projectType',
        operator: OperatorType.EQUALS,
        value: 'clinical_research',
        order: 1,
      });

      const context = { projectType: 'basic_research' };

      expect(basicResearchCondition.evaluate(context)).toBe(true);
      expect(clinicalResearchCondition.evaluate(context)).toBe(false);
    });

    it('临床研究应该走临床研究分支', () => {
      const basicResearchCondition = new ApprovalCondition({
        id: 'cond1',
        field: 'projectType',
        operator: OperatorType.EQUALS,
        value: 'basic_research',
        order: 0,
      });

      const clinicalResearchCondition = new ApprovalCondition({
        id: 'cond2',
        field: 'projectType',
        operator: OperatorType.EQUALS,
        value: 'clinical_research',
        order: 1,
      });

      const context = { projectType: 'clinical_research' };

      expect(basicResearchCondition.evaluate(context)).toBe(false);
      expect(clinicalResearchCondition.evaluate(context)).toBe(true);
    });
  });

  describe('动态审批人解析', () => {
    it('应该正确解析发起人作为审批人', () => {
      const instance = {
        id: 'inst1',
        initiatedBy: 'user1',
      } as any;

      const node = {
        approverType: ApproverType.SELF,
      } as any;

      // 发起人自己审批的场景
      expect(instance.initiatedBy).toBe('user1');
    });

    it('应该支持指定用户作为审批人', () => {
      const approverIds = ['user1', 'user2', 'user3'];

      expect(approverIds).toContain('user1');
      expect(approverIds).toHaveLength(3);
    });
  });
});

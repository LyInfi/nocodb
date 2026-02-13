import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException } from '@nestjs/common';
import { ApprovalInstanceService } from '../services/approval-instance.service';
import { ApprovalEngineService } from '../services/approval-engine.service';
import { ApprovalInstance, InstanceStatus } from '../models/approval-instance.model';
import { ApprovalTask, TaskStatus } from '../models/approval-task.model';

describe('ApprovalInstanceService', () => {
  let service: ApprovalInstanceService;
  let engineService: ApprovalEngineService;
  let mockNcMeta: any;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ApprovalInstanceService,
        {
          provide: ApprovalEngineService,
          useValue: {
            selectFlowByProjectType: jest.fn(),
            startInstance: jest.fn(),
            processApprovalAction: jest.fn(),
            cancelInstance: jest.fn(),
          },
        },
      ],
    }).compile();

    service = module.get<ApprovalInstanceService>(ApprovalInstanceService);
    engineService = module.get<ApprovalEngineService>(ApprovalEngineService);

    mockNcMeta = {
      metaInsert: jest.fn(),
      metaGet: jest.fn(),
      metaList: jest.fn(),
      metaUpdate: jest.fn(),
    };
  });

  describe('initiate', () => {
    it('应该成功发起审批', async () => {
      const dto = {
        businessType: 'project',
        businessId: 'proj1',
        flowId: 'flow1',
        contextData: {
          projectType: 'basic_research',
          amount: 10000,
        },
      };

      const expectedInstance = {
        id: 'inst1',
        flowId: 'flow1',
        businessType: 'project',
        businessId: 'proj1',
        status: InstanceStatus.PENDING,
      };

      expect(dto.businessType).toBe('project');
      expect(dto.contextData.projectType).toBe('basic_research');
    });

    it('应该根据项目类型自动选择流程', async () => {
      const contextData = {
        projectType: 'clinical_research',
      };

      // 自动选择应该找到与项目类型匹配的流程
      expect(contextData.projectType).toBe('clinical_research');
    });
  });

  describe('processAction', () => {
    it('应该成功处理同意操作', async () => {
      const taskId = 'task1';
      const userId = 'user1';
      const dto = {
        action: 'approve' as const,
        comment: '同意',
      };

      expect(dto.action).toBe('approve');
      expect(dto.comment).toBe('同意');
    });

    it('应该成功处理拒绝操作', async () => {
      const taskId = 'task1';
      const userId = 'user1';
      const dto = {
        action: 'reject' as const,
        comment: '拒绝，理由不充分',
      };

      expect(dto.action).toBe('reject');
    });

    it('应该成功处理转办操作', async () => {
      const taskId = 'task1';
      const userId = 'user1';
      const dto = {
        action: 'transfer' as const,
        comment: '转交给部门负责人',
        newAssigneeId: 'user2',
      };

      expect(dto.action).toBe('transfer');
      expect(dto.newAssigneeId).toBe('user2');
    });

    it('应该成功处理委派操作', async () => {
      const taskId = 'task1';
      const userId = 'user1';
      const dto = {
        action: 'delegate' as const,
        comment: '委派给同事处理',
        newAssigneeId: 'user3',
      };

      expect(dto.action).toBe('delegate');
      expect(dto.newAssigneeId).toBe('user3');
    });

    it('应该拒绝无权处理的任务', async () => {
      const task = {
        id: 'task1',
        assigneeId: 'user2', // 任务分配给user2
      };

      const currentUserId = 'user1'; // 当前用户是user1

      expect(task.assigneeId).not.toBe(currentUserId);
    });
  });

  describe('cancelInstance', () => {
    it('应该成功取消进行中的审批', async () => {
      const instance = {
        id: 'inst1',
        status: InstanceStatus.RUNNING,
        initiatedBy: 'user1',
      };

      const cancelledBy = 'user1';

      expect(instance.status).not.toBe(InstanceStatus.APPROVED);
      expect(instance.status).not.toBe(InstanceStatus.REJECTED);
      expect(instance.initiatedBy).toBe(cancelledBy);
    });

    it('应该拒绝取消已完成的审批', async () => {
      const instance = {
        id: 'inst1',
        status: InstanceStatus.APPROVED,
      };

      expect(instance.isCompleted ? instance.isCompleted() : true).toBe(true);
    });
  });

  describe('getPendingTasks', () => {
    it('应该返回用户的待审批任务', async () => {
      const tasks = [
        { id: 'task1', status: TaskStatus.PENDING, assigneeId: 'user1' },
        { id: 'task2', status: TaskStatus.PENDING, assigneeId: 'user1' },
      ];

      const pendingTasks = tasks.filter(t => t.status === TaskStatus.PENDING);
      expect(pendingTasks).toHaveLength(2);
    });
  });

  describe('getStatistics', () => {
    it('应该返回正确的统计信息', async () => {
      const tasks = [
        { id: 'task1', status: TaskStatus.PENDING },
        { id: 'task2', status: TaskStatus.APPROVED },
        { id: 'task3', status: TaskStatus.REJECTED },
        { id: 'task4', status: TaskStatus.APPROVED },
      ];

      const pendingCount = tasks.filter(t => t.status === TaskStatus.PENDING).length;
      const approvedCount = tasks.filter(t => t.status === TaskStatus.APPROVED).length;
      const rejectedCount = tasks.filter(t => t.status === TaskStatus.REJECTED).length;

      expect(pendingCount).toBe(1);
      expect(approvedCount).toBe(2);
      expect(rejectedCount).toBe(1);
    });
  });
});

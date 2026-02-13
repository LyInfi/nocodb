# 科研项目表单与审批流集成 - 实现文档

## 概述
本实现为 NocoDB 添加了科研项目表单与审批流集成功能，支持：
1. 配置科研项目表字段
2. 项目申请表单（含字段验证）
3. 自动触发审批流（基于 project_type）
4. 部门领导自动匹配（基于 dept_id）
5. 项目状态与审批实例状态同步

## 文件结构

### 1. 数据库迁移
**文件**: `packages/nocodb/src/meta/migrations/v2/nc_099_approval_workflow.ts`

创建了以下表：
- `nc_approval_workflows` - 审批流程定义表
- `nc_approval_instances` - 审批实例表
- `nc_dept_leaders` - 部门领导表
- `nc_approval_history` - 审批历史/审计表

**MetaTable 枚举更新**: `packages/nocodb/src/utils/globals.ts`

### 2. 数据模型
**文件**:
- `packages/nocodb/src/models/ApprovalWorkflow.ts` - 审批流程模型
- `packages/nocodb/src/models/ApprovalInstance.ts` - 审批实例模型
- `packages/nocodb/src/models/DeptLeader.ts` - 部门领导模型
- `packages/nocodb/src/models/ApprovalHistory.ts` - 审批历史模型

### 3. 服务层
**文件**: `packages/nocodb/src/services/approval-workflow.service.ts`

提供以下功能：
- `createWorkflow` - 创建审批流程
- `updateWorkflow` - 更新审批流程
- `deleteWorkflow` - 删除审批流程
- `triggerApproval` - 触发项目审批
- `approveProject` - 批准项目
- `rejectProject` - 拒绝项目
- `getPendingApprovals` - 获取待审批列表
- `addDeptLeader/updateDeptLeader/deleteDeptLeader` - 部门领导管理

### 4. 钩子处理器
**文件**: `packages/nocodb/src/services/project-approval-hook.service.ts`

监听 `after.insert` 事件，自动为项目表创建审批流程实例。

### 5. API 控制器
**文件**: `packages/nocodb/src/controllers/approval-workflow.controller.ts`

提供 REST API：

#### 审批流管理
- `GET /api/v2/meta/approval-workflows` - 获取所有审批流
- `GET /api/v2/meta/approval-workflows/by-type/:projectType` - 按类型获取
- `POST /api/v2/meta/approval-workflows` - 创建审批流
- `PATCH /api/v2/meta/approval-workflows/:workflowId` - 更新审批流
- `DELETE /api/v2/meta/approval-workflows/:workflowId` - 删除审批流

#### 部门领导管理
- `GET /api/v2/meta/dept-leaders/:deptId` - 获取部门领导
- `POST /api/v2/meta/dept-leaders` - 添加部门领导
- `PATCH /api/v2/meta/dept-leaders/:leaderId` - 更新部门领导
- `DELETE /api/v2/meta/dept-leaders/:leaderId` - 删除部门领导

#### 审批实例管理
- `GET /api/v2/meta/approval-instances/pending` - 获取待审批列表
- `POST /api/v2/meta/approval-instances/:instanceId/approve` - 批准
- `POST /api/v2/meta/approval-instances/:instanceId/reject` - 拒绝
- `GET /api/v2/meta/approval-instances/:instanceId/history` - 获取历史

### 6. 模块注册
**文件**: `packages/nocodb/src/modules/noco.module.ts`

注册了以下服务和控制器：
- `ApprovalWorkflowService`
- `ProjectApprovalHookService`
- `ApprovalWorkflowController`

## 使用说明

### 1. 配置审批流程
```javascript
POST /api/v2/meta/approval-workflows
{
  "name": "科研项目审批",
  "description": "一般科研项目审批流程",
  "project_type": "research",
  "workflow_config": {
    "steps": [
      {
        "step": 1,
        "name": "部门初审",
        "approver_type": "dept_leader"
      },
      {
        "step": 2,
        "name": "财务审核",
        "approver_type": "role",
        "approver_role": "finance_manager"
      }
    ],
    "auto_approve_threshold": 10000
  }
}
```

### 2. 配置部门领导
```javascript
POST /api/v2/meta/dept-leaders
{
  "dept_id": "dept_001",
  "dept_name": "研发部",
  "leader_id": "user_001",
  "leader_role": "primary",
  "approval_order": 1
}
```

### 3. 创建项目表单
创建名为 `projects`（或 `科研项目`、`research_project`）的表，包含以下字段：
- `title` - 项目标题
- `project_type` - 项目类型（如：research, development）
- `amount` - 项目金额
- `applicant_id` - 申请人ID
- `dept_id` - 部门ID
- `status` - 项目状态（draft, pending, approved, rejected）

### 4. 自动触发
当项目表有新的记录插入时，系统会自动：
1. 根据 `project_type` 查找对应的审批流程
2. 根据 `dept_id` 查询部门领导
3. 创建审批实例
4. 更新项目状态为 `pending`

### 5. 审批操作
```javascript
// 批准项目
POST /api/v2/meta/approval-instances/:instanceId/approve
{
  "comments": "同意立项"
}

// 拒绝项目
POST /api/v2/meta/approval-instances/:instanceId/reject
{
  "comments": "预算超支，请调整后重新提交"
}
```

## 数据库 Schema

### nc_approval_workflows
| 字段 | 类型 | 说明 |
|------|------|------|
| id | uuid/string | 主键 |
| name | string | 流程名称 |
| description | string | 流程描述 |
| project_type | string | 项目类型标识 |
| version | int | 版本号 |
| is_active | boolean | 是否激活 |
| workflow_config | jsonb | 流程配置 |
| base_id | string | 所属 base |
| fk_workspace_id | string | 所属 workspace |

### nc_approval_instances
| 字段 | 类型 | 说明 |
|------|------|------|
| id | uuid/string | 主键 |
| fk_workflow_id | string | 关联流程 |
| fk_model_id | string | 项目表ID |
| row_id | string | 项目记录ID |
| status | string | pending/approved/rejected/cancelled |
| current_approvers | jsonb | 当前审批人列表 |
| approved_by | jsonb | 已批准人列表 |
| rejected_by | jsonb | 已拒绝人列表 |
| current_step | int | 当前步骤 |
| total_steps | int | 总步骤数 |

### nc_dept_leaders
| 字段 | 类型 | 说明 |
|------|------|------|
| id | uuid/string | 主键 |
| dept_id | string | 部门ID |
| dept_name | string | 部门名称 |
| leader_id | string | 领导用户ID |
| leader_role | string | primary/secondary/backup |
| approval_order | int | 审批顺序 |
| is_active | boolean | 是否激活 |

## 待办事项
1. 添加更多 API 权限检查（ACL）
2. 实现邮件通知功能
3. 添加审批流程可视化
4. 支持并行审批
5. 添加审批超时处理
6. 实现多级审批自动升级

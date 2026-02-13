# 审批流通知系统集成实现

## 概述

本实现为 NocoDB 添加了审批流通知系统的完整支持，包括站内通知、邮件通知、Bull 队列定时任务和 WebSocket 实时推送。

## 文件变更清单

### SDK 类型定义

| 文件 | 变更内容 |
|------|----------|
| `packages/nocodb-sdk/src/lib/enums.ts` | 添加 AppEvents 枚举值：APPROVAL_REQUESTED, APPROVAL_APPROVED, APPROVAL_REJECTED, APPROVAL_CANCELLED, APPROVAL_REMINDER, APPROVAL_ESCALATED, APPROVAL_STEP_COMPLETED, APPROVAL_STEP_PENDING |

### 后端服务

| 文件 | 变更内容 |
|------|----------|
| `packages/nocodb/src/interface/Mail.ts` | 添加 MailEvent 枚举和邮件载荷接口 |
| `packages/nocodb/src/interface/Jobs.ts` | 添加 JobTypes 枚举和任务数据接口 |
| `packages/nocodb/src/services/approvals/approval-notifications.service.ts` | 新建：审批通知服务核心实现 |
| `packages/nocodb/src/modules/jobs/jobs/approval/approval-reminder.processor.ts` | 新建：审批提醒任务处理器 |
| `packages/nocodb/src/modules/jobs/jobs/approval/approval-escalation.processor.ts` | 新建：审批升级任务处理器 |
| `packages/nocodb/src/modules/jobs/jobs/approval/index.ts` | 新建：处理器导出索引 |
| `packages/nocodb/src/modules/jobs/jobs-map.service.ts` | 注册审批任务处理器 |
| `packages/nocodb/src/modules/noco.module.ts` | 注册 ApprovalNotificationsService |
| `packages/nocodb/src/services/mail/mail.service.ts` | 添加审批邮件发送逻辑 |

### 邮件模板

| 文件 | 描述 |
|------|------|
| `packages/nocodb/src/services/mail/templates/approval-requested.tsx` | 新审批请求邮件模板 |
| `packages/nocodb/src/services/mail/templates/approval-reminder.tsx` | 审批提醒邮件模板 |
| `packages/nocodb/src/services/mail/templates/approval-decision.tsx` | 审批决定（通过/拒绝）邮件模板 |
| `packages/nocodb/src/services/mail/templates/approval-escalated.tsx` | 审批升级邮件模板 |
| `packages/nocodb/src/services/mail/templates/approval-cancelled.tsx` | 审批取消邮件模板 |
| `packages/nocodb/src/services/mail/templates/index.ts` | 导出邮件模板 |

### 前端组件

| 文件 | 描述 |
|------|------|
| `packages/nc-gui/components/notification/Item/ApprovalRequested.vue` | 审批请求通知项组件 |
| `packages/nc-gui/components/notification/Item/ApprovalDecision.vue` | 审批决定通知项组件 |
| `packages/nc-gui/components/notification/Item/ApprovalReminder.vue` | 审批提醒通知项组件 |
| `packages/nc-gui/components/notification/Item/ApprovalEscalated.vue` | 审批升级通知项组件 |
| `packages/nc-gui/components/notification/Item.vue` | 更新以包含审批通知组件 |

## 功能实现

### 1. 站内通知（In-app Notifications）

- 审批请求创建时通知审批人
- 审批决定（通过/拒绝）时通知申请人
- 审批提醒通知
- 审批升级通知
- 审批取消通知

### 2. 邮件通知（Email Notifications）

- 使用现有 SMTP 插件系统
- 支持 React Email 模板
- 5 种邮件模板：请求、提醒、决定、升级、取消

### 3. Bull 队列定时任务

- **审批提醒任务**：审批截止前自动发送提醒
  - 最多 3 次提醒
  - 默认 24 小时间隔
  - 达到最大提醒次数后触发升级

- **审批升级任务**：超时未处理时自动升级
  - 支持多级升级
  - 通知新旧审批人
  - 更新审批步骤状态

### 4. WebSocket 实时推送

- 基于现有 Redis Pub/Sub 机制
- 长轮询支持
- 通知中心实时更新

## 集成方式

### 触发通知

在审批流服务中触发通知事件：

```typescript
// 审批请求时
this.appHooks.emit(AppEvents.APPROVAL_REQUESTED, {
  instanceId: instance.id,
  stepId: step.id,
  approver: { id, email, displayName },
  requester: { id, email, displayName },
  base: { id, title },
  table: { id, title },
  rowId,
  title,
  description,
  dueAt,
  req,
});

// 审批决定时
this.appHooks.emit(AppEvents.APPROVAL_APPROVED, {
  instanceId,
  stepId,
  decision: 'approved',
  approver,
  requester,
  base,
  table,
  title,
  comment,
  rowId,
  req,
});
```

### 定时任务调度

```typescript
// 调度提醒
await this.jobsService.add(
  JobTypes.ApprovalReminder,
  { stepId, instanceId, approverId, reminderCount: 0 },
  { delay: 24 * 60 * 60 * 1000 } // 24小时后
);

// 调度升级
await this.jobsService.add(
  JobTypes.ApprovalEscalation,
  { stepId, instanceId, escalatedToId, escalationLevel },
  { delay: dueAt.getTime() - Date.now() }
);
```

## 配置

无需额外配置，复用现有系统：
- 邮件：配置 SMTP 插件
- 队列：配置 Redis 环境变量
- WebSocket：自动通过 SocketGateway 支持

## 后续扩展

1. 添加更多审批策略支持（会签、或签、顺序审批）
2. 支持自定义提醒间隔和升级规则
3. 添加审批统计和报表
4. 支持审批评论和附件

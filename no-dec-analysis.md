# NocoDB 架构分析：改造为项目管理+审批流系统

## 1. 项目架构分析

### 1.1 前端技术栈

| 层级 | 技术 | 版本 |
|------|------|------|
| 框架 | Nuxt 3 + Vue 3 (Composition API) | Nuxt 3.17.4 / Vue 3.5.13 |
| 状态管理 | Pinia + Composable 注入模式 | Pinia 2.3.1 |
| UI 库 | Ant Design Vue | 3.2.20 |
| CSS | Windi CSS (Tailwind 替代) | 3.5.6 |
| 构建工具 | Vite (内置于 Nuxt) | — |
| 实时通信 | Socket.io Client | 4.8.1 |
| 富文本 | Tiptap | — |
| 代码编辑 | Monaco Editor | 0.52.2 |

**关键目录结构：**
```
packages/nc-gui/
├── pages/              # 文件路由（Nuxt Pages）
├── layouts/            # 布局：base.vue, shared-view.vue
├── components/
│   ├── smartsheet/     # 核心视图组件（Grid/Kanban/Calendar/Gallery/Form/Map）
│   ├── nc/             # 通用 UI 组件库
│   ├── cell/           # 单元格类型编辑器
│   ├── virtual-cell/   # 虚拟列（Lookup/Rollup/Formula）
│   ├── dashboard/      # 导航与项目管理
│   └── dlg/            # 对话框组件
├── composables/        # Vue 3 Composables（115+ 文件）
├── store/              # Pinia stores（views, bases, tables, workspace 等）
├── plugins/            # Nuxt 插件（API, Socket, i18n, Sentry 等）
├── context/            # Vue 注入键（150+ symbols）
└── lib/                # 类型定义、枚举、常量
```

### 1.2 后端技术栈

| 层级 | 技术 | 版本 |
|------|------|------|
| 框架 | NestJS + Express | NestJS 10.4.19 |
| 语言 | TypeScript | 5.7.3 |
| 数据库 ORM | Knex.js（SQL 查询构建器） | 3.1.0 |
| 认证 | Passport（JWT/OAuth/SAML/Local/Basic） | 0.7.0 |
| 缓存 | Redis (ioredis) | 5.6.1 |
| 任务队列 | Bull + Redis | 4.16.5 |
| WebSocket | Socket.io | 4.8.1 |
| AI 集成 | AI SDK (OpenAI + Anthropic) | 6.0.3 |

**关键目录结构：**
```
packages/nocodb/src/
├── main.ts                 # 入口（Express bootstrap）
├── Noco.ts                 # NestJS 应用初始化
├── app.module.ts           # 根模块
├── controllers/            # HTTP 路由处理器
├── services/               # 业务逻辑层
├── models/                 # 数据模型/实体
├── db/                     # 数据库层（BaseModelSqlv2 = 209KB 核心查询构建器）
├── meta/                   # 元数据库管理 + 迁移
├── modules/                # NestJS 模块（auth, oauth, jobs, event-emitter）
├── guards/                 # 认证守卫
├── strategies/             # Passport 认证策略
├── middlewares/             # 中间件（ACL extract-ids = 43KB）
├── plugins/                # 存储/通信插件（24 个）
├── cache/                  # 缓存层（Redis/Mock）
├── gateways/               # WebSocket 网关
└── utils/                  # 工具函数（acl.ts = 788 行权限定义）
```

**支持的数据库驱动：** MySQL, PostgreSQL, SQLite, Snowflake, Databricks, ClickHouse

### 1.3 数据库结构（元数据库）

NocoDB 使用"元数据库"追踪所有用户创建的表/视图/列。核心元表：

**核心实体表：**
| 元表 | 用途 |
|------|------|
| `nc_bases_v2` | 项目（Base） |
| `nc_sources_v2` | 数据源连接 |
| `nc_models_v2` | 用户表定义 |
| `nc_columns_v2` | 列定义 |
| `nc_views_v2` | 视图定义 |
| `nc_col_relations_v2` | 外键关系 |

**视图配置表：**
| 元表 | 用途 |
|------|------|
| `nc_grid_view_v2` / `nc_grid_view_columns_v2` | 网格视图 |
| `nc_kanban_view_v2` / `nc_kanban_view_columns_v2` | 看板视图 |
| `nc_calendar_view_v2` / `nc_calendar_view_columns_v2` | 日历视图 |
| `nc_gallery_view_v2` / `nc_gallery_view_columns_v2` | 画廊视图 |
| `nc_form_view_v2` / `nc_form_view_columns_v2` | 表单视图 |
| `nc_map_view_v2` / `nc_map_view_columns_v2` | 地图视图 |

**列类型配置表：**
| 元表 | 用途 |
|------|------|
| `nc_col_select_options_v2` | 单选/多选选项 |
| `nc_col_lookup_v2` | Lookup 列 |
| `nc_col_rollup_v2` | Rollup 聚合列 |
| `nc_col_formula_v2` | 公式列 |
| `nc_col_relations_v2` | 关联关系列 |

**用户与权限表：**
| 元表 | 用途 |
|------|------|
| `nc_users_v2` | 用户账户 |
| `nc_base_users_v2` | 项目级用户权限 |
| `nc_permissions` | 细粒度权限 |
| `nc_api_tokens` | API Token |

**系统功能表：**
| 元表 | 用途 |
|------|------|
| `nc_audit_v2` | 审计日志 |
| `nc_hooks_v2` | Webhooks |
| `nc_hook_logs_v2` | Webhook 执行日志 |
| `nc_comments` | 行级评论 |
| `notification` | 通知 |
| `nc_filter_exp_v2` | 过滤条件 |
| `nc_sort_v2` | 排序规则 |
| `nc_extensions` | 扩展 |
| `nc_integrations_v2` | 第三方集成 |
| `nc_plugins_v2` | 插件 |

### 1.4 插件/扩展机制

**三层扩展体系：**

1. **插件系统（Plugins）** — 24 个内置插件
   - 存储插件：S3, MinIO, GCS, R2, DigitalOcean Spaces 等
   - 通信插件：Slack, Discord, Mattermost, Teams, Twilio
   - 邮件插件：SMTP, AWS SES, MailerSend
   - 管理路由：`/api/v2/meta/plugins`

2. **扩展系统（Extensions）** — 基于 Base 的扩展
   - 路由：`/api/v2/meta/bases/:baseId/extensions`
   - 存储在 `nc_extensions` 表

3. **集成系统（Integrations）** — 第三方数据源连接
   - 基于注册表模式（`IntegrationRegistry` 单例）
   - 支持分类：Database, AI, Auth, Sync, Communication, SpreadSheet, **ProjectManagement**, CRM, Marketing, Ticketing, Storage, **WorkflowNode**
   - 同步系统支持：Full/Incremental 同步，Manual/Schedule/Webhook 触发
   - 内置同步 Schema：CRM、HRIS、Ticketing、File Storage

### 1.5 已有自动化/工作流系统

NocoDB 已有一个**自动化系统**（Automations），合并了 Workflow 和 Script：

**相关表：**
| 表 | 用途 | 关键字段 |
|----|------|---------|
| `nc_automations` | 自动化定义 | type (script/workflow), nodes (JSON), edges (JSON), enabled |
| `nc_automation_executions` | 执行记录 | workflow_data, execution_data, status, finished |
| `nc_automation_subscribers` | 订阅者 | fk_automation_id, fk_user_id, notify_on_error |
| `nc_dependency_tracker` | 依赖跟踪 | source_type, source_id, dependent_type, dependent_id |

**迁移文件路径：**
- `src/meta/migrations/v0/nc_004_workflows.ts` — 初始工作流
- `src/meta/migrations/v0/nc_011_merge_workflows_scripts.ts` — 合并为 Automations
- `src/meta/migrations/v0/nc_016_automation_error_notifications.ts` — 错误通知订阅

---

## 2. 现有功能盘点——可复用功能

### 2.1 直接可复用的核心功能

| 功能 | 复用度 | 说明 |
|------|--------|------|
| **看板视图（Kanban）** | ★★★★★ | 直接用于任务状态管理，支持拖拽、分组、堆叠 |
| **日历视图（Calendar）** | ★★★★★ | 直接用于排期/里程碑，支持月/周/日/年视图 |
| **网格视图（Grid）** | ★★★★★ | 任务列表、详细数据管理 |
| **画廊视图（Gallery）** | ★★★★☆ | 项目卡片概览 |
| **表单视图（Form）** | ★★★★★ | 需求收集、审批表单提交 |
| **关联关系（LTAR）** | ★★★★★ | 任务依赖、人员分配（多对多/一对多） |
| **Lookup/Rollup** | ★★★★★ | 跨表数据引用、进度汇总统计 |
| **公式列（Formula）** | ★★★★☆ | 自动计算（工时、进度百分比等） |
| **权限系统** | ★★★★☆ | Owner/Creator/Editor/Commenter/Viewer 五级角色 |
| **审计日志（Audit）** | ★★★★★ | 操作追踪、变更历史 |
| **通知系统** | ★★★★☆ | 用户通知（已有 CRUD，需扩展触发场景） |
| **Webhooks** | ★★★★☆ | 外部系统集成（支持重试、条件触发） |
| **评论系统（Comments）** | ★★★★★ | 行级评论/讨论 |
| **附件（Attachment）** | ★★★★★ | 文件上传（S3/GCS/MinIO 等存储插件） |
| **实时通信（Socket.io）** | ★★★★☆ | 实时数据同步 |
| **自动化系统** | ★★★☆☆ | 已有 nodes/edges 工作流结构，但功能尚未完善 |

### 2.2 SDK 中已有的字段类型

完整支持 30+ 字段类型，项目管理关键类型：
- **SingleSelect / MultiSelect** — 状态、优先级、标签
- **Date / DateTime** — 截止日期、里程碑
- **User / Collaborator** — 负责人、审批人
- **LinkToAnotherRecord** — 任务依赖、项目关联
- **Number / Percent / Duration** — 工时、进度
- **Checkbox** — 完成状态
- **Attachment** — 文件附件
- **LongText (Rich Text)** — 任务描述
- **Rating** — 优先级评分
- **Formula** — 计算字段

---

## 3. 项目管理改造方案

### 3.1 数据模型设计

基于 NocoDB 的表+视图体系，项目管理无需大量新建元表，而是通过**预置表模板 + 视图组合**实现：

#### 核心表模板

**Projects 表（项目）：**
| 字段 | 类型 | 说明 |
|------|------|------|
| Title | SingleLineText | 项目名称 |
| Description | LongText (Rich) | 项目描述 |
| Status | SingleSelect | 规划中/进行中/已完成/已归档 |
| Priority | SingleSelect | P0/P1/P2/P3 |
| Owner | User | 项目负责人 |
| Members | User (多选) | 项目成员 |
| Start Date | Date | 开始日期 |
| End Date | Date | 截止日期 |
| Progress | Percent (Rollup) | 自动汇总任务完成率 |
| Tasks | Links | 关联 Tasks 表 |

**Tasks 表（任务）：**
| 字段 | 类型 | 说明 |
|------|------|------|
| Title | SingleLineText | 任务标题 |
| Description | LongText (Rich) | 任务描述 |
| Status | SingleSelect | Todo/In Progress/In Review/Done |
| Priority | SingleSelect | Urgent/High/Medium/Low |
| Assignee | User | 负责人 |
| Reporter | User | 报告人 |
| Project | LinkToAnotherRecord | 所属项目 |
| Parent Task | LinkToAnotherRecord (自关联) | 父任务 |
| Sub Tasks | Links | 子任务 |
| Dependencies | LinkToAnotherRecord (多对多) | 前置依赖 |
| Start Date | Date | 开始日期 |
| Due Date | Date | 截止日期 |
| Estimated Hours | Number | 预估工时 |
| Actual Hours | Number | 实际工时 |
| Tags | MultiSelect | 标签 |
| Attachments | Attachment | 附件 |
| Sprint | SingleSelect / Link | 所属迭代 |

**Sprints/Milestones 表（迭代/里程碑）：**
| 字段 | 类型 | 说明 |
|------|------|------|
| Name | SingleLineText | 迭代名称 |
| Start Date | Date | 开始 |
| End Date | Date | 结束 |
| Status | SingleSelect | 计划/进行中/已完成 |
| Tasks | Links | 关联任务 |
| Completion Rate | Rollup (Percent) | 完成率 |

### 3.2 视图配置方案

**利用现有视图系统，无需新建视图类型：**

| 场景 | 视图类型 | 配置 |
|------|---------|------|
| 任务看板 | Kanban | 按 Status 字段分组 |
| 优先级看板 | Kanban | 按 Priority 字段分组 |
| 人员负载看板 | Kanban | 按 Assignee 字段分组 |
| 项目时间线 | Calendar | Start Date → Due Date 范围 |
| 迭代计划 | Calendar | Sprint Start → Sprint End |
| 任务列表 | Grid | 排序/过滤/分组 |
| 项目概览 | Gallery | 项目卡片 + 封面图 |
| 需求收集 | Form | 公开表单 + 字段验证 |
| 个人任务 | Grid + Filter | 过滤 Assignee = 当前用户 |

### 3.3 需要新增开发的功能

| 功能 | 优先级 | 复杂度 | 说明 |
|------|--------|--------|------|
| **甘特图视图（Gantt View）** | P0 | 高 | 新建视图类型，需前后端全链路开发 |
| **项目模板系统** | P1 | 中 | 预置表结构 + 视图的快速创建 |
| **任务依赖关系可视化** | P1 | 中 | 在甘特图中显示依赖线 |
| **工时追踪** | P2 | 低 | 基于 Duration 字段 + 时间记录表 |
| **仪表盘（Dashboard）** | P1 | 中 | 已有 Dashboard/Widget 模型，需实现前端 |
| **@提及与任务通知** | P1 | 中 | 扩展现有通知系统 |
| **批量操作增强** | P2 | 低 | 批量修改状态/负责人 |

### 3.4 甘特图实现方案

这是项目管理改造的**最大新增开发量**：

**后端新增：**
```
src/models/GanttView.ts          # 甘特图视图配置模型
src/models/GanttViewColumn.ts     # 甘特图列配置
src/controllers/gantt-view.controller.ts
src/services/gantt-view.service.ts
```

**元数据库新增表：**
- `nc_gantt_view_v2` — 甘特图配置（start_field, end_field, dependency_field, zoom_level）
- `nc_gantt_view_columns_v2` — 列显示配置

**前端新增：**
```
components/smartsheet/gantt/
├── index.vue                   # 甘特图入口
├── GanttChart.vue              # 主图表组件
├── GanttBar.vue                # 任务条
├── GanttDependencyLine.vue     # 依赖连线
├── GanttTimeline.vue           # 时间轴（日/周/月）
└── GanttSidebar.vue            # 左侧任务列表
composables/useGanttViewStore.ts # 状态管理
```

**SDK 扩展：**
- 在 `ViewTypes` 枚举中新增 `Gantt = 7`
- 添加 `GanttType` 接口

---

## 4. 审批流实现方案

### 4.1 数据模型

审批流需要在元数据库层面新增表，因为它是**跨表的系统级功能**：

#### 新增元表

**`nc_approval_flows`（审批流模板）：**
| 字段 | 类型 | 说明 |
|------|------|------|
| id | string(20) | 主键 |
| title | string(255) | 审批流名称 |
| description | text | 描述 |
| fk_model_id | string(20) | 关联的表 |
| base_id | string(20) | 所属项目 |
| fk_workspace_id | string(20) | 工作区 |
| trigger_type | enum | manual/on_create/on_update/on_field_change |
| trigger_config | json | 触发条件配置（字段变更条件等） |
| nodes | json | 审批节点定义（复用 Automation 的 nodes 结构） |
| edges | json | 节点连接（复用 Automation 的 edges 结构） |
| enabled | boolean | 是否启用 |
| created_by | string(20) | 创建者 |
| version | int | 版本号 |

**`nc_approval_instances`（审批实例）：**
| 字段 | 类型 | 说明 |
|------|------|------|
| id | string(20) | 主键 |
| fk_flow_id | string(20) | 关联审批流模板 |
| fk_model_id | string(20) | 关联表 |
| row_id | string(255) | 关联行 |
| current_node_id | string | 当前节点 |
| status | enum | pending/in_progress/approved/rejected/cancelled |
| initiated_by | string(20) | 发起人 |
| data_snapshot | json | 提交时的数据快照 |
| created_at | timestamp | 创建时间 |
| updated_at | timestamp | 更新时间 |

**`nc_approval_steps`（审批步骤记录）：**
| 字段 | 类型 | 说明 |
|------|------|------|
| id | string(20) | 主键 |
| fk_instance_id | string(20) | 关联审批实例 |
| node_id | string | 对应审批流节点 |
| step_type | enum | approval/notification/condition/action |
| assignee_type | enum | user/role/field_value |
| assignee_config | json | 审批人配置 |
| status | enum | pending/approved/rejected/skipped |
| fk_user_id | string(20) | 实际审批人 |
| comment | text | 审批意见 |
| acted_at | timestamp | 操作时间 |
| due_at | timestamp | 截止时间 |

### 4.2 状态机设计

```
                  ┌─────────┐
                  │  Draft   │ (用户填写表单/修改记录)
                  └────┬─────┘
                       │ submit
                       ▼
                  ┌─────────┐
            ┌────▶│ Pending  │◀───── (等待当前节点审批)
            │     └────┬─────┘
            │          │
            │    ┌─────┴──────┐
            │    ▼             ▼
      ┌──────────┐     ┌──────────┐
      │ Approved │     │ Rejected │
      │ (当前节点)│     │ (当前节点)│
      └────┬─────┘     └────┬─────┘
           │                 │
           ▼                 ▼
    ┌─────────────┐   ┌──────────┐
    │ Next Node?  │   │ 退回发起人 │──▶ 可重新提交(回到 Pending)
    │ Yes → Pending│   │ 或终止    │
    │ No  → Done  │   └──────────┘
    └─────────────┘
           │
           ▼
    ┌──────────┐
    │ Completed│ (全部节点通过)
    └──────────┘
```

**节点类型（Node Types）：**

```typescript
enum ApprovalNodeType {
  APPROVAL = 'approval',           // 审批节点
  NOTIFICATION = 'notification',   // 通知节点
  CONDITION = 'condition',         // 条件分支
  ACTION = 'action',               // 自动操作（修改字段值等）
  CC = 'cc',                       // 抄送
}

enum ApprovalStrategy {
  ANY = 'any',                     // 任一人通过即可
  ALL = 'all',                     // 所有人通过
  SEQUENTIAL = 'sequential',       // 按顺序逐一审批
  PERCENTAGE = 'percentage',       // 达到比例即通过
}
```

### 4.3 触发机制

复用现有 Hook/Webhook 触发器模式：

| 触发类型 | 说明 | 实现方式 |
|---------|------|---------|
| 手动触发 | 用户点击"提交审批"按钮 | 前端按钮 → API 调用 |
| 记录创建时 | 新建记录自动触发 | 复用 `after.insert` Hook |
| 字段变更时 | 特定字段值变化时触发 | 复用 `after.update` Hook + trigger_field |
| 条件触发 | 满足过滤条件时触发 | 复用 Filter 条件引擎 |

### 4.4 通知机制

扩展现有通知系统：

| 通知场景 | 渠道 | 实现 |
|---------|------|------|
| 待审批提醒 | 站内通知 + 邮件 | 扩展 `notification` 表 + SMTP 插件 |
| 审批结果通知 | 站内通知 + 邮件 | 同上 |
| 审批超时提醒 | 站内通知 + 邮件 | Bull 队列定时任务 |
| 抄送通知 | 站内通知 | 扩展 `notification` 表 |
| Webhook 通知 | 外部系统 | 复用 `nc_hooks_v2` |
| 即时推送 | WebSocket | 复用 Socket.io Gateway |

### 4.5 审批流前端组件

**新增文件：**
```
components/smartsheet/approval/
├── ApprovalFlowDesigner.vue       # 审批流可视化编辑器（节点拖拽）
├── ApprovalFlowNode.vue           # 单个节点组件
├── ApprovalPanel.vue              # 审批操作面板（通过/拒绝/评论）
├── ApprovalTimeline.vue           # 审批时间线（展示审批历史）
├── ApprovalBadge.vue              # 审批状态徽章
└── ApprovalList.vue               # 待审批列表

composables/useApprovalStore.ts    # 审批状态管理
store/approvals.ts                 # 审批列表 Pinia Store
```

**集成点：**
- **expanded-form**（记录详情弹窗）：添加审批状态面板和操作按钮
- **Toolbar**：添加"提交审批"操作
- **Sidebar**：添加"我的审批"入口
- **通知中心**：显示审批相关通知

### 4.6 后端 API

```
POST   /api/v2/meta/tables/:tableId/approval-flows          # 创建审批流
GET    /api/v2/meta/tables/:tableId/approval-flows          # 获取表的审批流列表
PATCH  /api/v2/meta/approval-flows/:flowId                  # 更新审批流
DELETE /api/v2/meta/approval-flows/:flowId                  # 删除审批流

POST   /api/v2/tables/:tableId/records/:rowId/submit-approval  # 提交审批
GET    /api/v2/approval-instances/:instanceId                    # 获取审批实例详情
POST   /api/v2/approval-steps/:stepId/approve                   # 通过
POST   /api/v2/approval-steps/:stepId/reject                    # 拒绝
POST   /api/v2/approval-instances/:instanceId/cancel            # 撤回

GET    /api/v2/meta/my-approvals                              # 我的待审批列表
GET    /api/v2/meta/my-submissions                            # 我提交的审批列表
```

---

## 5. 工作量评估

### 5.1 模块拆分与评估

| 模块 | 优先级 | 复杂度 | 预估人天 | 说明 |
|------|--------|--------|---------|------|
| **项目管理模板系统** | P0 | 低 | 5-8 | 预置表结构+视图模板的创建向导 |
| **看板增强** | P0 | 低 | 3-5 | 泳道（按 Assignee 分行）、WIP 限制 |
| **甘特图视图** | P0 | 高 | 20-30 | 全新视图类型，前后端全链路 |
| **任务依赖可视化** | P1 | 中 | 8-12 | 甘特图内依赖连线 + 自动排期 |
| **审批流-数据模型** | P0 | 中 | 5-8 | 元表创建 + 迁移 + Model 层 |
| **审批流-后端引擎** | P0 | 高 | 15-20 | 状态机、节点执行、超时处理 |
| **审批流-前端设计器** | P0 | 高 | 15-20 | 可视化流程编辑器 |
| **审批流-操作面板** | P0 | 中 | 8-10 | 审批/拒绝/评论 UI |
| **审批流-通知集成** | P1 | 中 | 5-8 | 邮件+站内+WebSocket 通知 |
| **仪表盘** | P1 | 中 | 10-15 | 项目概览、统计图表 |
| **@提及通知** | P1 | 低 | 3-5 | 评论中 @用户 → 触发通知 |
| **工时追踪** | P2 | 低 | 5-8 | 时间记录表 + 汇总 |

**总计估算：** 102-149 人天（约 3.5-5 个月，2-3 人团队）

### 5.2 推荐优先级路线

**Phase 1（基础功能，4-6 周）：**
1. 项目管理模板系统
2. 审批流数据模型 + 后端引擎
3. 审批流操作面板（简化版）

**Phase 2（核心增强，4-6 周）：**
4. 审批流可视化设计器
5. 甘特图视图（基础版）
6. 审批通知集成

**Phase 3（完善体验，4-6 周）：**
7. 甘特图依赖可视化
8. 仪表盘
9. 看板增强
10. @提及 + 工时追踪

---

## 6. 风险点与技术挑战

### 6.1 高风险

| 风险 | 影响 | 缓解措施 |
|------|------|---------|
| **甘特图性能** | 大量任务+依赖关系渲染可能卡顿 | 使用 Canvas 渲染（参考 Grid Canvas 模式），虚拟化长列表 |
| **审批流状态一致性** | 并发审批、网络故障可能导致状态不一致 | 数据库事务 + 乐观锁（version 字段）+ 幂等操作 |
| **审批流复杂度** | 条件分支+并行审批+会签的组合爆炸 | Phase 1 仅支持线性审批，Phase 2 引入分支 |
| **元数据库迁移** | 新增表可能与未来 NocoDB 官方更新冲突 | 使用独立 migration 版本前缀，避免修改现有表 |

### 6.2 中风险

| 风险 | 影响 | 缓解措施 |
|------|------|---------|
| **NocoDB 版本升级** | Fork 后难以合并上游更新 | 尽量通过扩展机制（Extension/Plugin）实现，减少核心代码修改 |
| **权限模型扩展** | 审批流需要更细粒度的权限（谁能发起/审批） | 在 `nc_permissions` 基础上扩展，新增 approval-specific 权限 |
| **实时通知可靠性** | WebSocket 断连可能丢失审批通知 | 站内通知 + 邮件双通道确保送达 |
| **多数据库兼容** | 审批流需要跨表查询，不同数据库方言差异 | 使用 Knex 抽象层，测试 MySQL/PostgreSQL/SQLite |

### 6.3 低风险

| 风险 | 影响 | 缓解措施 |
|------|------|---------|
| **字段类型限制** | 现有字段类型基本够用，但可能需要 Duration 增强 | 按需扩展 UITypes |
| **文件大小** | columns.service.ts 已有 174KB，需避免继续膨胀 | 审批流独立 Service，不嵌入现有文件 |
| **SDK 类型同步** | 前后端类型定义需要保持一致 | 复用 nocodb-sdk 的 Swagger 生成流程 |

---

## 关键文件路径索引

### 后端核心
| 文件 | 路径 |
|------|------|
| 入口 | `packages/nocodb/src/main.ts` |
| 应用初始化 | `packages/nocodb/src/Noco.ts` |
| 根模块 | `packages/nocodb/src/app.module.ts` |
| 核心查询构建器 | `packages/nocodb/src/db/BaseModelSqlv2.ts` (209KB) |
| ACL 定义 | `packages/nocodb/src/utils/acl.ts` (788 行) |
| 元表枚举 | `packages/nocodb/src/utils/globals.ts` |
| 权限中间件 | `packages/nocodb/src/middlewares/extract-ids/extract-ids.middleware.ts` (43KB) |
| 迁移目录 | `packages/nocodb/src/meta/migrations/` |
| Webhook 模型 | `packages/nocodb/src/models/Hook.ts` |
| 通知模型 | `packages/nocodb/src/models/Notification.ts` |
| 审计模型 | `packages/nocodb/src/models/Audit.ts` |
| 自动化迁移 | `packages/nocodb/src/meta/migrations/v0/nc_011_merge_workflows_scripts.ts` |

### 前端核心
| 文件 | 路径 |
|------|------|
| Nuxt 配置 | `packages/nc-gui/nuxt.config.ts` |
| 看板组件 | `packages/nc-gui/components/smartsheet/Kanban.vue` (64KB) |
| 日历组件 | `packages/nc-gui/components/smartsheet/calendar/` |
| 网格组件 | `packages/nc-gui/components/smartsheet/grid/` |
| 表单组件 | `packages/nc-gui/components/smartsheet/Form.vue` (101KB) |
| 视图 Store | `packages/nc-gui/store/views.ts` (1386 行) |
| 注入键 | `packages/nc-gui/context/index.ts` (150+ symbols) |
| API 客户端 | `packages/nc-gui/composables/useApi/index.ts` |
| 角色管理 | `packages/nc-gui/composables/useRoles.ts` |

### SDK
| 文件 | 路径 |
|------|------|
| API 类型定义 | `packages/nocodb-sdk/src/lib/Api.ts` (383KB+) |
| 字段类型枚举 | `packages/nocodb-sdk/src/lib/UITypes.ts` |
| 角色/事件枚举 | `packages/nocodb-sdk/src/lib/enums.ts` |
| 集成注册表 | `packages/noco-integrations/core/src/registry.ts` |
| 同步系统类型 | `packages/noco-integrations/core/src/sync/types.ts` |

# NocoDB 改造为项目管理+审批流系统 — 技术分析报告

> 版本: v2.0 (修订版)
> 日期: 2026-02-13
> 分析对象: NocoDB v0.301.2 (commit edbecb2cd2)

---

## 目录

1. [项目架构分析](#1-项目架构分析)
2. [现有功能盘点](#2-现有功能盘点)
3. [技术路线对比](#3-技术路线对比)
4. [用户场景分析](#4-用户场景分析)
5. [项目管理改造方案](#5-项目管理改造方案)
6. [审批流实现方案](#6-审批流实现方案)
7. [甘特图技术选型](#7-甘特图技术选型)
8. [工作量评估](#8-工作量评估)
9. [风险点与挑战](#9-风险点与挑战)
10. [总结与建议](#10-总结与建议)

---

## 1. 项目架构分析

### 1.1 整体架构

NocoDB 采用经典的前后端分离单体架构，通过 monorepo (pnpm workspaces + Lerna) 管理多个包：

```
nocodb/
├── packages/
│   ├── nc-gui/              # 前端 (Vue 3 + Nuxt 3)
│   ├── nocodb/              # 后端 (NestJS + Knex)
│   ├── nocodb-sdk/          # 共享 SDK (类型定义 + API 客户端)
│   ├── nc-lib-gui/          # 前端构建产物封装
│   └── noco-integrations/   # 集成插件 (数据源连接器)
├── tests/
│   └── playwright/          # E2E 测试
└── package.json             # 根 monorepo 配置
```

### 1.2 前端技术栈

| 维度 | 技术选型 | 版本 |
|------|---------|------|
| **框架** | Vue 3 + Nuxt 3 | Nuxt 3.17.4 |
| **状态管理** | Pinia + 自定义 Global State | Pinia 2.3.1 |
| **UI 组件库** | Ant Design Vue | 3.2.20 |
| **CSS 方案** | Windi CSS (Tailwind 兼容) | 3.5.6 |
| **构建工具** | Vite (Nuxt 集成) | — |
| **路由** | Nuxt 文件路由 (Hash 模式) | — |
| **富文本编辑** | TipTap | 2.11.5 |
| **图表** | ECharts | 5.6.0 |
| **地图** | Leaflet | 1.9.4 |
| **实时通信** | Socket.io-client | 4.8.1 |
| **代码编辑器** | Monaco Editor | 0.52.2 |
| **拖拽** | Sortable.js + Vuedraggable | 1.15.6 / 4.1.0 |
| **测试** | Vitest + Happy DOM | — |

**关键路径**:
- 组件: `packages/nc-gui/components/` (~33 子目录)
- Composables: `packages/nc-gui/composables/` (90+ 文件)
- Pinia Stores: `packages/nc-gui/store/` (~21 个 store)
- 页面路由: `packages/nc-gui/pages/`
- 注入上下文: `packages/nc-gui/context/index.ts` (~150 个 InjectionKey)

### 1.3 后端技术栈

| 维度 | 技术选型 | 版本 |
|------|---------|------|
| **框架** | NestJS | 10.4.19 |
| **ORM / 查询构建** | Knex.js (非 ORM，查询构建器) | — |
| **数据库支持** | SQLite / PostgreSQL / MySQL | 多数据库 |
| **元数据存储** | 内置 meta DB (Knex 管理) | 88+ 迁移 |
| **缓存** | Redis (可选) + 内存缓存 | — |
| **任务队列** | Bull (基于 Redis) | — |
| **实时** | Socket.io (WebSocket) | — |
| **认证** | JWT + Passport.js (多策略) | — |
| **构建** | rspack | — |
| **Node.js** | >= 22 | — |

**关键路径**:
- 模型层: `packages/nocodb/src/models/` (68 个模型文件)
- 服务层: `packages/nocodb/src/services/` (50+ 服务)
- 控制器层: `packages/nocodb/src/controllers/` (40+ 控制器)
- 元数据迁移: `packages/nocodb/src/meta/migrations/` (88+ 迁移)
- 数据库客户端: `packages/nocodb/src/dbQueryClient/` (支持 pg/mysql/sqlite)
- Hook/Webhook: `packages/nocodb/src/models/Hook.ts`
- 插件系统: `packages/nocodb/src/models/Plugin.ts`

### 1.4 SDK 与类型系统

SDK (`packages/nocodb-sdk/`) 是前后端共享的核心层，包含：

- **API 类型**: `src/lib/Api.ts` (383KB，自动生成的完整 API 类型)
- **UI 类型**: `src/lib/UITypes.ts` — 30+ 字段类型 (SingleLineText, Number, Date, SingleSelect, Checkbox, Attachment, Formula, Rollup, Links, User 等)
- **视图类型**: `src/lib/globals.ts` — ViewTypes: FORM(1), GALLERY(2), GRID(3), KANBAN(4), MAP(5), CALENDAR(6)
- **角色权限**: `src/lib/enums.ts` — OrgUserRoles, ProjectRoles, WorkspaceUserRoles
- **工作流接口**: `src/lib/workflow/interface.ts` — VariableDefinition, NodeExecutionResult 等 (初步框架)
- **权限矩阵**: `src/lib/permission/` — 基于角色的细粒度权限定义

### 1.5 数据库架构核心概念

```
Workspace (工作区)
  └── Base (项目/数据库)
       ├── Source (数据源，可连接外部 DB)
       │    └── Model/Table (表)
       │         ├── Column (列/字段，30+ 类型)
       │         ├── View (视图: Grid/Kanban/Gallery/Form/Calendar/Map)
       │         │    ├── Filter (过滤条件)
       │         │    ├── Sort (排序规则)
       │         │    └── ViewColumn (视图列配置)
       │         └── Hook (Webhook 触发器)
       ├── Extension (扩展)
       └── BaseUser (项目成员 + 角色)
```

---

## 2. 现有功能盘点

### 2.1 可直接复用的功能

| 功能 | 说明 | 复用度 | 关键路径 |
|------|------|--------|---------|
| **表格/Grid 视图** | 强大的数据网格，支持虚拟滚动、分组、聚合 | ★★★★★ | `components/smartsheet/grid/` |
| **看板视图** | 基于 SingleSelect/User 字段分组的卡片式看板 | ★★★★☆ | `components/smartsheet/Kanban.vue` |
| **表单视图** | 可配置字段、验证、条件逻辑 | ★★★★☆ | `components/smartsheet/Form.vue` |
| **日历视图** | 按日期字段展示记录 | ★★★★☆ | `components/smartsheet/calendar/` |
| **Gallery 视图** | 卡片式浏览 | ★★★☆☆ | `components/smartsheet/Gallery.vue` |
| **丰富字段类型** | 30+ 字段类型 (文本、数字、日期、选择、附件等) | ★★★★★ | `models/Column.ts` |
| **关联/Lookup/Rollup** | 跨表关联、查找、汇总 | ★★★★★ | `models/LinkToAnotherRecordColumn.ts` |
| **筛选与排序** | 多条件筛选 + 排序 | ★★★★★ | `models/Filter.ts`, `models/Sort.ts` |
| **权限系统** | 多级角色 (Super Admin → Viewer) | ★★★★☆ | `lib/acl.ts`, `composables/useRoles/` |
| **REST API** | 自动生成的 CRUD API + Swagger 文档 | ★★★★★ | `controllers/`, `services/` |
| **Webhook/Hook** | 行级事件触发 (insert/update/delete) | ★★★★☆ | `models/Hook.ts`, `services/hooks.service.ts` |
| **评论系统** | 行级评论 + 审计日志 | ★★★☆☆ | `models/Comment.ts`, `services/comments.service.ts` |
| **通知系统** | 应用内通知 | ★★★☆☆ | `models/Notification.ts` |
| **协作者字段** | User 类型字段，可指派人员 | ★★★★☆ | UITypes.User / UITypes.Collaborator |
| **附件** | 文件上传与管理 | ★★★★☆ | UITypes.Attachment |
| **扩展系统** | Manifest 驱动的扩展加载框架 | ★★★☆☆ | `composables/useExtensions.ts` |
| **实时协作** | Socket.io 实时同步 | ★★★★☆ | Socket.io 集成 |

### 2.2 部分可复用 / 需改造的功能

| 功能 | 现状 | 改造需求 |
|------|------|---------|
| **Workflow 模型** | 已有 Workflow 模型，但为空壳 (所有方法返回 null) | 需要从零实现，但模型骨架已存在 |
| **SDK workflow 接口** | `nocodb-sdk/src/lib/workflow/` 已定义变量类型、节点执行结果等接口 | 可作为审批流的基础接口扩展 |
| **公式系统** | 支持行级公式计算 | 可用于审批条件计算 |
| **Button 字段** | 已有 Button UIType | 可用于触发审批动作 |

### 2.3 需要新建的功能

| 功能 | 说明 |
|------|------|
| **甘特图视图** | 不存在任何甘特图实现，需完全新建 |
| **审批流引擎** | 多级审批、状态机、路由逻辑 |
| **审批流设计器** | 可视化流程设计界面 |
| **任务依赖关系** | 前置/后置任务依赖管理 |
| **工时/进度追踪** | 工时记录、进度百分比、燃尽图 |
| **仪表盘** | 项目概览、统计面板 |

---

## 3. 技术路线对比

### 3.1 方案概览

| 方案 | 简述 | 推荐度 |
|------|------|--------|
| **A. Fork 改造** | Fork NocoDB 源码，直接修改核心代码 | ★★★★☆ (推荐) |
| **B. 扩展/插件** | 利用 NocoDB 扩展系统开发功能 | ★★☆☆☆ |
| **C. 独立前端 + NocoDB API** | 自建前端，NocoDB 仅作数据后端 | ★★★☆☆ |
| **D. 换方案** | 放弃 NocoDB，采用其他开源方案 | ★★☆☆☆ |

### 3.2 方案 A: Fork 改造 (推荐)

**做法**: Fork NocoDB 仓库，在其代码基础上直接增加项目管理和审批流功能。

**优势**:
- 完全控制代码，可深度修改数据模型、API、UI
- 复用现有 70%+ 功能 (表格、看板、权限、API、实时协作)
- 可添加新的 ViewType (甘特图)，与现有视图体系一致
- 可扩展 Column 类型、添加审批状态字段
- 保留 NocoDB 的数据库连接能力，支持外部数据源

**劣势**:
- 与上游合并困难，长期维护成本高
- 需要深入理解 NocoDB 代码 (前端 200+ 组件，后端 68 个模型)
- 代码量大 (nc-gui package.json 有 200+ 依赖)

**适合场景**: 需要深度定制、长期独立发展的产品。

**合并策略**: 建议采用 "定期 cherry-pick" 而非 "定期 rebase"，只选取上游的 bug 修复和安全补丁。

### 3.3 方案 B: 扩展/插件开发

**做法**: 利用 NocoDB 现有扩展框架 (`Extension` 模型 + Manifest) 开发项目管理功能。

**优势**:
- 不修改核心代码，可随上游升级
- 扩展系统已有基础框架 (KV Store、访问控制、Modal/Panel 布局)

**劣势**:
- **扩展能力极其有限**: 当前扩展仅支持数据导出 (`data-exporter`, `json-exporter`) 级别的简单操作
- **无法添加新视图类型**: ViewTypes 枚举在 SDK 中硬编码，扩展无法注册新视图
- **无法修改数据模型**: 不能添加新的 MetaTable、Column 类型
- **无法实现审批流**: 需要后端状态机、新的 API 端点，这些超出扩展系统能力
- **无可视化流程设计器支持**: 扩展仅能在 Modal 或 Panel 中显示，无法深度集成到 Smartsheet 界面

**结论**: **不可行**。NocoDB 的扩展系统设计为轻量级数据处理插件，无法支撑项目管理和审批流这种深度功能改造。

### 3.4 方案 C: 独立前端 + NocoDB 作为数据后端

**做法**: NocoDB 仅作为 "headless database API" 使用，自建前端（如 React/Vue 应用）调用 NocoDB REST API。

**优势**:
- NocoDB 提供强大的 REST API (自动 CRUD + 筛选/排序/分页)
- 前端完全自由设计，不受 NocoDB UI 约束
- API 已有 V3 版本演进 (`controllers/v3/`)，接口稳定

**劣势**:
- **放弃 NocoDB 70% 的价值**: 看板、表格、表单等丰富 UI 全部需要自建
- **开发量远超 Fork 方案**: 相当于从零建立前端 (NocoDB nc-gui 有 200+ 组件)
- **实时协作需要重新实现**: Socket.io 集成层需要自行处理
- **权限系统需要桥接**: NocoDB 的角色系统需要映射到自建 UI

**结论**: 性价比低。如果不需要 NocoDB 的 UI，选择更轻量的后端 (Supabase, Directus) 更合理。

### 3.5 方案 D: 换方案

**备选方案评估**:

| 替代产品 | 项目管理能力 | 审批流能力 | 开源/自部署 | 技术栈 |
|----------|-------------|-----------|-------------|--------|
| **Plane** | 原生支持 (看板/Sprint/甘特) | 无 | MIT | Next.js + Django |
| **Taiga** | 原生支持 (Scrum/Kanban) | 无 | MPL-2.0 | Angular + Python |
| **OpenProject** | 原生支持 (甘特/WBS/成本) | 有 (基础审批) | GPLv3 | Angular + Ruby |
| **Directus** | 无，需定制 | 无，需定制 | BSL → GPLv3 | Vue 3 + Node.js |
| **n8n + 低代码平台** | 无，需组合 | 可实现 | Apache-2.0 | Vue + Node.js |

**结论**: 如果纯项目管理需求，OpenProject 或 Plane 更成熟；但如果需要 **通用数据管理 + 项目管理 + 审批流** 的混合场景，没有现成方案，Fork NocoDB 仍是最佳起点。

### 3.6 路线建议

**推荐方案 A (Fork 改造)**，理由：
1. NocoDB 提供了 70%+ 可复用的基础设施
2. 看板、表格、权限等核心能力已成熟
3. 数据模型扩展路径清晰 (新增 MetaTable + 迁移)
4. 已有 Workflow 模型骨架和 SDK 接口定义
5. 前后端技术栈 (Vue 3 + NestJS) 主流且易于招聘

---

## 4. 用户场景分析

### 4.1 核心用户角色

| 角色 | 说明 | 对应 NocoDB 角色 |
|------|------|-----------------|
| **项目经理 (PM)** | 创建项目、分配任务、跟踪进度 | Creator / Owner |
| **团队成员** | 执行任务、更新进度、提交工作成果 | Editor |
| **审批人** | 审核审批请求、批准/驳回 | 自定义角色 (新增) |
| **旁观者** | 查看项目状态、只读访问 | Viewer / Commenter |
| **系统管理员** | 配置审批流模板、管理用户权限 | Super Admin |

### 4.2 核心用户场景

#### 场景 1: 项目任务管理

```
PM 创建项目表 → 添加自定义字段 (优先级/状态/负责人/截止日期)
  → 切换看板视图，按状态分组查看
  → 切换甘特图，查看时间线和依赖关系
  → 筛选 "我负责的任务"
  → 查看仪表盘 (进度统计、逾期任务、工时汇总)
```

**NocoDB 已覆盖**: 表创建、自定义字段、看板视图、筛选
**需要新建**: 甘特图视图、任务依赖、仪表盘

#### 场景 2: 审批流程 (请假申请)

```
员工填写请假表单 → 系统自动识别审批流
  → 直属主管收到通知 → 审批通过
  → (3天以上) 自动转发部门经理 → 审批通过
  → HR 收到备案通知
  → 员工收到 "已批准" 通知
```

**NocoDB 已覆盖**: 表单视图、通知系统、Webhook
**需要新建**: 审批路由引擎、状态机、多级审批链

#### 场景 3: 采购审批 (含金额分级)

```
采购员提交采购申请 (含金额)
  → 金额 < 5000: 部门主管审批
  → 金额 5000-50000: 部门主管 → 财务总监
  → 金额 > 50000: 部门主管 → 财务总监 → CEO
  → 任一环节驳回 → 退回修改 → 重新提交
  → 审批超时 (48h) → 自动升级到上一级
```

**需要新建**: 条件路由、金额分级、超时策略、退回机制

#### 场景 4: 文档版本化审批 (合同审批)

```
员工上传合同草稿 (v1) → 提交审批
  → 法务审核 → 标注修改意见 → 驳回
  → 员工修改后上传 v2 → 重新提交
  → 法务审核通过 → 业务总监审批
  → 总监要求微调 → 委托转办给副总监
  → 副总监审批通过 → 合同生效
```

**需要新建**: 版本化、审批意见、委托转办、撤回规则

#### 场景 5: 敏捷开发项目追踪

```
团队使用看板管理 Sprint
  → 每日查看 "进行中" 任务
  → 甘特图规划迭代时间线
  → 日历视图查看里程碑
  → 工时记录 → 燃尽图
  → Sprint 回顾 (仪表盘)
```

**需要新建**: 甘特图、Sprint 管理、燃尽图、工时记录

---

## 5. 项目管理改造方案

### 5.1 新增甘特图视图

在 NocoDB 的视图系统中新增 `ViewTypes.GANTT = 7`：

**前端组件**:
```
components/smartsheet/
  └── gantt/
       ├── GanttChart.vue        # 主甘特图组件
       ├── GanttBar.vue          # 甘特条
       ├── GanttTimeline.vue     # 时间线头部
       ├── GanttDependency.vue   # 依赖线
       └── GanttMilestone.vue    # 里程碑标记
composables/
  └── useGanttViewStore.ts       # 甘特图状态管理
```

**后端模型**:
```
models/
  ├── GanttView.ts               # 甘特图视图配置
  ├── GanttViewColumn.ts         # 甘特图列配置
  └── TaskDependency.ts          # 任务依赖关系
```

**数据模型**:
```sql
-- 甘特视图配置
CREATE TABLE nc_gantt_view (
  id VARCHAR PRIMARY KEY,
  fk_view_id VARCHAR REFERENCES nc_views(id),
  fk_start_date_col_id VARCHAR,   -- 开始日期字段
  fk_end_date_col_id VARCHAR,     -- 结束日期字段
  fk_progress_col_id VARCHAR,     -- 进度百分比字段
  fk_assignee_col_id VARCHAR,     -- 负责人字段
  time_scale VARCHAR DEFAULT 'day', -- day/week/month/quarter
  show_dependencies BOOLEAN DEFAULT true,
  show_critical_path BOOLEAN DEFAULT false
);

-- 任务依赖关系
CREATE TABLE nc_task_dependencies (
  id VARCHAR PRIMARY KEY,
  fk_model_id VARCHAR REFERENCES nc_models(id),
  fk_from_row_id VARCHAR,         -- 前置任务
  fk_to_row_id VARCHAR,           -- 后置任务
  dependency_type VARCHAR DEFAULT 'FS', -- FS/FF/SS/SF
  lag_days INTEGER DEFAULT 0       -- 延迟天数
);
```

### 5.2 任务管理增强

基于现有的表和字段系统，添加项目管理语义层：

1. **项目模板**: 预配置的表模板，包含标准字段 (状态、优先级、负责人、截止日期、工时)
2. **仪表盘视图**: 基于现有 Dashboard 模型 (`models/Dashboard.ts`) 扩展
3. **工时追踪**: 新增 Duration 字段关联记录，聚合统计

### 5.3 修改清单

| 文件/模块 | 修改内容 |
|-----------|---------|
| `nocodb-sdk/src/lib/globals.ts` | 新增 `ViewTypes.GANTT = 7` |
| `nocodb-sdk/src/lib/Api.ts` | 新增甘特图相关 API 类型 |
| `packages/nocodb/src/models/` | 新增 GanttView, GanttViewColumn, TaskDependency |
| `packages/nocodb/src/services/` | 新增 gantt.service.ts, task-dependencies.service.ts |
| `packages/nocodb/src/controllers/` | 新增 gantt.controller.ts |
| `packages/nocodb/src/meta/migrations/v2/` | 新增迁移文件 |
| `packages/nc-gui/components/smartsheet/` | 新增 gantt/ 目录 |
| `packages/nc-gui/composables/` | 新增 useGanttViewStore.ts |
| `packages/nc-gui/store/views.ts` | 注册甘特图视图类型 |

---

## 6. 审批流实现方案

### 6.1 核心概念

```
ApprovalFlow (审批流模板)
  └── ApprovalFlowNode (审批节点)
       ├── type: initiator | approver | cc | condition | parallel
       ├── assignee_type: user | role | department | formula
       └── config: {...}

ApprovalInstance (审批实例)
  └── ApprovalStep (审批步骤)
       ├── status: pending | approved | rejected | delegated | withdrawn | timeout
       ├── assignee_id
       ├── comment
       └── version: integer  -- 对应提交版本
```

### 6.2 数据模型

```sql
-- 审批流模板
CREATE TABLE nc_approval_flows (
  id VARCHAR PRIMARY KEY,
  fk_model_id VARCHAR REFERENCES nc_models(id),
  title VARCHAR NOT NULL,
  description TEXT,
  trigger_type VARCHAR DEFAULT 'manual',    -- manual | on_create | on_update | condition
  trigger_condition JSON,                   -- 触发条件 (使用现有 Filter 语法)
  flow_definition JSON NOT NULL,            -- 流程节点定义 (DAG)
  is_active BOOLEAN DEFAULT true,
  version INTEGER DEFAULT 1,                -- 流程版本号
  created_by VARCHAR,
  created_at TIMESTAMP,
  updated_at TIMESTAMP
);

-- 审批流版本历史
CREATE TABLE nc_approval_flow_versions (
  id VARCHAR PRIMARY KEY,
  fk_flow_id VARCHAR REFERENCES nc_approval_flows(id),
  version INTEGER NOT NULL,
  flow_definition JSON NOT NULL,
  change_description TEXT,
  created_by VARCHAR,
  created_at TIMESTAMP
);

-- 审批实例
CREATE TABLE nc_approval_instances (
  id VARCHAR PRIMARY KEY,
  fk_flow_id VARCHAR REFERENCES nc_approval_flows(id),
  fk_flow_version INTEGER,                 -- 锁定使用的流程版本
  fk_model_id VARCHAR REFERENCES nc_models(id),
  fk_row_id VARCHAR NOT NULL,              -- 关联的数据行
  submission_version INTEGER DEFAULT 1,     -- 提交版本 (驳回后重提 +1)
  status VARCHAR DEFAULT 'pending',         -- pending | in_progress | approved | rejected | withdrawn | cancelled
  initiated_by VARCHAR,
  initiated_at TIMESTAMP,
  completed_at TIMESTAMP,
  current_node_id VARCHAR,                  -- 当前停留节点
  metadata JSON                             -- 运行时上下文
);

-- 审批步骤
CREATE TABLE nc_approval_steps (
  id VARCHAR PRIMARY KEY,
  fk_instance_id VARCHAR REFERENCES nc_approval_instances(id),
  fk_node_id VARCHAR,                      -- 对应流程节点
  assignee_id VARCHAR,                     -- 实际审批人
  original_assignee_id VARCHAR,            -- 原始审批人 (委托前)
  status VARCHAR DEFAULT 'pending',
  action VARCHAR,                          -- approve | reject | delegate | withdraw
  comment TEXT,
  attachments JSON,                        -- 审批附件
  submission_version INTEGER,              -- 对应提交版本
  delegated_to VARCHAR,                    -- 委托目标
  delegated_reason TEXT,
  timeout_at TIMESTAMP,                    -- 超时时间
  acted_at TIMESTAMP,
  created_at TIMESTAMP
);

-- 委托规则
CREATE TABLE nc_approval_delegations (
  id VARCHAR PRIMARY KEY,
  delegator_id VARCHAR NOT NULL,           -- 委托人
  delegate_id VARCHAR NOT NULL,            -- 被委托人
  fk_flow_id VARCHAR,                      -- 指定流程 (NULL=全部)
  start_date TIMESTAMP,
  end_date TIMESTAMP,
  is_active BOOLEAN DEFAULT true,
  reason TEXT
);
```

### 6.3 审批流状态机

```
                  ┌──────────┐
                  │  PENDING  │  (实例创建，等待处理)
                  └─────┬─────┘
                        │ 分配到第一个审批人
                        ▼
                  ┌──────────┐
            ┌────►│IN_PROGRESS│◄────────────────────┐
            │     └─────┬─────┘                      │
            │           │                             │
            │     ┌─────┴─────┐                       │
            │     │           │                       │
            │     ▼           ▼                       │
     (重新提交) ┌────┐    ┌─────────┐   (委托转办)      │
            │ │ OK │    │ REJECT  │──────────────────┘
            │ └──┬─┘    └────┬────┘   (驳回后修改重提)
            │    │           │
            │    │   ┌───────┴──────┐
            │    │   │              │
            │    ▼   ▼              ▼
            │ ┌──────────┐   ┌──────────┐
            │ │NEXT_NODE │   │WITHDRAWN │ (发起人撤回)
            │ └─────┬────┘   └──────────┘
            │       │
            │  (还有后续节点?)
            │       │
            │  YES──┤──NO
            │       │    │
            └───────┘    ▼
                   ┌──────────┐
                   │ APPROVED │ (全部通过)
                   └──────────┘
```

超时分支:
```
  PENDING ──(超时)──► AUTO_ESCALATE ──► 上一级审批人
                        或
                      AUTO_APPROVE (可配置)
                        或
                      AUTO_REJECT (可配置)
```

### 6.4 关键规则详解

#### 6.4.1 版本化

- **流程版本化**: 修改审批流模板时，自动创建新版本；进行中的实例继续使用旧版本
- **提交版本化**: 驳回后修改数据重新提交，`submission_version` +1，审批历史完整保留
- **审批快照**: 每次提交时对行数据做快照存入 `metadata`，确保审批人看到的是提交时的数据

#### 6.4.2 委托转办

- **主动委托**: 审批人可将当前步骤委托给指定人员，记录原始审批人和委托原因
- **自动委托**: 支持预设委托规则 (`nc_approval_delegations`)，指定时间范围内自动转办
- **委托链限制**: 最多允许 2 级委托 (A→B→C)，防止无限转办
- **实现**: 委托不创建新 step，而是更新现有 step 的 `assignee_id`，保留 `original_assignee_id`

#### 6.4.3 撤回规则

- **发起人撤回**: 仅当下一审批人**尚未操作**时允许撤回
- **已部分审批**: 如果并行审批中已有人审批通过，不允许撤回
- **撤回后状态**: 实例状态变为 `withdrawn`，可选择修改后重新提交 (新实例)
- **撤回窗口**: 可配置撤回时间窗口 (如提交后 24 小时内可撤回)

#### 6.4.4 超时策略

| 策略 | 说明 | 实现 |
|------|------|------|
| **自动提醒** | 超时前 N 小时发送提醒通知 | 定时任务 (Bull queue) |
| **自动升级** | 超时后自动转交上一级审批人 | 修改 step 的 assignee |
| **自动通过** | 超时后视为自动批准 | 更新 step status + 推进流程 |
| **自动驳回** | 超时后视为自动驳回 | 更新 step status + 终止流程 |
| **超时通知** | 超时后仅通知相关人员，不自动操作 | 发送通知 |

超时通过 `timeout_at` 字段和 Bull 延迟任务实现:

```typescript
// 创建审批步骤时设置超时任务
await this.approvalQueue.add('check-timeout', {
  stepId: step.id,
  instanceId: instance.id,
}, {
  delay: timeoutMs,  // 延迟执行
  jobId: `timeout-${step.id}`,
});
```

### 6.5 审批流设计器 (前端)

基于现有的 DAG 渲染库 (`@dagrejs/dagre` 已在依赖中) 构建可视化流程设计器:

```
components/approval/
  ├── FlowDesigner.vue         # 流程设计器主组件
  ├── FlowCanvas.vue           # 画布 (dagre 布局)
  ├── nodes/
  │    ├── InitiatorNode.vue   # 发起人节点
  │    ├── ApproverNode.vue    # 审批人节点
  │    ├── ConditionNode.vue   # 条件分支节点
  │    ├── ParallelNode.vue    # 并行会签节点
  │    └── CcNode.vue          # 抄送节点
  ├── FlowPreview.vue          # 流程预览
  └── ApprovalPanel.vue        # 审批操作面板 (批准/驳回/委托)
```

### 6.6 后端实现

```
services/
  ├── approval-flows.service.ts       # 审批流模板 CRUD
  ├── approval-instances.service.ts   # 审批实例管理
  ├── approval-engine.service.ts      # 审批引擎 (状态机 + 路由)
  └── approval-timeout.service.ts     # 超时处理

controllers/
  ├── approval-flows.controller.ts
  └── approval-instances.controller.ts
```

### 6.7 与现有系统集成

| 集成点 | 方式 |
|--------|------|
| **触发审批** | Hook 系统 — 行创建/更新时触发 |
| **审批人指派** | User 字段 + 角色系统 |
| **通知** | 复用 Notification 模型 + WebSocket 实时推送 |
| **评论** | 复用 Comment 系统存储审批意见 |
| **附件** | 复用 Attachment 字段类型 |
| **条件路由** | 复用 Filter 语法做条件判断 |
| **审计日志** | 复用 Audit 模型记录操作历史 |

---

## 7. 甘特图技术选型

### 7.1 候选方案对比

| 方案 | 许可证 | 包大小 | 特点 | 缺陷 |
|------|--------|--------|------|------|
| **DHTMLX Gantt** | GPL (商业需付费) | ~400KB | 功能最全面：依赖关系、关键路径、资源视图、基线对比 | GPL 限制，商业许可 $599+/dev |
| **Bryntum Gantt** | 商业 | ~500KB | 企业级功能，性能优秀，SSR 支持 | 纯商业，$2495+/dev |
| **frappe-gantt** | MIT | ~30KB | 轻量级，SVG 渲染，拖拽调整 | 无依赖管理、无资源视图 |
| **vue-ganttastic** | MIT | ~20KB | Vue 3 原生，轻量 | 功能简单，不支持依赖线 |
| **自研 (Canvas/SVG)** | — | 自定义 | 完全控制，NocoDB 风格一致 | 开发量最大 |
| **ECharts 甘特** | Apache-2.0 | 已集成 | 项目已引入 ECharts | 甘特图非 ECharts 强项，交互弱 |

### 7.2 推荐方案: frappe-gantt + 自研增强

**理由**:
1. **MIT 许可**: 无商业限制
2. **轻量级**: 30KB，不显著增加包体积
3. **SVG 渲染**: 与 NocoDB 现有 SVG 图标体系一致
4. **基础拖拽**: 已支持时间条拖拽调整
5. **可扩展**: 源码简单 (~2000 行)，易于定制

**需要自研增强的部分**:

| 功能 | 说明 | 工作量 |
|------|------|--------|
| **依赖关系线** | FS/FF/SS/SF 四种依赖类型的箭头连线 | 5 人天 |
| **关键路径高亮** | 计算并高亮关键路径 | 3 人天 |
| **资源视图** | 按负责人分组的资源甘特图 | 5 人天 |
| **虚拟滚动** | 大量任务时的性能优化 | 5 人天 |
| **里程碑** | 菱形标记的里程碑节点 | 2 人天 |
| **缩放控制** | 日/周/月/季度视图切换 | 3 人天 |
| **NocoDB 集成** | 与 SmartSheet 系统集成 (筛选/排序/权限) | 8 人天 |
| **今日线 + 基线** | 今日指示线 + 计划 vs 实际对比 | 3 人天 |

**备选**: 如果预算允许且需要快速上线，DHTMLX Gantt (GPL/商业) 提供了最完整的开箱即用功能。

### 7.3 技术实现要点

```typescript
// composables/useGanttViewStore.ts 核心结构
interface GanttTask {
  id: string;
  rowId: string;          // NocoDB 行 ID
  title: string;          // 显示值字段
  startDate: Date;        // 开始日期字段映射
  endDate: Date;          // 结束日期字段映射
  progress: number;       // 进度百分比 (0-100)
  assignee?: string;      // 负责人
  dependencies?: string[]; // 前置任务 ID 列表
  color?: string;         // 条形颜色
  isMilestone?: boolean;
}

interface GanttViewConfig {
  timeScale: 'day' | 'week' | 'month' | 'quarter';
  showDependencies: boolean;
  showCriticalPath: boolean;
  showBaseline: boolean;
  barHeight: number;
  rowPadding: number;
}
```

---

## 8. 工作量评估

### 8.1 总体评估

| 模块 | 工作量 (人天) | 复杂度 | 优先级 |
|------|-------------|--------|--------|
| **甘特图视图** | 35-45 | 高 | P1 |
| **审批流引擎 (后端)** | 40-50 | 高 | P1 |
| **审批流设计器 (前端)** | 25-35 | 高 | P1 |
| **审批流版本化 + 委托转办** | 15-20 | 中 | P1 |
| **超时策略 + 自动化** | 10-15 | 中 | P2 |
| **项目管理模板 + 仪表盘** | 15-20 | 中 | P2 |
| **任务依赖关系管理** | 10-15 | 中 | P2 |
| **工时追踪 + 燃尽图** | 10-15 | 中 | P3 |
| **测试 (单元 + E2E)** | 20-25 | 中 | P1 |
| **文档 + 部署** | 5-10 | 低 | P2 |
| **合计** | **185-250 人天** | — | — |

**建议范围: 150-220 人天** (取中间值，假设 4-5 人团队，约 8-12 周)

### 8.2 分阶段实施

#### Phase 1: 基础框架 (6-8 周, ~80-100 人天)
- 甘特图视图 (基础版: 时间轴 + 拖拽，不含依赖)
- 审批流引擎 (单链审批、基础状态机)
- 审批流设计器 (初版: 节点编辑 + 预览)
- 数据库迁移 + API
- 基础测试

#### Phase 2: 增强功能 (4-6 周, ~50-70 人天)
- 甘特图增强 (依赖关系、关键路径、资源视图)
- 审批流增强 (条件路由、并行会签、版本化)
- 委托转办 + 撤回规则
- 超时策略
- 项目管理模板

#### Phase 3: 打磨优化 (3-4 周, ~30-50 人天)
- 仪表盘 + 统计面板
- 工时追踪 + 燃尽图
- 性能优化 (甘特图虚拟滚动)
- E2E 测试完善
- 文档 + 部署指南

### 8.3 团队配置建议

| 角色 | 人数 | 职责 |
|------|------|------|
| 前端开发 | 2 | 甘特图组件、审批流设计器、仪表盘 |
| 后端开发 | 2 | 审批引擎、数据模型、API、超时策略 |
| 测试/DevOps | 1 | E2E 测试、CI/CD、部署 |

---

## 9. 风险点与挑战

### 9.1 技术风险

| 风险 | 影响 | 缓解措施 |
|------|------|---------|
| **NocoDB 代码量大，学习曲线陡** | 前期开发效率低 | 专人负责模块，先吃透一个视图的完整链路 |
| **与上游合并困难** | 长期维护成本高 | 采用 cherry-pick 策略，仅合并安全/bug 修复 |
| **甘特图性能** | 1000+ 任务时卡顿 | 虚拟滚动 + Canvas 渲染备选方案 |
| **审批流状态一致性** | 并发审批导致状态不一致 | 乐观锁 + 数据库事务 |
| **Knex 不是 ORM** | 缺少模型级验证和关系管理 | 在 Model 层手动维护，参考现有模式 |
| **前端复杂度高** | 150 个 InjectionKey，上下文管理复杂 | 严格遵循现有 provide/inject 模式 |

### 9.2 产品风险

| 风险 | 影响 | 缓解措施 |
|------|------|---------|
| **功能范围蔓延** | 工期失控 | 严格按 Phase 分期，MVP 先行 |
| **审批流灵活性不足** | 无法满足复杂场景 | 预留条件路由 + 自定义脚本扩展点 |
| **用户不习惯 NocoDB 操作方式** | 推广困难 | 提供项目管理专用模板 + 引导 |

### 9.3 关键技术挑战

1. **新增 ViewType 的全链路改造**: 从 SDK 枚举到前端组件到后端 CRUD，涉及 10+ 文件
2. **审批状态机正确性**: 需要形式化验证状态转换，避免死锁或漏洞
3. **实时协作下的审批冲突**: 多人同时操作同一审批实例的并发控制
4. **甘特图与 NocoDB 数据流集成**: 需要将 NocoDB 的 "表+行" 模型映射到甘特图的 "任务+依赖" 模型

---

## 10. 总结与建议

### 10.1 核心结论

1. **NocoDB 是优秀的起点**: 70%+ 基础功能可直接复用，特别是表格/看板/权限/API 体系
2. **Fork 改造是最优路线**: 扩展系统能力不足，独立前端性价比低，替代方案缺乏混合能力
3. **审批流是最大挑战**: 需要完整的状态机、路由引擎、超时机制，是工作量最大的模块
4. **甘特图推荐 frappe-gantt + 自研**: 平衡许可证、功能和开发成本
5. **估算 150-220 人天**: 4-5 人团队，约 3 个月完成核心功能

### 10.2 立即行动项

1. Fork NocoDB，建立独立仓库和 CI/CD
2. 完成一个 ViewType (甘特图) 的全链路 POC，验证改造路径
3. 设计审批流数据模型，先实现单链审批 MVP
4. 建立与上游的合并策略 (cherry-pick 安全修复)

### 10.3 关键文件参考索引

| 需要理解的核心文件 | 路径 |
|-------------------|------|
| 视图类型定义 | `packages/nocodb-sdk/src/lib/globals.ts:36` |
| 字段类型定义 | `packages/nocodb-sdk/src/lib/UITypes.ts` |
| 角色权限枚举 | `packages/nocodb-sdk/src/lib/enums.ts` |
| 前端权限矩阵 | `packages/nc-gui/lib/acl.ts` |
| View 模型 (后端) | `packages/nocodb/src/models/View.ts` |
| Model/Table 模型 | `packages/nocodb/src/models/Model.ts` |
| Hook 模型 | `packages/nocodb/src/models/Hook.ts` |
| Workflow 模型 (空壳) | `packages/nocodb/src/models/Workflow.ts` |
| 元数据服务 | `packages/nocodb/src/meta/meta.service.ts` |
| Kanban 视图 (参考实现) | `packages/nc-gui/components/smartsheet/Kanban.vue` |
| Grid 视图 (参考实现) | `packages/nc-gui/components/smartsheet/grid/` |
| 视图 Store (参考) | `packages/nc-gui/composables/useKanbanViewStore.ts` |
| 扩展系统 | `packages/nc-gui/composables/useExtensions.ts` |
| Workflow SDK 接口 | `packages/nocodb-sdk/src/lib/workflow/interface.ts` |
| NestJS 入口 | `packages/nocodb/src/Noco.ts` |
| 迁移示例 | `packages/nocodb/src/meta/migrations/v2/` |

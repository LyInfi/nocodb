import type { Knex } from 'knex';
import { MetaTable } from '~/utils/globals';

const up = async (knex: Knex) => {
  // 1. nc_approval_flows - 审批流模板表
  await knex.schema.createTable(MetaTable.APPROVAL_FLOWS, (table) => {
    table.string('id', 20).primary().notNullable();
    table.string('fk_workspace_id', 20).notNullable();
    table.string('base_id', 20).notNullable();
    table.string('title', 255).notNullable();
    table.text('description').nullable();
    table.string('fk_model_id', 20).notNullable(); // 关联的数据表
    table.text('config').nullable(); // JSON: 审批节点配置、条件等
    table.boolean('is_active').defaultTo(true);
    table.string('created_by', 20).notNullable();
    table.string('updated_by', 20).nullable();
    table.timestamps(true, true);

    table.index('fk_workspace_id', 'nc_approval_flows_workspace_idx');
    table.index('base_id', 'nc_approval_flows_base_idx');
    table.index('fk_model_id', 'nc_approval_flows_model_idx');
    table.index('created_by', 'nc_approval_flows_created_by_idx');
  });

  // 2. nc_approval_instances - 审批实例表
  await knex.schema.createTable(MetaTable.APPROVAL_INSTANCES, (table) => {
    table.string('id', 20).primary().notNullable();
    table.string('fk_workspace_id', 20).notNullable();
    table.string('base_id', 20).notNullable();
    table.string('fk_approval_flow_id', 20).notNullable();
    table.string('record_id', 255).notNullable(); // 数据记录ID
    table.string('status', 50).notNullable().defaultTo('pending'); // pending, approved, rejected, canceled
    table.string('current_node_id', 50).nullable(); // 当前审批节点ID
    table.text('context').nullable(); // JSON: 审批上下文数据
    table.string('started_by', 20).notNullable(); // 发起人
    table.timestamp('started_at', { useTz: true }).defaultTo(knex.fn.now());
    table.timestamp('completed_at', { useTz: true }).nullable();
    table.string('completed_by', 20).nullable();
    table.timestamps(true, true);

    table.index('fk_workspace_id', 'nc_approval_instances_workspace_idx');
    table.index('base_id', 'nc_approval_instances_base_idx');
    table.index('fk_approval_flow_id', 'nc_approval_instances_flow_idx');
    table.index('record_id', 'nc_approval_instances_record_idx');
    table.index('status', 'nc_approval_instances_status_idx');
    table.index('started_by', 'nc_approval_instances_started_by_idx');
    table.index(['fk_approval_flow_id', 'record_id'], 'nc_approval_instances_flow_record_idx');
  });

  // 3. nc_approval_tasks - 审批任务表
  await knex.schema.createTable(MetaTable.APPROVAL_TASKS, (table) => {
    table.string('id', 20).primary().notNullable();
    table.string('fk_workspace_id', 20).notNullable();
    table.string('base_id', 20).notNullable();
    table.string('fk_approval_instance_id', 20).notNullable();
    table.string('fk_approval_flow_id', 20).notNullable();
    table.string('node_id', 50).notNullable(); // 审批节点ID
    table.string('assignee_type', 20).notNullable(); // user, group, dept_leader, etc.
    table.string('fk_assignee_id', 20).notNullable(); // 审批人ID或组ID
    table.string('status', 50).notNullable().defaultTo('pending'); // pending, approved, rejected, delegated
    table.text('comment').nullable(); // 审批意见
    table.text('attachments').nullable(); // JSON: 附件列表
    table.timestamp('due_at', { useTz: true }).nullable(); // 截止时间
    table.timestamp('acted_at', { useTz: true }).nullable(); // 审批时间
    table.string('delegated_from', 20).nullable(); // 被委托任务的原任务ID
    table.timestamps(true, true);

    table.index('fk_workspace_id', 'nc_approval_tasks_workspace_idx');
    table.index('base_id', 'nc_approval_tasks_base_idx');
    table.index('fk_approval_instance_id', 'nc_approval_tasks_instance_idx');
    table.index('fk_approval_flow_id', 'nc_approval_tasks_flow_idx');
    table.index('fk_assignee_id', 'nc_approval_tasks_assignee_idx');
    table.index('status', 'nc_approval_tasks_status_idx');
    table.index(['fk_assignee_id', 'status'], 'nc_approval_tasks_assignee_status_idx');
  });

  // 4. nc_approval_groups - 审批组表
  await knex.schema.createTable(MetaTable.APPROVAL_GROUPS, (table) => {
    table.string('id', 20).primary().notNullable();
    table.string('fk_workspace_id', 20).notNullable();
    table.string('base_id', 20).notNullable();
    table.string('title', 255).notNullable();
    table.text('description').nullable();
    table.string('group_type', 50).defaultTo('static'); // static, dynamic, rule_based
    table.text('config').nullable(); // JSON: 动态组配置规则
    table.string('created_by', 20).notNullable();
    table.string('updated_by', 20).nullable();
    table.timestamps(true, true);

    table.index('fk_workspace_id', 'nc_approval_groups_workspace_idx');
    table.index('base_id', 'nc_approval_groups_base_idx');
    table.index('created_by', 'nc_approval_groups_created_by_idx');
  });

  // 5. nc_approval_group_members - 审批组成员表
  await knex.schema.createTable(MetaTable.APPROVAL_GROUP_MEMBERS, (table) => {
    table.string('id', 20).primary().notNullable();
    table.string('fk_workspace_id', 20).notNullable();
    table.string('base_id', 20).notNullable();
    table.string('fk_approval_group_id', 20).notNullable();
    table.string('fk_user_id', 20).notNullable();
    table.integer('sort_order').defaultTo(0); // 成员排序(用于顺序审批)
    table.string('role', 50).defaultTo('member'); // member, leader
    table.string('created_by', 20).notNullable();
    table.timestamps(true, true);

    table.index('fk_workspace_id', 'nc_approval_group_members_workspace_idx');
    table.index('base_id', 'nc_approval_group_members_base_idx');
    table.index('fk_approval_group_id', 'nc_approval_group_members_group_idx');
    table.index('fk_user_id', 'nc_approval_group_members_user_idx');
    table.unique(['fk_approval_group_id', 'fk_user_id'], {
      indexName: 'nc_approval_group_members_unique_idx',
    });
  });

  // 6. nc_dept_leaders - 部门领导映射表
  await knex.schema.createTable(MetaTable.DEPT_LEADERS, (table) => {
    table.string('id', 20).primary().notNullable();
    table.string('fk_workspace_id', 20).notNullable();
    table.string('base_id', 20).notNullable();
    table.string('dept_name', 255).notNullable(); // 部门名称/路径
    table.string('dept_code', 100).nullable(); // 部门编码
    table.string('fk_leader_id', 20).notNullable(); // 领导用户ID
    table.string('leader_type', 50).defaultTo('direct'); // direct: 直属领导, skip: 跨级领导
    table.integer('level').defaultTo(1); // 领导层级(1=直属, 2=上级的上级, etc.)
    table.string('created_by', 20).notNullable();
    table.string('updated_by', 20).nullable();
    table.timestamps(true, true);

    table.index('fk_workspace_id', 'nc_dept_leaders_workspace_idx');
    table.index('base_id', 'nc_dept_leaders_base_idx');
    table.index('dept_name', 'nc_dept_leaders_dept_idx');
    table.index('dept_code', 'nc_dept_leaders_dept_code_idx');
    table.index('fk_leader_id', 'nc_dept_leaders_leader_idx');
    table.index(['dept_name', 'level'], 'nc_dept_leaders_dept_level_idx');
    table.unique(['base_id', 'dept_name', 'level'], {
      indexName: 'nc_dept_leaders_unique_idx',
    });
  });
};

const down = async (knex: Knex) => {
  // Drop tables in reverse order (respecting foreign key dependencies)
  await knex.schema.dropTableIfExists(MetaTable.DEPT_LEADERS);
  await knex.schema.dropTableIfExists(MetaTable.APPROVAL_GROUP_MEMBERS);
  await knex.schema.dropTableIfExists(MetaTable.APPROVAL_GROUPS);
  await knex.schema.dropTableIfExists(MetaTable.APPROVAL_TASKS);
  await knex.schema.dropTableIfExists(MetaTable.APPROVAL_INSTANCES);
  await knex.schema.dropTableIfExists(MetaTable.APPROVAL_FLOWS);
};

export { up, down };

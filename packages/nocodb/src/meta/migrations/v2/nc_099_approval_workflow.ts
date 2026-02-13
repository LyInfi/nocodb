import type { Knex } from 'knex';
import { MetaTable } from '~/utils/globals';

const up = async (knex: Knex) => {
  // 1. Create approval workflows table - defines approval flows for different project types
  await knex.schema.createTable(MetaTable.APPROVAL_WORKFLOWS, (table) => {
    if (knex.client.config.client === 'pg') {
      table.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
    } else {
      table.string('id', 20).primary();
    }

    table.string('name', 255).notNullable();
    table.string('description', 1000);
    table.string('project_type', 100).notNullable(); // e.g., 'research', 'development', 'procurement'
    table.integer('version').defaultTo(1);
    table.boolean('is_active').defaultTo(true);
    table.string('base_id', 20).notNullable();
    table.string('fk_workspace_id', 20).notNullable();

    // Workflow configuration as JSON
    table.jsonb('workflow_config');

    table.timestamps(true, true);

    // Indexes
    table.index(['base_id', 'fk_workspace_id'], 'nc_approval_workflows_tenant_idx');
    table.index(['project_type', 'is_active'], 'nc_approval_workflows_type_idx');
  });

  // 2. Create approval instances table - tracks running approval processes
  await knex.schema.createTable(MetaTable.APPROVAL_INSTANCES, (table) => {
    if (knex.client.config.client === 'pg') {
      table.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
    } else {
      table.string('id', 20).primary();
    }

    table.string('fk_workflow_id', 20).notNullable();
    table.string('fk_model_id', 20).notNullable(); // projects table id
    table.string('row_id', 255).notNullable(); // project record id
    table.string('status', 50).notNullable().defaultTo('pending'); // pending, approved, rejected, cancelled

    // Current approvers (JSON array of user IDs)
    table.jsonb('current_approvers');
    table.jsonb('approved_by'); // Array of user IDs who approved
    table.jsonb('rejected_by'); // Array of user IDs who rejected

    // Approval steps tracking
    table.integer('current_step').defaultTo(1);
    table.integer('total_steps').defaultTo(1);

    table.text('comments');
    table.timestamp('started_at').defaultTo(knex.fn.now());
    table.timestamp('completed_at');

    table.string('base_id', 20).notNullable();
    table.string('fk_workspace_id', 20).notNullable();
    table.string('created_by', 20); // User who triggered the approval

    table.timestamps(true, true);

    // Indexes
    table.index(['base_id', 'fk_workspace_id'], 'nc_approval_instances_tenant_idx');
    table.index(['fk_model_id', 'row_id'], 'nc_approval_instances_record_idx');
    table.index(['status', 'fk_workflow_id'], 'nc_approval_instances_status_idx');
    table.index(['created_by'], 'nc_approval_instances_creator_idx');
  });

  // 3. Create department leaders table - maps departments to leaders
  await knex.schema.createTable(MetaTable.DEPT_LEADERS, (table) => {
    if (knex.client.config.client === 'pg') {
      table.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
    } else {
      table.string('id', 20).primary();
    }

    table.string('dept_id', 20).notNullable(); // Can be reference to departments table or external ID
    table.string('dept_name', 255);
    table.string('leader_id', 20).notNullable(); // User ID
    table.string('leader_role', 50).defaultTo('primary'); // primary, secondary, backup
    table.integer('approval_order').defaultTo(1); // For multi-level approvals within dept

    table.boolean('is_active').defaultTo(true);
    table.string('base_id', 20).notNullable();
    table.string('fk_workspace_id', 20).notNullable();

    table.timestamps(true, true);

    // Indexes
    table.index(['base_id', 'fk_workspace_id'], 'nc_dept_leaders_tenant_idx');
    table.index(['dept_id', 'is_active'], 'nc_dept_leaders_dept_idx');
    table.index(['leader_id'], 'nc_dept_leaders_leader_idx');
    table.unique(['dept_id', 'leader_id', 'base_id'], 'nc_dept_leaders_unique_idx');
  });

  // 4. Create approval history/audit table
  await knex.schema.createTable(MetaTable.APPROVAL_HISTORY, (table) => {
    if (knex.client.config.client === 'pg') {
      table.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
    } else {
      table.string('id', 20).primary();
    }

    table.string('fk_instance_id', 20).notNullable();
    table.string('action', 50).notNullable(); // submit, approve, reject, comment, escalate
    table.string('action_by', 20).notNullable(); // User ID
    table.text('comments');
    table.jsonb('action_data'); // Additional context

    table.string('base_id', 20).notNullable();
    table.string('fk_workspace_id', 20).notNullable();

    table.timestamps(true, true);

    // Indexes
    table.index(['base_id', 'fk_workspace_id'], 'nc_approval_history_tenant_idx');
    table.index(['fk_instance_id'], 'nc_approval_history_instance_idx');
    table.index(['action_by'], 'nc_approval_history_actor_idx');
  });
};

const down = async (knex: Knex) => {
  await knex.schema.dropTableIfExists(MetaTable.APPROVAL_HISTORY);
  await knex.schema.dropTableIfExists(MetaTable.DEPT_LEADERS);
  await knex.schema.dropTableIfExists(MetaTable.APPROVAL_INSTANCES);
  await knex.schema.dropTableIfExists(MetaTable.APPROVAL_WORKFLOWS);
};

export { up, down };

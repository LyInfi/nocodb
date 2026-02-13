<script setup lang="ts">
import type { Node } from '@vue-flow/core'
import type { ApprovalNodeData } from './useApprovalFlowStore'
import ConditionConfig from './ConditionConfig.vue'
import ParallelSignConfig from './ParallelSignConfig.vue'

interface Props {
  node: Node<ApprovalNodeData>
}

const props = defineProps<Props>()

const store = useApprovalFlowStore()
const { updateNode } = store

const { node } = toRefs(props)

// Local state for form editing
const formData = computed({
  get: () => node.value.data,
  set: (val) => {
    updateNode(node.value.id, val)
  },
})

const nodeTypeLabel = computed(() => {
  const labels: Record<string, string> = {
    start: '开始节点',
    serial: '串行审批',
    parallel: '会签审批',
    condition: '条件分支',
    end: '结束节点',
  }
  return labels[node.value.data.type] || '未知节点'
})

const showSerialConfig = computed(() => node.value.data.type === 'serial')
const showParallelConfig = computed(() => node.value.data.type === 'parallel')
const showConditionConfig = computed(() => node.value.data.type === 'condition')

// Serial node - approvers
const approvers = computed({
  get: () => formData.value.approvers || [],
  set: (val) => {
    formData.value = { ...formData.value, approvers: val }
  },
})

// Parallel node - groups
const parallelGroups = computed({
  get: () => formData.value.parallelGroups || [],
  set: (val) => {
    formData.value = { ...formData.value, parallelGroups: val }
  },
})

// Condition node - config
const conditionConfig = computed({
  get: () => formData.value.condition || { field: '', operator: 'eq', value: '' },
  set: (val) => {
    formData.value = { ...formData.value, condition: val }
  },
})

// Update basic fields
const updateField = (field: keyof ApprovalNodeData, value: any) => {
  updateNode(node.value.id, { [field]: value })
}
</script>

<template>
  <div class="nc-approval-node-config space-y-4">
    <!-- Node Type Badge -->
    <div class="flex items-center gap-2">
      <a-tag>{{ nodeTypeLabel }}</a-tag>
      <span class="text-xs text-nc-content-gray-subtle">ID: {{ node.id }}</span>
    </div>

    <!-- Basic Info -->
    <div class="space-y-3">
      <div class="nc-form-item">
        <label class="nc-form-label">节点名称</label>
        <a-input
          :value="formData.label"
          placeholder="输入节点名称"
          @update:value="(val) => updateField('label', val)"
        />
      </div>

      <div class="nc-form-item">
        <label class="nc-form-label">描述</label>
        <a-textarea
          :value="formData.description"
          :rows="2"
          placeholder="输入节点描述"
          @update:value="(val) => updateField('description', val)"
        />
      </div>
    </div>

    <!-- Serial Node Configuration -->
    <template v-if="showSerialConfig">
      <nc-divider />
      <div class="nc-form-item">
        <label class="nc-form-label">审批人</label>
        <a-select
          v-model:value="approvers"
          mode="tags"
          placeholder="添加审批人"
          class="w-full"
        >
          <a-select-option value="manager">部门经理</a-select-option>
          <a-select-option value="director">总监</a-select-option>
          <a-select-option value="vp">副总裁</a-select-option>
          <a-select-option value="ceo">CEO</a-select-option>
        </a-select>
        <p class="text-xs text-nc-content-gray-subtle mt-1">
          按添加顺序依次审批
        </p>
      </div>
    </template>

    <!-- Parallel Node Configuration -->
    <template v-if="showParallelConfig">
      <nc-divider />
      <ParallelSignConfig v-model="parallelGroups" />
    </template>

    <!-- Condition Node Configuration -->
    <template v-if="showConditionConfig">
      <nc-divider />
      <ConditionConfig v-model="conditionConfig" />
    </template>

    <!-- Read-only info for start/end nodes -->
    <template v-if="node.data.type === 'start' || node.data.type === 'end'">
      <nc-divider />
      <div class="bg-nc-bg-gray-light rounded-lg p-3 text-sm text-nc-content-gray">
        <GeneralIcon icon="info" class="mr-1" />
        {{ node.data.type === 'start' ? '这是流程的起始节点' : '这是流程的结束节点' }}
      </div>
    </template>
  </div>
</template>

<style lang="scss" scoped>
.nc-approval-node-config {
  .nc-form-item {
    @apply flex flex-col gap-1.5;
  }

  .nc-form-label {
    @apply text-xs text-nc-content-gray-subtle font-medium;
  }
}
</style>

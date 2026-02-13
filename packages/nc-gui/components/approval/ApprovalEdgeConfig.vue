<script setup lang="ts">
import type { Edge } from '@vue-flow/core'

interface Props {
  edge: Edge
}

const props = defineProps<Props>()

const store = useApprovalFlowStore()
const { updateEdge } = store

const { edge } = toRefs(props)

// Get connected nodes for context
const sourceNode = computed(() => {
  return store.nodes.find(n => n.id === edge.value.source)
})

const targetNode = computed(() => {
  return store.nodes.find(n => n.id === edge.value.target)
})

const isFromCondition = computed(() => {
  return sourceNode.value?.data.type === 'condition'
})

const label = computed({
  get: () => edge.value.label || '',
  set: (val) => {
    updateEdge(edge.value.id, { label: val })
  },
})

const conditionLabel = computed({
  get: () => edge.value.data?.conditionLabel || '',
  set: (val) => {
    updateEdge(edge.value.id, {
      data: { ...edge.value.data, conditionLabel: val }
    })
  },
})

// Common condition labels
const conditionLabels = [
  { value: '通过', label: '通过 (Yes)' },
  { value: '拒绝', label: '拒绝 (No)' },
  { value: '需要修改', label: '需要修改' },
  { value: '转交', label: '转交' },
]
</script>

<template>
  <div class="nc-approval-edge-config space-y-4">
    <!-- Edge Info -->
    <div class="flex items-center gap-2">
      <a-tag>连接</a-tag>
      <span class="text-xs text-nc-content-gray-subtle">ID: {{ edge.id }}</span>
    </div>

    <!-- Connection Info -->
    <div class="bg-nc-bg-gray-light rounded-lg p-3 space-y-2">
      <div class="flex items-center gap-2">
        <GeneralIcon icon="arrow-up" class="text-nc-content-gray-subtle" />
        <span class="text-sm text-nc-content-gray">从:</span>
        <span class="text-sm font-medium text-nc-content-gray-emphasis">
          {{ sourceNode?.data.label || edge.source }}
        </span>
      </div>
      <div class="flex items-center gap-2">
        <GeneralIcon icon="arrow-down" class="text-nc-content-gray-subtle" />
        <span class="text-sm text-nc-content-gray">到:</span>
        <span class="text-sm font-medium text-nc-content-gray-emphasis">
          {{ targetNode?.data.label || edge.target }}
        </span>
      </div>
    </div>

    <!-- Label Input -->
    <div class="nc-form-item">
      <label class="nc-form-label">连接标签</label>
      <a-input v-model:value="label" placeholder="输入标签（可选）" />
      <p class="text-xs text-nc-content-gray-subtle mt-1">
        标签将显示在连接线上
      </p>
    </div>

    <!-- Condition-specific config -->
    <template v-if="isFromCondition">
      <nc-divider />

      <div class="bg-amber-50 border border-amber-200 rounded-lg p-3">
        <div class="flex items-start gap-2">
          <GeneralIcon icon="info" class="text-amber-600 mt-0.5" />
          <div class="text-sm text-amber-800">
            此连接来自条件分支节点。建议设置明确的条件标签。
          </div>
        </div>
      </div>

      <div class="nc-form-item">
        <label class="nc-form-label">条件结果</label>
        <a-select v-model:value="conditionLabel" placeholder="选择或输入条件结果" class="w-full">
          <a-select-option v-for="opt in conditionLabels" :key="opt.value" :value="opt.value">
            {{ opt.label }}
          </a-select-option>
        </a-select>
        <p class="text-xs text-nc-content-gray-subtle mt-1">
          此标签将用于判断条件满足时走哪条分支
        </p>
      </div>
    </template>

    <!-- Style Settings -->
    <nc-divider />

    <div class="nc-form-item">
      <label class="nc-form-label">样式设置</label>
      <div class="flex gap-2">
        <a-button type="default" size="small" class="flex-1">
          <GeneralIcon icon="line-style" class="mr-1" />
          实线
        </a-button>
        <a-button type="default" size="small" class="flex-1">
          <GeneralIcon icon="dotted" class="mr-1" />
          虚线
        </a-button>
      </div>
    </div>
  </div>
</template>

<style lang="scss" scoped>
.nc-approval-edge-config {
  .nc-form-item {
    @apply flex flex-col gap-1.5;
  }

  .nc-form-label {
    @apply text-xs text-nc-content-gray-subtle font-medium;
  }
}
</style>

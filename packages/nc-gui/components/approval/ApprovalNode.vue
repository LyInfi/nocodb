<script setup lang="ts">
import type { NodeProps } from '@vue-flow/core'
import { Handle, Position } from '@vue-flow/core'
import type { ApprovalNodeData, ApprovalNodeType } from './useApprovalFlowStore'

interface Props extends NodeProps<ApprovalNodeData> {
  selected?: boolean
}

const props = defineProps<Props>()

const emit = defineEmits<{
  (e: 'delete', nodeId: string): void
}>()

const { data, selected } = toRefs(props)

// Node type configurations
const nodeTypeConfig: Record<ApprovalNodeType, { color: string; icon: string; bgColor: string }> = {
  start: {
    color: '#52c41a',
    icon: 'play',
    bgColor: '#f6ffed',
  },
  serial: {
    color: '#1890ff',
    icon: 'arrow-right',
    bgColor: '#e6f7ff',
  },
  parallel: {
    color: '#722ed1',
    icon: 'account-group',
    bgColor: '#f9f0ff',
  },
  condition: {
    color: '#fa8c16',
    icon: 'source-branch',
    bgColor: '#fff7e6',
  },
  end: {
    color: '#f5222d',
    icon: 'stop',
    bgColor: '#fff1f0',
  },
}

const config = computed(() => nodeTypeConfig[data.value.type])

const showDelete = computed(() => {
  // Don't show delete for start/end nodes
  return selected.value && data.value.type !== 'start' && data.value.type !== 'end'
})

const handleDelete = () => {
  emit('delete', props.id)
}
</script>

<template>
  <div
    class="nc-approval-node relative"
    :class="{ 'nc-approval-node--selected': selected }"
    :style="{ '--node-color': config.color }"
  >
    <!-- Target Handle (Top) -->
    <Handle
      v-if="data.type !== 'start'"
      type="target"
      :position="Position.Top"
      class="nc-handle nc-handle--target"
    />

    <!-- Node Content -->
    <div
      class="nc-approval-node__content"
      :style="{ backgroundColor: config.bgColor, borderColor: config.color }"
    >
      <!-- Icon -->
      <div class="nc-approval-node__icon" :style="{ backgroundColor: config.color }">
        <GeneralIcon :icon="config.icon" class="text-white text-lg" />
      </div>

      <!-- Info -->
      <div class="nc-approval-node__info">
        <div class="nc-approval-node__label" :style="{ color: config.color }">
          {{ data.label }}
        </div>
        <div v-if="data.description" class="nc-approval-node__desc">
          {{ data.description }}
        </div>

        <!-- Approvers indicator for serial nodes -->
        <div v-if="data.type === 'serial' && data.approvers?.length" class="nc-approval-node__meta">
          <GeneralIcon icon="account" class="text-xs mr-1" /
          <span>{{ data.approvers.length }} 审批人</span>
        </div>

        <!-- Groups indicator for parallel nodes -->
        <div v-if="data.type === 'parallel' && data.parallelGroups?.length" class="nc-approval-node__meta">
          <GeneralIcon icon="account-group" class="text-xs mr-1" /
          <span>{{ data.parallelGroups.length }} 审批组</span>
        </div>

        <!-- Condition indicator -->
        <div v-if="data.type === 'condition' && data.condition?.field" class="nc-approval-node__meta">
          <GeneralIcon icon="code-json" class="text-xs mr-1" /
          <span class="truncate max-w-[120px]" :title="data.condition.field">
            {{ data.condition.field }}
          </span>
        </div>
      </div>

      <!-- Delete Button -->
      <div v-if="showDelete" class="nc-approval-node__delete" @click.stop="handleDelete">
        <GeneralIcon icon="close" class="text-xs" />
      </div>
    </div>

    <!-- Source Handle (Bottom) -->
    <Handle
      v-if="data.type !== 'end'"
      type="source"
      :position="Position.Bottom"
      class="nc-handle nc-handle--source"
    />
  </div>
</template>

<style lang="scss" scoped>
.nc-approval-node {
  min-width: 160px;
  max-width: 200px;

  &--selected {
    .nc-approval-node__content {
      box-shadow: 0 0 0 2px var(--node-color), 0 4px 12px rgba(0, 0, 0, 0.15);
    }
  }

  &__content {
    display: flex;
    align-items: center;
    gap: 10px;
    padding: 10px 12px;
    border-radius: 8px;
    border: 2px solid;
    background: white;
    cursor: pointer;
    transition: all 0.2s ease;
    position: relative;

    &:hover {
      box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
      transform: translateY(-1px);
    }
  }

  &__icon {
    width: 36px;
    height: 36px;
    border-radius: 8px;
    display: flex;
    align-items: center;
    justify-content: center;
    flex-shrink: 0;
  }

  &__info {
    flex: 1;
    min-width: 0;
    display: flex;
    flex-direction: column;
    gap: 2px;
  }

  &__label {
    font-size: 14px;
    font-weight: 600;
    line-height: 1.3;
  }

  &__desc {
    font-size: 11px;
    color: rgba(0, 0, 0, 0.45);
    line-height: 1.2;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  &__meta {
    display: flex;
    align-items: center;
    font-size: 11px;
    color: rgba(0, 0, 0, 0.45);
    margin-top: 2px;
  }

  &__delete {
    position: absolute;
    top: -8px;
    right: -8px;
    width: 20px;
    height: 20px;
    background: #ff4d4f;
    color: white;
    border-radius: 50%;
    display: flex;
    align-items: center;
    justify-content: center;
    cursor: pointer;
    opacity: 0;
    transition: opacity 0.2s;

    .nc-approval-node:hover &,
    .nc-approval-node--selected & {
      opacity: 1;
    }

    &:hover {
      background: #ff7875;
    }
  }
}

.nc-handle {
  width: 10px;
  height: 10px;
  background: white;
  border: 2px solid var(--node-color);
  border-radius: 50%;

  &--target {
    top: -6px;
  }

  &--source {
    bottom: -6px;
  }
}
</style>

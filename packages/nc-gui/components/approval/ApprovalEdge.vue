<script setup lang="ts">
import type { EdgeProps } from '@vue-flow/core'
import { EdgeLabelRenderer, getBezierPath } from '@vue-flow/core'
import type { CSSProperties } from 'vue'

interface ApprovalEdgeProps extends EdgeProps {
  id: string
  sourceX: number
  sourceY: number
  targetX: number
  targetY: number
  sourcePosition: any
  targetPosition: any
  label?: string
  selected?: boolean
}

const props = defineProps<ApprovalEdgeProps>()

const emit = defineEmits<{
  (e: 'delete', edgeId: string): void
}>()

const { selected, label } = toRefs(props)

const edgePath = computed(() => {
  return getBezierPath({
    sourceX: props.sourceX,
    sourceY: props.sourceY,
    targetX: props.targetX,
    targetY: props.targetY,
    sourcePosition: props.sourcePosition,
    targetPosition: props.targetPosition,
  })
})

const labelStyle = computed<CSSProperties>(() => ({
  position: 'absolute',
  transform: `translate(-50%, -50%) translate(${edgePath.value[1]}px, ${edgePath.value[2]}px)`,
  pointerEvents: 'all',
}))

const handleDelete = () => {
  emit('delete', props.id)
}
</script>

<template>
  <g class="nc-approval-edge">
    <!-- Invisible wider path for easier interaction -->
    <path
      :d="edgePath[0]"
      fill="none"
      stroke="transparent"
      stroke-width="20"
      class="nc-approval-edge__hit-area"
    />

    <!-- Visible edge path -->
    <path
      :id="id"
      :d="edgePath[0]"
      fill="none"
      :class="[
        'nc-approval-edge__path',
        selected ? 'nc-approval-edge__path--selected' : '',
      ]"
      stroke-width="2"
    />

    <!-- Delete button -->
    <foreignObject
      v-if="selected"
      :x="edgePath[1] - 10"
      :y="edgePath[2] - 10"
      width="20"
      height="20"
      class="nc-approval-edge__delete-wrapper"
    >
      <div class="nc-approval-edge__delete" @click.stop="handleDelete">
        <GeneralIcon icon="close" class="text-xs" />
      </div>
    </foreignObject>
  </g>

  <!-- Edge label -->
  <EdgeLabelRenderer v-if="label">
    <div
      :style="labelStyle"
      class="nc-approval-edge__label nodrag nopan"
    >
      {{ label }}
    </div>
  </EdgeLabelRenderer>
</template>

<style lang="scss" scoped>
.nc-approval-edge {
  &__path {
    stroke: #b8c2cc;
    transition: stroke 0.2s, stroke-width 0.2s;

    &--selected {
      stroke: #3366ff;
      stroke-width: 3;
    }
  }

  &__hit-area {
    cursor: pointer;

    &:hover + .nc-approval-edge__path {
      stroke: #3366ff;
    }
  }

  &__delete-wrapper {
    overflow: visible;
  }

  &__delete {
    width: 20px;
    height: 20px;
    background: #ff4d4f;
    color: white;
    border-radius: 50%;
    display: flex;
    align-items: center;
    justify-content: center;
    cursor: pointer;
    box-shadow: 0 2px 4px rgba(0, 0, 0, 0.2);

    &:hover {
      background: #ff7875;
    }
  }

  &__label {
    padding: 4px 8px;
    background: white;
    border: 1px solid #e5e7eb;
    border-radius: 4px;
    font-size: 12px;
    color: #4a5568;
    box-shadow: 0 2px 4px rgba(0, 0, 0, 0.05);
  }
}
</style>

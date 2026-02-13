<script setup lang="ts">
import { Background, Controls, MiniMap, Panel, PanelPosition } from '@vue-flow/additional-components'
import { VueFlow, useVueFlow } from '@vue-flow/core'
import type { ApprovalNodeType } from './useApprovalFlowStore'
import { useApprovalFlowStore } from './useApprovalFlowStore'

const props = defineProps<{
  flowId?: string
}>()

const emit = defineEmits<{
  (e: 'save', flow: any): void
  (e: 'cancel'): void
}>()

const store = useApprovalFlowStore()

const {
  nodes,
  edges,
  selectedNode,
  selectedEdge,
  showConfigPanel,
  configPanelType,
  hasUnsavedChanges,
} = storeToRefs(store)

const {
  addNode,
  addEdge,
  removeNode,
  removeEdge,
  selectNode,
  selectEdge,
  clearSelection,
  saveFlow,
  validateFlow,
  resetFlow,
} = store

// Vue Flow instance
const {
  fitView,
  zoomIn,
  zoomOut,
  project,
  onConnect,
  onNodeClick,
  onEdgeClick,
  onPaneClick,
  onNodeDragStop,
} = useVueFlow({
  minZoom: 0.2,
  maxZoom: 2,
  defaultZoom: 1,
})

// Node palette for drag and drop
const nodePalette = [
  { type: 'serial' as ApprovalNodeType, label: '串行审批', icon: 'mdi:arrow-right', color: '#1890ff' },
  { type: 'parallel' as ApprovalNodeType, label: '会签审批', icon: 'mdi:account-group', color: '#52c41a' },
  { type: 'condition' as ApprovalNodeType, label: '条件分支', icon: 'mdi:source-branch', color: '#fa8c16' },
]

// Drag state
const draggedNodeType = ref<ApprovalNodeType | null>(null)

// Validation dialog
const showValidationDialog = ref(false)
const validationErrors = ref<string[]>([])

// Initialize flow
onMounted(() => {
  if (props.flowId) {
    store.loadFlow(props.flowId)
  } else {
    resetFlow()
  }

  nextTick(() => {
    fitView({ padding: 0.2 })
  })
})

// Connection handler
onConnect((params) => {
  addEdge(params.source, params.target, params.label)
})

// Click handlers
onNodeClick(({ node }) => {
  selectNode(node)
})

onEdgeClick(({ edge }) => {
  selectEdge(edge)
})

onPaneClick(() => {
  clearSelection()
})

// Drag and drop handlers
const onDragStart = (type: ApprovalNodeType) => {
  draggedNodeType.value = type
}

const onDragOver = (event: DragEvent) => {
  event.preventDefault()
}

const onDrop = (event: DragEvent) => {
  event.preventDefault()

  if (!draggedNodeType.value) return

  const position = project({
    x: event.clientX - 200, // Adjust for sidebar width
    y: event.clientY - 100,
  })

  addNode(draggedNodeType.value, position)
  draggedNodeType.value = null

  nextTick(() => {
    fitView({ padding: 0.1 })
  })
}

// Save handler
const handleSave = () => {
  const validation = validateFlow()
  if (!validation.valid) {
    validationErrors.value = validation.errors
    showValidationDialog.value = true
    return
  }

  const flow = saveFlow()
  if (flow) {
    emit('save', flow)
    message.success('流程保存成功')
  }
}

// Delete handlers
const handleDeleteNode = (nodeId: string) => {
  removeNode(nodeId)
}

const handleDeleteEdge = (edgeId: string) => {
  removeEdge(edgeId)
}

// Keyboard shortcuts
onKeyStroke('Delete', () => {
  if (selectedNode.value) {
    removeNode(selectedNode.value.id)
  } else if (selectedEdge.value) {
    removeEdge(selectedEdge.value.id)
  }
})
</script>

<template>
  <div class="nc-approval-flow-designer flex h-full w-full">
    <!-- Left Sidebar - Node Palette -->
    <div class="nc-approval-sidebar w-52 bg-nc-bg-gray-light border-r border-nc-border-gray-medium flex flex-col">
      <div class="p-4 border-b border-nc-border-gray-medium">
        <h3 class="text-sm font-semibold text-nc-content-gray">节点类型</h3>
        <p class="text-xs text-nc-content-gray-subtle mt-1">拖拽节点到画布</p>
      </div>

      <div class="flex-1 p-3 space-y-2">
        <div
          v-for="item in nodePalette"
          :key="item.type"
          draggable="true"
          class="nc-palette-item flex items-center gap-2 p-3 bg-nc-bg-default rounded-lg border border-nc-border-gray-medium cursor-move hover:border-nc-border-brand hover:shadow-sm transition-all"
          :style="{ borderLeftColor: item.color, borderLeftWidth: '3px' }"
          @dragstart="onDragStart(item.type)"
        >
          <GeneralIcon :icon="item.icon" class="text-lg" :style="{ color: item.color }" />
          <span class="text-sm text-nc-content-gray">{{ item.label }}</span>
        </div>
      </div>

      <div class="p-4 border-t border-nc-border-gray-medium space-y-2">
        <a-button type="primary" size="small" class="w-full" @click="handleSave">
          <GeneralIcon icon="save" class="mr-1" />
          保存流程
        </a-button>
        <a-button type="default" size="small" class="w-full" @click="emit('cancel')">
          <GeneralIcon icon="close" class="mr-1" />
          取消
        </a-button>
      </div>
    </div>

    <!-- Main Canvas -->
    <div class="flex-1 relative" @dragover="onDragOver" @drop="onDrop">
      <VueFlow
        v-model:nodes="nodes"
        v-model:edges="edges"
        class="nc-approval-flow"
        :default-zoom="1"
        :min-zoom="0.2"
        :max-zoom="2"
        :fit-view-on-init="true"
      >
        <Background :gap="20" :size="1" pattern-color="#e5e7eb" />

        <Controls :position="PanelPosition.BottomLeft">
          <template #control-zoom-in>
            <div class="nc-control-btn" @click="zoomIn">
              <GeneralIcon icon="plus" />
            </div>
          </template>
          <template #control-zoom-out>
            <div class="nc-control-btn" @click="zoomOut">
              <GeneralIcon icon="minus" />
            </div>
          </template>
          <template #control-fit-view>
            <div class="nc-control-btn" @click="fitView">
              <GeneralIcon icon="fullscreen" />
            </div>
          </template>
        </Controls>

        <MiniMap :position="PanelPosition.BottomRight" class="bg-nc-bg-default" />

        <!-- Custom Node Template -->
        <template #node-approval="nodeProps">
          <ApprovalNode
            v-bind="nodeProps"
            :selected="selectedNode?.id === nodeProps.id"
            @delete="handleDeleteNode"
          />
        </template>

        <!-- Custom Edge Template -->
        <template #edge-approval="edgeProps">
          <ApprovalEdge
            v-bind="edgeProps"
            :selected="selectedEdge?.id === edgeProps.id"
            @delete="handleDeleteEdge"
          />
        </template>

        <!-- Toolbar Panel -->
        <Panel :position="PanelPosition.TopLeft" class="m-2">
          <div class="flex items-center gap-2 bg-nc-bg-default rounded-lg shadow-sm border border-nc-border-gray-medium p-2">
            <a-button type="default" size="small" @click="resetFlow">
              <GeneralIcon icon="refresh" class="mr-1" />
              重置
            </a-button>
            <a-button type="default" size="small" @click="fitView">
              <GeneralIcon icon="fit" class="mr-1" />
              适应画布
            </a-button>
            <div v-if="hasUnsavedChanges" class="flex items-center text-xs text-nc-content-warning">
              <GeneralIcon icon="alert" class="mr-1" />
              未保存
            </div>
          </div>
        </Panel>
      </VueFlow>

      <!-- Right Config Panel -->
      <Transition name="slide">
        <div v-if="showConfigPanel" class="nc-config-panel absolute right-0 top-0 h-full w-80 bg-nc-bg-default border-l border-nc-border-gray-medium shadow-lg z-10">
          <div class="flex items-center justify-between p-4 border-b border-nc-border-gray-medium">
            <h3 class="text-sm font-semibold text-nc-content-gray">
              {{ configPanelType === 'node' ? '节点配置' : '连接配置' }}
            </h3>
            <a-button type="text" size="small" @click="clearSelection">
              <GeneralIcon icon="close" />
            </a-button>
          </div>

          <div class="p-4 overflow-y-auto h-[calc(100%-60px)]">
            <ApprovalNodeConfig v-if="configPanelType === 'node' && selectedNode" :node="selectedNode" />
            <ApprovalEdgeConfig v-else-if="configPanelType === 'edge' && selectedEdge" :edge="selectedEdge" />
          </div>
        </div>
      </Transition>
    </div>

    <!-- Validation Dialog -->
    <a-modal
      v-model:visible="showValidationDialog"
      title="验证失败"
      :footer="null"
      :closable="true"
      @cancel="showValidationDialog = false"
    >
      <div class="space-y-3">
        <p class="text-sm text-nc-content-gray">请修复以下问题后再保存：</p>
        <ul class="list-disc pl-5 space-y-1">
          <li v-for="error in validationErrors" :key="error" class="text-sm text-nc-content-error">
            {{ error }}
          </li>
        </ul>
        <div class="flex justify-end pt-4">
          <a-button type="primary" size="small" @click="showValidationDialog = false">
            确定
          </a-button>
        </div>
      </div>
    </a-modal>
  </div>
</template>

<style lang="scss" scoped>
.nc-approval-flow-designer {
  height: 100vh;
}

.nc-approval-sidebar {
  .nc-palette-item {
    &:active {
      cursor: grabbing;
    }
  }
}

.nc-control-btn {
  @apply w-7 h-7 flex items-center justify-center bg-nc-bg-default text-nc-content-gray-subtle hover:text-nc-content-gray cursor-pointer;

  &:not(:last-child) {
    @apply border-b border-nc-border-gray-medium;
  }
}

.nc-approval-flow {
  :deep(.vue-flow__node) {
    @apply border-none shadow-none;
  }

  :deep(.vue-flow__edge) {
    @apply cursor-pointer;
  }
}

.nc-config-panel {
  :deep(.nc-form-item) {
    @apply mb-4;
  }
}

.slide-enter-active,
.slide-leave-active {
  transition: transform 0.3s ease;
}

.slide-enter-from,
.slide-leave-to {
  transform: translateX(100%);
}
</style>

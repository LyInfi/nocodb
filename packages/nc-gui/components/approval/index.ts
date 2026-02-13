// Approval Flow Components
// 审批流组件库

// 设计器组件
export { default as ApprovalFlowDesigner } from './ApprovalFlowDesigner.vue'
export { default as ApprovalNode } from './ApprovalNode.vue'
export { default as ApprovalEdge } from './ApprovalEdge.vue'
export { default as ApprovalNodeConfig } from './ApprovalNodeConfig.vue'
export { default as ApprovalEdgeConfig } from './ApprovalEdgeConfig.vue'
export { default as ConditionConfig } from './ConditionConfig.vue'
export { default as ParallelSignConfig } from './ParallelSignConfig.vue'
export { useApprovalFlowStore } from './useApprovalFlowStore.ts'

// 审批面板组件
export { default as ApprovalPanel } from './ApprovalPanel.vue'
export { default as ApprovalTimeline } from './ApprovalTimeline.vue'
export { default as PendingApprovalList } from './PendingApprovalList.vue'
export { default as ApprovalStatusBadge } from './ApprovalStatusBadge.vue'

export type {
  ApprovalNodeType,
  ApprovalNodeData,
  ConditionConfig,
  ParallelGroup,
  ApprovalFlowDefinition,
} from './useApprovalFlowStore.ts'

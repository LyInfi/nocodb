import type { Edge, Node } from '@vue-flow/core'
import { MarkerType } from '@vue-flow/core'

export type ApprovalNodeType = 'start' | 'serial' | 'parallel' | 'condition' | 'end'

export interface ApprovalNodeData {
  label: string
  type: ApprovalNodeType
  approvers?: string[]
  condition?: ConditionConfig
  parallelGroups?: ParallelGroup[]
  description?: string
}

export interface ConditionConfig {
  field: string
  operator: 'eq' | 'ne' | 'gt' | 'lt' | 'contains' | 'in'
  value: string | string[] | number
}

export interface ParallelGroup {
  id: string
  name: string
  approvers: string[]
  requiredCount?: number
}

export interface ApprovalFlowDefinition {
  id: string
  name: string
  nodes: Node<ApprovalNodeData>[]
  edges: Edge[]
  createdAt?: string
  updatedAt?: string
}

const defaultNodes: Node<ApprovalNodeData>[] = [
  {
    id: 'start',
    type: 'approval',
    position: { x: 250, y: 50 },
    data: { label: '开始', type: 'start', description: '流程开始' },
  },
  {
    id: 'end',
    type: 'approval',
    position: { x: 250, y: 400 },
    data: { label: '结束', type: 'end', description: '流程结束' },
  },
]

export const useApprovalFlowStore = defineStore('approvalFlow', () => {
  // State
  const flows = ref<ApprovalFlowDefinition[]>([])
  const currentFlow = ref<ApprovalFlowDefinition | null>(null)
  const nodes = ref<Node<ApprovalNodeData>[]>([...defaultNodes])
  const edges = ref<Edge[]>([])
  const selectedNode = ref<Node<ApprovalNodeData> | null>(null)
  const selectedEdge = ref<Edge | null>(null)
  const isLoading = ref(false)
  const showConfigPanel = ref(false)
  const configPanelType = ref<'node' | 'edge' | null>(null)

  // Getters
  const hasUnsavedChanges = computed(() => {
    if (!currentFlow.value) return nodes.value.length > 2
    // Compare current nodes/edges with saved flow
    return JSON.stringify(nodes.value) !== JSON.stringify(currentFlow.value.nodes) ||
           JSON.stringify(edges.value) !== JSON.stringify(currentFlow.value.edges)
  })

  const nodeCount = computed(() => nodes.value.length)

  const canAddNode = computed(() => {
    // Check if start and end nodes exist
    return nodes.value.some(n => n.data.type === 'start') &&
           nodes.value.some(n => n.data.type === 'end')
  })

  // Actions
  const createNewFlow = (name: string) => {
    const newFlow: ApprovalFlowDefinition = {
      id: `flow-${Date.now()}`,
      name,
      nodes: [...defaultNodes],
      edges: [],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    }
    currentFlow.value = newFlow
    nodes.value = [...defaultNodes]
    edges.value = []
    flows.value.push(newFlow)
    return newFlow
  }

  const loadFlow = (flowId: string) => {
    const flow = flows.value.find(f => f.id === flowId)
    if (flow) {
      currentFlow.value = flow
      nodes.value = JSON.parse(JSON.stringify(flow.nodes))
      edges.value = JSON.parse(JSON.stringify(flow.edges))
    }
    return flow
  }

  const saveFlow = () => {
    if (!currentFlow.value) return null

    const updatedFlow: ApprovalFlowDefinition = {
      ...currentFlow.value,
      nodes: JSON.parse(JSON.stringify(nodes.value)),
      edges: JSON.parse(JSON.stringify(edges.value)),
      updatedAt: new Date().toISOString(),
    }

    const index = flows.value.findIndex(f => f.id === currentFlow.value!.id)
    if (index !== -1) {
      flows.value[index] = updatedFlow
    }
    currentFlow.value = updatedFlow
    return updatedFlow
  }

  const addNode = (type: ApprovalNodeType, position: { x: number; y: number }) => {
    const id = `node-${Date.now()}`
    let label = ''
    let description = ''

    switch (type) {
      case 'serial':
        label = '串行审批'
        description = '顺序审批节点'
        break
      case 'parallel':
        label = '会签审批'
        description = '并行审批节点'
        break
      case 'condition':
        label = '条件分支'
        description = '根据条件分支'
        break
    }

    const newNode: Node<ApprovalNodeData> = {
      id,
      type: 'approval',
      position,
      data: {
        label,
        type,
        description,
        approvers: type === 'serial' ? [] : undefined,
        parallelGroups: type === 'parallel' ? [] : undefined,
        condition: type === 'condition' ? { field: '', operator: 'eq', value: '' } : undefined,
      },
    }

    nodes.value.push(newNode)
    return newNode
  }

  const updateNode = (nodeId: string, data: Partial<ApprovalNodeData>) => {
    const node = nodes.value.find(n => n.id === nodeId)
    if (node) {
      node.data = { ...node.data, ...data }
    }
    return node
  }

  const removeNode = (nodeId: string) => {
    // Don't allow removing start/end nodes
    const node = nodes.value.find(n => n.id === nodeId)
    if (node && (node.data.type === 'start' || node.data.type === 'end')) {
      return false
    }

    nodes.value = nodes.value.filter(n => n.id !== nodeId)
    // Remove associated edges
    edges.value = edges.value.filter(e => e.source !== nodeId && e.target !== nodeId)
    if (selectedNode.value?.id === nodeId) {
      selectedNode.value = null
      showConfigPanel.value = false
    }
    return true
  }

  const addEdge = (source: string, target: string, label?: string) => {
    // Check if edge already exists
    const exists = edges.value.some(e => e.source === source && e.target === target)
    if (exists) return null

    const id = `edge-${Date.now()}`
    const newEdge: Edge = {
      id,
      source,
      target,
      label,
      type: 'approval',
      markerEnd: {
        type: MarkerType.ArrowClosed,
      },
    }

    edges.value.push(newEdge)
    return newEdge
  }

  const updateEdge = (edgeId: string, updates: Partial<Edge>) => {
    const edge = edges.value.find(e => e.id === edgeId)
    if (edge) {
      Object.assign(edge, updates)
    }
    return edge
  }

  const removeEdge = (edgeId: string) => {
    edges.value = edges.value.filter(e => e.id !== edgeId)
    if (selectedEdge.value?.id === edgeId) {
      selectedEdge.value = null
      showConfigPanel.value = false
    }
  }

  const selectNode = (node: Node<ApprovalNodeData> | null) => {
    selectedNode.value = node
    selectedEdge.value = null
    if (node) {
      configPanelType.value = 'node'
      showConfigPanel.value = true
    } else {
      showConfigPanel.value = false
    }
  }

  const selectEdge = (edge: Edge | null) => {
    selectedEdge.value = edge
    selectedNode.value = null
    if (edge) {
      configPanelType.value = 'edge'
      showConfigPanel.value = true
    } else {
      showConfigPanel.value = false
    }
  }

  const clearSelection = () => {
    selectedNode.value = null
    selectedEdge.value = null
    showConfigPanel.value = false
    configPanelType.value = null
  }

  const validateFlow = () => {
    const errors: string[] = []

    // Check start and end nodes exist
    const hasStart = nodes.value.some(n => n.data.type === 'start')
    const hasEnd = nodes.value.some(n => n.data.type === 'end')

    if (!hasStart) errors.push('缺少开始节点')
    if (!hasEnd) errors.push('缺少结束节点')

    // Check all nodes are connected
    const connectedNodeIds = new Set<string>()
    edges.value.forEach(e => {
      connectedNodeIds.add(e.source)
      connectedNodeIds.add(e.target)
    })

    nodes.value.forEach(node => {
      if (!connectedNodeIds.has(node.id) && node.data.type !== 'start' && node.data.type !== 'end') {
        errors.push(`节点 "${node.data.label}" 未连接`)
      }
    })

    // Check for isolated paths
    nodes.value.forEach(node => {
      if (node.data.type === 'condition') {
        const outgoingEdges = edges.value.filter(e => e.source === node.id)
        if (outgoingEdges.length < 2) {
          errors.push(`条件节点 "${node.data.label}" 需要至少两个分支`)
        }
      }
    })

    return {
      valid: errors.length === 0,
      errors,
    }
  }

  const resetFlow = () => {
    nodes.value = [...defaultNodes]
    edges.value = []
    selectedNode.value = null
    selectedEdge.value = null
    showConfigPanel.value = false
  }

  return {
    // State
    flows,
    currentFlow,
    nodes,
    edges,
    selectedNode,
    selectedEdge,
    isLoading,
    showConfigPanel,
    configPanelType,

    // Getters
    hasUnsavedChanges,
    nodeCount,
    canAddNode,

    // Actions
    createNewFlow,
    loadFlow,
    saveFlow,
    addNode,
    updateNode,
    removeNode,
    addEdge,
    updateEdge,
    removeEdge,
    selectNode,
    selectEdge,
    clearSelection,
    validateFlow,
    resetFlow,
  }
})

<script setup lang="ts">
import type { ParallelGroup } from './useApprovalFlowStore'

interface Props {
  modelValue: ParallelGroup[]
}

const props = defineProps<Props>()

const emit = defineEmits<{
  (e: 'update:modelValue', value: ParallelGroup[]): void
}>()

const groups = useVModel(props, emit)

// Available approver groups
const presetGroups = [
  { id: 'academic', name: '学术审查组', defaultApprovers: ['academic_lead', 'academic_member1', 'academic_member2'] },
  { id: 'ethics', name: '伦理审查组', defaultApprovers: ['ethics_lead', 'ethics_member1'] },
  { id: 'finance', name: '财务审查组', defaultApprovers: ['finance_lead', 'finance_member1'] },
  { id: 'legal', name: '法务审查组', defaultApprovers: ['legal_lead'] },
]

const addGroup = () => {
  const newGroup: ParallelGroup = {
    id: `group-${Date.now()}`,
    name: `审批组 ${groups.value.length + 1}`,
    approvers: [],
    requiredCount: 1,
  }
  groups.value.push(newGroup)
}

const removeGroup = (index: number) => {
  groups.value.splice(index, 1)
}

const addPresetGroup = (preset: typeof presetGroups[0]) => {
  const exists = groups.value.some(g => g.id === preset.id)
  if (exists) {
    message.warning(`"${preset.name}" 已添加`)
    return
  }
  groups.value.push({
    id: preset.id,
    name: preset.name,
    approvers: [...preset.defaultApprovers],
    requiredCount: 1,
  })
}

const moveGroup = (index: number, direction: 'up' | 'down') => {
  if (direction === 'up' && index > 0) {
    const temp = groups.value[index]
    groups.value[index] = groups.value[index - 1]
    groups.value[index - 1] = temp
  } else if (direction === 'down' && index < groups.value.length - 1) {
    const temp = groups.value[index]
    groups.value[index] = groups.value[index + 1]
    groups.value[index + 1] = temp
  }
}
</script>

<template>
  <div class="nc-parallel-config space-y-4">
    <div class="text-sm font-medium text-nc-content-gray mb-2">
      会签配置
      <span class="text-xs text-nc-content-gray-subtle font-normal"> (所有组同时审批)</span>
    </div>

    <!-- Preset Groups -->
    <div class="bg-nc-bg-gray-light rounded-lg p-3">
      <div class="text-xs text-nc-content-gray-subtle mb-2">快速添加预设组</div>
      <div class="flex flex-wrap gap-2">
        <a-tag
          v-for="preset in presetGroups"
          :key="preset.id"
          class="cursor-pointer hover:bg-nc-bg-brand-hover"
          @click="addPresetGroup(preset)"
        >
          <GeneralIcon icon="plus" class="text-xs mr-1" />
          {{ preset.name }}
        </a-tag>
      </div>
    </div>

    <!-- Groups List -->
    <div class="space-y-3">
      <div
        v-for="(group, index) in groups"
        :key="group.id"
        class="bg-nc-bg-default border border-nc-border-gray-medium rounded-lg p-3"
      >
        <div class="flex items-center justify-between mb-2">
          <a-input v-model:value="group.name" size="small" class="flex-1 mr-2" placeholder="组名称" />
          <div class="flex items-center gap-1">
            <a-button
              type="text"
              size="small"
              :disabled="index === 0"
              @click="moveGroup(index, 'up')"
            >
              <GeneralIcon icon="arrow-up" class="text-xs" />
            </a-button>
            <a-button
              type="text"
              size="small"
              :disabled="index === groups.length - 1"
              @click="moveGroup(index, 'down')"
            >
              <GeneralIcon icon="arrow-down" class="text-xs" />
            </a-button>
            <a-button type="text" size="small" @click="removeGroup(index)">
              <GeneralIcon icon="delete" class="text-xs text-nc-content-error" />
            </a-button>
          </div>
        </div>

        <!-- Required Count -->
        <div class="flex items-center gap-2 mb-2">
          <span class="text-xs text-nc-content-gray-subtle">需通过人数:</span>
          <a-input-number
            v-model:value="group.requiredCount"
            :min="1"
            :max="group.approvers.length || 1"
            size="small"
            class="w-20"
          />
          <span class="text-xs text-nc-content-gray-subtle">/ {{ group.approvers.length }} 人</span>
        </div>

        <!-- Approvers -->
        <div class="nc-form-item">
          <label class="nc-form-label">审批人</label>
          <a-select
            v-model:value="group.approvers"
            mode="tags"
            placeholder="添加审批人"
            class="w-full"
            size="small"
          >
            <a-select-option value="academic_lead">学术负责人</a-select-option>
            <a-select-option value="academic_member1">学术成员1</a-select-option>
            <a-select-option value="academic_member2">学术成员2</a-select-option>
            <a-select-option value="ethics_lead">伦理负责人</a-select-option>
            <a-select-option value="ethics_member1">伦理成员1</a-select-option>
            <a-select-option value="finance_lead">财务负责人</a-select-option>
            <a-select-option value="legal_lead">法务负责人</a-select-option>
          </a-select>
        </div>
      </div>

      <!-- Empty State -->
      <div v-if="!groups.length" class="text-center py-8 text-nc-content-gray-subtle">
        <GeneralIcon icon="account-group" class="text-3xl mb-2" />
        <div class="text-sm">暂无审批组</div>
        <div class="text-xs mt-1">点击上方预设组快速添加</div>
      </div>
    </div>

    <!-- Add Custom Group Button -->
    <a-button type="dashed" size="small" class="w-full" @click="addGroup">
      <GeneralIcon icon="plus" class="mr-1" />
      添加自定义组
    </a-button>

    <!-- Summary -->
    <div v-if="groups.length" class="bg-nc-bg-gray-light rounded-lg p-3">
      <div class="text-xs text-nc-content-gray-subtle mb-1">会签摘要</div>
      <div class="text-sm text-nc-content-gray">
        共 {{ groups.length }} 个审批组，{{ groups.reduce((sum, g) => sum + g.approvers.length, 0) }} 位审批人
      </div>
    </div>
  </div>
</template>

<style lang="scss" scoped>
.nc-parallel-config {
  .nc-form-item {
    @apply flex flex-col gap-1;
  }

  .nc-form-label {
    @apply text-xs text-nc-content-gray-subtle;
  }
}
</style>

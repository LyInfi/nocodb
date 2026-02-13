<script setup lang="ts">
import type { ConditionConfig } from './useApprovalFlowStore'

interface Props {
  modelValue: ConditionConfig
}

const props = defineProps<Props>()

const emit = defineEmits<{
  (e: 'update:modelValue', value: ConditionConfig): void
}>()

const { modelValue } = useVModel(props, emit)

// Available fields for project_type condition
const availableFields = [
  { value: 'project_type', label: '项目类型 (project_type)' },
  { value: 'budget', label: '预算 (budget)' },
  { value: 'department', label: '部门 (department)' },
  { value: 'priority', label: '优先级 (priority)' },
]

const operators = [
  { value: 'eq', label: '等于' },
  { value: 'ne', label: '不等于' },
  { value: 'gt', label: '大于' },
  { value: 'lt', label: '小于' },
  { value: 'contains', label: '包含' },
  { value: 'in', label: '在列表中' },
]

// Preset values for project_type
const projectTypeOptions = [
  { value: 'research', label: '研究项目' },
  { value: 'development', label: '开发项目' },
  { value: 'marketing', label: '市场项目' },
  { value: 'internal', label: '内部项目' },
]

const isMultiSelect = computed(() => modelValue.value.operator === 'in')
</script>

<template>
  <div class="nc-condition-config space-y-4">
    <div class="text-sm font-medium text-nc-content-gray mb-2">
      条件配置
    </div>

    <!-- Field Selection -->
    <div class="nc-form-item">
      <label class="nc-form-label">字段</label>
      <a-select v-model:value="modelValue.field" placeholder="选择字段" class="w-full">
        <a-select-option v-for="field in availableFields" :key="field.value" :value="field.value">
          {{ field.label }}
        </a-select-option>
      </a-select>
    </div>

    <!-- Operator Selection -->
    <div class="nc-form-item">
      <label class="nc-form-label">操作符</label>
      <a-select v-model:value="modelValue.operator" placeholder="选择操作符" class="w-full">
        <a-select-option v-for="op in operators" :key="op.value" :value="op.value">
          {{ op.label }}
        </a-select-option>
      </a-select>
    </div>

    <!-- Value Input -->
    <div class="nc-form-item">
      <label class="nc-form-label">值</label>

      <!-- Multi-select for 'in' operator -->
      <template v-if="isMultiSelect">
        <a-select
          v-if="modelValue.field === 'project_type'"
          v-model:value="modelValue.value"
          mode="multiple"
          placeholder="选择项目类型"
          class="w-full"
        >
          <a-select-option v-for="opt in projectTypeOptions" :key="opt.value" :value="opt.value">
            {{ opt.label }}
          </a-select-option>
        </a-select>
        <a-select v-else v-model:value="modelValue.value" mode="tags" placeholder="输入多个值" class="w-full" />
      </template>

      <!-- Single select for project_type -->
      <template v-else-if="modelValue.field === 'project_type'">
        <a-select v-model:value="modelValue.value" placeholder="选择项目类型" class="w-full">
          <a-select-option v-for="opt in projectTypeOptions" :key="opt.value" :value="opt.value">
            {{ opt.label }}
          </a-select-option>
        </a-select>
      </template>

      <!-- Number input for budget -->
      <template v-else-if="modelValue.field === 'budget'">
        <a-input-number v-model:value="modelValue.value" placeholder="输入预算金额" class="w-full" />
      </template>

      <!-- Default text input -->
      <template v-else>
        <a-input v-model:value="modelValue.value" placeholder="输入值" class="w-full" />
      </template>
    </div>

    <!-- Preview -->
    <div class="bg-nc-bg-gray-light rounded-lg p-3 mt-4">
      <div class="text-xs text-nc-content-gray-subtle mb-1">条件预览</div>
      <div class="text-sm text-nc-content-gray">
        {{ availableFields.find(f => f.value === modelValue.field)?.label || '选择字段' }}
        {{ operators.find(o => o.value === modelValue.operator)?.label || '选择操作符' }}
        <span v-if="Array.isArray(modelValue.value)">
          {{ modelValue.value.join(', ') }}
        </span>
        <span v-else>
          {{ modelValue.value || '?' }}
        </span>
      </div>
    </div>
  </div>
</template>

<style lang="scss" scoped>
.nc-condition-config {
  .nc-form-item {
    @apply flex flex-col gap-1.5;
  }

  .nc-form-label {
    @apply text-xs text-nc-content-gray-subtle font-medium;
  }
}
</style>

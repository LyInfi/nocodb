<script lang="ts" setup>
import dayjs from 'dayjs'
import type { ApprovalHistoryItem } from '~/lib/types'

interface Props {
  history: ApprovalHistoryItem[]
  loading?: boolean
}

const props = withDefaults(defineProps<Props>(), {
  loading: false,
})

const { t } = useI18n()

const sortedHistory = computed(() => {
  return [...props.history].sort((a, b) => {
    return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
  })
})

const getStatusIcon = (action: string) => {
  switch (action) {
    case 'approve':
      return 'ncCheck'
    case 'reject':
      return 'ncX'
    case 'submit':
      return 'send'
    case 'cancel':
      return 'ncX'
    default:
      return 'ncInfo'
  }
}

const getStatusColor = (action: string) => {
  switch (action) {
    case 'approve':
      return 'bg-green-500'
    case 'reject':
      return 'bg-red-500'
    case 'submit':
      return 'bg-blue-500'
    case 'cancel':
      return 'bg-gray-500'
    default:
      return 'bg-gray-400'
  }
}

const formatDate = (date: string) => {
  return dayjs(date).format('YYYY-MM-DD HH:mm')
}
</script>

<template>
  <div class="nc-approval-timeline">
    <div v-if="loading" class="flex justify-center py-4">
      <GeneralLoader size="medium" />
    </div>

    <div v-else-if="sortedHistory.length === 0" class="text-center py-6 text-gray-500">
      <GeneralIcon icon="history" class="w-8 h-8 mx-auto mb-2 opacity-50" />
      <p class="text-sm">{{ $t('msg.noApprovalHistory') }}</p>
    </div>

    <div v-else class="relative">
      <!-- Timeline line -->
      <div class="absolute left-3.5 top-2 bottom-2 w-0.5 bg-nc-border-gray-medium" />

      <div class="space-y-4">
        <div
          v-for="(item, index) in sortedHistory"
          :key="item.id"
          class="relative flex gap-3"
        >
          <!-- Timeline dot -->
          <div
            class="relative z-10 w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0"
            :class="getStatusColor(item.action)"
          >
            <GeneralIcon
              :icon="getStatusIcon(item.action)"
              class="w-3.5 h-3.5 text-white"
            />
          </div>

          <!-- Content -->
          <div class="flex-1 min-w-0 pb-2">
            <div class="flex items-start justify-between gap-2">
              <div class="flex-1 min-w-0">
                <p class="text-sm font-medium text-nc-content-gray">
                  {{ item.user?.display_name || item.user?.email || $t('labels.unknownUser') }}
                </p>
                <p class="text-xs text-nc-content-gray-subtle mt-0.5">
                  {{ item.comment || $t(`labels.approvalAction_${item.action}`) }}
                </p>
              </div>
              <span class="text-xs text-nc-content-gray-subtle flex-shrink-0">
                {{ formatDate(item.createdAt) }}
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<style lang="scss" scoped>
.nc-approval-timeline {
  @apply p-3;
}
</style>

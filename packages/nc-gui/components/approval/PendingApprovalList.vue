<script lang="ts" setup>
import dayjs from 'dayjs'
import { ApprovalStatus, type ApprovalRecord } from '~/lib/types'

interface Props {
  loading?: boolean
  limit?: number
}

const props = withDefaults(defineProps<Props>(), {
  loading: false,
  limit: 10,
})

const emit = defineEmits<{
  (e: 'view', record: ApprovalRecord): void
  (e: 'approve', record: ApprovalRecord): void
  (e: 'reject', record: ApprovalRecord): void
  (e: 'refresh'): void
}>()

const { $api } = useNuxtApp()
const { t } = useI18n()
const { isUIAllowed } = useRoles()

const pendingList = ref<ApprovalRecord[]>([])
const isLoading = ref(false)
const totalCount = ref(0)
const page = ref(1)

const fetchPendingApprovals = async () => {
  if (!isUIAllowed('approvalAction')) return

  isLoading.value = true
  try {
    const response = await $api.approval.list({
      status: ApprovalStatus.PENDING,
      page: page.value,
      limit: props.limit,
    })
    pendingList.value = response.data || []
    totalCount.value = response.meta?.total || 0
  } catch (e: any) {
    console.error('Failed to fetch pending approvals:', e)
  } finally {
    isLoading.value = false
  }
}

const handleView = (record: ApprovalRecord) => {
  emit('view', record)
}

const handleApprove = async (record: ApprovalRecord, event: Event) => {
  event.stopPropagation()
  emit('approve', record)
}

const handleReject = async (record: ApprovalRecord, event: Event) => {
  event.stopPropagation()
  emit('reject', record)
}

const refresh = () => {
  fetchPendingApprovals()
  emit('refresh')
}

onMounted(() => {
  fetchPendingApprovals()
})

defineExpose({
  refresh,
})
</script>

<template>
  <div class="nc-pending-approval-list bg-nc-bg-default rounded-lg border border-nc-border-gray-medium">
    <!-- Header -->
    <div class="flex items-center justify-between px-4 py-3 border-b border-nc-border-gray-medium">
      <div class="flex items-center gap-2">
        <GeneralIcon icon="approval" class="w-5 h-5 text-nc-content-brand" />
        <span class="font-semibold text-nc-content-gray">{{ $t('labels.pendingApprovals') }}</span>
        <NcBadge v-if="totalCount > 0" color="brand" size="xs" class="ml-1">
          {{ totalCount }}
        </NcBadge>
      </div>
      <NcButton type="text" size="xs" @click="refresh">
        <GeneralIcon icon="refresh" class="w-4 h-4" />
      </NcButton>
    </div>

    <!-- Content -->
    <div class="max-h-96 overflow-y-auto">
      <div v-if="isLoading || loading" class="flex justify-center py-8">
        <GeneralLoader size="medium" />
      </div>

      <div v-else-if="pendingList.length === 0" class="text-center py-8">
        <GeneralIcon icon="approval" class="w-12 h-12 mx-auto mb-3 opacity-30" />
        <p class="text-sm text-nc-content-gray-subtle">{{ $t('msg.noPendingApprovals') }}</p>
      </div>

      <div v-else class="divide-y divide-nc-border-gray-medium">
        <div
          v-for="item in pendingList"
          :key="item.id"
          class="p-3 hover:bg-nc-bg-gray-medium cursor-pointer transition-colors"
          @click="handleView(item)"
        >
          <div class="flex items-start justify-between gap-2">
            <div class="flex-1 min-w-0">
              <p class="text-sm font-medium text-nc-content-gray truncate">
                {{ item.recordTitle || $t('labels.untitledRecord') }}
              </p>
              <p class="text-xs text-nc-content-gray-subtle mt-0.5">
                {{ item.tableTitle || item.tableId }} •
                {{ $t('labels.submittedBy') }} {{ item.submittedBy?.display_name || item.submittedBy?.email }}
              </p>
              <p class="text-xs text-nc-content-gray-subtle mt-0.5">
                {{ dayjs(item.createdAt).fromNow() }}
              </p>
            </div>

            <div class="flex gap-1 flex-shrink-0">
              <NcTooltip :title="$t('general.reject')">
                <NcButton
                  type="danger"
                  size="xs"
                  class="!p-1"
                  @click="handleReject(item, $event)"
                >
                  <GeneralIcon icon="ncX" class="w-3.5 h-3.5" />
                </NcButton>
              </NcTooltip>
              <NcTooltip :title="$t('general.approve')">
                <NcButton
                  type="primary"
                  size="xs"
                  class="!p-1"
                  @click="handleApprove(item, $event)"
                >
                  <GeneralIcon icon="ncCheck" class="w-3.5 h-3.5" />
                </NcButton>
              </NcTooltip>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<style lang="scss" scoped>
.nc-pending-approval-list {
  @apply overflow-hidden;
}
</style>

<script lang="ts" setup>
import { ApprovalStatus } from '~/lib/types'

interface Props {
  status: ApprovalStatus
  size?: 'xs' | 'sm' | 'md' | 'lg'
  rounded?: 'sm' | 'md' | 'lg'
}

const props = withDefaults(defineProps<Props>(), {
  size: 'sm',
  rounded: 'md',
})

const { t } = useI18n()

const statusConfig = computed(() => {
  switch (props.status) {
    case ApprovalStatus.PENDING:
      return {
        color: 'yellow',
        label: t('labels.approvalPending'),
        icon: 'clock',
      }
    case ApprovalStatus.APPROVED:
      return {
        color: 'green',
        label: t('labels.approvalApproved'),
        icon: 'ncCheck',
      }
    case ApprovalStatus.REJECTED:
      return {
        color: 'red',
        label: t('labels.approvalRejected'),
        icon: 'ncX',
      }
    case ApprovalStatus.CANCELLED:
      return {
        color: 'gray',
        label: t('labels.approvalCancelled'),
        icon: 'ncX',
      }
    default:
      return {
        color: 'gray',
        label: t('labels.approvalUnknown'),
        icon: 'ncInfo',
      }
  }
})
</script>

<template>
  <NcBadge
    :color="statusConfig.color"
    :size="size"
    :rounded="rounded"
    class="flex items-center gap-1.5 px-2"
  >
    <GeneralIcon :icon="statusConfig.icon" class="w-3.5 h-3.5" />
    <span class="text-xs font-medium">{{ statusConfig.label }}</span>
  </NcBadge>
</template>

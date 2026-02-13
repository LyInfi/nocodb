<script lang="ts" setup>
import dayjs from 'dayjs'
import { ApprovalStatus, type ApprovalRecord, type ApprovalActionRequest } from '~/lib/types'

interface Props {
  recordId: string
  tableId: string
  viewId?: string
  approvalRecord?: ApprovalRecord | null
  disabled?: boolean
}

const props = defineProps<Props>()

const emit = defineEmits<{
  (e: 'approve', data: ApprovalActionRequest): void
  (e: 'reject', data: ApprovalActionRequest): void
  (e: 'refresh'): void
}>()

const { t } = useI18n()
const { $api } = useNuxtApp()
const { isUIAllowed } = useRoles()

const comment = ref('')
const isSubmitting = ref(false)
const activeAction = ref<'approve' | 'reject' | null>(null)
const showConfirmDialog = ref(false)

const canApprove = computed(() => {
  if (props.disabled || !props.approvalRecord) return false
  return props.approvalRecord.status === ApprovalStatus.PENDING &&
    isUIAllowed('approvalAction')
})

const isCommentRequired = computed(() => {
  // Can be configured based on requirements
  return activeAction.value === 'reject'
})

const isSubmitDisabled = computed(() => {
  if (isCommentRequired.value && !comment.value.trim()) return true
  return false
})

const handleActionClick = (action: 'approve' | 'reject') => {
  activeAction.value = action
  showConfirmDialog.value = true
}

const handleCancel = () => {
  showConfirmDialog.value = false
  activeAction.value = null
  comment.value = ''
}

const handleConfirm = async () => {
  if (!activeAction.value || !props.approvalRecord) return

  isSubmitting.value = true

  try {
    const actionData: ApprovalActionRequest = {
      approvalId: props.approvalRecord.id,
      action: activeAction.value,
      comment: comment.value.trim(),
    }

    if (activeAction.value === 'approve') {
      await $api.approval.approve(props.recordId, actionData)
      emit('approve', actionData)
    } else {
      await $api.approval.reject(props.recordId, actionData)
      emit('reject', actionData)
    }

    message.success(
      activeAction.value === 'approve'
        ? t('msg.success.approved')
        : t('msg.success.rejected')
    )

    emit('refresh')
    handleCancel()
  } catch (e: any) {
    const errorMsg = await extractSdkResponseErrorMsg(e)
    message.error(errorMsg)
  } finally {
    isSubmitting.value = false
  }
}

const getActionTitle = computed(() => {
  return activeAction.value === 'approve'
    ? t('labels.confirmApprove')
    : t('labels.confirmReject')
})

const getActionDescription = computed(() => {
  return activeAction.value === 'approve'
    ? t('labels.confirmApproveDescription')
    : t('labels.confirmRejectDescription')
})
</script>

<template>
  <div class="nc-approval-panel bg-nc-bg-default rounded-lg border border-nc-border-gray-medium">
    <!-- Header -->
    <div class="flex items-center justify-between px-4 py-3 border-b border-nc-border-gray-medium">
      <div class="flex items-center gap-2">
        <GeneralIcon icon="approval" class="w-5 h-5 text-nc-content-brand" />
        <span class="font-semibold text-nc-content-gray">{{ $t('labels.approval') }}</span>
      </div>
      <ApprovalStatusBadge
        v-if="approvalRecord"
        :status="approvalRecord.status"
        size="sm"
      />
      <NcBadge v-else color="gray" size="sm">
        {{ $t('labels.notSubmitted') }}
      </NcBadge>
    </div>

    <!-- Content -->
    <div class="p-4">
      <div v-if="!approvalRecord" class="text-center py-4">
        <GeneralIcon icon="approval" class="w-10 h-10 mx-auto mb-2 opacity-30" />
        <p class="text-sm text-nc-content-gray-subtle">{{ $t('msg.noApprovalRecord') }}</p>
      </div>

      <div v-else-if="approvalRecord.status !== ApprovalStatus.PENDING" class="py-2">
        <div class="flex items-start gap-3">
          <GeneralUserIcon
            v-if="approvalRecord.approvedBy || approvalRecord.rejectedBy"
            :email="(approvalRecord.approvedBy || approvalRecord.rejectedBy)?.email"
            :name="(approvalRecord.approvedBy || approvalRecord.rejectedBy)?.display_name"
            class="flex-shrink-0"
            size="base"
          />
          <div class="flex-1 min-w-0">
            <p class="text-sm text-nc-content-gray">
              <template v-if="approvalRecord.status === ApprovalStatus.APPROVED">
                {{ $t('labels.approvedBy') }}
                <span class="font-medium">{{ approvalRecord.approvedBy?.display_name || approvalRecord.approvedBy?.email }}</span>
              </template>
              <template v-else-if="approvalRecord.status === ApprovalStatus.REJECTED">
                {{ $t('labels.rejectedBy') }}
                <span class="font-medium">{{ approvalRecord.rejectedBy?.display_name || approvalRecord.rejectedBy?.email }}</span>
              </template>
            </p>
            <p v-if="approvalRecord.comment" class="text-sm text-nc-content-gray-subtle mt-1 bg-nc-bg-gray-medium rounded p-2">
              {{ approvalRecord.comment }}
            </p>
            <p class="text-xs text-nc-content-gray-subtle mt-1">
              {{ dayjs(approvalRecord.updatedAt).format('YYYY-MM-DD HH:mm') }}
            </p>
          </div>
        </div>
      </div>

      <!-- Action Buttons -->
      <div v-else-if="canApprove" class="space-y-3">
        <div class="text-sm text-nc-content-gray-subtle mb-2">
          {{ $t('labels.approvalActionHint') }}
        </div>

        <div class="flex gap-2">
          <NcButton
            type="danger"
            class="flex-1"
            :disabled="isSubmitting"
            @click="handleActionClick('reject')"
          >
            <GeneralIcon icon="ncX" class="w-4 h-4 mr-1.5" />
            {{ $t('general.reject') }}
          </NcButton>
          <NcButton
            type="primary"
            class="flex-1"
            :disabled="isSubmitting"
            @click="handleActionClick('approve')"
          >
            <GeneralIcon icon="ncCheck" class="w-4 h-4 mr-1.5" />
            {{ $t('general.approve') }}
          </NcButton>
        </div>
      </div>

      <div v-else class="text-center py-2">
        <p class="text-sm text-nc-content-gray-subtle">{{ $t('msg.waitingForApproval') }}</p>
      </div>
    </div>

    <!-- Confirmation Dialog -->
    <NcModal
      v-model:visible="showConfirmDialog"
      :closable="!isSubmitting"
      :mask-closable="!isSubmitting"
      :footer="null"
      width="400px"
    >
      <div class="p-4">
        <h3 class="text-lg font-semibold text-nc-content-gray mb-2">{{ getActionTitle }}</h3>
        <p class="text-sm text-nc-content-gray-subtle mb-4">{{ getActionDescription }}</p>

        <div class="mb-4">
          <label class="block text-sm font-medium text-nc-content-gray mb-1.5">
            {{ $t('labels.comment') }}
            <span v-if="isCommentRequired" class="text-red-500">*</span>
          </label>
          <a-textarea
            v-model:value="comment"
            :placeholder="$t('labels.approvalCommentPlaceholder')"
            :rows="3"
            class="nc-approval-comment-input"
          />
        </div>

        <div class="flex justify-end gap-2">
          <NcButton :disabled="isSubmitting" @click="handleCancel">
            {{ $t('general.cancel') }}
          </NcButton>
          <NcButton
            :type="activeAction === 'approve' ? 'primary' : 'danger'"
            :loading="isSubmitting"
            :disabled="isSubmitDisabled"
            @click="handleConfirm"
          >
            {{ activeAction === 'approve' ? $t('general.approve') : $t('general.reject') }}
          </NcButton>
        </div>
      </div>
    </NcModal>
  </div>
</template>

<style lang="scss" scoped>
.nc-approval-panel {
  @apply overflow-hidden;
}

.nc-approval-comment-input {
  &:focus {
    @apply ring-2 ring-nc-border-brand;
  }
}
</style>

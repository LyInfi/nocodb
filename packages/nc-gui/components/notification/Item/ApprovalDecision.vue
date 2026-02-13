<script setup lang="ts">
import type { NotificationType } from 'nocodb-sdk'

const props = defineProps<{
  item: NotificationType
}>()

const item = toRef(props, 'item')

const { navigateToProject } = useGlobal()

const isApproved = computed(() => item.value.body?.type === 'approval_approved')

const handleClick = () => {
  const body = item.value.body
  if (body?.base?.id && body?.table?.id) {
    navigateToProject({
      baseId: body.base.id,
      tableId: body.table.id,
      rowId: body.rowId,
    })
  }
}
</script>

<template>
  <NotificationItemWrapper :item="item" @click="handleClick">
    <div class="flex flex-col gap-1">
      <div>
        <span
          class="font-semibold"
          :class="isApproved ? 'text-green-600' : 'text-red-600'"
        >
          {{ isApproved ? '✅ Approved' : '❌ Rejected' }}
        </span>
        <span class="ml-1">by {{ item.body?.approver?.displayName ?? item.body?.approver?.email }}</span>
      </div>
      <div class="text-sm text-gray-700">
        {{ item.body?.title }}
      </div>
      <div v-if="item.body?.comment" class="text-xs text-gray-500 italic">
        "{{ item.body.comment }}"
      </div>
      <div v-if="item.body?.base?.title" class="text-xs text-gray-500">
        Base: {{ item.body.base.title }}
      </div>
    </div>
  </NotificationItemWrapper>
</template>

<script setup lang="ts">
import type { NotificationType } from 'nocodb-sdk'

const props = defineProps<{
  item: NotificationType
}>()

const item = toRef(props, 'item')

const { navigateToProject } = useGlobal()

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
        <span class="font-semibold">{{ item.body?.requester?.displayName ?? item.body?.requester?.email }}</span>
        requested your approval for
        <span class="font-semibold">{{ item.body?.title }}</span>
      </div>
      <div v-if="item.body?.base?.title" class="text-xs text-gray-500">
        Base: {{ item.body.base.title }}
        <span v-if="item.body?.table?.title"> | Table: {{ item.body.table.title }}</span>
      </div>
      <div v-if="item.body?.dueAt" class="text-xs text-orange-500">
        Due: {{ new Date(item.body.dueAt).toLocaleDateString() }}
      </div>
    </div>
  </NotificationItemWrapper>
</template>

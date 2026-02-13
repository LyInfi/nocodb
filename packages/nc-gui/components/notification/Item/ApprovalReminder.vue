<script setup lang="ts">
import type { NotificationType } from 'nocodb-sdk'

const props = defineProps<{
  item: NotificationType
}>()

const item = toRef(props, 'item')

const { navigateToProject } = useGlobal()

const handleClick = () => {
  const body = item.value.body
  if (body?.base?.id && body?.instanceId) {
    navigateToProject({
      baseId: body.base.id,
    })
  }
}
</script>

<template>
  <NotificationItemWrapper :item="item" @click="handleClick">
    <div class="flex flex-col gap-1">
      <div class="flex items-center gap-2">
        <span class="text-yellow-600">⏰</span>
        <span class="font-semibold">Approval Reminder</span>
        <span v-if="item.body?.reminderCount" class="text-xs bg-yellow-100 text-yellow-800 px-2 py-0.5 rounded">
          #{{ item.body.reminderCount }}
        </span>
      </div>
      <div class="text-sm">
        {{ item.body?.title }}
      </div>
      <div v-if="item.body?.dueAt" class="text-xs text-red-500 font-semibold">
        ⚠️ Due: {{ new Date(item.body.dueAt).toLocaleDateString() }}
      </div>
      <div v-if="item.body?.base?.title" class="text-xs text-gray-500">
        Base: {{ item.body.base.title }}
      </div>
    </div>
  </NotificationItemWrapper>
</template>

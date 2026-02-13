<script setup lang="ts">
import type { NotificationType } from 'nocodb-sdk'

const props = defineProps<{
  item: NotificationType
}>()

const item = toRef(props, 'item')

const { navigateToProject } = useGlobal()

const handleClick = () => {
  const body = item.value.body
  if (body?.base?.id) {
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
        <span class="text-red-600">🚨</span>
        <span class="font-semibold text-red-600">Approval Escalated</span>
        <span v-if="item.body?.escalationLevel" class="text-xs bg-red-100 text-red-800 px-2 py-0.5 rounded">
          Level {{ item.body.escalationLevel }}
        </span>
      </div>
      <div class="text-sm">
        {{ item.body?.title }}
      </div>
      <div v-if="item.body?.previousApprover" class="text-xs text-gray-500">
        Escalated from: {{ item.body.previousApprover.displayName ?? item.body.previousApprover.email }}
      </div>
      <div v-if="item.body?.base?.title" class="text-xs text-gray-500">
        Base: {{ item.body.base.title }}
      </div>
    </div>
  </NotificationItemWrapper>
</template>

<script setup lang="ts">
const props = defineProps<{
  showFieldsTab?: boolean
}>()

const { isSqlView, meta } = useSmartsheetStoreOrThrow()

const expandedFormStore = useExpandedFormStoreOrThrow()

const { isExpandedFormCommentMode } = storeToRefs(useConfigStore())

const tab = ref<'fields' | 'comments' | 'audits' | 'approval'>(
  props.showFieldsTab && (!isExpandedFormCommentMode.value || isSqlView.value) ? 'fields' : 'comments',
)

watch(tab, (newValue) => {
  if (newValue === 'audits') {
    expandedFormStore.loadAudits()
  } else if (newValue === 'approval') {
    expandedFormStore.loadApprovalRecord()
  }
})

// Check if approval feature is enabled for the current view
const isApprovalEnabled = computed(() => {
  // TODO: Check if approval workflow is enabled for this table/view
  // This can be extended based on backend configuration
  return !!meta.value?.enable_approvals
})
</script>

<template>
  <div class="flex flex-col bg-nc-bg-default !h-full w-full rounded-br-2xl overflow-hidden">
    <NcTabs v-model:active-key="tab" class="h-full">
      <a-tab-pane v-if="props.showFieldsTab" key="fields" class="w-full h-full">
        <template #tab>
          <div v-e="['c:row-expand:fields']" class="flex items-center gap-2">
            <GeneralIcon icon="fields" class="w-4 h-4" />
            <span class="<lg:hidden"> {{ $t('objects.fields') }} </span>
          </div>
        </template>
        <SmartsheetExpandedFormPresentorsFieldsMiniColumnsWrapper />
      </a-tab-pane>

      <a-tab-pane v-if="!isSqlView" key="comments" class="w-full h-full">
        <template #tab>
          <div v-e="['c:row-expand:comment']" class="flex items-center gap-2">
            <GeneralIcon icon="messageCircle" class="w-4 h-4" />
            <span class="<lg:hidden"> {{ $t('general.comments') }} </span>
          </div>
        </template>
        <SmartsheetExpandedFormSidebarComments />
      </a-tab-pane>

      <a-tab-pane v-if="!isSqlView" key="audits" class="w-full">
        <template #tab>
          <div v-e="['c:row-expand:audit']" class="flex items-center gap-2">
            <GeneralIcon icon="audit" class="w-4 h-4" />
            <span class="<lg:hidden"> {{ $t('labels.revisionHistory') }} </span>
          </div>
        </template>
        <SmartsheetExpandedFormSidebarAudits />
      </a-tab-pane>

      <a-tab-pane v-if="!isSqlView && isApprovalEnabled" key="approval" class="w-full h-full">
        <template #tab>
          <div v-e="['c:row-expand:approval']" class="flex items-center gap-2">
            <GeneralIcon icon="approval" class="w-4 h-4" />
            <span class="<lg:hidden"> {{ $t('labels.approval') }} </span>
          </div>
        </template>
        <div class="p-3 h-full overflow-y-auto">
          <ApprovalPanel
            :record-id="expandedFormStore.row?.id || ''"
            :table-id="meta?.id || ''"
            :approval-record="expandedFormStore.approvalRecord || null"
            @refresh="expandedFormStore.loadApprovalRecord?.()"
          />
          <ApprovalTimeline
            v-if="expandedFormStore.approvalHistory?.length"
            :history="expandedFormStore.approvalHistory"
            class="mt-3"
          />
        </div>
      </a-tab-pane>
    </NcTabs>
  </div>
</template>

<style lang="scss" scoped>
.tab {
  @apply max-w-1/2;
}

.tab .tab-title {
  @apply min-w-0 flex justify-center gap-2 font-semibold items-center;
  word-break: 'keep-all';
  white-space: 'nowrap';
  display: 'inline';
}

.text-decoration-line-through {
  text-decoration: line-through;
}

:deep(.ant-tabs) {
  @apply !overflow-visible;
  .ant-tabs-nav {
    @apply px-3 bg-nc-bg-default;
    .ant-tabs-nav-list {
      @apply w-[99%] mx-auto gap-6;

      .ant-tabs-tab {
        @apply flex-1 flex items-center justify-center pt-3 pb-2.5;

        & + .ant-tabs-tab {
          @apply !ml-0;
        }
      }
    }
  }
  .ant-tabs-content-holder {
    .ant-tabs-content {
      @apply h-full;
    }
  }
}
</style>

<style lang="scss">
.ant-tabs-dropdown {
  @apply overflow-hidden;
  .ant-tabs-dropdown-content {
    @apply !rounded-lg overflow-hidden border-1 border-nc-border-gray-medium;
  }
}
</style>

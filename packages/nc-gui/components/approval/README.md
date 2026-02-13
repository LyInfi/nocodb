# Approval Components

This directory contains components for implementing an approval workflow feature in NocoDB.

## Components

### ApprovalPanel.vue
Main approval panel component that provides approve/reject functionality.

**Props:**
- `recordId: string` - The record ID being approved
- `tableId: string` - The table ID
- `viewId?: string` - Optional view ID
- `approvalRecord?: ApprovalRecord | null` - The current approval record
- `disabled?: boolean` - Whether the panel is disabled

**Events:**
- `@approve` - Emitted when record is approved
- `@reject` - Emitted when record is rejected
- `@refresh` - Emitted when approval status is refreshed

**Usage:**
```vue
<ApprovalPanel
  :record-id="recordId"
  :table-id="tableId"
  :approval-record="approvalRecord"
  @refresh="loadApprovalData"
/>
```

### ApprovalTimeline.vue
Displays the approval history timeline.

**Props:**
- `history: ApprovalHistoryItem[]` - Array of approval history items
- `loading?: boolean` - Loading state

**Usage:**
```vue
<ApprovalTimeline :history="approvalHistory" />
```

### PendingApprovalList.vue
List of pending approvals for the current user.

**Props:**
- `loading?: boolean` - Loading state
- `limit?: number` - Number of items to show (default: 10)

**Events:**
- `@view(record)` - Emitted when a record is clicked
- `@approve(record)` - Emitted when approve button is clicked
- `@reject(record)` - Emitted when reject button is clicked
- `@refresh` - Emitted when list is refreshed

**Usage:**
```vue
<PendingApprovalList
  :limit="20"
  @view="handleView"
  @approve="handleApprove"
  @reject="handleReject"
/>
```

### ApprovalStatusBadge.vue
Badge component for displaying approval status.

**Props:**
- `status: ApprovalStatus` - The approval status (pending, approved, rejected, cancelled)
- `size?: 'xs' | 'sm' | 'md' | 'lg'` - Badge size
- `rounded?: 'sm' | 'md' | 'lg'` - Border radius

**Usage:**
```vue
<ApprovalStatusBadge :status="record.approvalStatus" />
```

## Types

All approval-related types are defined in `~/lib/types.ts`:

- `ApprovalStatus` - Enum for approval statuses
- `ApprovalRecord` - Interface for approval records
- `ApprovalHistoryItem` - Interface for history items
- `ApprovalActionRequest` - Interface for approval actions

## Integration

The approval panel is integrated into the expanded form sidebar. To enable it:

1. Set `enable_approvals: true` on the table meta
2. The approval tab will automatically appear in the expanded form sidebar

## Permissions

The `approvalAction` permission is required to approve/reject records. By default, this is granted to:
- Editor
- Creator
- Owner

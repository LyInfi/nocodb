import Welcome from '~/services/mail/templates/welcome';
import BaseInvite from '~/services/mail/templates/base-invite';
import PasswordReset from '~/services/mail/templates/password-reset';
import VerifyEmail from '~/services/mail/templates/verify-your-email';
import OrganizationInvite from '~/services/mail/templates/org-invite';
import OrganizationRoleUpdate from '~/services/mail/templates/org-role-update';
import BaseRoleUpdate from '~/services/mail/templates/base-role-update';
import FormSubmission from '~/services/mail/templates/form-submission';
import ApprovalRequested from '~/services/mail/templates/approval-requested';
import ApprovalReminder from '~/services/mail/templates/approval-reminder';
import ApprovalDecision from '~/services/mail/templates/approval-decision';
import ApprovalEscalated from '~/services/mail/templates/approval-escalated';
import ApprovalCancelled from '~/services/mail/templates/approval-cancelled';

export {
  Welcome,
  BaseInvite,
  BaseRoleUpdate,
  PasswordReset,
  VerifyEmail,
  OrganizationInvite,
  OrganizationRoleUpdate,
  FormSubmission,
  ApprovalRequested,
  ApprovalReminder,
  ApprovalDecision,
  ApprovalEscalated,
  ApprovalCancelled,
};

import { ClaimStatus } from '@prisma/client';

// Display names for claim statuses (same as the web app). ENHANCEMENT is the
// reconsideration step and DISCHARGED is "Discharge Approved".
export const CLAIM_STATUS_LABELS: Record<ClaimStatus, string> = {
  DRAFT: 'Draft',
  PENDING: 'Pre-Auth Pending',
  SENT_TO_TPA: 'Pre-Auth Sent to TPA',
  APPROVED: 'Pre-Auth Approved',
  QUERIED: 'Query',
  QUERY_REPLY_SENT: 'Query Reply Sent',
  ENHANCEMENT: 'Reconsideration Sent',
  DENIED: 'Pre-Auth Denied',
  DISCHARGE_INITIATED: 'Discharge Initiated',
  DISCHARGE_SENT: 'Discharge Sent',
  DISCHARGED: 'Discharge Approved',
  SETTLEMENT_INITIATED: 'Settlement Initiated',
  SETTLED: 'Settled',
};

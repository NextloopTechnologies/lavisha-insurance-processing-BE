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

// Dashboard grouping, following the requirement's end-to-end flow.
export const CLAIM_STAGES: { key: string; label: string; statuses: ClaimStatus[] }[] = [
  { key: 'PRE_AUTH', label: 'Pre-Auth', statuses: [ClaimStatus.PENDING, ClaimStatus.SENT_TO_TPA, ClaimStatus.APPROVED] },
  { key: 'QUERY', label: 'Query', statuses: [ClaimStatus.QUERIED, ClaimStatus.QUERY_REPLY_SENT] },
  { key: 'RECONSIDERATION', label: 'Reconsideration', statuses: [ClaimStatus.ENHANCEMENT] },
  { key: 'DENIED', label: 'Denied', statuses: [ClaimStatus.DENIED] },
  { key: 'DISCHARGE', label: 'Discharge', statuses: [ClaimStatus.DISCHARGE_INITIATED, ClaimStatus.DISCHARGE_SENT, ClaimStatus.DISCHARGED] },
  { key: 'SETTLEMENT', label: 'Settlement', statuses: [ClaimStatus.SETTLEMENT_INITIATED] },
  { key: 'SETTLED', label: 'Settled', statuses: [ClaimStatus.SETTLED] },
  { key: 'DRAFT', label: 'Draft', statuses: [ClaimStatus.DRAFT] },
];

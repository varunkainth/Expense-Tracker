import type { CreatedPairing, PairingClient, PairingStatus } from '@expense-tracker/shared';
/** Completes the protocol automatically only after the phone explicitly approves. */
export async function finishPhoneApproval(api: Pick<PairingClient, 'confirm'>, session: CreatedPairing, status: PairingStatus): Promise<PairingStatus> {
  if (status.state !== 'approved' || !status.verificationCode) return status;
  return api.confirm(session.sessionId, session.browserToken, status.verificationCode);
}

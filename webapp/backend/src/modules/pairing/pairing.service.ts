import { parseTransfer, type TransferImportInfo, type TransferEnvelope } from '@expense-tracker/shared';
import { randomInt, randomUUID } from 'node:crypto';
import { PAIRING_VERSION, type CreatedPairing, type ClaimedPairing, type PairingState, type PairingStatus } from '@expense-tracker/shared';
import { ApiError } from '../../lib/api-error';
import { createToken, hashToken, matchesToken } from '../../lib/tokens';

type Role = 'browser' | 'phone';
interface Session {
  id: string; state: PairingState; browserName: string; phoneName: string | null; phoneDeviceId: string | null;
  browserHash: Buffer; phoneHash?: Buffer; claimHash?: Buffer; verificationCode: string | null;
  transfer?: TransferEnvelope; transferExpiresAt?: number; lastSequence?: number; acknowledgedSequence?: number; importedExpenseCount?: number; lastReadState?: string; importInfo?: TransferImportInfo;
  expiresAt: number; browserSeen: number; phoneSeen: number | null;
}
export interface PairingEvent {
  event: string; sessionId: string; sequence?: number; ciphertextBytes?: number;
  expenseCount?: number; completed?: boolean; recordCount?: number; companyCount?: number; attachmentCount?: number; reason?: string; latestSequence?: number; acknowledgedSequence?: number;
}
export interface PairingOptions {
  pairingTtlMs: number; linkedTtlMs: number; presenceTtlMs: number; maxSessions: number; now?: () => number; onEvent?: (event: PairingEvent) => void;
}
/** Memory only. A restart intentionally drops every session and revokes its tokens. */
export class PairingService {
  private readonly sessions = new Map<string, Session>();
  private readonly now: () => number;
  constructor(private readonly options: PairingOptions) { this.now = options.now ?? Date.now; }
  private emit(event: string, sessionId: string, details: Omit<PairingEvent, 'event' | 'sessionId'> = {}) { this.options.onEvent?.({ event, sessionId, ...details }); }
  private expireTransfer(session: Session) {
    if (session.transfer && (session.transferExpiresAt ?? 0) <= this.now()) {
      this.emit('transfer_expired', session.id, { sequence: session.transfer.sequence });
      session.transfer = undefined;
    }
  }
  prune() {
    for (const [id, session] of this.sessions) {
      if (session.expiresAt <= this.now()) { this.sessions.delete(id); this.emit('pairing_expired', id); }
      else this.expireTransfer(session);
    }
  }
  clear() { this.sessions.clear(); }
  create(browserName: string): CreatedPairing {
    this.prune();
    if (this.sessions.size >= this.options.maxSessions) throw new ApiError(503, 'CAPACITY_REACHED', 'Pairing is busy. Try again shortly.');
    const id = randomUUID(), browserToken = createToken(), claimToken = createToken();
    const expiresAt = this.now() + this.options.pairingTtlMs;
    this.sessions.set(id, { id, state: 'waiting', browserName, phoneName: null, phoneDeviceId: null,
      browserHash: hashToken(browserToken), claimHash: hashToken(claimToken), verificationCode: null,
      expiresAt, browserSeen: this.now(), phoneSeen: null });
    this.emit('pairing_created', id);
    return { sessionId: id, browserToken, expiresAt,
      qr: { type: 'expense-tracker.pairing', version: PAIRING_VERSION, sessionId: id, claimToken, expiresAt } };
  }
  private find(id: string): Session {
    const session = this.sessions.get(id);
    if (!session || session.expiresAt <= this.now()) {
      this.sessions.delete(id);
      if (session) this.emit('pairing_expired', id);
      throw new ApiError(404, 'SESSION_UNAVAILABLE', 'Session is expired or unavailable.');
    }
    return session;
  }
  private authorize(id: string, token: string, required?: Role): { session: Session; role: Role } {
    const session = this.find(id);
    // Evaluate both comparisons. The session ID and a device ID are never credentials.
    const browser = matchesToken(token, session.browserHash);
    const phone = matchesToken(token, session.phoneHash);
    const role = browser ? 'browser' : phone ? 'phone' : null;
    if (!role || (required && required !== role)) throw new ApiError(401, 'UNAUTHORIZED', 'Valid session credentials are required.');
    return { session, role };
  }
  claim(id: string, input: { claimToken: string; phoneName: string; phoneDeviceId: string }): ClaimedPairing {
    const session = this.find(id);
    if (!matchesToken(input.claimToken, session.claimHash)) throw new ApiError(401, 'INVALID_CLAIM', 'QR challenge is invalid or already used.');
    const phoneToken = createToken();
    session.claimHash = undefined;
    session.phoneHash = hashToken(phoneToken);
    session.phoneName = input.phoneName;
    session.phoneDeviceId = input.phoneDeviceId;
    session.phoneSeen = this.now();
    session.verificationCode = String(randomInt(0, 1_000_000)).padStart(6, '0');
    session.state = 'claimed';
    this.emit('phone_claimed_qr', id);
    return { sessionId: id, phoneToken, browserName: session.browserName,
      verificationCode: session.verificationCode, expiresAt: session.expiresAt };
  }
  approve(id: string, token: string, code: string): PairingStatus {
    const { session } = this.authorize(id, token, 'phone');
    if (session.state !== 'claimed' && session.state !== 'approved') throw new ApiError(409, 'INVALID_STATE', 'This session cannot be approved.');
    this.verifyCode(session, code);
    session.state = 'approved'; session.phoneSeen = this.now();
    this.emit('phone_approved', id);
    return this.serialize(session);
  }
  confirm(id: string, token: string, code: string): PairingStatus {
    const { session } = this.authorize(id, token, 'browser');
    if (session.state !== 'approved') throw new ApiError(409, 'PHONE_APPROVAL_REQUIRED', 'Approve the connection on your phone first.');
    this.verifyCode(session, code);
    session.state = 'linked'; session.verificationCode = null;
    session.expiresAt = this.now() + this.options.linkedTtlMs;
    session.browserSeen = this.now();
    this.emit('browser_linked', id);
    return this.serialize(session);
  }
  private verifyCode(session: Session, code: string) {
    if (session.verificationCode !== code) throw new ApiError(409, 'CODE_MISMATCH', 'Verification codes do not match.');
  }
  status(id: string, token: string): PairingStatus { return this.serialize(this.authorize(id, token).session); }
  heartbeat(id: string, token: string): PairingStatus {
    const { session, role } = this.authorize(id, token);
    if (session.state !== 'linked') throw new ApiError(409, 'NOT_LINKED', 'Finish pairing before sending heartbeats.');
    if (role === 'phone') session.phoneSeen = this.now(); else session.browserSeen = this.now();
    return this.serialize(session);
  }
  private linked(id: string, token: string, role: Role) {
    const { session } = this.authorize(id, token, role);
    if (session.state !== 'linked') throw new ApiError(409, 'NOT_LINKED', 'Finish pairing before transferring expenses.');
    return session;
  }
  publishTransfer(id: string, token: string, input: TransferEnvelope) {
    const session = this.linked(id, token, 'phone');
    const envelope = parseTransfer(input);
    if (envelope.sequence < (session.lastSequence ?? 0)) throw new ApiError(409, 'STALE_TRANSFER', 'Transfer is out of date.');
    if (envelope.sequence === session.lastSequence && session.transfer && session.transfer.ciphertext !== envelope.ciphertext) throw new ApiError(409, 'SEQUENCE_REUSED', 'Transfer sequence already used.');
    this.prune();
    const size = [...this.sessions.values()].reduce((sum, value) => sum + (value === session ? 0 : value.transfer?.ciphertext.length ?? 0), 0);
    if (size + envelope.ciphertext.length > 8_000_000) throw new ApiError(503, 'CAPACITY_REACHED', 'Transfer relay is busy. Try again shortly.');
    session.lastSequence = envelope.sequence; session.transfer = envelope; session.transferExpiresAt = this.now() + 120_000;
    this.emit('transfer_uploaded', id, { sequence: envelope.sequence, ciphertextBytes: envelope.ciphertext.length * 3 / 4 - (envelope.ciphertext.endsWith('==') ? 2 : envelope.ciphertext.endsWith('=') ? 1 : 0) });
    return { accepted: true };
  }
  receiveTransfer(id: string, token: string) {
    const session = this.linked(id, token, 'browser');
    this.expireTransfer(session);
    const reason = session.transfer ? 'pending' : !session.lastSequence ? 'not_uploaded' : session.acknowledgedSequence === session.lastSequence ? session.importInfo?.completed === false ? 'chunk_saved_waiting_for_next' : 'already_imported' : 'expired_waiting_for_retry';
    const readState = `${reason}:${session.lastSequence ?? 0}`;
    if (session.lastReadState !== readState) {
      this.emit(session.transfer ? 'transfer_delivered' : 'transfer_queue_empty', id, { reason, latestSequence: session.lastSequence ?? 0, acknowledgedSequence: session.acknowledgedSequence ?? 0 });
      session.lastReadState = readState;
    }
    return { envelope: session.transfer ?? null };
  }
  transferReceipt(id: string, token: string) {
    const session = this.linked(id, token, 'phone');
    return { latestSequence: session.lastSequence ?? 0, acknowledgedSequence: session.acknowledgedSequence ?? 0, importedExpenseCount: session.importedExpenseCount ?? null, ...(session.importInfo ? { importInfo: session.importInfo } : {}) };
  }
  acknowledgeTransfer(id: string, token: string, sequence: number, expenseCount?: number, importInfo?: TransferImportInfo) {
    const session = this.linked(id, token, 'browser');
    if (session.transfer?.sequence === sequence) {
      session.acknowledgedSequence = sequence; session.importedExpenseCount = expenseCount; session.importInfo = importInfo; session.transfer = undefined;
      this.emit(importInfo?.completed === false ? 'browser_chunk_saved' : 'browser_import_acknowledged', id, { sequence, ...(expenseCount === undefined ? {} : { expenseCount }), ...importInfo });
    } else this.emit('transfer_ack_ignored', id, { sequence, latestSequence: session.lastSequence ?? 0 });
    return { acknowledged: true };
  }
  revoke(id: string, token: string) { this.authorize(id, token); this.sessions.delete(id); this.emit('pairing_revoked', id); }
  private serialize(session: Session): PairingStatus {
    const online = (seen: number | null) => session.state === 'linked' && seen !== null && this.now() - seen < this.options.presenceTtlMs;
    return { sessionId: session.id, state: session.state, expiresAt: session.expiresAt, browserName: session.browserName,
      phoneName: session.phoneName, verificationCode: session.verificationCode,
      phoneOnline: online(session.phoneSeen), browserOnline: online(session.browserSeen) };
  }
}

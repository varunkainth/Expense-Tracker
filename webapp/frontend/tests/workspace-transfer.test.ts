import { expect, test } from 'bun:test';
import { indexedDB, IDBKeyRange } from 'fake-indexeddb';
import Dexie from 'dexie';
import { createCipheriv, randomBytes } from 'node:crypto';
import { PairingClient, transferContext, CHUNK_BYTES } from '@expense-tracker/shared';
import { base64Bytes } from '../../../packages/workspace-data/src/chunks';
import { buildApp } from '../../backend/src/app';
import { readEnv } from '../../backend/src/config/env';
import { ExpenseDatabase } from '../src/lib/database/database';
import { fixtureWorkspace } from './fixtures/workspace';
import { finishPhoneApproval } from '../src/features/connection/lib/finish-phone-approval';
import { decryptTransfer } from '../src/features/connection/lib/transfer-crypto';
import { receiveWorkspaceChunk } from '../src/features/connection/data/workspace-import';
test('large encrypted workspace travels through bounded relay chunks and completes only after atomic import', async () => {
  Dexie.dependencies.indexedDB = indexedDB; Dexie.dependencies.IDBKeyRange = IDBKeyRange;
  const database = new ExpenseDatabase(`relay-workspace-${crypto.randomUUID()}`), app = buildApp(readEnv({ LOG_LEVEL:'silent' }));
  try {
    const fetcher = (async (url, options) => { const response = await app.inject({ method: options?.method as 'GET'|'POST'|'DELETE', url:new URL(String(url)).pathname, headers:options?.headers as Record<string,string>, payload:options?.body as string }); return new Response(response.statusCode === 204 ? null : response.body, {status:response.statusCode}); }) as typeof fetch;
    const api = new PairingClient('https://relay.example',fetcher), session = await api.create('Browser'), phone = await api.claim(session.qr,crypto.randomUUID(),'Phone');
    await api.approve(session.sessionId,phone.phoneToken,phone.verificationCode);
    await finishPhoneApproval(api,session,await api.status(session.sessionId,session.browserToken));
    const snapshot = await fixtureWorkspace(650000), payload = Buffer.from(JSON.stringify(snapshot)), snapshotId = crypto.randomUUID(), sha256 = await crypto.subtle.digest('SHA-256',payload);
    const parts = Math.ceil(payload.length / CHUNK_BYTES), key = randomBytes(32);
    for (let part=0;part<parts;part++) {
      const sequence=part+1, iv=randomBytes(12), cipher=createCipheriv('aes-256-gcm',key,iv);
      cipher.setAAD(Buffer.from(transferContext(session.sessionId,sequence)));
      const chunk={type:'workspace-chunk',snapshotId,part,parts,sha256:Buffer.from(sha256).toString('hex'),data:base64Bytes(payload.subarray(part*CHUNK_BYTES,(part+1)*CHUNK_BYTES))};
      const ciphertext=Buffer.concat([iv,cipher.update(JSON.stringify(chunk),'utf8'),cipher.final(),cipher.getAuthTag()]).toString('base64');
      expect(ciphertext.length).toBeLessThan(750000);
      await api.publishTransfer(session.sessionId,phone.phoneToken,{sequence,ciphertext});
      const envelope=await api.receiveTransfer(session.sessionId,session.browserToken);
      const imported=await receiveWorkspaceChunk(database,await decryptTransfer(key.toString('hex'),session.sessionId,envelope!),session.sessionId,sequence);
      await api.acknowledgeTransfer(session.sessionId,session.browserToken,sequence,undefined,imported.expenseCount,{completed:imported.completed,companyCount:imported.companyCount,recordCount:imported.recordCount,attachmentCount:imported.attachmentCount});
      const receipt=await api.transferReceipt(session.sessionId,phone.phoneToken);
      expect(receipt.importInfo?.completed).toBe(part===parts-1);
    }
    expect((await api.transferReceipt(session.sessionId,phone.phoneToken)).importInfo).toMatchObject({completed:true,companyCount:7,recordCount:22,attachmentCount:1});
    expect(await database.phoneRecords.count()).toBe(22);
    expect((await database.phoneFiles.toArray())[0].bytes.length).toBe(650000);
  } finally {await database.delete();await app.close();}
});

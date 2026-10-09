import * as DocumentPicker from 'expo-document-picker';
import { ImageManipulator, SaveFormat } from 'expo-image-manipulator';
import * as ImagePicker from 'expo-image-picker';
import { Directory, File, Paths } from 'expo-file-system';
import { PDFDocument, StandardFonts, rgb } from 'pdf-lib';
import { getDatabase } from '../database/client';
import { CompanyExpenseAttachmentType } from '../types/company';
import { MonthPeriod, getPeriodRange } from '../types/period';
import { generateUUID } from '../utils/uuid';

const ATTACHMENT_DIRECTORY = 'company-expense-attachments';
const MAX_IMAGE_DIMENSION = 2000;
const IMAGE_QUALITY = 0.78;
const PAGE_WIDTH = 595.28;
const PAGE_HEIGHT = 841.89;
export interface CompanyExpenseAttachment {
  id: string;
  expense_type: CompanyExpenseAttachmentType;
  expense_id: string;
  file_name: string;
  mime_type: 'image/jpeg' | 'application/pdf';
  storage_name: string;
  size_bytes: number;
  created_at: number;
}

export interface PickedExpenseAttachment {
  uri: string;
  name: string;
  mimeType: string;
  size: number;
  width?: number;
  height?: number;
}

interface ExportAttachment extends CompanyExpenseAttachment {
  expense_date: number;
}

const attachmentDirectory = () =>
  new Directory(Paths.document, ATTACHMENT_DIRECTORY);

export function getExpenseAttachmentErrorMessage(error: unknown): string {
  const message = error instanceof Error ? error.message : String(error);
  if (message.toLowerCase().includes('encrypted')) {
    return 'This PDF is password-protected. Remove the password before attaching it so it can be merged during export.';
  }
  return message || 'Please try again.';
}

export async function pickExpenseImages(): Promise<PickedExpenseAttachment[]> {
  const result = await ImagePicker.launchImageLibraryAsync({
    mediaTypes: ['images'],
    allowsMultipleSelection: true,
    selectionLimit: 10,
    quality: 1,
  });

  if (result.canceled) return [];
  return result.assets.map((asset) => ({
    uri: asset.uri,
    name: asset.fileName ?? `receipt-${Date.now()}.jpg`,
    mimeType: asset.mimeType ?? 'image/jpeg',
    size: asset.fileSize ?? 0,
    width: asset.width,
    height: asset.height,
  }));
}

export async function takeExpensePhoto(): Promise<PickedExpenseAttachment | null> {
  const permission = await ImagePicker.requestCameraPermissionsAsync();
  if (!permission.granted) {
    throw new Error('Allow camera access to take a receipt photo.');
  }

  const result = await ImagePicker.launchCameraAsync({
    mediaTypes: ['images'],
    quality: 1,
  });
  if (result.canceled || !result.assets[0]) return null;

  const asset = result.assets[0];
  return {
    uri: asset.uri,
    name: asset.fileName ?? `receipt-${Date.now()}.jpg`,
    mimeType: asset.mimeType ?? 'image/jpeg',
    size: asset.fileSize ?? 0,
    width: asset.width,
    height: asset.height,
  };
}

export async function pickExpensePdfs(): Promise<PickedExpenseAttachment[]> {
  const result = await DocumentPicker.getDocumentAsync({
    type: 'application/pdf',
    copyToCacheDirectory: true,
    multiple: true,
  });
  if (result.canceled) return [];

  return result.assets.map((asset) => ({
    uri: asset.uri,
    name: asset.name,
    mimeType: asset.mimeType ?? 'application/pdf',
    size: asset.size ?? 0,
  }));
}

export async function listExpenseAttachments(
  expenseType: CompanyExpenseAttachmentType,
  expenseId: string,
): Promise<CompanyExpenseAttachment[]> {
  const db = await getDatabase();
  return db.getAllAsync<CompanyExpenseAttachment>(
    `SELECT * FROM company_expense_attachments
     WHERE expense_type = ? AND expense_id = ?
     ORDER BY created_at ASC;`,
    [expenseType, expenseId],
  );
}

export async function getExpenseAttachmentCounts(
  expenseType: CompanyExpenseAttachmentType,
  expenseIds: string[],
): Promise<Record<string, number>> {
  if (expenseIds.length === 0) return {};
  const db = await getDatabase();
  const placeholders = expenseIds.map(() => '?').join(', ');
  const rows = await db.getAllAsync<{ expense_id: string; attachment_count: number }>(
    `SELECT expense_id, COUNT(*) AS attachment_count
     FROM company_expense_attachments
     WHERE expense_type = ? AND expense_id IN (${placeholders})
     GROUP BY expense_id;`,
    [expenseType, ...expenseIds],
  );
  return Object.fromEntries(rows.map((row) => [row.expense_id, row.attachment_count]));
}

export function getExpenseAttachmentFile(storageName: string): File {
  return new File(attachmentDirectory(), storageName);
}

export async function addExpenseAttachment(
  expenseType: CompanyExpenseAttachmentType,
  expenseId: string,
  picked: PickedExpenseAttachment,
): Promise<CompanyExpenseAttachment> {
  const id = generateUUID();
  const source = new File(picked.uri);
  const isPdf = picked.mimeType === 'application/pdf' || picked.name.toLowerCase().endsWith('.pdf');
  if (!isPdf && !picked.mimeType.startsWith('image/')) {
    throw new Error('Choose an image or PDF attachment.');
  }

  const directory = attachmentDirectory();
  directory.create({ idempotent: true, intermediates: true });

  let storedFile: File;
  let mimeType: CompanyExpenseAttachment['mime_type'];
  if (isPdf) {
    const bytes = await source.bytes();
    const pdf = await PDFDocument.load(bytes);
    if (pdf.getPageCount() === 0) {
      throw new Error('This PDF does not contain any pages.');
    }
    storedFile = new File(directory, `${id}.pdf`);
    await source.copy(storedFile);
    mimeType = 'application/pdf';
  } else {
    const bounds = picked.width && picked.height
      ? Math.max(picked.width, picked.height)
      : MAX_IMAGE_DIMENSION + 1;
    const scale = Math.min(1, MAX_IMAGE_DIMENSION / bounds);
    const context = ImageManipulator.manipulate(picked.uri);
    if (scale < 1 && picked.width && picked.height) {
      context.resize({
        width: Math.round(picked.width * scale),
        height: Math.round(picked.height * scale),
      });
    }
    const rendered = await context.renderAsync();
    const compressed = await rendered.saveAsync({
      format: SaveFormat.JPEG,
      compress: IMAGE_QUALITY,
    });
    storedFile = new File(directory, `${id}.jpg`);
    await new File(compressed.uri).copy(storedFile);
    mimeType = 'image/jpeg';
  }

  // File.size can be null when the URI provider has not populated its stat
  // metadata yet. Read the persisted bytes so SQLite always receives a number.
  const sizeBytes = (await storedFile.bytes()).byteLength;
  const db = await getDatabase();
  const now = Date.now();
  try {
    await db.runAsync(
      `INSERT INTO company_expense_attachments
        (id, expense_type, expense_id, file_name, mime_type, storage_name, size_bytes, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?);`,
      [id, expenseType, expenseId, picked.name, mimeType, storedFile.name, sizeBytes, now],
    );
  } catch (error) {
    if (storedFile.exists) storedFile.delete();
    throw error;
  }

  return {
    id,
    expense_type: expenseType,
    expense_id: expenseId,
    file_name: picked.name,
    mime_type: mimeType,
    storage_name: storedFile.name,
    size_bytes: sizeBytes,
    created_at: now,
  };
}

export async function deleteExpenseAttachment(id: string): Promise<void> {
  const db = await getDatabase();
  const row = await db.getFirstAsync<{ storage_name: string }>(
    'SELECT storage_name FROM company_expense_attachments WHERE id = ?;',
    [id],
  );
  if (!row) return;
  await db.runAsync('DELETE FROM company_expense_attachments WHERE id = ?;', [id]);
  const file = getExpenseAttachmentFile(row.storage_name);
  try {
    if (file.exists) file.delete();
  } catch (error) {
    console.warn('Could not remove the attachment file:', error);
  }
}

export async function deleteExpenseAttachments(
  expenseType: CompanyExpenseAttachmentType,
  expenseId: string,
): Promise<void> {
  const db = await getDatabase();
  const rows = await db.getAllAsync<{ storage_name: string }>(
    `SELECT storage_name FROM company_expense_attachments
     WHERE expense_type = ? AND expense_id = ?;`,
    [expenseType, expenseId],
  );
  await db.runAsync(
    'DELETE FROM company_expense_attachments WHERE expense_type = ? AND expense_id = ?;',
    [expenseType, expenseId],
  );
  for (const row of rows) {
    try {
      const file = getExpenseAttachmentFile(row.storage_name);
      if (file.exists) file.delete();
    } catch (error) {
      console.warn('Could not remove an expense attachment file:', error);
    }
  }
}

async function getAttachmentsForPeriod(
  employeeId: string,
  period: MonthPeriod,
): Promise<ExportAttachment[]> {
  const db = await getDatabase();
  const range = getPeriodRange(period);
  const periodFilter = range.start == null
    ? ''
    : `AND (
        (x.expense_type = 'hotel' AND x.expense_date < ? AND x.expense_end >= ?)
        OR (x.expense_type != 'hotel' AND x.expense_date >= ? AND x.expense_date < ?)
      )`;
  const periodArgs = range.start == null
    ? []
    : [range.end!, range.start, range.start, range.end!];

  return db.getAllAsync<ExportAttachment>(
    `SELECT a.*, x.expense_date FROM (
       SELECT 'outstation_conveyance' AS expense_type, id, employee_id, date AS expense_date, date AS expense_end,
         amount AS amount
       FROM outstation_conveyance
       UNION ALL
       SELECT 'hotel', id, employee_id, start_date, end_date, amount FROM hotel
       UNION ALL
       SELECT 'tour_conveyance', id, employee_id, date, date, fare FROM tour_conveyance
       UNION ALL
       SELECT 'miscellaneous_expense', id, employee_id, date, date, amount
       FROM miscellaneous_expense
     ) x
     JOIN company_expense_attachments a
       ON a.expense_type = x.expense_type AND a.expense_id = x.id
     WHERE x.employee_id = ? ${periodFilter}
     ORDER BY x.expense_date ASC, a.created_at ASC;`,
    [employeeId, ...periodArgs],
  );
}

export async function buildCompanyAttachmentsPdf(
  employeeId: string,
  period: MonthPeriod,
): Promise<{ uri: string; filename: string }> {
  const attachments = await getAttachmentsForPeriod(employeeId, period);
  if (attachments.length === 0) {
    throw new Error('No receipt attachments were found for the selected month.');
  }

  const output = await PDFDocument.create();
  const font = await output.embedFont(StandardFonts.Helvetica);
  const attachmentDir = attachmentDirectory();

  for (const attachment of attachments) {
    const input = await new File(attachmentDir, attachment.storage_name).bytes();
    if (attachment.mime_type === 'application/pdf') {
      const source = await PDFDocument.load(input);
      const cover = output.addPage([PAGE_WIDTH, PAGE_HEIGHT]);
      cover.drawText(attachment.file_name, {
        x: 40,
        y: PAGE_HEIGHT - 55,
        size: 10,
        font,
        color: rgb(0.35, 0.39, 0.45),
        maxWidth: PAGE_WIDTH - 80,
      });
      const copied = await output.copyPages(source, source.getPageIndices());
      copied.forEach((page) => output.addPage(page));
    } else {
      const page = output.addPage([PAGE_WIDTH, PAGE_HEIGHT]);
      page.drawText(attachment.file_name, {
        x: 40,
        y: PAGE_HEIGHT - 55,
        size: 10,
        font,
        color: rgb(0.35, 0.39, 0.45),
        maxWidth: PAGE_WIDTH - 80,
      });
      const image = await output.embedJpg(input);
      const availableWidth = PAGE_WIDTH - 80;
      const availableHeight = PAGE_HEIGHT - 100;
      const scale = Math.min(availableWidth / image.width, availableHeight / image.height);
      const width = image.width * scale;
      const height = image.height * scale;
      page.drawImage(image, {
        x: (PAGE_WIDTH - width) / 2,
        y: 35 + (availableHeight - height) / 2,
        width,
        height,
      });
    }
  }

  const bytes = await output.save({ useObjectStreams: true });
  const periodLabel = period.kind === 'all'
    ? 'All-Time'
    : `${period.year}-${String(period.monthIndex + 1).padStart(2, '0')}`;
  const filename = `Expense_Receipts_${periodLabel}.pdf`;
  const result = new File(Paths.cache, filename);
  result.create({ overwrite: true });
  result.write(bytes);
  return { uri: result.uri, filename };
}

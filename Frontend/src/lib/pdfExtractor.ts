import * as pdfjsLib from 'pdfjs-dist';
import type { PDFDocumentProxy } from 'pdfjs-dist';
import { createWorker } from 'tesseract.js';
import { ExtractedPage } from '@/types';

// Configure PDF.js worker for Vite bundling
pdfjsLib.GlobalWorkerOptions.workerSrc = new URL(
  'pdfjs-dist/build/pdf.worker.min.mjs',
  import.meta.url
).toString();

export const MAX_PDF_BYTES = 50 * 1024 * 1024; // 50 MB matching Supabase Storage bucket limit

export type PdfErrorCode =
  | 'INVALID_FORMAT'
  | 'FILE_TOO_LARGE'
  | 'PASSWORD_REQUIRED'
  | 'INCORRECT_PASSWORD'
  | 'CORRUPTED_PDF'
  | 'EMPTY_PDF'
  | 'UNKNOWN';

export class PdfExtractionError extends Error {
  code: PdfErrorCode;
  constructor(code: PdfErrorCode, message: string) {
    super(message);
    this.name = 'PdfExtractionError';
    this.code = code;
  }
}

export interface PdfExtractionResult {
  pageCount: number;
  pages: ExtractedPage[];
  fullTextLength: number;
  isScanned: boolean;
  ocrApplied: boolean;
  document?: PDFDocumentProxy;
}

async function readBlobAsArrayBuffer(blob: Blob): Promise<ArrayBuffer> {
  if (typeof blob.arrayBuffer === 'function') {
    return blob.arrayBuffer();
  }
  return new Promise<ArrayBuffer>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as ArrayBuffer);
    reader.onerror = () => reject(reader.error || new Error('Failed to read file bytes'));
    reader.readAsArrayBuffer(blob);
  });
}

export async function validatePdfFile(file: File): Promise<void> {
  if (!file) {
    throw new PdfExtractionError('INVALID_FORMAT', 'No file provided.');
  }

  const hasPdfExtension = file.name.toLowerCase().endsWith('.pdf');
  const hasPdfMime = file.type === 'application/pdf' || file.type === '';

  if (!hasPdfExtension && !hasPdfMime) {
    throw new PdfExtractionError(
      'INVALID_FORMAT',
      `Invalid file type "${file.type || file.name}". Please upload a valid .pdf document.`
    );
  }

  if (file.size < 10) {
    throw new PdfExtractionError('CORRUPTED_PDF', 'The selected file is too small to be a valid PDF.');
  }

  if (file.size > MAX_PDF_BYTES) {
    throw new PdfExtractionError(
      'FILE_TOO_LARGE',
      `File exceeds the 50 MB limit (${(file.size / (1024 * 1024)).toFixed(1)} MB).`
    );
  }

  // Verify %PDF- magic bytes in the first 1024 bytes
  const headerSlice = await readBlobAsArrayBuffer(file.slice(0, 1024));
  const headerText = new TextDecoder('ascii').decode(headerSlice);
  if (!headerText.includes('%PDF-')) {
    throw new PdfExtractionError(
      'INVALID_FORMAT',
      'File header validation failed: this file does not start with a valid %PDF- signature.'
    );
  }
}

export async function loadPdfDocument(file: File, password?: string): Promise<PDFDocumentProxy> {
  const data = new Uint8Array(await readBlobAsArrayBuffer(file));
  const loadingTask = pdfjsLib.getDocument({
    data,
    password: password || undefined,
    useSystemFonts: true,
  });

  try {
    const doc = await loadingTask.promise;
    if (doc.numPages === 0) {
      throw new PdfExtractionError('EMPTY_PDF', 'The PDF contains zero pages.');
    }
    return doc;
  } catch (err: unknown) {
    if (err instanceof PdfExtractionError) throw err;
    const errorObj = err as { name?: string; code?: number; message?: string };
    if (errorObj?.name === 'PasswordException') {
      if (errorObj.code === 2) {
        throw new PdfExtractionError('INCORRECT_PASSWORD', 'Incorrect PDF password. Please try again.');
      }
      throw new PdfExtractionError(
        'PASSWORD_REQUIRED',
        'This PDF is password-protected. Enter the document password to unlock text extraction.'
      );
    }
    if (errorObj?.name === 'InvalidPDFException' || errorObj?.name === 'FormatError') {
      throw new PdfExtractionError(
        'CORRUPTED_PDF',
        'Unable to parse PDF structure. The file appears corrupted or malformed.'
      );
    }
    throw new PdfExtractionError(
      'UNKNOWN',
      errorObj?.message || 'Failed to read PDF document.'
    );
  }
}

export async function extractTextFromPdf(
  file: File,
  options?: {
    password?: string;
    onProgress?: (currentPage: number, totalPages: number) => void;
  }
): Promise<PdfExtractionResult> {
  await validatePdfFile(file);
  const doc = await loadPdfDocument(file, options?.password);

  const pages: ExtractedPage[] = [];
  let totalChars = 0;

  for (let i = 1; i <= doc.numPages; i++) {
    const page = await doc.getPage(i);
    const content = await page.getTextContent();
    const strings = content.items
      .map((item) => ('str' in item ? item.str : ''))
      .filter(Boolean);
    const pageText = strings.join(' ').replace(/\s+/g, ' ').trim();
    pages.push({
      pageNumber: i,
      text: pageText,
      charCount: pageText.length,
      ocrUsed: false,
    });
    totalChars += pageText.length;
    options?.onProgress?.(i, doc.numPages);
  }

  const avgCharsPerPage = doc.numPages > 0 ? totalChars / doc.numPages : 0;
  const isScanned = avgCharsPerPage < 60;

  return {
    pageCount: doc.numPages,
    pages,
    fullTextLength: totalChars,
    isScanned,
    ocrApplied: false,
    document: doc,
  };
}

export async function loadPdfFromUrl(url: string): Promise<PDFDocumentProxy> {
  const loadingTask = pdfjsLib.getDocument({ url, useSystemFonts: true });
  return await loadingTask.promise;
}

export async function runOcrOnPdf(
  file: File,
  options?: {
    password?: string;
    maxPages?: number;
    onProgress?: (currentPage: number, totalPages: number) => void;
  }
): Promise<PdfExtractionResult> {
  await validatePdfFile(file);
  const doc = await loadPdfDocument(file, options?.password);

  const totalToProcess = options?.maxPages ? Math.min(doc.numPages, options.maxPages) : doc.numPages;
  const worker = await createWorker('eng');
  const pages: ExtractedPage[] = [];
  let totalChars = 0;

  try {
    for (let i = 1; i <= totalToProcess; i++) {
      const page = await doc.getPage(i);
      const viewport = page.getViewport({ scale: 1.75 });
      const canvas = document.createElement('canvas');
      canvas.width = viewport.width;
      canvas.height = viewport.height;
      const ctx = canvas.getContext('2d');
      if (!ctx) {
        throw new Error('Could not initialize 2D canvas context for OCR.');
      }

      await page.render({ canvasContext: ctx, viewport }).promise;
      const {
        data: { text },
      } = await worker.recognize(canvas);

      const cleaned = (text || '').replace(/\s+/g, ' ').trim();
      pages.push({
        pageNumber: i,
        text: cleaned,
        charCount: cleaned.length,
        ocrUsed: true,
      });
      totalChars += cleaned.length;
      options?.onProgress?.(i, totalToProcess);
    }
  } finally {
    await worker.terminate();
  }

  return {
    pageCount: doc.numPages,
    pages,
    fullTextLength: totalChars,
    isScanned: false,
    ocrApplied: true,
    document: doc,
  };
}

export async function renderPdfPageToCanvas(
  doc: PDFDocumentProxy,
  pageNumber: number,
  canvas: HTMLCanvasElement,
  scale = 1.25
): Promise<void> {
  const page = await doc.getPage(pageNumber);
  const viewport = page.getViewport({ scale });
  canvas.width = viewport.width;
  canvas.height = viewport.height;
  const ctx = canvas.getContext('2d');
  if (!ctx) return;
  await page.render({ canvasContext: ctx, viewport }).promise;
}

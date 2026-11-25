import { describe, expect, it } from 'vitest';
import { PdfExtractionError, validatePdfFile } from '@/lib/pdfExtractor';

function makeFile(bytes: string, name: string, type = 'application/pdf'): File {
  return new File([bytes], name, { type });
}

describe('PDF Upload Validation', () => {
  it('rejects non-PDF files', async () => {
    const txt = makeFile('hello world', 'notes.txt', 'text/plain');
    await expect(validatePdfFile(txt)).rejects.toMatchObject({
      code: 'INVALID_FORMAT',
    });
  });

  it('rejects files claiming .pdf extension without %PDF- magic header', async () => {
    const fakePdf = makeFile('NOT_A_REAL_PDF_CONTENT_12345', 'fake.pdf', 'application/pdf');
    await expect(validatePdfFile(fakePdf)).rejects.toBeInstanceOf(PdfExtractionError);
    await expect(validatePdfFile(fakePdf)).rejects.toMatchObject({
      code: 'INVALID_FORMAT',
    });
  });

  it('rejects tiny corrupted files', async () => {
    const tiny = makeFile('%PDF', 'tiny.pdf', 'application/pdf');
    await expect(validatePdfFile(tiny)).rejects.toMatchObject({
      code: 'CORRUPTED_PDF',
    });
  });

  it('rejects files exceeding 50 MB limit', async () => {
    const validHeader = makeFile('%PDF-1.7\n1 0 obj\n<<>>\nendobj\n%%EOF', 'huge.pdf');
    Object.defineProperty(validHeader, 'size', { value: 51 * 1024 * 1024 });
    await expect(validatePdfFile(validHeader)).rejects.toMatchObject({
      code: 'FILE_TOO_LARGE',
    });
  });

  it('accepts files with valid .pdf extension and %PDF- signature', async () => {
    const validHeader = makeFile('%PDF-1.7\n1 0 obj\n<<>>\nendobj\n%%EOF', 'paper.pdf');
    await expect(validatePdfFile(validHeader)).resolves.toBeUndefined();
  });
});

import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useDropzone, type FileRejection } from 'react-dropzone';
import { useNavigate } from 'react-router-dom';
import type { PDFDocumentProxy } from 'pdfjs-dist';
import {
  FileUp,
  FileText,
  AlertTriangle,
  Lock,
  ScanText,
  ChevronLeft,
  ChevronRight,
  Sparkles,
  CheckCircle2,
  Loader2,
} from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { useProject } from '@/contexts/ProjectContext';
import { useToast } from '@/contexts/ToastContext';
import {
  extractTextFromPdf,
  loadPdfDocument,
  loadPdfFromUrl,
  MAX_PDF_BYTES,
  PdfExtractionError,
  PdfExtractionResult,
  renderPdfPageToCanvas,
  runOcrOnPdf,
} from '@/lib/pdfExtractor';
import { analyzePaperApi } from '@/lib/api';
import { supabase } from '@/lib/supabase';
import { formatBytes } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Progress } from '@/components/ui/progress';
import { Alert } from '@/components/ui/alert';
import { ErrorBanner } from '@/components/common/ErrorBanner';
import { LoadingSpinner } from '@/components/common/LoadingSpinner';

export function UploadPaperPage() {
  const { user, isConfigured } = useAuth();
  const { activeBundle, createProject, renameProject, savePaperUpload, refreshActiveBundle } = useProject();
  const { notify } = useToast();
  const navigate = useNavigate();

  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [pdfDoc, setPdfDoc] = useState<PDFDocumentProxy | null>(null);
  const [previewPage, setPreviewPage] = useState(1);
  const [extraction, setExtraction] = useState<PdfExtractionResult | null>(null);
  const [extracting, setExtracting] = useState(false);
  const [ocrProgress, setOcrProgress] = useState<{ current: number; total: number } | null>(null);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [savingToCloud, setSavingToCloud] = useState(false);
  const [analyzing, setAnalyzing] = useState(false);
  const [errorState, setErrorState] = useState<{ code?: string; message: string; retryAction?: 'extract' | 'analyze' } | null>(null);
  const [pdfPassword, setPdfPassword] = useState('');
  const [needsPassword, setNeedsPassword] = useState(false);
  const [projectTitleInput, setProjectTitleInput] = useState('');
  const [uploadedTarget, setUploadedTarget] = useState<{ fileKey: string; projectId: string } | null>(null);
  const [existingPdfDoc, setExistingPdfDoc] = useState<PDFDocumentProxy | null>(null);
  const [existingPreviewPage, setExistingPreviewPage] = useState(1);

  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const existingCanvasRef = useRef<HTMLCanvasElement | null>(null);

  const getFileKey = (f: File) => `${f.name}:${f.size}:${f.lastModified}`;

  const processPdfFile = useCallback(async (file: File, password?: string) => {
    setErrorState(null);
    setNeedsPassword(false);
    setExtracting(true);
    setExtraction(null);
    setPdfDoc(null);
    setUploadedTarget(null);
    setSelectedFile(file);
    setProjectTitleInput(file.name.replace(/\.pdf$/i, '').replace(/[_-]+/g, ' '));

    try {
      const result = await extractTextFromPdf(file, { password });
      const doc = result.document || (await loadPdfDocument(file, password));
      setPdfDoc(doc);
      setPreviewPage(1);
      setExtraction(result);
      notify('PDF extracted successfully', {
        description: `${result.pageCount} pages processed (${result.fullTextLength.toLocaleString()} characters).`,
        kind: result.isScanned ? 'warning' : 'success',
      });
    } catch (err) {
      if (err instanceof PdfExtractionError) {
        if (err.code === 'PASSWORD_REQUIRED' || err.code === 'INCORRECT_PASSWORD') {
          setNeedsPassword(true);
        }
        setErrorState({ code: err.code, message: err.message, retryAction: 'extract' });
      } else {
        setErrorState({ message: err instanceof Error ? err.message : 'Failed to extract PDF.', retryAction: 'extract' });
      }
    } finally {
      setExtracting(false);
    }
  }, [notify]);

  const onDrop = useCallback(
    (acceptedFiles: File[]) => {
      if (acceptedFiles.length > 0) {
        setPdfPassword('');
        processPdfFile(acceptedFiles[0]);
      }
    },
    [processPdfFile]
  );

  const onDropRejected = useCallback((rejections: FileRejection[]) => {
    const first = rejections[0];
    if (!first) return;
    const err = first.errors[0];
    const message =
      err?.code === 'file-too-large'
        ? `File "${first.file.name}" exceeds the 50 MB maximum PDF size limit.`
        : err?.code === 'file-invalid-type'
        ? `Invalid file type for "${first.file.name}". Please upload a valid .pdf document.`
        : err?.message || `Could not accept file "${first.file.name}".`;
    setSelectedFile(null);
    setExtraction(null);
    setPdfDoc(null);
    setNeedsPassword(false);
    setErrorState({ code: 'INVALID_FORMAT', message });
  }, []);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    onDropRejected,
    multiple: false,
    maxSize: MAX_PDF_BYTES,
    accept: { 'application/pdf': ['.pdf'] },
  });

  useEffect(() => {
    if (pdfDoc && canvasRef.current) {
      renderPdfPageToCanvas(pdfDoc, previewPage, canvasRef.current, 1.15).catch(() => {
        // ignore canvas cancellation on quick page flip
      });
    }
  }, [pdfDoc, previewPage]);

  // Load PDF preview from Supabase Storage when revisiting Stage 1 on an existing cloud project
  const existingPaper = activeBundle?.paper;
  useEffect(() => {
    let cancelled = false;
    setExistingPdfDoc(null);
    setExistingPreviewPage(1);

    if (!existingPaper || selectedFile || activeBundle?.project.is_demo || !isConfigured) {
      return;
    }

    supabase.storage
      .from('research-papers')
      .createSignedUrl(existingPaper.storage_path, 3600)
      .then(({ data }) => {
        if (!cancelled && data?.signedUrl) {
          return loadPdfFromUrl(data.signedUrl);
        }
        return null;
      })
      .then((doc) => {
        if (!cancelled && doc) {
          setExistingPdfDoc(doc);
        }
      })
      .catch(() => {
        // Graceful fallback to extracted text summary if preview fails
      });

    return () => {
      cancelled = true;
    };
  }, [existingPaper, selectedFile, activeBundle?.project.is_demo, isConfigured]);

  useEffect(() => {
    if (existingPdfDoc && existingCanvasRef.current) {
      renderPdfPageToCanvas(existingPdfDoc, existingPreviewPage, existingCanvasRef.current, 1.05).catch(() => {
        // ignore quick flip cancellation
      });
    }
  }, [existingPdfDoc, existingPreviewPage]);

  const handleRunOcr = async () => {
    if (!selectedFile) return;
    setErrorState(null);
    setUploadedTarget(null);
    setOcrProgress({ current: 0, total: extraction?.pageCount || 1 });
    try {
      const result = await runOcrOnPdf(selectedFile, {
        password: pdfPassword || undefined,
        onProgress: (current, total) => setOcrProgress({ current, total }),
      });
      setExtraction(result);
      if (result.document) setPdfDoc(result.document);
      notify('OCR text extraction completed', {
        description: `Recovered ${result.fullTextLength.toLocaleString()} characters across ${result.pageCount} pages.`,
        kind: 'success',
      });
    } catch (err) {
      setErrorState({ message: err instanceof Error ? err.message : 'OCR failed.' });
    } finally {
      setOcrProgress(null);
    }
  };

  const handleSaveAndAnalyze = async (runAiNow: boolean) => {
    if (!selectedFile || !extraction) return;
    if (!user || !isConfigured) {
      notify('Sign in required for cloud persistence & AI analysis', {
        description: 'Configure Supabase in .env and sign in to upload and analyze papers.',
        kind: 'warning',
      });
      return;
    }

    setErrorState(null);
    const fileKey = getFileKey(selectedFile);
    let targetProjectId = uploadedTarget?.fileKey === fileKey ? uploadedTarget.projectId : null;

    try {
      if (!targetProjectId) {
        setSavingToCloud(true);
        setUploadProgress(10);

        const activeEmptyProject =
          activeBundle && !activeBundle.project.is_demo && !activeBundle.paper
            ? activeBundle.project
            : null;

        if (activeEmptyProject) {
          targetProjectId = activeEmptyProject.id;
          const desiredTitle = projectTitleInput.trim();
          if (desiredTitle && desiredTitle !== activeEmptyProject.title) {
            await renameProject(activeEmptyProject.id, desiredTitle);
          }
        } else {
          const created = await createProject(
            projectTitleInput.trim() || selectedFile.name.replace(/\.pdf$/i, '')
          );
          targetProjectId = created.id;
        }

        await savePaperUpload({
          projectId: targetProjectId,
          file: selectedFile,
          pageCount: extraction.pageCount,
          pages: extraction.pages,
          isScanned: extraction.isScanned,
          ocrApplied: extraction.ocrApplied,
          onUploadProgress: (pct) => setUploadProgress(pct),
        });

        setUploadedTarget({ fileKey, projectId: targetProjectId });
        notify('PDF stored securely in Supabase Storage', { kind: 'success' });
      }

      if (runAiNow && targetProjectId) {
        setSavingToCloud(false);
        setAnalyzing(true);
        await analyzePaperApi(targetProjectId, extraction.pages);
        await refreshActiveBundle(targetProjectId);
        notify('AI Research Paper Analysis complete!', { kind: 'success' });
        navigate('/app/analysis');
      }
    } catch (err) {
      setErrorState({
        message: err instanceof Error ? err.message : 'Failed to upload or analyze paper.',
        retryAction: uploadedTarget?.fileKey === fileKey || targetProjectId ? 'analyze' : undefined,
      });
    } finally {
      setSavingToCloud(false);
      setAnalyzing(false);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <Badge className="mb-2">Stage 1 of 9</Badge>
        <h1 className="text-2xl font-bold text-white">Upload & Extract Research Paper</h1>
        <p className="mt-1 text-sm text-slate-400">
          Upload an academic PDF. Every readable page is extracted with page citations preserved—never silently truncated.
        </p>
      </div>

      {/* Existing paper banner & preview if revisiting Stage 1 */}
      {existingPaper && !selectedFile && (
        <div className="space-y-4">
          <Alert variant="info" className="flex flex-col justify-between gap-3 sm:flex-row sm:items-center">
            <div>
              <p className="font-semibold text-sky-100">
                Current Project Paper: {existingPaper.file_name}
                {activeBundle?.project.is_demo ? ' (DEMO DATA)' : ''}
              </p>
              <p className="text-xs text-sky-200/80">
                {existingPaper.page_count} pages • {formatBytes(existingPaper.file_size)} •{' '}
                {existingPaper.full_text_length.toLocaleString()} extracted characters
                {existingPaper.ocr_applied ? ' • OCR applied' : ''}
              </p>
            </div>
            <Button size="sm" onClick={() => navigate('/app/analysis')}>
              View Analysis (Stage 2)
            </Button>
          </Alert>

          <div className={`grid gap-4 ${existingPdfDoc ? 'lg:grid-cols-2' : ''}`}>
            {existingPdfDoc && (
              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-3">
                  <div>
                    <CardTitle>Stored PDF Preview</CardTitle>
                    <CardDescription>
                      Page {existingPreviewPage} of {existingPaper.page_count}
                    </CardDescription>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <Button
                      size="icon"
                      variant="outline"
                      disabled={existingPreviewPage <= 1}
                      onClick={() => setExistingPreviewPage((p) => Math.max(1, p - 1))}
                    >
                      <ChevronLeft className="h-4 w-4" />
                    </Button>
                    <Button
                      size="icon"
                      variant="outline"
                      disabled={existingPreviewPage >= existingPaper.page_count}
                      onClick={() => setExistingPreviewPage((p) => Math.min(existingPaper.page_count, p + 1))}
                    >
                      <ChevronRight className="h-4 w-4" />
                    </Button>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="flex max-h-[380px] justify-center overflow-auto rounded-lg border border-slate-800 bg-slate-900 p-2">
                    <canvas ref={existingCanvasRef} className="max-w-full shadow-lg" />
                  </div>
                </CardContent>
              </Card>
            )}

            <Card>
              <CardHeader>
                <CardTitle>Extracted Pages ({existingPaper.extracted_pages?.length || 0})</CardTitle>
                <CardDescription>Stored page-indexed text available to the AI analyzer.</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="max-h-64 overflow-y-auto rounded-lg border border-slate-800 bg-navy-950 p-3 font-mono text-xs text-slate-300">
                  {(existingPaper.extracted_pages || []).map((p) => (
                    <div key={p.pageNumber} className="mb-3 border-b border-slate-800/60 pb-2 last:border-none">
                      <span className="font-semibold text-violet-400">[Page {p.pageNumber}]</span>{' '}
                      {p.text ? p.text.slice(0, 400) + (p.text.length > 400 ? '...' : '') : '(No text on this page)'}
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      )}

      {/* Dropzone */}
      <Card>
        <CardContent className="pt-6">
          <div
            {...getRootProps()}
            className={`flex cursor-pointer flex-col items-center justify-center rounded-xl border-2 border-dashed p-10 text-center transition-colors ${
              isDragActive
                ? 'border-violet-400 bg-violet-600/15'
                : 'border-slate-700 bg-navy-950/60 hover:border-violet-500/60'
            }`}
          >
            <input {...getInputProps()} />
            <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-xl bg-violet-600/20 text-violet-400">
              <FileUp className="h-6 w-6" />
            </div>
            <p className="text-base font-semibold text-white">
              {isDragActive ? 'Drop your PDF here...' : 'Drag & drop a research paper PDF'}
            </p>
            <p className="mt-1 text-xs text-slate-400">
              Or click to browse local files • Validated via .pdf & %PDF- header • Max 50 MB
            </p>
          </div>

          {selectedFile && (
            <div className="mt-4 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-slate-800 bg-navy-950/70 px-4 py-3">
              <div className="flex items-center gap-3">
                <FileText className="h-5 w-5 text-violet-400" />
                <div>
                  <p className="text-sm font-medium text-white">{selectedFile.name}</p>
                  <p className="text-xs text-slate-400">
                    Size: {formatBytes(selectedFile.size)}
                    {extraction ? ` • ${extraction.pageCount} pages` : ''}
                  </p>
                </div>
              </div>
              {extraction && (
                <Badge variant={extraction.isScanned ? 'warning' : 'success'}>
                  {extraction.isScanned ? 'Scanned PDF Detected' : 'Text Extracted'}
                </Badge>
              )}
            </div>
          )}

          {savingToCloud && (
            <div className="mt-4 space-y-1.5">
              <div className="flex justify-between text-xs text-slate-400">
                <span>Uploading PDF to secure Supabase Storage...</span>
                <span>{uploadProgress}%</span>
              </div>
              <Progress value={uploadProgress} />
            </div>
          )}
        </CardContent>
      </Card>

      {errorState && (
        <ErrorBanner
          title={
            errorState.code === 'PASSWORD_REQUIRED' || errorState.code === 'INCORRECT_PASSWORD'
              ? 'Password-Protected PDF'
              : errorState.code === 'CORRUPTED_PDF'
              ? 'Corrupted PDF Detected'
              : errorState.code === 'INVALID_FORMAT' || errorState.code === 'FILE_TOO_LARGE'
              ? 'Invalid PDF Upload'
              : errorState.retryAction === 'analyze'
              ? 'AI Analysis Error'
              : 'PDF Processing Error'
          }
          message={errorState.message}
          onRetry={
            errorState.retryAction === 'analyze'
              ? () => handleSaveAndAnalyze(true)
              : selectedFile && errorState.retryAction === 'extract'
              ? () => processPdfFile(selectedFile, pdfPassword)
              : undefined
          }
        />
      )}

      {needsPassword && selectedFile && (
        <Card className="border-amber-500/40">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-amber-200">
              <Lock className="h-4 w-4" />
              Unlock Password-Protected PDF
            </CardTitle>
            <CardDescription>Enter the document password to decrypt and extract pages locally in your browser.</CardDescription>
          </CardHeader>
          <CardContent className="flex gap-3">
            <Input
              type="password"
              placeholder="PDF Password"
              value={pdfPassword}
              onChange={(e) => setPdfPassword(e.target.value)}
            />
            <Button onClick={() => processPdfFile(selectedFile, pdfPassword)}>Unlock PDF</Button>
          </CardContent>
        </Card>
      )}

      {extracting && (
        <LoadingSpinner
          title="Extracting pages with PDF.js..."
          subtitle="Reading text layer across all pages while preserving page numbers."
        />
      )}

      {ocrProgress && (
        <Card className="border-violet-500/40">
          <CardContent className="space-y-3 pt-5">
            <div className="flex items-center gap-2 text-sm font-medium text-white">
              <Loader2 className="h-4 w-4 animate-spin text-violet-400" />
              Running Browser OCR (Tesseract.js) — Page {ocrProgress.current} of {ocrProgress.total}
            </div>
            <Progress value={(ocrProgress.current / Math.max(ocrProgress.total, 1)) * 100} />
          </CardContent>
        </Card>
      )}

      {analyzing && (
        <LoadingSpinner
          title="Analyzing Research Paper with Google Gemini..."
          subtitle="Extracting problem statement, methodology, equations, datasets, metrics, and reproducibility signals across all sections."
        />
      )}

      {/* Extraction Results + PDF Preview */}
      {extraction && !analyzing && (
        <div className="grid gap-6 lg:grid-cols-2">
          {/* Left: PDF Canvas Preview */}
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-3">
              <div>
                <CardTitle>PDF Preview</CardTitle>
                <CardDescription>
                  Page {previewPage} of {extraction.pageCount}
                </CardDescription>
              </div>
              <div className="flex items-center gap-1.5">
                <Button
                  size="icon"
                  variant="outline"
                  disabled={previewPage <= 1}
                  onClick={() => setPreviewPage((p) => Math.max(1, p - 1))}
                >
                  <ChevronLeft className="h-4 w-4" />
                </Button>
                <Button
                  size="icon"
                  variant="outline"
                  disabled={previewPage >= extraction.pageCount}
                  onClick={() => setPreviewPage((p) => Math.min(extraction.pageCount, p + 1))}
                >
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              <div className="flex max-h-[480px] justify-center overflow-auto rounded-lg border border-slate-800 bg-slate-900 p-2">
                <canvas ref={canvasRef} className="max-w-full shadow-lg" />
              </div>
            </CardContent>
          </Card>

          {/* Right: Scanned Warning / OCR Option + Extracted Text & Actions */}
          <div className="space-y-4">
            {extraction.isScanned && !extraction.ocrApplied && (
              <Alert variant="warning" className="space-y-3">
                <div className="flex items-start gap-2.5">
                  <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-amber-400" />
                  <div>
                    <p className="font-semibold">Scanned / Image-Only PDF Detected</p>
                    <p className="mt-1 text-xs text-amber-100/90">
                      Very little embedded text was found ({extraction.fullTextLength} chars across {extraction.pageCount} pages). OCR is required to read scanned pages before AI analysis.
                    </p>
                  </div>
                </div>
                <Button size="sm" variant="outline" onClick={handleRunOcr} disabled={Boolean(ocrProgress)}>
                  <ScanText className="h-4 w-4" />
                  Run In-Browser OCR (Tesseract.js)
                </Button>
              </Alert>
            )}

            <Card>
              <CardHeader>
                <CardTitle>Extracted Text Summary</CardTitle>
                <CardDescription>
                  {extraction.pageCount} pages • {extraction.fullTextLength.toLocaleString()} total characters
                  {extraction.ocrApplied ? ' (via OCR)' : ''}
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <label className="mb-1.5 block text-xs font-medium text-slate-300">
                    Project Title
                  </label>
                  <Input
                    value={projectTitleInput}
                    onChange={(e) => setProjectTitleInput(e.target.value)}
                    placeholder="Enter a title for this research project"
                  />
                </div>

                <div className="max-h-56 overflow-y-auto rounded-lg border border-slate-800 bg-navy-950 p-3 font-mono text-xs text-slate-300">
                  {extraction.pages.map((p) => (
                    <div key={p.pageNumber} className="mb-3 border-b border-slate-800/60 pb-2 last:border-none">
                      <span className="font-semibold text-violet-400">[Page {p.pageNumber}]</span>{' '}
                      {p.text ? p.text.slice(0, 450) + (p.text.length > 450 ? '...' : '') : '(No embedded text on this page)'}
                    </div>
                  ))}
                </div>

                <div className="flex flex-wrap gap-3">
                  <Button
                    onClick={() => handleSaveAndAnalyze(true)}
                    disabled={savingToCloud || analyzing || extraction.fullTextLength === 0}
                  >
                    <Sparkles className="h-4 w-4" />
                    Save & Run AI Paper Analysis
                  </Button>
                  <Button
                    variant="outline"
                    onClick={() => handleSaveAndAnalyze(false)}
                    disabled={savingToCloud || analyzing}
                  >
                    <CheckCircle2 className="h-4 w-4" />
                    Save Upload Only
                  </Button>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      )}
    </div>
  );
}

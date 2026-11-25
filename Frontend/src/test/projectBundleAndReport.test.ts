import { describe, expect, it } from 'vitest';
import JSZip from 'jszip';
import { DEMO_PROJECT_BUNDLE } from '@/data/demoProject';
import { buildProjectZipBlob } from '@/lib/projectZip';
import { generateFinalReportPdf } from '@/lib/reportGenerator';

describe('Demo Integrity, Project ZIP & PDF Report Generation', () => {
  it('demo project is labeled DEMO DATA and does not fabricate actual execution results', () => {
    expect(DEMO_PROJECT_BUNDLE.project.is_demo).toBe(true);
    expect(DEMO_PROJECT_BUNDLE.project.title).toContain('Plant Disease Detection');
    expect(DEMO_PROJECT_BUNDLE.runs).toHaveLength(0);
    expect(DEMO_PROJECT_BUNDLE.results).toHaveLength(0);
    expect(DEMO_PROJECT_BUNDLE.blueprints.map((b) => b.implementation_level)).toEqual([
      'beginner',
      'intermediate',
      'advanced',
    ]);
  });

  it('builds a valid ZIP archive containing source files, requirements.txt, and README.md', async () => {
    const blob = await buildProjectZipBlob(DEMO_PROJECT_BUNDLE.generatedCode!);
    const buffer = await new Promise<ArrayBuffer>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as ArrayBuffer);
      reader.onerror = () => reject(reader.error);
      reader.readAsArrayBuffer(blob);
    });
    const loaded = await JSZip.loadAsync(buffer);
    const paths = Object.keys(loaded.files);

    expect(paths.some((p) => p.endsWith('main.py'))).toBe(true);
    expect(paths.some((p) => p.endsWith('src/model.py'))).toBe(true);
    expect(paths.some((p) => p.endsWith('requirements.txt'))).toBe(true);
    expect(paths.some((p) => p.endsWith('README.md'))).toBe(true);
  });

  it('generates a multi-page PDF technical report without crashing', () => {
    const pdf = generateFinalReportPdf(DEMO_PROJECT_BUNDLE);
    const pageCount = pdf.getNumberOfPages();
    expect(pageCount).toBeGreaterThanOrEqual(2);
    const out = pdf.output('arraybuffer');
    expect(out.byteLength).toBeGreaterThan(2000);
  });
});

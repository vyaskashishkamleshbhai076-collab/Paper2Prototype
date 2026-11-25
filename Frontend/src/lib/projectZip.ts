import JSZip from 'jszip';
import { GeneratedCode } from '@/types';

export async function buildProjectZipBlob(code: GeneratedCode): Promise<Blob> {
  const zip = new JSZip();
  const rootFolder = zip.folder(code.project_name || 'paper2prototype_experiment') || zip;

  for (const file of code.files || []) {
    const cleanPath = file.path.replace(/^\/+/, '');
    rootFolder.file(cleanPath, file.content);
  }

  if (code.requirements_txt) {
    rootFolder.file('requirements.txt', code.requirements_txt);
  }

  if (code.readme_md) {
    rootFolder.file('README.md', code.readme_md);
  }

  if (code.sample_input) {
    rootFolder.file('sample_input.txt', code.sample_input);
  }

  if (code.configuration_instructions) {
    rootFolder.file('CONFIG_INSTRUCTIONS.md', code.configuration_instructions);
  }

  return await zip.generateAsync({ type: 'blob' });
}

export function triggerBlobDownload(blob: Blob, fileName: string): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = fileName;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

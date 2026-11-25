import React from 'react';
import { describe, expect, it } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import App from '@/App';
import { ToastProvider } from '@/contexts/ToastContext';
import { AuthProvider } from '@/contexts/AuthContext';
import { ProjectProvider } from '@/contexts/ProjectContext';
import { AuthPage } from '@/pages/AuthPage';
import { DEMO_PROJECT_BUNDLE } from '@/data/demoProject';

describe('Paper2Prototype End-to-End UI Workflow', () => {
  it('renders Landing Page with required copy and navigates into Sample Demo Project', async () => {
    window.history.pushState({}, '', '/');
    render(<App />);

    expect(screen.getByText('Turn Research Into Reality.')).toBeInTheDocument();
    expect(
      screen.getByText(/Transform complex academic research papers into practical experiments/i)
    ).toBeInTheDocument();

    // Open Sample Demo Project from landing page
    const demoButton = screen.getByRole('button', { name: /Try Demo: Plant Disease Detection/i });
    fireEvent.click(demoButton);

    // Should navigate to Research Analysis with DEMO DATA badge & extracted fields
    expect(
      await screen.findByText(/Plant Disease Detection Using Deep Learning \(DEMO DATA\)/i)
    ).toBeInTheDocument();
    expect(screen.getAllByText('DEMO DATA').length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText(/9-Stage Research-to-Prototype Pipeline/i)).toBeInTheDocument();
  });

  it('navigates across all demo stages: Blueprint editing, Datasets, Code, Execute, Results, Reproducibility, and Reports', async () => {
    window.history.pushState({}, '', '/');
    render(<App />);

    fireEvent.click(screen.getByRole('button', { name: /Try Demo: Plant Disease Detection/i }));
    await screen.findByText(/Plant Disease Detection Using Deep Learning \(DEMO DATA\)/i);

    // Stage 4: Experiment Blueprint — switch to Beginner and edit title
    fireEvent.click(screen.getByRole('link', { name: /Experiment Blueprint/i }));
    expect(await screen.findByText(/Experiment Blueprint Generator/i)).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /A\. Beginner/i }));
    expect(
      await screen.findByDisplayValue(/Lightweight Leaf Feature Baseline \(Beginner Prototype\)/i)
    ).toBeInTheDocument();

    // Edit CPU hardware requirement (verifies full editability)
    const cpuInput = screen.getByDisplayValue('2+ cores');
    fireEvent.change(cpuInput, { target: { value: '4+ cores' } });
    expect(screen.getByDisplayValue('4+ cores')).toBeInTheDocument();

    // Stage 5: Dataset Finder
    fireEvent.click(screen.getByRole('link', { name: /Dataset Finder/i }));
    expect(await screen.findByText(/PlantVillage \(Kaggle Search\)/i)).toBeInTheDocument();

    // Stage 6: Code Generator
    fireEvent.click(screen.getByRole('link', { name: /Code Generator/i }));
    expect(await screen.findByText(/plant_disease_mobilenetv2_prototype\//i)).toBeInTheDocument();

    // Stage 7: Run Experiment — refuses fake execution
    fireEvent.click(screen.getByRole('link', { name: /Run Experiment/i }));
    fireEvent.click(await screen.findByRole('button', { name: /Run Experiment/i }));
    expect(await screen.findByText(/Paper2Prototype never fakes experiment execution/i)).toBeInTheDocument();

    // Stage 8: Results — honest unexecuted state + paper-reported benchmark reference
    fireEvent.click(screen.getByRole('link', { name: /^Results$/i }));
    expect(
      await screen.findByText(/No Actual Sandbox Execution Results Recorded Yet/i)
    ).toBeInTheDocument();
    expect(screen.getByText('97.4%')).toBeInTheDocument();

    // Reproducibility Checker
    fireEvent.click(screen.getByRole('link', { name: /Reproducibility Checker/i }));
    expect(await screen.findByText('75')).toBeInTheDocument();
    expect(
      screen.getByText(/NOT guaranteed experimental reproducibility/i)
    ).toBeInTheDocument();

    // Stage 9: Reports
    fireEvent.click(screen.getByRole('link', { name: /^Reports$/i }));
    expect(await screen.findByText(/Report Structure Preview \(12 Sections\)/i)).toBeInTheDocument();
  });

  it('allows switching to an ungenerated blueprint level without snapping back', async () => {
    const originalBlueprints = [...DEMO_PROJECT_BUNDLE.blueprints];
    DEMO_PROJECT_BUNDLE.blueprints = originalBlueprints.filter(
      (b) => b.implementation_level === 'intermediate'
    );
    try {
      window.history.pushState({}, '', '/');
      render(<App />);
      fireEvent.click(screen.getByRole('button', { name: /Try Demo: Plant Disease Detection/i }));
      await screen.findByText(/Plant Disease Detection Using Deep Learning \(DEMO DATA\)/i);

      fireEvent.click(screen.getByRole('link', { name: /Experiment Blueprint/i }));
      await screen.findByDisplayValue(/MobileNetV2 Transfer Learning Prototype/i);

      fireEvent.click(screen.getByRole('button', { name: /A\. Beginner/i }));
      await waitFor(() => {
        expect(screen.getByText(/No BEGINNER Blueprint Yet/i)).toBeInTheDocument();
      });
    } finally {
      DEMO_PROJECT_BUNDLE.blueprints = originalBlueprints;
    }
  });

  it('rejects non-PDF files on UploadPaperPage with a clear validation error banner', async () => {
    window.history.pushState({}, '', '/app/upload');
    render(<App />);

    const fileInput = document.querySelector('input[type="file"]') as HTMLInputElement;
    expect(fileInput).toBeTruthy();

    const badFile = new File(['plain text'], 'notes.txt', { type: 'text/plain' });
    fireEvent.change(fileInput, { target: { files: [badFile] } });

    expect(await screen.findByText(/Invalid PDF Upload/i)).toBeInTheDocument();
    expect(screen.getByText(/Invalid file type/i)).toBeInTheDocument();
  });

  it('renders update-password form on /reset-password and signup form on /auth?mode=signup', async () => {
    render(
      <MemoryRouter initialEntries={['/reset-password']}>
        <ToastProvider>
          <AuthProvider>
            <ProjectProvider>
              <Routes>
                <Route path="/reset-password" element={<AuthPage />} />
                <Route path="/auth" element={<AuthPage />} />
              </Routes>
            </ProjectProvider>
          </AuthProvider>
        </ToastProvider>
      </MemoryRouter>
    );

    expect(screen.getByText(/Set a new password/i)).toBeInTheDocument();

    render(
      <MemoryRouter initialEntries={['/auth?mode=signup']}>
        <ToastProvider>
          <AuthProvider>
            <ProjectProvider>
              <Routes>
                <Route path="/auth" element={<AuthPage />} />
              </Routes>
            </ProjectProvider>
          </AuthProvider>
        </ToastProvider>
      </MemoryRouter>
    );

    expect(screen.getByText(/Create your researcher account/i)).toBeInTheDocument();
  });

  it('keeps Explain Code filename bound to the explained file when switching tabs', async () => {
    window.history.pushState({}, '', '/');
    render(<App />);
    fireEvent.click(screen.getByRole('button', { name: /Try Demo: Plant Disease Detection/i }));
    await screen.findByText(/Plant Disease Detection Using Deep Learning \(DEMO DATA\)/i);

    fireEvent.click(screen.getByRole('link', { name: /Code Generator/i }));
    await screen.findByText(/plant_disease_mobilenetv2_prototype\//i);

    fireEvent.click(screen.getByRole('button', { name: /Explain Code/i }));
    expect(await screen.findByText(/Code Explanation — src\/config\.py/i)).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /main\.py/i }));
    expect(screen.getByText(/Code Explanation — src\/config\.py/i)).toBeInTheDocument();
    expect(screen.queryByText(/Code Explanation — main\.py/i)).not.toBeInTheDocument();
  });

  it('syncs RunExperimentPage entrypoint to an existing python file when main.py is absent', async () => {
    const originalFiles = [...DEMO_PROJECT_BUNDLE.generatedCode!.files];
    DEMO_PROJECT_BUNDLE.generatedCode!.files = [
      { path: 'src/train.py', language: 'python', content: 'print("ok")' },
    ];
    try {
      window.history.pushState({}, '', '/');
      render(<App />);
      fireEvent.click(screen.getByRole('button', { name: /Try Demo: Plant Disease Detection/i }));
      await screen.findByText(/Plant Disease Detection Using Deep Learning \(DEMO DATA\)/i);

      fireEvent.click(screen.getByRole('link', { name: /Run Experiment/i }));
      const select = (await screen.findByLabelText(/Entry Python file/i)) as HTMLSelectElement;
      await waitFor(() => {
        expect(select.value).toBe('src/train.py');
      });
    } finally {
      DEMO_PROJECT_BUNDLE.generatedCode!.files = originalFiles;
    }
  });
});

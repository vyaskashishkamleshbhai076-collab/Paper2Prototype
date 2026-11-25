import React from 'react';
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import { AuthProvider } from '@/contexts/AuthContext';
import { ProjectProvider } from '@/contexts/ProjectContext';
import { ToastProvider } from '@/contexts/ToastContext';
import { AppLayout } from '@/components/layout/AppLayout';
import { LandingPage } from '@/pages/LandingPage';
import { AuthPage } from '@/pages/AuthPage';
import { DashboardPage } from '@/pages/DashboardPage';
import { UploadPaperPage } from '@/pages/UploadPaperPage';
import { ResearchAnalysisPage } from '@/pages/ResearchAnalysisPage';
import { ExperimentBlueprintPage } from '@/pages/ExperimentBlueprintPage';
import { DatasetFinderPage } from '@/pages/DatasetFinderPage';
import { CodeGeneratorPage } from '@/pages/CodeGeneratorPage';
import { RunExperimentPage } from '@/pages/RunExperimentPage';
import { ResultsPage } from '@/pages/ResultsPage';
import { ReproducibilityPage } from '@/pages/ReproducibilityPage';
import { ReportsPage } from '@/pages/ReportsPage';
import { ProjectHistoryPage } from '@/pages/ProjectHistoryPage';
import { SettingsPage } from '@/pages/SettingsPage';

export function App() {
  return (
    <BrowserRouter>
      <ToastProvider>
        <AuthProvider>
          <ProjectProvider>
            <Routes>
              <Route path="/" element={<LandingPage />} />
              <Route path="/auth" element={<AuthPage />} />
              <Route path="/reset-password" element={<AuthPage />} />

              <Route path="/app" element={<AppLayout />}>
                <Route index element={<Navigate to="/app/dashboard" replace />} />
                <Route path="dashboard" element={<DashboardPage />} />
                <Route path="upload" element={<UploadPaperPage />} />
                <Route path="analysis" element={<ResearchAnalysisPage />} />
                <Route path="blueprint" element={<ExperimentBlueprintPage />} />
                <Route path="datasets" element={<DatasetFinderPage />} />
                <Route path="code" element={<CodeGeneratorPage />} />
                <Route path="execute" element={<RunExperimentPage />} />
                <Route path="results" element={<ResultsPage />} />
                <Route path="reproducibility" element={<ReproducibilityPage />} />
                <Route path="reports" element={<ReportsPage />} />
                <Route path="history" element={<ProjectHistoryPage />} />
                <Route path="settings" element={<SettingsPage />} />
              </Route>

              <Route path="*" element={<Navigate to="/" replace />} />
            </Routes>
          </ProjectProvider>
        </AuthProvider>
      </ToastProvider>
    </BrowserRouter>
  );
}

export default App;

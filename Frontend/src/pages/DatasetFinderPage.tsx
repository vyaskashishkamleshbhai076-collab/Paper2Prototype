import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Database, ExternalLink, Sparkles, Package, ArrowRight, ShieldCheck, Search } from 'lucide-react';
import { useProject } from '@/contexts/ProjectContext';
import { useToast } from '@/contexts/ToastContext';
import { recommendResourcesApi } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Alert } from '@/components/ui/alert';
import { EmptyState } from '@/components/common/EmptyState';
import { ErrorBanner } from '@/components/common/ErrorBanner';
import { LoadingSpinner } from '@/components/common/LoadingSpinner';

export function DatasetFinderPage() {
  const { activeBundle, refreshActiveBundle } = useProject();
  const { notify } = useToast();
  const navigate = useNavigate();

  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  if (!activeBundle) {
    return (
      <EmptyState
        icon={Database}
        title="No Project Selected"
        description="Analyze a research paper first to discover verified datasets and Python libraries."
        actionLabel="Go to Upload Paper"
        onAction={() => navigate('/app/upload')}
      />
    );
  }

  const { project, analysis } = activeBundle;

  if (!analysis) {
    return (
      <EmptyState
        icon={Database}
        title="Paper Analysis Required"
        description="Run Stage 2 Research Analysis before searching for matching datasets and libraries."
        actionLabel="Go to Research Analysis"
        onAction={() => navigate('/app/analysis')}
      />
    );
  }

  const datasets = analysis.dataset_recommendations || [];
  const libraries = analysis.library_recommendations || [];

  const handleFetchResources = async () => {
    if (project.is_demo) {
      notify('Demo project resources are pre-populated.', { kind: 'info' });
      return;
    }
    setLoading(true);
    setErrorMsg(null);
    try {
      await recommendResourcesApi(project.id);
      await refreshActiveBundle(project.id);
      notify('Verified datasets and PyPI libraries updated', { kind: 'success' });
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Failed to fetch recommendations');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-start">
        <div>
          <div className="mb-2 flex items-center gap-2">
            <Badge>Stage 5 of 9</Badge>
            {project.is_demo && <Badge variant="warning">DEMO DATA</Badge>}
          </div>
          <h1 className="text-2xl font-bold text-white">Dataset & Resource Finder</h1>
          <p className="mt-1 text-sm text-slate-400">
            Queries Hugging Face Hub & PyPI live on the backend and constructs transparent official search links for Kaggle, UCI, and Google Dataset Search—never fabricated URLs.
          </p>
        </div>

        <div className="flex flex-wrap gap-2">
          {!project.is_demo && (
            <Button variant="outline" onClick={handleFetchResources} disabled={loading}>
              <Sparkles className="h-4 w-4" />
              {datasets.length > 0 ? 'Refresh Recommendations' : 'Find Datasets & Libraries'}
            </Button>
          )}
          <Button onClick={() => navigate('/app/code')}>
            Next: Generate Python Code
            <ArrowRight className="h-4 w-4" />
          </Button>
        </div>
      </div>

      <Alert variant="info">
        Link Integrity Guarantee: Direct dataset links marked <strong>Verified</strong> were confirmed via live Hugging Face / PyPI API lookup. Links marked <strong>Official Search Link</strong> open the repository&apos;s live search query rather than guessing a potentially broken URL.
      </Alert>

      {errorMsg && <ErrorBanner message={errorMsg} onRetry={handleFetchResources} />}

      {loading && (
        <LoadingSpinner
          title="Querying Hugging Face Hub & PyPI Registry..."
          subtitle="Matching datasets across Hugging Face, Kaggle, UCI, Google Dataset Search, and verifying Python package docs."
        />
      )}

      {!loading && datasets.length === 0 && libraries.length === 0 && (
        <EmptyState
          icon={Database}
          title="No Dataset Recommendations Fetched Yet"
          description="Click below to discover verified datasets and Python packages tailored to this research paper."
          actionLabel="Discover Datasets & Libraries"
          onAction={handleFetchResources}
        />
      )}

      {!loading && datasets.length > 0 && (
        <div className="space-y-4">
          <h2 className="text-lg font-semibold text-white">Recommended Datasets</h2>
          <div className="grid gap-4 md:grid-cols-2">
            {datasets.map((ds, i) => (
              <Card key={i}>
                <CardHeader className="pb-3">
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <CardTitle>{ds.name}</CardTitle>
                    {ds.verification_status === 'verified' ? (
                      <Badge variant="success">
                        <ShieldCheck className="h-3 w-3" />
                        Verified Hub Match
                      </Badge>
                    ) : ds.verification_status === 'search_link' ? (
                      <Badge variant="info">
                        <Search className="h-3 w-3" />
                        Official Search Link
                      </Badge>
                    ) : (
                      <Badge variant="warning">Unverified Link</Badge>
                    )}
                  </div>
                  <CardDescription>
                    Source: {ds.source} • Format: {ds.format}
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-3 text-sm">
                  <p className="text-slate-300">{ds.description}</p>
                  <p className="text-xs text-slate-400">
                    <strong className="text-slate-300">Relevance:</strong> {ds.relevance}
                  </p>
                  {ds.url ? (
                    <a
                      href={ds.url}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex items-center gap-1.5 text-xs font-medium text-violet-400 hover:text-violet-300 hover:underline"
                    >
                      Open in {ds.source}
                      <ExternalLink className="h-3.5 w-3.5" />
                    </a>
                  ) : (
                    <span className="text-xs text-slate-500">No verified public URL available</span>
                  )}
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      )}

      {!loading && libraries.length > 0 && (
        <div className="space-y-4">
          <h2 className="text-lg font-semibold text-white">Recommended Python Libraries & Documentation</h2>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {libraries.map((lib, i) => (
              <Card key={i}>
                <CardHeader className="pb-2">
                  <div className="flex items-center justify-between gap-2">
                    <CardTitle className="flex items-center gap-2 text-base">
                      <Package className="h-4 w-4 text-violet-400" />
                      {lib.name}
                    </CardTitle>
                    <Badge variant={lib.verification_status === 'verified' ? 'success' : 'secondary'}>
                      {lib.verification_status === 'verified' ? 'PyPI Verified' : 'Package'}
                    </Badge>
                  </div>
                  <CardDescription>{lib.category}</CardDescription>
                </CardHeader>
                <CardContent className="space-y-2.5 text-xs">
                  <p className="text-slate-300">{lib.description}</p>
                  <code className="block rounded bg-navy-950 px-2.5 py-1.5 font-mono text-violet-300">
                    pip install {lib.pip_package}
                  </code>
                  {lib.docs_url && (
                    <a
                      href={lib.docs_url}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex items-center gap-1 text-violet-400 hover:underline"
                    >
                      PyPI Package Page <ExternalLink className="h-3 w-3" />
                    </a>
                  )}
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

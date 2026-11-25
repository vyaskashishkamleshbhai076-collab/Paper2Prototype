import React from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  Atom,
  ArrowRight,
  FileUp,
  Microscope,
  Compass,
  Database,
  Code2,
  Play,
  BarChart3,
  ShieldCheck,
  FileText,
  Sparkles,
  CheckCircle2,
  Layers,
  Lock,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { useAuth } from '@/contexts/AuthContext';
import { useProject } from '@/contexts/ProjectContext';

const HOW_IT_WORKS = [
  { step: '01', title: 'Upload Academic PDF', desc: 'Drag & drop papers with page-level extraction, preview, and OCR support.', icon: FileUp },
  { step: '02', title: 'AI Paper Analysis', desc: 'Extract 14 structured fields with page citations—zero fabricated facts.', icon: Microscope },
  { step: '03', title: 'Methodology Extraction', desc: 'Map equations, algorithms, hyperparameters, and pipeline stages.', icon: Layers },
  { step: '04', title: 'Experiment Blueprint', desc: 'Editable Beginner, Intermediate, and Advanced implementation plans.', icon: Compass },
  { step: '05', title: 'Dataset & Libraries', desc: 'Discover verified Hugging Face, Kaggle, UCI, and PyPI resources.', icon: Database },
  { step: '06', title: 'Python Starter Project', desc: 'Modular code, requirements.txt, and README in Monaco Editor.', icon: Code2 },
  { step: '07', title: 'Sandboxed Execution', desc: 'Isolated external container execution with CPU/memory/timeout limits.', icon: Play },
  { step: '08', title: 'Result & Reproducibility', desc: 'Compare actual measured runs against paper claims + score out of 100.', icon: BarChart3 },
  { step: '09', title: 'Technical PDF Report', desc: 'Export a complete 12-section report and downloadable ZIP project.', icon: FileText },
];

const KEY_FEATURES = [
  {
    icon: ShieldCheck,
    title: 'Research Reproducibility Score',
    desc: 'Transparent 100-point rubric auditing dataset info, hyperparameters, dependencies, and environment documentation.',
  },
  {
    icon: Lock,
    title: 'Isolated Sandbox Security',
    desc: 'AI-generated Python code is never executed on app servers—it runs only in an isolated, network-restricted container or locally.',
  },
  {
    icon: Microscope,
    title: 'Evidence-First Extraction',
    desc: 'Strictly separates verbatim paper facts with page numbers from AI-generated recommendations.',
  },
  {
    icon: Code2,
    title: 'Multi-File Monaco Workspace',
    desc: 'Edit generated Python modules, inspect code explanations, and export the entire starter repository as a ZIP.',
  },
];

export function LandingPage() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { openDemoProject } = useProject();

  const handleOpenDemo = () => {
    openDemoProject();
    navigate('/app/analysis');
  };

  return (
    <div className="min-h-screen bg-navy-950 text-slate-100">
      {/* Top Navbar */}
      <header className="sticky top-0 z-40 border-b border-slate-800/70 bg-navy-950/85 backdrop-blur-md">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-3.5 sm:px-6">
          <Link to="/" className="flex items-center gap-2.5">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-violet-600 to-indigo-500 text-white">
              <Atom className="h-5 w-5" />
            </div>
            <div>
              <span className="text-base font-bold tracking-tight text-white">Paper2Prototype</span>
              <p className="hidden text-[11px] text-violet-300 sm:block">From Research Paper to Working Prototype.</p>
            </div>
          </Link>

          <div className="flex items-center gap-2.5">
            <Button variant="ghost" size="sm" onClick={handleOpenDemo}>
              <Sparkles className="h-4 w-4 text-violet-400" />
              Live Demo
            </Button>
            {user ? (
              <Button size="sm" onClick={() => navigate('/app/dashboard')}>
                Open Dashboard
                <ArrowRight className="h-4 w-4" />
              </Button>
            ) : (
              <>
                <Button variant="outline" size="sm" onClick={() => navigate('/auth')}>
                  Sign In
                </Button>
                <Button size="sm" onClick={() => navigate('/auth?mode=signup')}>
                  Get Started
                </Button>
              </>
            )}
          </div>
        </div>
      </header>

      {/* Hero Section */}
      <section className="relative overflow-hidden border-b border-slate-800/60 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-violet-900/30 via-navy-950 to-navy-950 py-20 sm:py-28">
        <div className="mx-auto max-w-5xl px-4 text-center sm:px-6">
          <Badge className="mb-5 px-3.5 py-1 text-xs">
            <Sparkles className="h-3.5 w-3.5" />
            From Research Paper to Working Prototype.
          </Badge>
          <h1 className="bg-gradient-to-r from-white via-slate-100 to-violet-300 bg-clip-text text-4xl font-extrabold tracking-tight text-transparent sm:text-6xl">
            Turn Research Into Reality.
          </h1>
          <p className="mx-auto mt-6 max-w-2xl text-base leading-relaxed text-slate-300 sm:text-lg">
            Transform complex academic research papers into practical experiments, executable code and reproducible prototypes with AI.
          </p>

          <div className="mt-9 flex flex-wrap items-center justify-center gap-4">
            <Button size="lg" onClick={() => navigate(user ? '/app/dashboard' : '/auth?mode=signup')}>
              Get Started
              <ArrowRight className="h-4 w-4" />
            </Button>
            <Button size="lg" variant="outline" onClick={() => navigate(user ? '/app/upload' : '/auth')}>
              <FileUp className="h-4 w-4 text-violet-400" />
              Upload Research Paper
            </Button>
            <Button size="lg" variant="secondary" onClick={handleOpenDemo}>
              <Microscope className="h-4 w-4 text-violet-300" />
              Try Demo: Plant Disease Detection
            </Button>
          </div>
        </div>
      </section>

      {/* How It Works */}
      <section className="mx-auto max-w-7xl px-4 py-20 sm:px-6">
        <div className="mb-12 text-center">
          <Badge variant="secondary" className="mb-3">End-to-End 9-Stage Pipeline</Badge>
          <h2 className="text-3xl font-bold text-white">How It Works</h2>
          <p className="mt-2 text-slate-400">
            Every workflow stage persists your research artifacts and lets you revisit or refine any step.
          </p>
        </div>

        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {HOW_IT_WORKS.map((item) => {
            const Icon = item.icon;
            return (
              <Card key={item.step} className="border-slate-800/80 transition-colors hover:border-violet-500/40">
                <CardContent className="pt-5">
                  <div className="mb-3 flex items-center justify-between">
                    <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-violet-600/15 text-violet-400">
                      <Icon className="h-5 w-5" />
                    </div>
                    <span className="font-mono text-xs font-semibold text-violet-400">STAGE {item.step}</span>
                  </div>
                  <h3 className="text-base font-semibold text-white">{item.title}</h3>
                  <p className="mt-1.5 text-sm text-slate-400">{item.desc}</p>
                </CardContent>
              </Card>
            );
          })}
        </div>
      </section>

      {/* Key Features & Benefits */}
      <section className="border-y border-slate-800/70 bg-navy-900/40 py-20">
        <div className="mx-auto max-w-7xl px-4 sm:px-6">
          <div className="grid gap-12 lg:grid-cols-2">
            <div>
              <Badge className="mb-3">Key Features</Badge>
              <h2 className="text-3xl font-bold text-white">Built for Scientific Rigor & Security</h2>
              <p className="mt-3 text-slate-400">
                Unlike generic chat wrappers, Paper2Prototype anchors every claim to page numbers, verifies external dataset/package links, and isolates code execution.
              </p>
              <div className="mt-8 grid gap-4 sm:grid-cols-2">
                {KEY_FEATURES.map((f) => {
                  const Icon = f.icon;
                  return (
                    <Card key={f.title} className="bg-navy-950/70">
                      <CardContent className="pt-5">
                        <Icon className="mb-2.5 h-5 w-5 text-violet-400" />
                        <h3 className="text-sm font-semibold text-white">{f.title}</h3>
                        <p className="mt-1 text-xs leading-relaxed text-slate-400">{f.desc}</p>
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            </div>

            <div className="flex flex-col justify-center">
              <Badge variant="success" className="mb-3 w-fit">Benefits for Researchers & Students</Badge>
              <h2 className="text-3xl font-bold text-white">Accelerate Literature-to-Lab Velocity</h2>
              <ul className="mt-6 space-y-4">
                {[
                  'Cut paper comprehension and architecture mapping time from days to minutes.',
                  'Switch seamlessly between Beginner, Intermediate, and Advanced experiment tiers.',
                  'Identify missing hyperparameters and dataset gaps before writing training code.',
                  'Export clean modular Python projects and 12-section technical PDF reports.',
                ].map((benefit) => (
                  <li key={benefit} className="flex items-start gap-3 text-sm text-slate-300">
                    <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-emerald-400" />
                    <span>{benefit}</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      </section>

      {/* Example Workflow */}
      <section className="mx-auto max-w-5xl px-4 py-20 sm:px-6">
        <Card className="border-violet-500/40 bg-gradient-to-br from-navy-900 via-navy-900 to-violet-950/40">
          <CardContent className="p-8 sm:p-10">
            <div className="flex flex-col justify-between gap-6 md:flex-row md:items-center">
              <div className="space-y-3">
                <Badge variant="warning">DEMO DATA — Example Workflow</Badge>
                <h2 className="text-2xl font-bold text-white">
                  Plant Disease Detection Using Deep Learning
                </h2>
                <p className="max-w-xl text-sm text-slate-300">
                  Inspect a complete sample project covering MobileNetV2 & ResNet-50 analysis, 3 implementation blueprints, PlantVillage dataset links, modular PyTorch code, and a 75/100 reproducibility audit.
                </p>
              </div>
              <Button size="lg" onClick={handleOpenDemo} className="shrink-0">
                Explore Demo Workflow
                <ArrowRight className="h-4 w-4" />
              </Button>
            </div>
          </CardContent>
        </Card>
      </section>

      {/* Footer */}
      <footer className="border-t border-slate-800/80 bg-navy-950 py-8">
        <div className="mx-auto flex max-w-7xl flex-col items-center justify-between gap-4 px-4 text-xs text-slate-500 sm:flex-row sm:px-6">
          <div className="flex items-center gap-2 text-slate-300">
            <Atom className="h-4 w-4 text-violet-400" />
            <span className="font-semibold">Paper2Prototype</span>
            <span>— From Research Paper to Working Prototype.</span>
          </div>
          <p>React + TypeScript • Tailwind CSS • Supabase • Google Gemini • Monaco • Recharts</p>
        </div>
      </footer>
    </div>
  );
}

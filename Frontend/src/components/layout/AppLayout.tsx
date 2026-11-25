import React, { useState } from 'react';
import { Link, NavLink, Outlet, useNavigate } from 'react-router-dom';
import {
  LayoutDashboard,
  FileUp,
  Microscope,
  Compass,
  Database,
  Code2,
  Play,
  BarChart3,
  ShieldCheck,
  FileText,
  History,
  Settings,
  LogOut,
  Menu,
  X,
  Atom,
  Sparkles,
  AlertTriangle,
} from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { useProject } from '@/contexts/ProjectContext';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { WorkflowStepper } from './WorkflowStepper';
import { cn } from '@/lib/utils';

const NAV_ITEMS = [
  { to: '/app/dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { to: '/app/upload', label: 'Upload Paper', icon: FileUp },
  { to: '/app/analysis', label: 'Research Analysis', icon: Microscope },
  { to: '/app/blueprint', label: 'Experiment Blueprint', icon: Compass },
  { to: '/app/datasets', label: 'Dataset Finder', icon: Database },
  { to: '/app/code', label: 'Code Generator', icon: Code2 },
  { to: '/app/execute', label: 'Run Experiment', icon: Play },
  { to: '/app/results', label: 'Results', icon: BarChart3 },
  { to: '/app/reproducibility', label: 'Reproducibility Checker', icon: ShieldCheck },
  { to: '/app/reports', label: 'Reports', icon: FileText },
  { to: '/app/history', label: 'Project History', icon: History },
  { to: '/app/settings', label: 'Settings', icon: Settings },
];

export function AppLayout() {
  const { user, profile, signOut, isConfigured } = useAuth();
  const { activeBundle, openDemoProject } = useProject();
  const navigate = useNavigate();
  const [mobileOpen, setMobileOpen] = useState(false);

  const handleLogout = async () => {
    await signOut();
    navigate('/');
  };

  const sidebarContent = (
    <div className="flex h-full flex-col">
      <div className="flex items-center justify-between border-b border-slate-800/80 px-4 py-4">
        <Link to="/" className="flex items-center gap-2.5">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-violet-600 to-indigo-500 text-white shadow-lg shadow-violet-900/40">
            <Atom className="h-5 w-5" />
          </div>
          <div>
            <p className="text-sm font-bold tracking-tight text-white">Paper2Prototype</p>
            <p className="text-[10px] text-violet-300">Research → Working Code</p>
          </div>
        </Link>
        <button
          type="button"
          className="rounded-lg p-1 text-slate-400 hover:bg-navy-800 lg:hidden"
          onClick={() => setMobileOpen(false)}
          aria-label="Close navigation"
        >
          <X className="h-5 w-5" />
        </button>
      </div>

      <nav className="flex-1 space-y-1 overflow-y-auto px-3 py-4">
        {NAV_ITEMS.map((item) => {
          const Icon = item.icon;
          return (
            <NavLink
              key={item.to}
              to={item.to}
              onClick={() => setMobileOpen(false)}
              className={({ isActive }) =>
                cn(
                  'flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors',
                  isActive
                    ? 'bg-violet-600/20 text-white border border-violet-500/40'
                    : 'text-slate-400 hover:bg-navy-800/70 hover:text-slate-100'
                )
              }
            >
              <Icon className="h-4 w-4 shrink-0 text-violet-400" />
              <span className="truncate">{item.label}</span>
            </NavLink>
          );
        })}
      </nav>

      <div className="border-t border-slate-800/80 p-3">
        <Button
          variant="outline"
          size="sm"
          className="mb-3 w-full justify-start border-violet-500/30 text-violet-200"
          onClick={() => {
            openDemoProject();
            navigate('/app/analysis');
            setMobileOpen(false);
          }}
        >
          <Sparkles className="h-3.5 w-3.5 text-violet-400" />
          Load Sample Demo Project
        </Button>

        {user ? (
          <div className="flex items-center justify-between gap-2 rounded-lg bg-navy-950/70 px-3 py-2">
            <div className="min-w-0">
              <p className="truncate text-xs font-medium text-white">
                {profile?.full_name || user.email}
              </p>
              <p className="truncate text-[11px] text-slate-400">{user.email}</p>
            </div>
            <button
              type="button"
              onClick={handleLogout}
              title="Sign out"
              className="rounded-md p-1.5 text-slate-400 hover:bg-navy-800 hover:text-rose-300"
            >
              <LogOut className="h-4 w-4" />
            </button>
          </div>
        ) : (
          <Button className="w-full" size="sm" onClick={() => navigate('/auth')}>
            Sign In / Create Account
          </Button>
        )}
      </div>
    </div>
  );

  return (
    <div className="flex min-h-screen bg-navy-950 text-slate-100">
      {/* Desktop Sidebar */}
      <aside className="hidden w-64 shrink-0 border-r border-slate-800/80 bg-navy-900/90 lg:block">
        <div className="sticky top-0 h-screen">{sidebarContent}</div>
      </aside>

      {/* Mobile Drawer */}
      {mobileOpen && (
        <div className="fixed inset-0 z-50 flex lg:hidden">
          <div className="fixed inset-0 bg-black/70" onClick={() => setMobileOpen(false)} />
          <aside className="relative z-10 w-64 border-r border-slate-800 bg-navy-900">{sidebarContent}</aside>
        </div>
      )}

      {/* Main Content */}
      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-30 flex items-center justify-between gap-3 border-b border-slate-800/80 bg-navy-950/90 px-4 py-3 backdrop-blur-md lg:px-6">
          <div className="flex min-w-0 items-center gap-3">
            <button
              type="button"
              onClick={() => setMobileOpen(true)}
              className="rounded-lg p-1.5 text-slate-300 hover:bg-navy-800 lg:hidden"
              aria-label="Open navigation"
            >
              <Menu className="h-5 w-5" />
            </button>
            {activeBundle ? (
              <div className="flex min-w-0 items-center gap-2">
                <span className="truncate text-sm font-semibold text-white">
                  {activeBundle.project.title}
                </span>
                {activeBundle.project.is_demo && (
                  <Badge variant="warning" className="shrink-0">
                    DEMO DATA
                  </Badge>
                )}
              </div>
            ) : (
              <span className="text-sm text-slate-400">No active project selected</span>
            )}
          </div>

          <div className="flex items-center gap-2">
            {!isConfigured && (
              <Badge variant="warning" className="hidden sm:inline-flex">
                <AlertTriangle className="h-3 w-3" />
                Supabase .env not configured
              </Badge>
            )}
            <Button size="sm" variant="outline" onClick={() => navigate('/app/upload')}>
              <FileUp className="h-3.5 w-3.5" />
              New Paper
            </Button>
          </div>
        </header>

        <main className="mx-auto w-full max-w-7xl flex-1 space-y-5 p-4 lg:p-6">
          {activeBundle && <WorkflowStepper project={activeBundle.project} />}
          <Outlet />
        </main>
      </div>
    </div>
  );
}

import React, { useEffect, useState } from 'react';
import { Link, useLocation, useNavigate, useSearchParams } from 'react-router-dom';
import { Atom, ArrowLeft, Loader2, Sparkles } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { useProject } from '@/contexts/ProjectContext';
import { useToast } from '@/contexts/ToastContext';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Alert } from '@/components/ui/alert';

type AuthMode = 'login' | 'signup' | 'forgot' | 'update-password';

const VALID_MODES: AuthMode[] = ['login', 'signup', 'forgot', 'update-password'];

export function AuthPage() {
  const [searchParams] = useSearchParams();
  const location = useLocation();
  const { user, isConfigured, isPasswordRecovery, signIn, signUp, sendPasswordReset, updatePassword } = useAuth();
  const { openDemoProject } = useProject();
  const { notify } = useToast();
  const navigate = useNavigate();

  const resolveModeFromLocation = (): AuthMode => {
    if (location.pathname === '/reset-password' || isPasswordRecovery) {
      return 'update-password';
    }
    const qMode = searchParams.get('mode') as AuthMode | null;
    return qMode && VALID_MODES.includes(qMode) ? qMode : 'login';
  };

  const [mode, setMode] = useState<AuthMode>(resolveModeFromLocation);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [infoMsg, setInfoMsg] = useState<string | null>(null);

  useEffect(() => {
    if (location.pathname === '/reset-password' || isPasswordRecovery) {
      setMode('update-password');
      return;
    }
    const qMode = searchParams.get('mode') as AuthMode | null;
    if (qMode && VALID_MODES.includes(qMode)) {
      setMode(qMode);
    }
  }, [location.pathname, searchParams, isPasswordRecovery]);

  useEffect(() => {
    if (user && mode !== 'update-password' && !isPasswordRecovery && location.pathname !== '/reset-password') {
      navigate('/app/dashboard', { replace: true });
    }
  }, [user, mode, isPasswordRecovery, location.pathname, navigate]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    setInfoMsg(null);
    setSubmitting(true);

    try {
      if (mode === 'login') {
        await signIn(email, password);
        notify('Welcome back!', { kind: 'success' });
        navigate('/app/dashboard');
      } else if (mode === 'signup') {
        const res = await signUp(email, password, fullName);
        if (res.needsEmailConfirm) {
          setInfoMsg('Account created! Please check your email to confirm your address before signing in.');
        } else {
          notify('Account created successfully!', { kind: 'success' });
          navigate('/app/dashboard');
        }
      } else if (mode === 'forgot') {
        await sendPasswordReset(email);
        setInfoMsg('Password reset email sent. Check your inbox for the recovery link.');
      } else if (mode === 'update-password') {
        await updatePassword(password);
        notify('Password updated!', { kind: 'success' });
        navigate('/app/dashboard');
      }
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Authentication error');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-navy-950 px-4 py-12">
      <div className="mb-6 flex w-full max-w-md items-center justify-between">
        <Link to="/" className="inline-flex items-center gap-1.5 text-sm text-slate-400 hover:text-white">
          <ArrowLeft className="h-4 w-4" />
          Back to Home
        </Link>
        <div className="flex items-center gap-2">
          <Atom className="h-5 w-5 text-violet-400" />
          <span className="font-bold text-white">Paper2Prototype</span>
        </div>
      </div>

      <Card className="w-full max-w-md border-slate-800">
        <CardHeader>
          <CardTitle>
            {mode === 'login' && 'Sign in to your workspace'}
            {mode === 'signup' && 'Create your researcher account'}
            {mode === 'forgot' && 'Reset your password'}
            {mode === 'update-password' && 'Set a new password'}
          </CardTitle>
          <CardDescription>
            {mode === 'login' && 'Access your uploaded papers, blueprints, and generated code.'}
            {mode === 'signup' && 'Start converting academic papers into working prototypes.'}
            {mode === 'forgot' && 'We will email you a secure password recovery link.'}
            {mode === 'update-password' && 'Choose a strong password for your account.'}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {!isConfigured && (
            <Alert variant="warning">
              Supabase environment variables (<code>VITE_SUPABASE_URL</code>, <code>VITE_SUPABASE_ANON_KEY</code>) are not configured in <code>frontend/.env</code>. You can still explore the Sample Demo Project below!
            </Alert>
          )}

          {errorMsg && <Alert variant="destructive">{errorMsg}</Alert>}
          {infoMsg && <Alert variant="success">{infoMsg}</Alert>}

          <form onSubmit={handleSubmit} className="space-y-3.5">
            {mode === 'signup' && (
              <div>
                <label className="mb-1.5 block text-xs font-medium text-slate-300">Full Name</label>
                <Input
                  type="text"
                  required
                  placeholder="Dr. Ada Lovelace"
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                />
              </div>
            )}

            {mode !== 'update-password' && (
              <div>
                <label className="mb-1.5 block text-xs font-medium text-slate-300">Email Address</label>
                <Input
                  type="email"
                  required
                  placeholder="researcher@university.edu"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                />
              </div>
            )}

            {mode !== 'forgot' && (
              <div>
                <label className="mb-1.5 block text-xs font-medium text-slate-300">Password</label>
                <Input
                  type="password"
                  required
                  minLength={6}
                  placeholder="Minimum 6 characters"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                />
              </div>
            )}

            <Button type="submit" className="w-full" disabled={submitting || !isConfigured}>
              {submitting && <Loader2 className="h-4 w-4 animate-spin" />}
              {mode === 'login' && 'Sign In'}
              {mode === 'signup' && 'Create Account'}
              {mode === 'forgot' && 'Send Reset Link'}
              {mode === 'update-password' && 'Update Password'}
            </Button>
          </form>

          <div className="flex flex-wrap items-center justify-between gap-2 pt-2 text-xs text-slate-400">
            {mode === 'login' && (
              <>
                <button type="button" onClick={() => setMode('signup')} className="hover:text-violet-300">
                  Need an account? Sign up
                </button>
                <button type="button" onClick={() => setMode('forgot')} className="hover:text-violet-300">
                  Forgot password?
                </button>
              </>
            )}
            {(mode === 'signup' || mode === 'forgot') && (
              <button type="button" onClick={() => setMode('login')} className="hover:text-violet-300">
                Back to Sign In
              </button>
            )}
          </div>

          <div className="border-t border-slate-800 pt-4">
            <Button
              type="button"
              variant="outline"
              className="w-full border-violet-500/30 text-violet-200"
              onClick={() => {
                openDemoProject();
                navigate('/app/dashboard');
              }}
            >
              <Sparkles className="h-4 w-4 text-violet-400" />
              Explore Sample Demo Project (No Login Needed)
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

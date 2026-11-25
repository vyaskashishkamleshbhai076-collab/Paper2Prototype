import React, { useEffect, useState } from 'react';
import { Settings, User, Shield, KeyRound, CheckCircle2, AlertTriangle } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/contexts/ToastContext';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';

export function SettingsPage() {
  const { user, profile, isConfigured, updateProfile, updatePassword } = useAuth();
  const { notify } = useToast();

  const [fullName, setFullName] = useState('');
  const [institution, setInstitution] = useState('');
  const [role, setRole] = useState('researcher');
  const [newPassword, setNewPassword] = useState('');
  const [savingProfile, setSavingProfile] = useState(false);
  const [savingPass, setSavingPass] = useState(false);

  useEffect(() => {
    if (profile) {
      setFullName(profile.full_name || '');
      setInstitution(profile.institution || '');
      setRole(profile.role || 'researcher');
    }
  }, [profile]);

  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    setSavingProfile(true);
    try {
      await updateProfile({ full_name: fullName, institution, role });
      notify('Profile updated', { kind: 'success' });
    } catch (err) {
      notify('Profile update failed', {
        description: err instanceof Error ? err.message : 'Unable to save profile',
        kind: 'error',
      });
    } finally {
      setSavingProfile(false);
    }
  };

  const handlePasswordChange = async (e: React.FormEvent) => {
    e.preventDefault();
    setSavingPass(true);
    try {
      await updatePassword(newPassword);
      setNewPassword('');
      notify('Password updated successfully', { kind: 'success' });
    } catch (err) {
      notify('Password update failed', {
        description: err instanceof Error ? err.message : 'Unable to change password',
        kind: 'error',
      });
    } finally {
      setSavingPass(false);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="flex items-center gap-2 text-2xl font-bold text-white">
          <Settings className="h-6 w-6 text-violet-400" />
          Settings & Environment
        </h1>
        <p className="mt-1 text-sm text-slate-400">
          Manage your researcher profile, account security, and backend integration status.
        </p>
      </div>

      {/* Profile Settings */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <User className="h-4 w-4 text-violet-400" />
            Researcher Profile
          </CardTitle>
          <CardDescription>
            {user ? `Signed in as ${user.email}` : 'Sign in to customize and persist your profile.'}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSaveProfile} className="grid gap-4 sm:grid-cols-3">
            <div>
              <label className="mb-1.5 block text-xs text-slate-400">Full Name</label>
              <Input
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                placeholder="Dr. Grace Hopper"
                disabled={!user}
              />
            </div>
            <div>
              <label className="mb-1.5 block text-xs text-slate-400">Institution / Lab</label>
              <Input
                value={institution}
                onChange={(e) => setInstitution(e.target.value)}
                placeholder="University / Research Lab"
                disabled={!user}
              />
            </div>
            <div>
              <label className="mb-1.5 block text-xs text-slate-400">Role</label>
              <select
                value={role}
                onChange={(e) => setRole(e.target.value)}
                disabled={!user}
                className="h-10 w-full rounded-lg border border-slate-700 bg-navy-950 px-3 text-sm text-slate-100"
              >
                <option value="student">Student</option>
                <option value="researcher">Researcher</option>
                <option value="developer">ML Developer</option>
              </select>
            </div>
            <div className="sm:col-span-3">
              <Button type="submit" disabled={!user || savingProfile}>
                {savingProfile ? 'Saving...' : 'Save Profile'}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>

      {/* Password Update */}
      {user && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <KeyRound className="h-4 w-4 text-violet-400" />
              Security & Password
            </CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={handlePasswordChange} className="flex flex-wrap items-end gap-3">
              <div className="w-full max-w-xs">
                <label className="mb-1.5 block text-xs text-slate-400">New Password</label>
                <Input
                  type="password"
                  minLength={6}
                  required
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  placeholder="Minimum 6 characters"
                />
              </div>
              <Button type="submit" variant="outline" disabled={savingPass}>
                {savingPass ? 'Updating...' : 'Update Password'}
              </Button>
            </form>
          </CardContent>
        </Card>
      )}

      {/* Backend & Security Architecture Status */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Shield className="h-4 w-4 text-emerald-400" />
            Server-Side Secrets & Sandbox Setup
          </CardTitle>
          <CardDescription>
            All AI keys (Google Gemini) and execution credentials reside strictly on Supabase Edge Functions—never in frontend code.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3 text-xs">
          <div className="flex items-center justify-between rounded-lg border border-slate-800 bg-navy-950/60 p-3">
            <span>
              Supabase Client Connection (<code className="text-violet-300">VITE_SUPABASE_URL</code> &amp;{' '}
              <code className="text-violet-300">VITE_SUPABASE_ANON_KEY</code>)
            </span>
            {isConfigured ? (
              <Badge variant="success">
                <CheckCircle2 className="h-3 w-3" />
                Configured
              </Badge>
            ) : (
              <Badge variant="warning">
                <AlertTriangle className="h-3 w-3" />
                Not Configured
              </Badge>
            )}
          </div>
          <div className="rounded-lg border border-slate-800 bg-navy-950 p-3 font-mono text-slate-300">
            <p className="text-violet-300"># Configure Edge Function Secrets via Supabase CLI:</p>
            <p>supabase secrets set GEMINI_API_KEY=your_gemini_key</p>
            <p>supabase secrets set SANDBOX_API_URL=https://your-sandbox-runner.example.com</p>
            <p>supabase secrets set SANDBOX_API_KEY=your_sandbox_secret</p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

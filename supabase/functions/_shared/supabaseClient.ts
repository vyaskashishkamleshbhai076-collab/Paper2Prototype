import { createClient, SupabaseClient, User } from 'https://esm.sh/@supabase/supabase-js@2.45.0';

export async function getAuthenticatedClient(req: Request): Promise<{
  supabase: SupabaseClient;
  user: User;
}> {
  const authHeader = req.headers.get('Authorization');
  if (!authHeader) {
    throw new Error('Missing Authorization header');
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL');
  const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY');

  if (!supabaseUrl || !supabaseAnonKey) {
    throw new Error('Supabase server environment variables are not configured');
  }

  const supabase = createClient(supabaseUrl, supabaseAnonKey, {
    global: { headers: { Authorization: authHeader } },
  });

  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();

  if (error || !user) {
    throw new Error('Unauthorized: invalid or expired session');
  }

  return { supabase, user };
}

export async function assertProjectOwnership(
  supabase: SupabaseClient,
  projectId: string,
  userId: string
): Promise<void> {
  const { data, error } = await supabase
    .from('research_projects')
    .select('id, user_id')
    .eq('id', projectId)
    .eq('user_id', userId)
    .single();

  if (error || !data) {
    throw new Error('Project not found or access denied');
  }
}

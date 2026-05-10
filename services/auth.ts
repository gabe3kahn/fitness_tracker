import { supabase } from './supabase';

export async function signIn(email: string, password: string) {
  return supabase.auth.signInWithPassword({ email, password });
}

export async function signUp(email: string, password: string, username: string) {
  return supabase.auth.signUp({
    email,
    password,
    options: { data: { username } },
  });
}

export async function signOut() {
  return supabase.auth.signOut();
}

export async function createProfile(userId: string, username: string, displayName: string) {
  return supabase.from('profiles').insert({
    id: userId,
    username,
    display_name: displayName,
  });
}

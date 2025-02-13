import { supabase } from './supabase';

export async function createInitialUser() {
  const email = 'mirza.ovi8@gmail.com';
  const password = 'P@ssw0rd2025!'; // Strong password with special chars, numbers, and mixed case

  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      emailRedirectTo: `${window.location.origin}/login`
    }
  });

  if (error) {
    console.error('Error creating user:', error.message);
    return { error };
  }

  return { data };
}
import { createClient } from "@/lib/supabase/server";

export function apiError(code: string, message: string, status: number) {
  return Response.json({ error: { code, message } }, { status });
}

export async function authenticatedClient() {
  const client = await createClient();
  const { data, error } = await client.auth.getUser();
  if (error || !data.user) return null;
  return client;
}

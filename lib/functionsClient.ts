// Thin drop-in replacement for `supabase.functions.invoke(name, { body })`,
// pointed at our own Next.js API routes instead of Supabase Edge Functions.
export async function invokeFunction<T = unknown>(
  name: string,
  options: { body: unknown },
): Promise<{ data: T | null; error: Error | null }> {
  try {
    const res = await fetch(`/api/${name}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(options.body),
    });
    const json = await res.json().catch(() => ({}));
    if (!res.ok) {
      return { data: null, error: new Error(json?.error || `Request failed (${res.status})`) };
    }
    return { data: json as T, error: null };
  } catch (e) {
    return { data: null, error: e instanceof Error ? e : new Error("Network error") };
  }
}

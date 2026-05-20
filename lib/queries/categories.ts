import type { SupabaseClient } from "@supabase/supabase-js";

export async function getCategories(supabase: SupabaseClient) {
  return supabase
    .from("archive_categories")
    .select("*")
    .order("id", { ascending: true });
}
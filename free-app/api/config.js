function isValidSupabaseUrl(value) {
  try {
    const url = new URL(value);
    return url.protocol === "https:" && (url.hostname.endsWith(".supabase.co") || url.hostname.endsWith(".supabase.net"));
  } catch {
    return false;
  }
}

function isPublicKey(value) {
  return typeof value === "string" && (value.startsWith("sb_publishable_") || value.split(".").length === 3);
}

export default function handler(_request, response) {
  const supabaseUrl = String(process.env.SUPABASE_URL || "").replace(/\/$/, "");
  const supabasePublishableKey = process.env.SUPABASE_PUBLISHABLE_KEY || process.env.SUPABASE_ANON_KEY || "";

  if (!isValidSupabaseUrl(supabaseUrl) || !isPublicKey(supabasePublishableKey)) {
    return response.status(503).json({
      error: "Configure SUPABASE_URL e SUPABASE_PUBLISHABLE_KEY na hospedagem.",
    });
  }

  response.setHeader("Cache-Control", "public, max-age=300, s-maxage=3600, stale-while-revalidate=86400");
  return response.status(200).json({ supabaseUrl, supabasePublishableKey });
}

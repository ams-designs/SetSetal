interface ImportMetaEnv {
  readonly VITE_SUPABASE_URL?: string;
  readonly VITE_SUPABASE_PUBLISHABLE_KEY?: string;
  // Optional: the public site key for the sign-in captcha (Cloudflare Turnstile).
  readonly VITE_TURNSTILE_SITE_KEY?: string;
}

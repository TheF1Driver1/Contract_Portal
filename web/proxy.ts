import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

export async function proxy(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet: { name: string; value: string; options?: Record<string, unknown> }[]) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value)
          );
          supabaseResponse = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options as Parameters<typeof supabaseResponse.cookies.set>[2])
          );
        },
      },
    }
  );

  // getClaims() verifies the JWT locally once asymmetric signing keys are on
  // (it falls back to a network check with the legacy shared secret).
  const { data: claimsData } = await supabase.auth.getClaims();
  const claims = claimsData?.claims as
    | { sub?: string; app_role?: string; locale?: string }
    | undefined;
  const user = claims?.sub ? { id: claims.sub } : null;

  const { pathname } = request.nextUrl;
  const isAuthPage = pathname.startsWith("/login") || pathname.startsWith("/signup") || pathname.startsWith("/forgot-password") || pathname.startsWith("/reset-password");
  const isApiRoute = pathname.startsWith("/api");
  const isLandingPage = pathname === "/";
  const isInvitePage = pathname.startsWith("/invite");
  const isPortalPage = pathname.startsWith("/portal");
  const isPricingPage = pathname === "/pricing";
  const isLegalPage = ["/terminos", "/privacidad", "/en/terms", "/en/privacy"].includes(pathname);
  const isResetPassword = pathname.startsWith("/reset-password");

  // Public routes — no auth required
  if (!user && (isAuthPage || isApiRoute || isLandingPage || isInvitePage || isPricingPage || isLegalPage)) {
    return supabaseResponse;
  }

  // Unauthenticated user hitting a protected route
  if (!user) {
    return NextResponse.redirect(new URL("/login", request.url));
  }

  // API routes authorize themselves; nothing below applies to them.
  if (isApiRoute) return supabaseResponse;

  // Role and locale come from the custom access-token hook (migration 015).
  // Until the hook is enabled, fall back to one profile lookup.
  let role = claims?.app_role;
  let locale = claims?.locale;
  if (!role || !locale) {
    const { data: profile } = await supabase
      .from("profiles")
      .select("role, locale")
      .eq("id", user.id)
      .single();
    role = role ?? (profile?.role as string | undefined);
    locale = locale ?? (profile?.locale as string | undefined);
  }
  role = role ?? "landlord";
  locale = locale ?? "es";

  // Set locale cookie for next-intl (only if different from current cookie)
  const currentLocaleCookie = request.cookies.get("NEXT_LOCALE")?.value;
  if (currentLocaleCookie !== locale) {
    supabaseResponse.cookies.set("NEXT_LOCALE", locale, {
      path: "/",
      maxAge: 60 * 60 * 24 * 365,
      sameSite: "lax",
    });
  }

  // Tenants are locked to /portal
  if (role === "tenant" && !isPortalPage && !isApiRoute && !isAuthPage) {
    return NextResponse.redirect(new URL("/portal", request.url));
  }

  // Landlords cannot access /portal
  if (role === "landlord" && isPortalPage) {
    return NextResponse.redirect(new URL("/dashboard", request.url));
  }

  // Authenticated users on auth pages redirect to their home
  if (user && isAuthPage && !isResetPassword) {
    return NextResponse.redirect(
      new URL(role === "tenant" ? "/portal" : "/dashboard", request.url)
    );
  }

  return supabaseResponse;
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|_vercel|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};

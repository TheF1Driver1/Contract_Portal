import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

export async function middleware(request: NextRequest) {
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

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { pathname } = request.nextUrl;
  const isAuthPage = pathname.startsWith("/login") || pathname.startsWith("/signup") || pathname.startsWith("/forgot-password") || pathname.startsWith("/reset-password");
  const isApiRoute = pathname.startsWith("/api");
  const isLandingPage = pathname === "/";
  const isInvitePage = pathname.startsWith("/invite");
  const isPortalPage = pathname.startsWith("/portal");
  const isPricingPage = pathname === "/pricing";
  const isResetPassword = pathname.startsWith("/reset-password");

  // Public routes — no auth required
  if (!user && (isAuthPage || isApiRoute || isLandingPage || isInvitePage || isPricingPage)) {
    return supabaseResponse;
  }

  // Unauthenticated user hitting a protected route
  if (!user) {
    return NextResponse.redirect(new URL("/login", request.url));
  }

  // Fetch role and locale for authenticated users on non-API routes
  const { data: profile } = await supabase
    .from("profiles")
    .select("role, locale, plan")
    .eq("id", user.id)
    .single();
  const role = (profile?.role as string | undefined) ?? "landlord";
  const locale = (profile?.locale as string | undefined) ?? "es";

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
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};

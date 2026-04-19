# Task: Dark Mode

## Files to modify
- `web/app/layout.tsx`
- `web/components/Sidebar.tsx`
- `web/app/(dashboard)/layout.tsx`
- `web/app/(dashboard)/contracts/page.tsx`
- `web/app/(dashboard)/tenants/page.tsx`
- `web/app/(dashboard)/properties/AddPropertyModal.tsx`
- `web/components/ui/badge.tsx`

## Files to create
- `web/components/ThemeProvider.tsx`
- `web/components/ThemeToggle.tsx`

## Install
```bash
cd Contract_Portal/web && npm install next-themes
```

## Context
`tailwind.config.ts` already has `darkMode: ["class"]`.
`globals.css` already has `.dark {}` CSS vars. Both already done — skip those.

## Changes

### Create `web/components/ThemeProvider.tsx`
```tsx
"use client"
import { ThemeProvider as NextThemeProvider } from "next-themes"
export function ThemeProvider({ children }: { children: React.ReactNode }) {
  return (
    <NextThemeProvider attribute="class" defaultTheme="system" enableSystem>
      {children}
    </NextThemeProvider>
  )
}
```

### Create `web/components/ThemeToggle.tsx`
```tsx
"use client"
import { useTheme } from "next-themes"
import { Sun, Moon } from "lucide-react"
export function ThemeToggle() {
  const { theme, setTheme } = useTheme()
  return (
    <button onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
      className="p-2 rounded-md hover:bg-accent">
      {theme === "dark" ? <Sun size={18} /> : <Moon size={18} />}
    </button>
  )
}
```

### `web/app/layout.tsx`
Wrap `<body>` contents with `<ThemeProvider>`. Import it.

### `web/components/Sidebar.tsx`
- `bg-white` → `bg-card`
- Add `<ThemeToggle />` above the Sign Out button

### `web/app/(dashboard)/layout.tsx`
- `bg-gray-50` → `bg-background`

### `web/app/(dashboard)/contracts/page.tsx`
- Table wrapper `bg-white` → `bg-card`

### `web/app/(dashboard)/tenants/page.tsx`
- Table wrapper `bg-white` → `bg-card`

### `web/app/(dashboard)/properties/AddPropertyModal.tsx`
- Modal container `bg-white` → `bg-card`

### `web/components/ui/badge.tsx`
- For each color variant, add matching `dark:` class (e.g. `dark:bg-green-900 dark:text-green-300`)

## Done
- Sun/Moon toggle visible in sidebar
- Toggle switches theme; page does not flash white in dark mode
- Run: `grep -r "bg-white\|bg-gray-50" web/app web/components --include="*.tsx"` → no results (or all remaining ones have `dark:` equivalents)

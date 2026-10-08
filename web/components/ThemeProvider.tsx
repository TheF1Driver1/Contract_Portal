"use client"
import { ThemeProvider as NextThemeProvider } from "next-themes"

// Light, dark or follow the device (Profile › Apariencia).
export function ThemeProvider({ children }: { children: React.ReactNode }) {
  return (
    <NextThemeProvider attribute="class" defaultTheme="system" enableSystem disableTransitionOnChange>
      {children}
    </NextThemeProvider>
  )
}

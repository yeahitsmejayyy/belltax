import { createContext, useContext, useEffect, useState } from "react"

// Light, dark or follow the system. The chosen theme is remembered per app (storageKey); `resolvedTheme` is
// what's actually showing, so a toggle can flip from whatever the system picked.

export type Theme = "dark" | "light" | "system"
type Resolved = "dark" | "light"

// storageKey: where the choice is remembered; null keeps it for this page only (previews, tests).
type ThemeProviderProps = { children: React.ReactNode; defaultTheme?: Theme; storageKey?: string | null }
type ThemeProviderState = { theme: Theme; resolvedTheme: Resolved; setTheme: (theme: Theme) => void }

const systemTheme = (): Resolved => (typeof window !== "undefined" && window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light")

const ThemeProviderContext = createContext<ThemeProviderState>({ theme: "system", resolvedTheme: "light", setTheme: () => null })

const read = (key: string | null): Theme | null => {
  if (!key) return null
  try {
    return localStorage.getItem(key) as Theme | null
  } catch {
    return null
  }
}

export function ThemeProvider({ children, defaultTheme = "system", storageKey = "btp-theme", ...props }: ThemeProviderProps) {
  const [theme, setThemeState] = useState<Theme>(() => read(storageKey) || defaultTheme)
  const [system, setSystem] = useState<Resolved>(systemTheme)
  const resolvedTheme = theme === "system" ? system : theme

  useEffect(() => {
    const mql = window.matchMedia("(prefers-color-scheme: dark)")
    const on = () => setSystem(mql.matches ? "dark" : "light")
    mql.addEventListener("change", on)
    return () => mql.removeEventListener("change", on)
  }, [])

  useEffect(() => {
    const root = window.document.documentElement
    root.classList.remove("light", "dark")
    root.classList.add(resolvedTheme)
  }, [resolvedTheme])

  const value: ThemeProviderState = {
    theme,
    resolvedTheme,
    setTheme: (t: Theme) => {
      try {
        if (storageKey) localStorage.setItem(storageKey, t)
      } catch {
        /* private mode: the choice lasts for this page only */
      }
      setThemeState(t)
    },
  }

  return (
    <ThemeProviderContext.Provider {...props} value={value}>
      {children}
    </ThemeProviderContext.Provider>
  )
}

export const useTheme = () => useContext(ThemeProviderContext)

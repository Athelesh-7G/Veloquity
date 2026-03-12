"use client"

import { createContext, useContext, useState, useEffect, type ReactNode } from "react"

type Theme = "light" | "dark" | "system"

interface UserProfile {
  name: string
  email: string
  company: string
}

interface AppContextType {
  theme: Theme
  resolvedTheme: "light" | "dark"
  setTheme: (theme: Theme) => void
  sidebarCollapsed: boolean
  setSidebarCollapsed: (collapsed: boolean) => void
  showOnboarding: boolean
  setShowOnboarding: (show: boolean) => void
  searchQuery: string
  setSearchQuery: (query: string) => void
  userProfile: UserProfile
  setUserProfile: (profile: UserProfile) => void
}

const AppContext = createContext<AppContextType | undefined>(undefined)

export function AppProvider({ children }: { children: ReactNode }) {
  const [theme, setThemeState] = useState<Theme>("system")
  const [resolvedTheme, setResolvedTheme] = useState<"light" | "dark">("light")
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false)
  const [showOnboarding, setShowOnboarding] = useState(false)
  const [searchQuery, setSearchQuery] = useState("")
  const [userProfile, setUserProfileState] = useState<UserProfile>({
    name: "Alex Johnson",
    email: "alex@veloquity.io",
    company: "Acme Corp",
  })

  const resolveTheme = (themeValue: Theme): "light" | "dark" => {
    if (themeValue === "system") {
      return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light"
    }
    return themeValue
  }

  useEffect(() => {
    const savedTheme = localStorage.getItem("veloquity-theme") as Theme | null
    const savedProfile = localStorage.getItem("veloquity-profile")

    if (savedTheme) {
      setThemeState(savedTheme)
      setResolvedTheme(resolveTheme(savedTheme))
    } else {
      setResolvedTheme(resolveTheme("system"))
    }

    if (savedProfile) {
      try {
        setUserProfileState(JSON.parse(savedProfile))
      } catch (e) {
        // Ignore parse errors
      }
    }

    // Check if first visit
    const hasVisited = localStorage.getItem("veloquity-visited")
    if (!hasVisited) {
      setShowOnboarding(true)
      localStorage.setItem("veloquity-visited", "true")
    }

    // Listen for system theme changes
    const mediaQuery = window.matchMedia("(prefers-color-scheme: dark)")
    const handleChange = () => {
      if (theme === "system") {
        setResolvedTheme(mediaQuery.matches ? "dark" : "light")
      }
    }
    mediaQuery.addEventListener("change", handleChange)
    return () => mediaQuery.removeEventListener("change", handleChange)
  }, [theme])

  useEffect(() => {
    document.documentElement.classList.toggle("dark", resolvedTheme === "dark")
  }, [resolvedTheme])

  const setTheme = (newTheme: Theme) => {
    setThemeState(newTheme)
    const resolved = resolveTheme(newTheme)
    setResolvedTheme(resolved)
    localStorage.setItem("veloquity-theme", newTheme)
    document.documentElement.classList.toggle("dark", resolved === "dark")
  }

  const setUserProfile = (profile: UserProfile) => {
    setUserProfileState(profile)
    localStorage.setItem("veloquity-profile", JSON.stringify(profile))
  }

  return (
    <AppContext.Provider
      value={{
        theme,
        resolvedTheme,
        setTheme,
        sidebarCollapsed,
        setSidebarCollapsed,
        showOnboarding,
        setShowOnboarding,
        searchQuery,
        setSearchQuery,
        userProfile,
        setUserProfile,
      }}
    >
      {children}
    </AppContext.Provider>
  )
}

export function useApp() {
  const context = useContext(AppContext)
  if (!context) {
    throw new Error("useApp must be used within AppProvider")
  }
  return context
}

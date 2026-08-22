import React, { createContext, useContext, useState, useEffect } from "react";

type Theme = "dark" | "light";

interface ThemeContextType {
  theme: Theme;
  toggleTheme: () => void;
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

export const ThemeProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  console.log("✅ ThemeProvider Rendered");

  const [theme, setTheme] = useState<Theme>(() => {
    const saved = localStorage.getItem("sbit_theme");
    return saved === "light" || saved === "dark" ? saved : "dark";
  });

  useEffect(() => {
    console.log("Theme changed:", theme);

    const root = document.documentElement;

    if (theme === "light") {
      root.classList.remove("dark");
      root.classList.add("light");
    } else {
      root.classList.remove("light");
      root.classList.add("dark");
    }

    localStorage.setItem("sbit_theme", theme);
  }, [theme]);

  return (
    <ThemeContext.Provider value={{ theme, toggleTheme: () => setTheme(t => t === "dark" ? "light" : "dark") }}>
      {children}
    </ThemeContext.Provider>
  );
};

export const useTheme = () => {
  const context = useContext(ThemeContext);

  console.log("useTheme:", context);

  if (!context) {
    throw new Error("useTheme must be used within a ThemeProvider");
  }

  return context;
};
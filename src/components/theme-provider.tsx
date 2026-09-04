"use client";

import { createContext, useCallback, useContext, useEffect, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { MoonIcon, SunIcon } from "lucide-react";

type Theme = "light" | "dark";

const ThemeContext = createContext<{
  theme: Theme;
  toggle: () => void;
}>({ theme: "light", toggle: () => {} });

export const THEME_STORAGE_KEY = "mpc-theme";

/** Inlined in <head> by the layout so the first paint already has the right theme. */
export const themeInitScript = `
(function(){try{
  var s=localStorage.getItem("${THEME_STORAGE_KEY}");
  var t=s==="light"||s==="dark"?s:(window.matchMedia("(prefers-color-scheme: dark)").matches?"dark":"light");
  document.documentElement.classList.toggle("dark",t==="dark");
  document.documentElement.style.colorScheme=t;
}catch(e){}})();
`;

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [theme, setTheme] = useState<Theme>("light");

  useEffect(() => {
    // Sync from the pre-paint theme script (external system → state).
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setTheme(document.documentElement.classList.contains("dark") ? "dark" : "light");
  }, []);

  const toggle = useCallback(() => {
    setTheme((prev) => {
      const next: Theme = prev === "dark" ? "light" : "dark";
      document.documentElement.classList.toggle("dark", next === "dark");
      document.documentElement.style.colorScheme = next;
      try {
        localStorage.setItem(THEME_STORAGE_KEY, next);
      } catch {}
      return next;
    });
  }, []);

  return <ThemeContext.Provider value={{ theme, toggle }}>{children}</ThemeContext.Provider>;
}

export function useTheme() {
  return useContext(ThemeContext);
}

/** tacto-style square icon button: sun/moon morph with a rotating swap. */
export function ThemeToggle() {
  const { theme, toggle } = useTheme();
  const dark = theme === "dark";

  return (
    <motion.button
      type="button"
      onClick={toggle}
      whileHover={{ scale: 1.06 }}
      whileTap={{ scale: 0.9, rotate: -8 }}
      transition={{ type: "spring", stiffness: 500, damping: 26 }}
      aria-label={dark ? "Switch to light mode" : "Switch to dark mode"}
      className="hairline flex size-9 items-center justify-center rounded-lg bg-card text-foreground transition-colors duration-300 hover:bg-primary hover:text-primary-foreground focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
    >
      <AnimatePresence mode="wait" initial={false}>
        <motion.span
          key={theme}
          initial={{ rotate: -90, opacity: 0, scale: 0.5 }}
          animate={{ rotate: 0, opacity: 1, scale: 1 }}
          exit={{ rotate: 90, opacity: 0, scale: 0.5 }}
          transition={{ duration: 0.25, ease: [0.22, 1, 0.36, 1] }}
          className="flex"
        >
          {dark ? <MoonIcon className="size-4" /> : <SunIcon className="size-4" />}
        </motion.span>
      </AnimatePresence>
    </motion.button>
  );
}

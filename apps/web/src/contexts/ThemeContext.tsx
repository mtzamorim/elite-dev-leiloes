import { createContext,useContext,useEffect,useMemo,useState,type ReactNode } from 'react';
type Theme='light'|'dark';
const ThemeContext=createContext<{theme:Theme;toggle:()=>void}|null>(null);
export function ThemeProvider({children}:{children:ReactNode}) {
  const [theme,setTheme]=useState<Theme>(()=>{
    const stored=localStorage.getItem('atelier-theme');
    return stored==='dark'||stored==='light'?stored:(window.matchMedia('(prefers-color-scheme: dark)').matches?'dark':'light');
  });
  useEffect(()=>{document.documentElement.dataset.theme=theme;localStorage.setItem('atelier-theme',theme);},[theme]);
  const value=useMemo(()=>({theme,toggle:()=>setTheme(t=>t==='light'?'dark':'light')}),[theme]);
  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}
export function useTheme(){const ctx=useContext(ThemeContext);if(!ctx)throw new Error('ThemeProvider ausente');return ctx;}

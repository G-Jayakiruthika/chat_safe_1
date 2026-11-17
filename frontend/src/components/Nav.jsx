import { useEffect, useRef, useState } from 'react';
import { Link, NavLink, useNavigate } from 'react-router-dom';
import { AnimatePresence, motion } from 'framer-motion';
import { Home, Radar, ScanLine, Users, Flame, Menu, X, Search, Sun, Moon, Settings, Shield, LogOut, Plug, Heart, Mic, Sliders, Globe, Sparkles } from 'lucide-react';
import { useTheme } from '../lib/theme.jsx';
import { api } from '../lib/api.js';

export function Header({ onSearch, onLogout, onOpenAppearance, currentLang = 'en' }) {
  const { mode, toggle, state, setState } = useTheme();
  const [open, setOpen] = useState(false); const nav = useNavigate(); const first = useRef(null);
  useEffect(() => {
    if (!open) return undefined;
    first.current?.focus();
    const esc = (e) => e.key === 'Escape' && setOpen(false);
    addEventListener('keydown', esc); return () => removeEventListener('keydown', esc);
  }, [open]);
  const go = (to) => { setOpen(false); nav(to); };
  const items = [
    { label: 'Rural Voice AI (Speed-Dial 9)', icon: Mic, to: '/family' },
    { label: 'My Family', icon: Heart, to: '/my-family' },
    { label: 'Appearance & Themes (SkillForge)', icon: Sliders, action: () => { setOpen(false); onOpenAppearance?.(); } },
    { label: 'Connected Apps', icon: Plug, to: '/apps' },
    { label: 'Settings', icon: Settings, to: '/settings' },
    { label: 'Privacy', icon: Shield, to: '/legal/privacy' },
  ];
  return (
    <header className="sticky top-0 z-40 border-b border-fg/20 bg-bg/80 backdrop-blur-xl">
      <div className="mx-auto flex h-16 max-w-5xl items-center gap-2 px-4">
        <Link to="/" className="mr-auto flex items-center gap-2 text-xl font-extrabold" aria-label="TrueSafe home"><Shield className="text-accent" aria-hidden="true" /><span className="grad-text">TrueSafe</span><span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-accent/15 text-accent font-bold hidden sm:inline">KAVACH+URIMAI</span></Link>
        <button className="btn-ghost !min-h-[44px] !px-3 flex items-center gap-1 text-xs font-bold" onClick={onOpenAppearance} aria-label="Change theme or Indian language"><Globe size={18} className="text-accent" /><span className="uppercase font-mono">{currentLang}</span></button>
        <button className="btn-ghost !min-h-[44px] !px-3" onClick={() => setState(state === 'voice' ? 'neutral' : 'voice')} aria-pressed={state === 'voice'} aria-label="Toggle voice agent theme"><Mic size={20} /></button>
        <button className="btn-ghost !min-h-[44px] !px-3" onClick={onSearch} aria-label="Search (Command K)"><Search size={20} /><kbd className="hidden text-xs sm:inline">⌘K</kbd></button>
        <button className="btn-ghost !min-h-[44px] !px-3" onClick={toggle} aria-label={`Switch to ${mode === 'dark' ? 'bright' : 'dark'} mode`}>{mode === 'dark' ? <Sun size={20} /> : <Moon size={20} />}</button>
        <button className="btn-ghost !min-h-[44px] !px-3" aria-expanded={open} aria-controls="main-menu" aria-label={open ? 'Close menu' : 'Open menu'} onClick={() => setOpen(!open)}>{open ? <X size={20} /> : <Menu size={20} />}</button>
      </div>
      <AnimatePresence>
        {open && (
          <motion.nav id="main-menu" aria-label="Main menu" initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }}
            className="card absolute right-3 top-[68px] w-64 p-2 shadow-2xl">
            {items.map(({ label, icon: I, to, action }, i) => (
              <button key={label} ref={i === 0 ? first : null} onClick={() => action ? action() : go(to)} className="flex min-h-[48px] w-full items-center gap-3 rounded-xl px-4 text-left font-medium hover:bg-fg/10"><I size={20} aria-hidden="true" />{label}</button>
            ))}
            <button onClick={() => go('/demo')} className="flex min-h-[48px] w-full items-center gap-3 rounded-xl px-4 text-left font-medium hover:bg-fg/10"><Flame size={20} aria-hidden="true" />How scams work</button>
            <button onClick={async () => { setOpen(false); try { await api.logout(); } catch { /* ignore */ } onLogout(); }} className="flex min-h-[48px] w-full items-center gap-3 rounded-xl px-4 text-left font-medium hover:bg-fg/10"><LogOut size={20} aria-hidden="true" />Logout</button>
          </motion.nav>
        )}
      </AnimatePresence>
    </header>
  );
}

const TABS = [
  { to: '/', label: 'Radar', icon: Radar },
  { to: '/scan', label: 'Scan', icon: ScanLine },
  { to: '/demo', label: '8 Scams', icon: Sparkles },
  { to: '/family', label: 'Family', icon: Users },
  { to: '/streak', label: 'Streak', icon: Flame },
];
export function BottomNav() {
  return (
    <nav aria-label="Primary" className="fixed inset-x-0 bottom-0 z-40 border-t border-fg/20 bg-bg/90 pb-[env(safe-area-inset-bottom)] backdrop-blur-xl">
      <ul className="mx-auto flex max-w-xl justify-around">
        {TABS.map(({ to, label, icon: I }) => (
          <li key={to} className="flex-1">
            <NavLink to={to} end={to === '/'} className={({ isActive }) => `flex min-h-[60px] flex-col items-center justify-center gap-1 text-sm font-semibold ${isActive ? 'text-accent' : 'text-muted'}`}>
              {({ isActive }) => (<><I size={22} aria-hidden="true" strokeWidth={isActive ? 2.8 : 2} /><span>{label}</span>{isActive && <motion.span layoutId="tab-dot" className="h-1 w-6 rounded-full bg-accent" />}</>)}
            </NavLink>
          </li>
        ))}
      </ul>
    </nav>
  );
}
export { Home };

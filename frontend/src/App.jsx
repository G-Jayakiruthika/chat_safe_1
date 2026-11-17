import { useCallback, useEffect, useState } from 'react';
import { Route, Routes, useLocation } from 'react-router-dom';
import Aurora from './components/Aurora.jsx';
import GlowCursor from './components/GlowCursor.jsx';
import SearchOverlay from './components/SearchOverlay.jsx';
import CookieBanner from './components/CookieBanner.jsx';
import Preloader from './components/Preloader.jsx';
import AppearanceModal from './components/AppearanceModal.jsx';
import { Header, BottomNav } from './components/Nav.jsx';
import { api } from './lib/api.js';
import { useTheme } from './lib/theme.jsx';
import Login from './pages/Login.jsx';
import Radar from './pages/Radar.jsx';
import Scan from './pages/Scan.jsx';
import Family from './pages/Family.jsx';
import Streak from './pages/Streak.jsx';
import Demo from './pages/Demo.jsx';
import Apps from './pages/Apps.jsx';
import Legal from './pages/Legal.jsx';
import Settings from './pages/Settings.jsx';
import MyFamily from './pages/MyFamily.jsx';

export default function App() {
  const [authed, setAuthed] = useState(true);
  const [search, setSearch] = useState(false);
  const [appearance, setAppearance] = useState(false);
  const [lang, setLang] = useState(() => localStorage.getItem('ts_lang') || 'en');
  const { setState } = useTheme();
  const loc = useLocation();

  useEffect(() => {
    api.me().then(() => setAuthed(true)).catch(() => setAuthed(true));
  }, []);

  useEffect(() => {
    const k = (e) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setSearch((s) => !s);
      }
    };
    addEventListener('keydown', k);
    return () => removeEventListener('keydown', k);
  }, []);

  // Leaving the scanner resets the sea-creature state back to BlueDragon
  useEffect(() => {
    if (!loc.pathname.startsWith('/scan')) {
      setState((s) => (s === 'voice' ? s : 'neutral'));
    }
  }, [loc.pathname, setState]);

  const closeSearch = useCallback(() => setSearch(false), []);

  const handleLangChange = (newLang) => {
    setLang(newLang);
    localStorage.setItem('ts_lang', newLang);
  };

  const publicLegal = loc.pathname.startsWith('/legal');

  return (
    <>
      <Preloader />
      <a href="#main" className="skip-link">Skip to content</a>
      <Aurora />
      <GlowCursor />

      {!authed && !publicLegal ? (
        <main id="main"><Login onAuthed={() => setAuthed(true)} /></main>
      ) : (
        <>
          {authed && (
            <Header
              onSearch={() => setSearch(true)}
              onLogout={() => setAuthed(false)}
              onOpenAppearance={() => setAppearance(true)}
              currentLang={lang}
            />
          )}

          <main id="main" className="mx-auto min-h-screen max-w-5xl px-4 pb-32 pt-6">
            <Routes>
              <Route path="/" element={<Radar />} />
              <Route path="/scan" element={<Scan />} />
              <Route path="/family" element={<Family />} />
              <Route path="/streak" element={<Streak />} />
              <Route path="/demo" element={<Demo />} />
              <Route path="/apps" element={<Apps />} />
              <Route path="/my-family" element={<MyFamily />} />
              <Route path="/settings" element={<Settings onDeleted={() => setAuthed(false)} />} />
              <Route path="/legal/:doc" element={<Legal />} />
              <Route path="*" element={<Radar />} />
            </Routes>

            <footer className="mt-16 border-t border-fg/20 pt-6 text-sm text-muted">
              <div className="flex flex-wrap items-center justify-between gap-4">
                <nav aria-label="Legal" className="flex flex-wrap gap-4">
                  {['privacy', 'terms', 'refund', 'cookies'].map((d) => (
                    <a key={d} className="underline" href={`/legal/${d}`}>{d[0].toUpperCase() + d.slice(1)}</a>
                  ))}
                </nav>
                <button
                  onClick={() => setAppearance(true)}
                  className="rounded-full border border-fg/20 px-3 py-1 text-xs font-semibold hover:border-accent"
                >
                  ⚙ Display & Languages ({lang.toUpperCase()})
                </button>
              </div>
              <address className="mt-3 not-italic text-xs text-muted">
                TrueSafe + Urimai v2.0 · PromptWars X Noor AITH · Google Gemini 3.8 / 2.0 Multimodal · Cybercrime helpline: 1930 · National Grievance: CPGRAMS
              </address>
            </footer>
          </main>

          {authed && <BottomNav />}
        </>
      )}

      <SearchOverlay open={search} onClose={closeSearch} />
      <AppearanceModal
        open={appearance}
        onClose={() => setAppearance(false)}
        currentLang={lang}
        onLangChange={handleLangChange}
      />
      <CookieBanner />
    </>
  );
}

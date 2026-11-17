import { useEffect, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

const BOOT_LOGS = [
  'INITIALIZING GEMINI 3.8 NEURAL ENGINE...',
  'SYNCING 23 INDIAN LANGUAGE KERNELS...',
  'CONNECTING TWILIO SPEED-DIAL 9 GATEWAY...',
  'LOADING KAVACH SCAM THREAT RADAR...',
  'CALIBRATING URIMAI CIVIC GRIEVANCE ENGINE...',
  'SYSTEM SECURE // BHARAT SAFE ACTIVE',
];

export default function Preloader({ onComplete }) {
  const [progress, setProgress] = useState(0);
  const [logIndex, setLogIndex] = useState(0);
  const [done, setDone] = useState(false);
  const onCompleteRef = useRef(onComplete);
  onCompleteRef.current = onComplete;

  useEffect(() => {
    const start = Date.now();
    const duration = 1200; // 1.2s fast & smooth load

    const timer = setInterval(() => {
      const elapsed = Date.now() - start;
      const pct = Math.min(100, Math.floor((elapsed / duration) * 100));
      setProgress(pct);

      const idx = Math.min(BOOT_LOGS.length - 1, Math.floor((pct / 100) * BOOT_LOGS.length));
      setLogIndex(idx);

      if (pct >= 100) {
        clearInterval(timer);
        setDone(true);
        onCompleteRef.current?.();
      }
    }, 30);

    // Hard fallback timeout ensures preloader NEVER stays frozen
    const fallback = setTimeout(() => {
      clearInterval(timer);
      setDone(true);
      onCompleteRef.current?.();
    }, 1500);

    return () => {
      clearInterval(timer);
      clearTimeout(fallback);
    };
  }, []);

  return (
    <AnimatePresence>
      {!done && (
        <motion.div
          initial={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.35, ease: 'easeOut' }}
          onClick={() => {
            setDone(true);
            onCompleteRef.current?.();
          }}
          className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-[#05060f] text-white select-none overflow-hidden cursor-pointer"
          style={{ fontFamily: 'system-ui, -apple-system, sans-serif' }}
        >
          {/* Subtle Ambient Radial Wash */}
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,_var(--tw-gradient-stops))] from-cyan-950/30 via-transparent to-transparent pointer-events-none" />

          {/* Central Shield Graphic (from Chat_Safe SVG) */}
          <div className="relative mb-8 flex flex-col items-center">
            <svg
              className="w-20 h-24 sm:w-24 sm:h-28 drop-shadow-[0_0_28px_rgba(34,211,238,0.7)] text-cyan-400"
              viewBox="0 0 64 72"
              fill="none"
              aria-hidden="true"
            >
              {/* Outer Shield Path */}
              <motion.path
                d="M32 3 59 13v26c0 17-11 28-27 33C16 67 5 56 5 39V13Z"
                stroke="currentColor"
                strokeWidth="3.5"
                strokeLinejoin="round"
                initial={{ pathLength: 0 }}
                animate={{ pathLength: 1 }}
                transition={{ duration: 0.9, ease: 'easeInOut' }}
              />

              {/* Central Checkmark Path */}
              <motion.path
                d="m20 36 8 8 17-18"
                stroke="#34d399"
                strokeWidth="5"
                strokeLinecap="round"
                strokeLinejoin="round"
                initial={{ pathLength: 0 }}
                animate={{ pathLength: 1 }}
                transition={{ duration: 0.5, delay: 0.5, ease: 'easeOut' }}
              />
            </svg>

            {/* Glowing Brand */}
            <div className="mt-4 flex items-center gap-1.5 text-2xl font-black tracking-wider">
              <span className="text-white">Chat</span>
              <span className="text-cyan-400 animate-pulse">_</span>
              <span className="text-cyan-400">Safe</span>
              <span className="ml-2 rounded-md bg-cyan-400/20 px-2 py-0.5 text-[10px] font-mono font-bold text-cyan-300">
                + URIMAI v2.0
              </span>
            </div>
            <p className="mt-1 text-xs font-mono tracking-widest text-slate-400 uppercase">
              MADE FOR BHARAT · 23 LANGUAGES
            </p>
          </div>

          {/* Progress Bar & Telemetry */}
          <div className="w-full max-w-xs px-4 space-y-3">
            <div className="flex justify-between items-center text-xs font-mono">
              <span className="text-cyan-300 tracking-wider">BOOT_STATUS</span>
              <span className="font-bold text-emerald-400">{progress}%</span>
            </div>

            {/* Sleek Gradient Bar */}
            <div className="h-1.5 w-full rounded-full bg-slate-800/80 overflow-hidden border border-white/10">
              <div
                className="h-full bg-gradient-to-r from-cyan-400 via-emerald-400 to-amber-300 transition-all duration-75 ease-out shadow-[0_0_12px_rgba(34,211,238,0.8)]"
                style={{ width: `${progress}%` }}
              />
            </div>

            {/* Live Changing Telemetry Log */}
            <p className="min-h-[18px] text-center font-mono text-[11px] text-slate-400 tracking-wider truncate">
              {BOOT_LOGS[logIndex]}
            </p>
          </div>

          <span className="mt-6 text-[10px] font-mono text-slate-500 tracking-widest uppercase">
            Click anywhere to skip
          </span>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

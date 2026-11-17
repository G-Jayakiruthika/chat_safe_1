import React, { useRef } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import { motion } from 'framer-motion';
import { pointer } from '../lib/pointer.js';
import { useTheme } from '../lib/theme.jsx';

function Core({ mood }) {
  const group = useRef();
  const inner = useRef();
  useFrame((s, dt) => {
    if (!group.current || !inner.current) return;
    const speed = mood === 'scanning' ? 2.2 : mood === 'angry' ? 1.6 : 0.5;
    group.current.rotation.y += dt * speed;
    group.current.rotation.x += dt * speed * 0.4;
    group.current.position.y = Math.sin(s.clock.elapsedTime * 1.3) * 0.12 + pointer.y * 0.25;
    group.current.position.x += (pointer.x * 0.35 - group.current.position.x) * 0.06;
    const k = mood === 'angry' ? 1 + Math.sin(s.clock.elapsedTime * 14) * 0.04 : 1;
    inner.current.scale.setScalar(k);
  });
  return (
    <group ref={group}>
      <mesh>
        <icosahedronGeometry args={[1.25, 1]} />
        <meshStandardMaterial color="#ffffff" wireframe emissive="#ffffff" emissiveIntensity={0.7} />
      </mesh>
      <mesh ref={inner}>
        <icosahedronGeometry args={[0.95, 0]} />
        <meshStandardMaterial color="#9bb8ff" metalness={0.8} roughness={0.2} flatShading />
      </mesh>
    </group>
  );
}

const EYE = {
  calm: { ry: 1, x: 0, browL: 0, browR: 0, browY: 0 },
  scanning: { ry: 0.8, x: [-9, 9, -9], browL: -4, browR: 4, browY: -2 },
  angry: { ry: 0.55, x: 0, browL: 24, browR: -24, browY: 4 },
  happy: { ry: 0.35, x: 0, browL: -10, browR: 10, browY: -4 },
};

class WebGLErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false };
  }
  static getDerivedStateFromError() {
    return { hasError: true };
  }
  componentDidCatch(err) {
    console.debug('3D Avatar Canvas fallback:', err);
  }
  render() {
    if (this.state.hasError) {
      return (
        <div className="absolute inset-0 flex items-center justify-center">
          <div className="h-24 w-24 rounded-full border-2 border-accent/40 bg-accent/10 animate-pulse" />
        </div>
      );
    }
    return this.props.children;
  }
}

export default function Avatar3D({ mood = 'calm', size = 200 }) {
  const { state } = useTheme();
  const m = EYE[mood] || EYE.calm;
  const color = mood === 'angry' ? 'rgb(var(--accent))' : 'rgb(var(--fg))';

  return (
    <div
      className="relative mx-auto"
      style={{ width: size, height: size }}
      role="img"
      aria-label={`TrueSafe guardian avatar, currently ${mood}. Theme: ${state}.`}
    >
      <WebGLErrorBoundary>
        <Canvas
          camera={{ position: [0, 0, 4], fov: 45 }}
          dpr={[1, 1.5]}
          aria-hidden="true"
          gl={{ alpha: true }}
          fallback={
            <div className="absolute inset-0 flex items-center justify-center">
              <div className="h-24 w-24 rounded-full border-2 border-accent/40 bg-accent/10" />
            </div>
          }
        >
          <ambientLight intensity={0.6} />
          <directionalLight position={[3, 3, 4]} intensity={2} />
          <Core mood={mood} />
        </Canvas>
      </WebGLErrorBoundary>

      <svg viewBox="0 0 100 100" className="pointer-events-none absolute inset-0" aria-hidden="true">
        {[[36, 'browL'], [64, 'browR']].map(([cx, key]) => (
          <g key={cx}>
            <motion.rect
              x={cx - 9}
              y={38}
              width={18}
              height={3}
              rx={1.5}
              fill={color}
              style={{ originX: '50%', originY: '50%' }}
              animate={{ rotate: m[key], y: m.browY }}
              transition={{ type: 'spring', stiffness: 160, damping: 14 }}
            />
            <motion.ellipse
              cx={cx}
              cy={50}
              rx={5.5}
              ry={7}
              fill={color}
              animate={{ scaleY: m.ry, x: m.x }}
              style={{ originX: '50%', originY: '50%' }}
              transition={
                mood === 'scanning'
                  ? { duration: 1.6, repeat: Infinity, ease: 'easeInOut' }
                  : { type: 'spring', stiffness: 200, damping: 16 }
              }
            />
          </g>
        ))}
        {mood === 'happy' && (
          <path d="M40 66 Q50 74 60 66" stroke={color} strokeWidth="2.5" fill="none" strokeLinecap="round" />
        )}
      </svg>
    </div>
  );
}

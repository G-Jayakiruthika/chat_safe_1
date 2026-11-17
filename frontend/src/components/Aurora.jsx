import { useEffect, useRef } from 'react';
import { Renderer, Program, Mesh, Triangle } from 'ogl';
import { useTheme } from '../lib/theme.jsx';

/** React Bits-style Aurora / GradientWaves: flowing ribbons of digital data, colours tied to CSS variables. */
const VERT = `#version 300 es
in vec2 position; void main(){ gl_Position = vec4(position,0.,1.); }`;
const FRAG = `#version 300 es
precision highp float;
uniform float uTime; uniform vec2 uRes; uniform vec3 c0; uniform vec3 c1; uniform vec3 c2; uniform vec3 uBg;
out vec4 o;
float ribbon(vec2 uv, float off, float spd, float amp, float w){
  float y = off + sin(uv.x*3.0 + uTime*spd)*amp + sin(uv.x*7.0 - uTime*spd*1.7)*amp*0.35;
  float d = abs(uv.y - y);
  return smoothstep(w, 0.0, d);
}
void main(){
  vec2 uv = gl_FragCoord.xy / uRes; uv.x *= uRes.x/uRes.y;
  vec3 col = uBg;
  float t = uTime;
  float a = ribbon(uv, 0.62, 0.45, 0.10, 0.20);
  float b = ribbon(uv, 0.45, 0.30, 0.13, 0.17);
  float c = ribbon(uv, 0.30, 0.55, 0.08, 0.22);
  // data "scanline" ticks along ribbons
  float ticks = step(0.92, fract(uv.x*40.0 - t*0.6)) * 0.35 + 0.65;
  col += c0 * a * 0.55 * ticks + c1 * b * 0.45 + c2 * c * 0.5 * ticks;
  col *= 0.85 + 0.15 * sin(uv.y*3.0 + t*0.2);
  o = vec4(col, 1.0);
}`;

const read = (name) => getComputedStyle(document.documentElement).getPropertyValue(name).trim().split(/\s+/).map((n) => Number(n) / 255);
const lerp = (a, b, k) => a.map((v, i) => v + (b[i] - v) * k);

export default function Aurora() {
  const host = useRef(null);
  const { mode, state } = useTheme();
  const target = useRef({});

  useEffect(() => {
    // theme changed (CSS vars already applied by effect order after paint) -> new target colours
    const id = requestAnimationFrame(() => {
      target.current = { c0: read('--accent'), c1: read('--a2'), c2: read('--a3'), bg: read('--bg') };
    });
    return () => cancelAnimationFrame(id);
  }, [mode, state]);

  useEffect(() => {
    const el = host.current;
    if (!el) return;
    let renderer;
    try {
      renderer = new Renderer({ alpha: false, antialias: false, dpr: Math.min(typeof devicePixelRatio !== 'undefined' ? devicePixelRatio : 1, 1.5) });
      if (!renderer || !renderer.gl || !renderer.gl.canvas) return;
    } catch {
      return;
    }
    const gl = renderer.gl;
    try {
      el.appendChild(gl.canvas);
      gl.canvas.style.cssText = 'width:100%;height:100%;display:block';
      const cur = { c0: read('--accent'), c1: read('--a2'), c2: read('--a3'), bg: read('--bg') };
      target.current = { ...cur };
      const geometry = new Triangle(gl);
      const program = new Program(gl, {
        vertex: VERT, fragment: FRAG,
        uniforms: { uTime: { value: 0 }, uRes: { value: [1, 1] }, c0: { value: cur.c0 }, c1: { value: cur.c1 }, c2: { value: cur.c2 }, uBg: { value: cur.bg } },
      });
      const mesh = new Mesh(gl, { geometry, program });
      const resize = () => {
        renderer.setSize(el.offsetWidth || 1, el.offsetHeight || 1);
        program.uniforms.uRes.value = [gl.canvas.width, gl.canvas.height];
      };
      resize(); addEventListener('resize', resize);
      const reduce = typeof matchMedia !== 'undefined' && matchMedia('(prefers-reduced-motion: reduce)').matches;
      let raf; let last = performance.now(); let t = 0;
      const loop = (now) => {
        raf = requestAnimationFrame(loop);
        const dt = Math.min((now - last) / 1000, 0.05); last = now;
        if (!reduce) t += dt;
        const k = Math.min(1, dt * 3);
        for (const key of ['c0', 'c1', 'c2', 'bg']) cur[key] = lerp(cur[key], target.current[key] || cur[key], k);
        Object.assign(program.uniforms, {
          uTime: { value: t }, c0: { value: cur.c0 }, c1: { value: cur.c1 }, c2: { value: cur.c2 }, uBg: { value: cur.bg },
        });
        renderer.render({ scene: mesh });
      };
      raf = requestAnimationFrame(loop);
      return () => {
        cancelAnimationFrame(raf); removeEventListener('resize', resize);
        gl.canvas.remove(); gl.getExtension('WEBGL_lose_context')?.loseContext();
      };
    } catch (e) {
      console.warn('Aurora WebGL init failed:', e);
    }
  }, []);

  return <div ref={host} aria-hidden="true" className="pointer-events-none fixed inset-0 -z-10 opacity-60 [mask-image:linear-gradient(to_bottom,black,rgba(0,0,0,.55))]" />;
}

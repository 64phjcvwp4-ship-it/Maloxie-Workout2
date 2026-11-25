import React, { useEffect, useRef } from 'react';

export type SideRaysOrigin =
  | 'top-left'
  | 'top-right'
  | 'bottom-left'
  | 'bottom-right'
  | 'left'
  | 'right'
  | 'top'
  | 'bottom';

export interface SideRaysProps {
  rayColor1?: string;
  rayColor2?: string;
  origin?: SideRaysOrigin;
  speed?: number;
  intensity?: number;
  spread?: number;
  density?: number;
  followMouse?: boolean;
  blend?: number;
  sharpness?: number;
  tilt?: number;
  falloff?: number;
  glow?: number;
  saturation?: number;
  dust?: number;
  mouseInfluence?: number;
  intro?: boolean;
  lightMode?: boolean;
  opacity?: number;
  className?: string;
}

function hexToRgb(hex: string): [number, number, number] {
  const clean = hex.replace('#', '').trim();
  if (clean.length === 3) {
    const r = parseInt(clean[0] + clean[0], 16);
    const g = parseInt(clean[1] + clean[1], 16);
    const b = parseInt(clean[2] + clean[2], 16);
    return [r, g, b];
  }
  if (clean.length === 6) {
    const r = parseInt(clean.slice(0, 2), 16);
    const g = parseInt(clean.slice(2, 4), 16);
    const b = parseInt(clean.slice(4, 6), 16);
    if (!Number.isNaN(r) && !Number.isNaN(g) && !Number.isNaN(b)) {
      return [r, g, b];
    }
  }
  return [147, 51, 234];
}

function mixRgb(
  a: [number, number, number],
  b: [number, number, number],
  t: number
): [number, number, number] {
  return [
    Math.round(a[0] + (b[0] - a[0]) * t),
    Math.round(a[1] + (b[1] - a[1]) * t),
    Math.round(a[2] + (b[2] - a[2]) * t),
  ];
}

function getOriginPoint(
  origin: SideRaysOrigin,
  width: number,
  height: number
): { ox: number; oy: number; baseAngle: number } {
  switch (origin) {
    case 'top-left':
      return { ox: -width * 0.08, oy: -height * 0.08, baseAngle: Math.PI * 0.25 };
    case 'top-right':
      return { ox: width * 1.08, oy: -height * 0.08, baseAngle: Math.PI * 0.75 };
    case 'bottom-left':
      return { ox: -width * 0.08, oy: height * 1.08, baseAngle: -Math.PI * 0.25 };
    case 'bottom-right':
      return { ox: width * 1.08, oy: height * 1.08, baseAngle: -Math.PI * 0.75 };
    case 'left':
      return { ox: -width * 0.1, oy: height * 0.5, baseAngle: 0 };
    case 'right':
      return { ox: width * 1.1, oy: height * 0.5, baseAngle: Math.PI };
    case 'top':
      return { ox: width * 0.5, oy: -height * 0.1, baseAngle: Math.PI * 0.5 };
    case 'bottom':
      return { ox: width * 0.5, oy: height * 1.1, baseAngle: -Math.PI * 0.5 };
  }
}

export const SideRays: React.FC<SideRaysProps> = ({
  rayColor1 = '#f4f4f5',
  rayColor2 = '#d4d4d8',
  origin = 'top-right',
  speed = 2.5,
  intensity = 1.6,
  spread = 2,
  density = 5,
  followMouse = true,
  blend = 0.5,
  sharpness = 0.5,
  tilt = 0,
  falloff = 1.6,
  glow = 1,
  saturation = 1,
  dust = 0,
  mouseInfluence = 0.5,
  intro = true,
  lightMode = false,
  opacity = 1,
  className = '',
}) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const mouseRef = useRef({ targetX: 0.5, targetY: 0.5, currentX: 0.5, currentY: 0.5 });

  useEffect(() => {
    if (!followMouse) return;
    const handleMove = (e: PointerEvent) => {
      mouseRef.current.targetX = e.clientX / Math.max(1, window.innerWidth);
      mouseRef.current.targetY = e.clientY / Math.max(1, window.innerHeight);
    };
    window.addEventListener('pointermove', handleMove, { passive: true });
    return () => window.removeEventListener('pointermove', handleMove);
  }, [followMouse]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const prefersReduced =
      typeof window !== 'undefined' &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    let rafId = 0;
    let width = 0;
    let height = 0;
    const startTime = performance.now();

    const rgb1 = hexToRgb(rayColor1);
    const rgb2 = hexToRgb(rayColor2);

    const rayCount = Math.max(6, Math.round(density * 4));
    const rays = Array.from({ length: rayCount }, (_, i) => {
      const seed = (i * 1.6180339) % 1;
      return {
        offsetNorm: (i / (rayCount - 1 || 1)) * 2 - 1,
        widthFactor: 0.045 + seed * 0.085,
        phase: i * 1.37,
        freq: 0.45 + seed * 0.7,
        mixRatio: i / Math.max(1, rayCount - 1),
        alphaScale: 0.45 + ((i * 7) % 5) * 0.14,
      };
    });

    const dustCount = Math.max(0, Math.round(dust * 55));
    const dustMotes = Array.from({ length: dustCount }, (_, i) => ({
      x: ((i * 0.371) % 1),
      y: ((i * 0.619) % 1),
      size: 0.8 + ((i * 13) % 4) * 0.55,
      vx: (((i * 17) % 10) - 5) * 0.00018,
      vy: (((i * 23) % 10) - 5) * 0.00018,
      phase: i * 0.8,
    }));

    const resize = () => {
      const rect = canvas.getBoundingClientRect();
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      width = Math.max(1, rect.width);
      height = Math.max(1, rect.height);
      canvas.width = Math.round(width * dpr);
      canvas.height = Math.round(height * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };

    resize();
    const ro = new ResizeObserver(resize);
    ro.observe(canvas);

    const draw = (now: number) => {
      const elapsed = (now - startTime) * 0.001;
      const t = prefersReduced ? 0.5 : elapsed * speed * 0.4;

      // Smooth pointer interpolation
      mouseRef.current.currentX +=
        (mouseRef.current.targetX - mouseRef.current.currentX) * 0.06;
      mouseRef.current.currentY +=
        (mouseRef.current.targetY - mouseRef.current.currentY) * 0.06;

      const introFactor = intro && !prefersReduced ? Math.min(1, elapsed / 1.1) : 1;

      ctx.clearRect(0, 0, width, height);

      // Base background wash (charcoal dark vs lightMode)
      if (lightMode) {
        ctx.fillStyle = 'rgba(248, 248, 250, 0.9)';
        ctx.fillRect(0, 0, width, height);
      }

      const { ox, oy, baseAngle } = getOriginPoint(origin, width, height);
      const mouseAngleOffset = followMouse
        ? ((mouseRef.current.currentX - 0.5) * 0.32 +
            (mouseRef.current.currentY - 0.5) * 0.24) *
          mouseInfluence
        : 0;
      const centerAngle = baseAngle + (tilt * Math.PI) / 180 + mouseAngleOffset;

      const maxReach = Math.hypot(width, height) * (1.28 / Math.max(0.45, falloff * 0.72));

      ctx.save();
      ctx.globalCompositeOperation = lightMode ? 'multiply' : 'screen';

      // Origin ambient bloom
      if (glow > 0) {
        const bloom = ctx.createRadialGradient(ox, oy, 0, ox, oy, maxReach * 0.72);
        const midColor = mixRgb(rgb1, rgb2, blend);
        const bloomAlpha = Math.min(0.65, 0.26 * intensity * glow * introFactor);
        bloom.addColorStop(0, `rgba(${midColor[0]}, ${midColor[1]}, ${midColor[2]}, ${bloomAlpha})`);
        bloom.addColorStop(
          0.45,
          `rgba(${rgb2[0]}, ${rgb2[1]}, ${rgb2[2]}, ${bloomAlpha * 0.35})`
        );
        bloom.addColorStop(1, 'rgba(14, 14, 17, 0)');
        ctx.fillStyle = bloom;
        ctx.fillRect(0, 0, width, height);
      }

      // Draw volumetric light shafts
      const spreadAngle = 0.42 * spread;
      const edgeSharpness = Math.min(0.95, Math.max(0.1, sharpness));

      for (let i = 0; i < rays.length; i++) {
        const ray = rays[i];
        const sway = Math.sin(t * ray.freq + ray.phase) * 0.045 * (1 + spread * 0.2);
        const rayAngle = centerAngle + ray.offsetNorm * spreadAngle + sway;
        const halfWidthAngle =
          ray.widthFactor * (1.35 - edgeSharpness * 0.75) * (0.7 + spread * 0.22);

        const colorMix = Math.min(1, Math.max(0, ray.mixRatio * (0.4 + blend * 0.8)));
        const [r, g, b] = mixRgb(rgb1, rgb2, colorMix);

        const pulse = 0.78 + 0.22 * Math.sin(t * (ray.freq * 1.3) + ray.phase * 1.7);
        const alpha = Math.min(
          0.48,
          0.075 * intensity * ray.alphaScale * pulse * introFactor
        );

        const x1 = ox + Math.cos(rayAngle - halfWidthAngle) * maxReach;
        const y1 = oy + Math.sin(rayAngle - halfWidthAngle) * maxReach;
        const x2 = ox + Math.cos(rayAngle + halfWidthAngle) * maxReach;
        const y2 = oy + Math.sin(rayAngle + halfWidthAngle) * maxReach;

        const endX = ox + Math.cos(rayAngle) * maxReach;
        const endY = oy + Math.sin(rayAngle) * maxReach;

        const grad = ctx.createLinearGradient(ox, oy, endX, endY);
        grad.addColorStop(0, `rgba(${r}, ${g}, ${b}, ${alpha})`);
        grad.addColorStop(
          Math.min(0.82, 0.36 / Math.max(0.6, falloff * 0.55)),
          `rgba(${r}, ${g}, ${b}, ${alpha * 0.42})`
        );
        grad.addColorStop(1, `rgba(${r}, ${g}, ${b}, 0)`);

        ctx.fillStyle = grad;
        ctx.beginPath();
        ctx.moveTo(ox, oy);
        ctx.lineTo(x1, y1);
        ctx.lineTo(x2, y2);
        ctx.closePath();
        ctx.fill();
      }

      // Optional atmospheric dust particles
      if (dustMotes.length > 0) {
        for (const m of dustMotes) {
          if (!prefersReduced) {
            m.x = (m.x + m.vx + 1) % 1;
            m.y = (m.y + m.vy + 1) % 1;
          }
          const shimmer = 0.35 + 0.65 * Math.abs(Math.sin(t * 1.2 + m.phase));
          ctx.fillStyle = `rgba(${rgb2[0]}, ${rgb2[1]}, ${rgb2[2]}, ${
            0.35 * shimmer * introFactor
          })`;
          ctx.beginPath();
          ctx.arc(m.x * width, m.y * height, m.size, 0, Math.PI * 2);
          ctx.fill();
        }
      }

      ctx.restore();

      if (!prefersReduced) {
        rafId = requestAnimationFrame(draw);
      }
    };

    rafId = requestAnimationFrame(draw);

    return () => {
      cancelAnimationFrame(rafId);
      ro.disconnect();
    };
  }, [
    blend,
    density,
    dust,
    falloff,
    followMouse,
    glow,
    intensity,
    intro,
    lightMode,
    mouseInfluence,
    origin,
    rayColor1,
    rayColor2,
    sharpness,
    speed,
    spread,
    tilt,
  ]);

  return (
    <canvas
      ref={canvasRef}
      style={{
        opacity,
        filter: saturation !== 1 ? `saturate(${saturation})` : undefined,
      }}
      className={`w-full h-full block pointer-events-none ${className}`}
    />
  );
};

export default SideRays;

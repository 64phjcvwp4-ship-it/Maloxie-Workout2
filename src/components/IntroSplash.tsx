import React, { useEffect, useRef, useState } from 'react';
import { GlassSlabLogo } from './glass-slab-logo';

interface IntroSplashProps {
  fadingOut: boolean;
  onStartFadeOut: () => void;
  onComplete: () => void;
}

export function IntroSplash({ fadingOut, onStartFadeOut, onComplete }: IntroSplashProps) {
  const [logoReady, setLogoReady] = useState(false);
  const [textVisible, setTextVisible] = useState(false);
  const startedFadeRef = useRef(false);

  const triggerFadeOut = () => {
    if (startedFadeRef.current) return;
    startedFadeRef.current = true;
    onStartFadeOut();
  };

  useEffect(() => {
    const textTimer = window.setTimeout(() => {
      setTextVisible(true);
    }, 180);
    return () => window.clearTimeout(textTimer);
  }, []);

  // Fallback timer in case WebGL takes longer than expected or falls back
  useEffect(() => {
    const reduced = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false;
    const maxWaitMs = reduced ? 900 : 3200;
    const fallbackTimer = window.setTimeout(() => {
      triggerFadeOut();
    }, maxWaitMs);
    return () => window.clearTimeout(fallbackTimer);
  }, []);

  // Once the GlassSlabLogo WebGL scene is ready, let its 1.45s intro wave play and settle, then fade out
  useEffect(() => {
    if (!logoReady) return;
    const reduced = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false;
    const holdMs = reduced ? 650 : 2150;
    const timer = window.setTimeout(() => {
      triggerFadeOut();
    }, holdMs);
    return () => window.clearTimeout(timer);
  }, [logoReady]);

  // Unmount cleanly once the fade-out transition completes
  useEffect(() => {
    if (!fadingOut) return;
    const reduced = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false;
    const fadeMs = reduced ? 280 : 750;
    const doneTimer = window.setTimeout(() => {
      onComplete();
    }, fadeMs);
    return () => window.clearTimeout(doneTimer);
  }, [fadingOut, onComplete]);

  // Allow keyboard dismissal without adding visual chrome
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' || e.key === 'Enter' || e.key === ' ') {
        triggerFadeOut();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  return (
    <div
      onClick={triggerFadeOut}
      aria-label="Maloxie intro"
      className={`fixed inset-0 z-50 flex flex-col items-center justify-center px-6 select-none transition-[opacity,transform] duration-700 ease-[cubic-bezier(0.16,1,0.3,1)] ${
        fadingOut
          ? 'opacity-0 scale-[0.98] pointer-events-none'
          : 'opacity-100 scale-100 cursor-pointer'
      }`}
    >
      {/* Subtle radial contrast vignette so HoloMosaic shines while keeping the wordmark crisp */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_center,rgba(8,8,10,0.45)_0%,rgba(8,8,10,0.12)_48%,transparent_78%)]"
      />

      <div className="relative z-10 flex flex-col items-center justify-center">
        <div className="w-[240px] sm:w-[300px] md:w-[330px]">
          <GlassSlabLogo
            logo="/assets/maloxie-logo-mask.png"
            slabs={17}
            depth={0.75}
            elevation={60}
            colors={['#e89b3c', '#f4b86a', '#d9822b', '#27272a', '#141418']}
            backgroundColor="transparent"
            lightColor="#fff2ed"
            ambient={0.18}
            exposure={1.16}
            reflectivity={1.65}
            intro
            introDuration={1.45}
            onReady={() => setLogoReady(true)}
            style={{ height: 240 }}
            className="w-full"
            aria-label="Maloxie Glass Slab Logo"
          />
        </div>

        <div
          className={`mt-4 text-center transition-[opacity,transform] duration-700 ease-[cubic-bezier(0.16,1,0.3,1)] ${
            textVisible && !fadingOut
              ? 'opacity-100 translate-y-0'
              : 'opacity-0 translate-y-2'
          }`}
        >
          <span className="block font-display text-3xl sm:text-4xl font-bold tracking-[-0.035em] text-white drop-shadow-[0_8px_28px_rgba(0,0,0,0.9)]">
            Maloxie
          </span>
        </div>
      </div>
    </div>
  );
}

import React, { useRef, useState, type ReactNode } from 'react';

export interface MagicBentoCardProps {
  children: ReactNode;
  className?: string;
  onClick?: () => void;
  enableBorderGlow?: boolean;
  enableSpotlight?: boolean;
  spotlightRadius?: number;
  radius?: number;
}

export const MagicBentoCard: React.FC<MagicBentoCardProps> = ({
  children,
  className = '',
  onClick,
  enableBorderGlow = true,
  enableSpotlight = true,
  spotlightRadius = 300,
  radius = 28,
}) => {
  const cardRef = useRef<HTMLDivElement | null>(null);
  const [spot, setSpot] = useState({ x: 0, y: 0, active: false });

  const handleMove = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!cardRef.current || (!enableSpotlight && !enableBorderGlow)) return;
    const rect = cardRef.current.getBoundingClientRect();
    setSpot({
      x: e.clientX - rect.left,
      y: e.clientY - rect.top,
      active: true,
    });
  };

  return (
    <div
      ref={cardRef}
      onClick={onClick}
      onMouseMove={handleMove}
      onMouseLeave={() => setSpot((s) => ({ ...s, active: false }))}
      style={{ borderRadius: `${radius}px` }}
      className={`relative overflow-hidden bg-[#121218]/56 backdrop-blur-2xl border border-white/[0.065] shadow-[0_24px_52px_-18px_rgba(0,0,0,0.72),inset_0_1px_0_0_rgba(255,255,255,0.065)] transition-all duration-200 ${
        onClick ? 'cursor-pointer hover:border-[#E89B3C]/35 hover:bg-[#16161e]/64' : ''
      } ${className}`}
    >
      {enableSpotlight && spot.active && (
        <div
          aria-hidden="true"
          style={{
            background: `radial-gradient(${spotlightRadius}px circle at ${spot.x}px ${spot.y}px, rgba(232, 155, 60, 0.085), transparent 65%)`,
          }}
          className="pointer-events-none absolute inset-0 z-0 transition-opacity duration-200"
        />
      )}
      {enableBorderGlow && spot.active && (
        <div
          aria-hidden="true"
          style={{
            borderRadius: `${radius}px`,
            background: `radial-gradient(${Math.round(spotlightRadius * 0.75)}px circle at ${spot.x}px ${spot.y}px, rgba(232, 155, 60, 0.28), transparent 60%)`,
            WebkitMask:
              'linear-gradient(#fff 0 0) content-box, linear-gradient(#fff 0 0)',
            WebkitMaskComposite: 'xor',
            maskComposite: 'exclude',
            padding: '1px',
          }}
          className="pointer-events-none absolute inset-0 z-10"
        />
      )}
      <div className="relative z-20 h-full">{children}</div>
    </div>
  );
};

export interface MagicBentoProps {
  children: ReactNode;
  gap?: number;
  className?: string;
}

export const MagicBento: React.FC<MagicBentoProps> = ({
  children,
  gap = 14,
  className = '',
}) => {
  return (
    <div
      style={{ gap: `${gap}px` }}
      className={`grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 ${className}`}
    >
      {children}
    </div>
  );
};

export default MagicBento;

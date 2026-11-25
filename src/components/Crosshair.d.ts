import type { CSSProperties, RefObject } from 'react';

export interface CrosshairProps {
  color?: string;
  containerRef?: RefObject<HTMLElement | null> | null;
  thickness?: number;
  opacity?: number;
  lineStyle?: 'solid' | 'dashed' | 'dotted';
  gap?: number;
  fade?: number;
  smoothing?: number;
  showCoordinates?: boolean;
  targetEffect?: 'lock' | 'glitch' | 'none';
  targetSelector?: string;
  clickPulse?: boolean;
  hideCursor?: boolean;
  blendMode?: CSSProperties['mixBlendMode'];
  className?: string;
  style?: CSSProperties;
}

export default function Crosshair(props: CrosshairProps): React.JSX.Element;

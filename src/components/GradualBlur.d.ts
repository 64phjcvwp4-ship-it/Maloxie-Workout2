import type { CSSProperties, RefObject } from 'react';

export interface GradualBlurProps {
  position?: 'top' | 'bottom' | 'left' | 'right';
  target?: 'parent' | 'page';
  height?: number | string;
  width?: number | string;
  strength?: number;
  layers?: number;
  curve?: 'linear' | 'bezier' | 'ease-in' | 'ease-out' | 'ease-in-out';
  exponential?: boolean;
  opacity?: number;
  saturation?: number;
  tint?: string;
  autoHide?: boolean;
  container?: string | HTMLElement | RefObject<HTMLElement | null> | null;
  hoverIntensity?: number;
  duration?: number | string;
  easing?: string;
  zIndex?: number;
  className?: string;
  style?: CSSProperties;
}

export default function GradualBlur(props: GradualBlurProps): React.JSX.Element;

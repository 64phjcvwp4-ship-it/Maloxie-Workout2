import type { ReactNode } from 'react';

export type InfiniteSpiralItem =
  | string
  | {
      id?: string;
      src?: string;
      alt?: string;
      label?: string;
      href?: string;
      target?: string;
      onClick?: () => void;
      content?: ReactNode;
      [key: string]: unknown;
    };

export interface InfiniteSpiralProps {
  items?: InfiniteSpiralItem[];
  renderItem?: (item: Exclude<InfiniteSpiralItem, string>, index: number) => ReactNode;
  speed?: number;
  direction?: 'up' | 'down';
  animationMode?: 'auto' | 'scroll' | 'drag' | 'all';
  radius?: number;
  cardWidth?: number;
  cardHeight?: number;
  verticalSpacing?: number;
  perspective?: number;
  cardsPerTurn?: number;
  rotation?: number;
  cardTilt?: number;
  cardRadius?: number;
  centerScale?: number;
  edgeFade?: number;
  edgeBlur?: number;
  pauseOnHover?: boolean;
  imageFit?: 'cover' | 'contain' | 'fill' | 'none' | 'scale-down';
  grayscale?: number;
  className?: string;
}

export default function InfiniteSpiral(props: InfiniteSpiralProps): React.JSX.Element;

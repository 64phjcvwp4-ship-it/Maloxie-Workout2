export type InfiniteSpiralItem =
  | string
  | {
      src: string;
      alt?: string;
      [key: string]: unknown;
    };

export interface InfiniteSpiralProps {
  items?: InfiniteSpiralItem[];
  speed?: number;
  direction?: 'up' | 'down';
  animationMode?: 'auto' | 'scroll' | 'drag';
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

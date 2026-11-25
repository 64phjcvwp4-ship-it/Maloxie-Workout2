import React, { forwardRef } from 'react';
import {
  SoapBubbleButton,
  SoapBubbleIconButton,
  type SoapBubbleButtonProps,
  type SoapBubbleIconButtonProps,
} from '../soap-bubble';

export type MaloxieButtonVariant = 'primary' | 'secondary' | 'subtle';
export type MaloxieButtonSize = 'xs' | 'sm' | 'md' | 'lg';

export interface MaloxieButtonProps extends Omit<SoapBubbleButtonProps, 'size'> {
  variant?: MaloxieButtonVariant;
  size?: MaloxieButtonSize;
}

const VARIANT_MATERIAL: Record<MaloxieButtonVariant, Partial<SoapBubbleButtonProps>> = {
  primary: {
    tint: '#e89b3c',
    opacity: 0.34,
    soapColor: '#f4b86a',
    soapHighlightColor: '#ffe4bd',
    soapShadeColor: '#2a1a07',
    iridescence: 1.45,
    oilOpacity: 0.72,
    reflectivity: 1.25,
    bevel: 12,
    wobble: 0.35,
    environment: 'studio',
  },
  secondary: {
    tint: '#18181f',
    opacity: 0.52,
    soapColor: '#d4d4dc',
    soapHighlightColor: 'rgba(255, 255, 255, 0.58)',
    soapShadeColor: '#09090d',
    iridescence: 1.25,
    oilOpacity: 0.58,
    reflectivity: 1.1,
    bevel: 11,
    wobble: 0.3,
    environment: 'studio',
  },
  subtle: {
    tint: '#0d0d12',
    opacity: 0.28,
    soapColor: '#a1a1aa',
    soapHighlightColor: 'rgba(255, 255, 255, 0.42)',
    soapShadeColor: '#050507',
    iridescence: 1.0,
    oilOpacity: 0.42,
    reflectivity: 0.95,
    bevel: 10,
    wobble: 0.25,
    environment: 'studio',
  },
};

const SIZE_CLASSES: Record<MaloxieButtonSize, string> = {
  xs: '!min-h-[1.85rem] !px-3 !text-[11px] !font-medium',
  sm: '!min-h-[2.15rem] !px-3.5 !text-xs !font-medium',
  md: '!min-h-[2.4rem] !px-4 !text-xs !font-semibold',
  lg: '!min-h-[2.85rem] !px-6 !text-sm !font-semibold',
};

const VARIANT_TEXT_CLASSES: Record<MaloxieButtonVariant, string> = {
  primary: '!text-white',
  secondary: '!text-[#F5F5F7]',
  subtle: '!text-zinc-300 hover:!text-white',
};

export const MaloxieButton = forwardRef<HTMLButtonElement, MaloxieButtonProps>(
  function MaloxieButton(
    {
      variant = 'secondary',
      size = 'md',
      className = '',
      type = 'button',
      children,
      ...props
    },
    ref,
  ) {
    const material = VARIANT_MATERIAL[variant];
    return (
      <SoapBubbleButton
        ref={ref}
        type={type}
        {...material}
        {...props}
        className={`${SIZE_CLASSES[size]} ${VARIANT_TEXT_CLASSES[variant]} whitespace-nowrap shrink-0 ${className}`.trim()}
      >
        {children}
      </SoapBubbleButton>
    );
  },
);

export interface MaloxieIconButtonProps extends SoapBubbleIconButtonProps {
  variant?: MaloxieButtonVariant;
}

export const MaloxieIconButton = forwardRef<HTMLButtonElement, MaloxieIconButtonProps>(
  function MaloxieIconButton({ variant = 'subtle', className = '', ...props }, ref) {
    const material = VARIANT_MATERIAL[variant];
    return (
      <SoapBubbleIconButton
        ref={ref}
        {...material}
        {...props}
        className={`!w-[2.125rem] !h-[2.125rem] !min-h-0 text-zinc-300 hover:text-white ${className}`.trim()}
      />
    );
  },
);

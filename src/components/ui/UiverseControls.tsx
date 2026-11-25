import React, { type ReactNode } from 'react';
import { MaloxieButton } from './MaloxieButton';

export interface GlassRadioOption {
  value: string;
  label: string;
  sublabel?: string;
}

export interface GlassRadioSelectorProps {
  name: string;
  options: GlassRadioOption[];
  value: string;
  onChange: (value: string) => void;
  className?: string;
}

export const GlassRadioSelector: React.FC<GlassRadioSelectorProps> = ({
  name,
  options,
  value,
  onChange,
  className = '',
}) => {
  return (
    <div className={`radio-input ${className}`}>
      <div className="glass" aria-hidden="true">
        <div className="glass-inner" />
      </div>
      <div className="selector">
        {options.map((opt) => {
          const checked = opt.value === value;
          const inputId = `${name}-${opt.value}`;
          return (
            <div key={opt.value} className="choice">
              <div>
                <input
                  id={inputId}
                  name={name}
                  type="radio"
                  value={opt.value}
                  checked={checked}
                  onChange={() => onChange(opt.value)}
                  className="choice-circle"
                />
                <div className="ball" />
              </div>
              <label
                htmlFor={inputId}
                className={`choice-name flex flex-col ${checked ? 'is-active' : ''}`}
              >
                <span>{opt.label}</span>
                {opt.sublabel && (
                  <span className="text-[11px] font-sans font-normal text-[#A1A1AA]">
                    {opt.sublabel}
                  </span>
                )}
              </label>
            </div>
          );
        })}
      </div>
    </div>
  );
};

export interface TactilePillButtonProps {
  children: ReactNode;
  onClick?: () => void;
  disabled?: boolean;
  type?: 'button' | 'submit';
  className?: string;
}

export const TactilePillButton: React.FC<TactilePillButtonProps> = ({
  children,
  onClick,
  disabled = false,
  type = 'button',
  className = '',
}) => {
  return (
    <MaloxieButton
      type={type}
      onClick={onClick}
      disabled={disabled}
      variant="primary"
      size="lg"
      className={className}
    >
      {children}
    </MaloxieButton>
  );
};

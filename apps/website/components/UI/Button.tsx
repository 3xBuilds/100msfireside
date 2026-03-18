import React from 'react';
import { cn } from '@/lib/utils';

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'default' | 'ghost' | 'outline' | 'action';
  size?: 'sm' | 'md' | 'lg';
  children: React.ReactNode;
  className?: string;
  active?: boolean;
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ variant = 'default', size = 'md', className, children, disabled, active = false, ...props }, ref) => {
    const baseStyles = 'rounded-lg font-semibold disabled:opacity-50 disabled:cursor-not-allowed shadow-lg shadow-black/50 ';
    
    const variants = {
      default: active
        ? 'gradient-fire text-white shadow-lg hover:shadow-xl hover:scale-[1.02] duration-200 rounded-full font-bold'
        : 'gradient-fire text-white shadow-lg hover:shadow-xl hover:scale-[1.02] duration-200 rounded-full',
      ghost: active 
        ? 'bg-white/20 text-white font-bold'
        : 'bg-white/5 text-white/70 hover:bg-white/20 hover:text-white',
      outline: 'bg-transparent border-2 border-fireside-orange text-fireside-orange hover:bg-fireside-orange/10 hover:shadow-md rounded-full',
      action: active
        ? 'gradient-fire border-t-[1px] border-l-[1px] border-white/50 text-white font-bold'
        : 'bg-white/10 border-t-[1px] border-l-[1px] border-white/20 text-white',
    };

    const sizes = {
      sm: 'px-4 py-2 text-sm',
      md: 'px-6 py-3 text-base',
      lg: 'px-8 py-4 text-lg',
    };

    return (
      <button
        ref={ref}
        type='button'
        className={cn(
          baseStyles,
          variants[variant],
          sizes[size],
          className
        )}
        disabled={disabled}
        onClick={props.onClick}
      >
        {children}
      </button>
    );
  }
);

Button.displayName = 'Button';

export default Button;

import { ButtonHTMLAttributes, forwardRef } from "react";
import { cva, type VariantProps } from "class-variance-authority";

const buttonVariants = cva(
  "inline-flex items-center justify-center font-medium transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed disabled:pointer-events-none relative overflow-hidden group",
  {
    variants: {
      variant: {
        primary:
          "bg-brand-500 hover:bg-brand-600 active:bg-brand-700 text-white shadow-lg hover:shadow-xl focus:ring-brand-500/30 hover:shadow-glow",
        secondary:
          "bg-neutral-0 text-neutral-700 border border-neutral-200 hover:bg-neutral-50 active:bg-neutral-100 shadow-sm hover:shadow-md focus:ring-brand-500/20 hover:border-neutral-300",
        ghost:
          "bg-transparent text-brand-600 hover:bg-brand-50 active:bg-brand-100 focus:ring-brand-500/20 hover:text-brand-700",
        danger:
          "bg-accent-500 hover:bg-accent-600 active:bg-accent-700 text-white shadow-lg hover:shadow-xl focus:ring-accent-500/30",
        outline:
          "border border-neutral-200 text-neutral-700 hover:border-brand-300 hover:bg-brand-50 active:bg-brand-100 focus:ring-brand-500/20 bg-neutral-0 shadow-sm hover:shadow-md hover:text-brand-700",
        glass:
          "glass text-neutral-700 hover:bg-white/80 focus:ring-brand-500/20 border-0 shadow-glass",
      },
      size: {
        xs: "h-8 px-3 text-xs rounded-lg font-medium gap-1.5",
        sm: "h-9 px-4 text-sm rounded-lg font-medium gap-2",
        md: "h-10 px-5 text-sm rounded-xl font-medium gap-2",
        lg: "h-12 px-6 text-base rounded-xl font-medium gap-2.5",
        xl: "h-14 px-8 text-lg rounded-2xl font-medium gap-3",
        icon: "h-10 w-10 rounded-xl",
      },
      fullWidth: {
        true: "w-full",
      },
    },
    defaultVariants: {
      variant: "primary",
      size: "md",
    },
  }
);

export interface ButtonProps
  extends ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  loading?: boolean;
}

const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, fullWidth, loading, children, disabled, type = "button", ...props }, ref) => {
    const isDisabled = disabled || loading;
    
    return (
      <button
        className={buttonVariants({ variant, size, fullWidth, className })}
        ref={ref}
        disabled={isDisabled}
        type={type}
        aria-disabled={isDisabled}
        aria-busy={loading}
        {...props}
      >
        {loading && (
          <div className="spinner mr-2" />
        )}
        <span className={`${loading ? "opacity-70" : ""} relative z-10 flex items-center gap-2`}>
          {children}
        </span>
      </button>
    );
  }
);

Button.displayName = "Button";

export default Button;
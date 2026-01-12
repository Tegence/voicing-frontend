import { InputHTMLAttributes, forwardRef } from "react";
import { cva, type VariantProps } from "class-variance-authority";

const inputVariants = cva(
  "w-full border rounded-xl transition-all duration-200 bg-neutral-0 text-neutral-800 placeholder-neutral-400 focus:outline-none focus:ring-2 focus:ring-offset-1",
  {
    variants: {
      size: {
        sm: "h-9 px-3 text-sm",
        md: "h-11 px-4 text-base",
        lg: "h-12 px-5 text-lg",
      },
      variant: {
        default: "border-neutral-200 focus:border-brand-400 focus:ring-brand-400/20 hover:border-neutral-300",
        error: "border-error-500 focus:border-error-500 focus:ring-error-500/20",
        success: "border-success-500 focus:border-success-500 focus:ring-success-500/20",
        glass: "glass border-neutral-200/50 focus:border-brand-400/50 focus:ring-brand-400/20",
      },
    },
    defaultVariants: {
      size: "md",
      variant: "default",
    },
  }
);

export interface InputProps
  extends Omit<InputHTMLAttributes<HTMLInputElement>, "size">,
    VariantProps<typeof inputVariants> {
  label?: string;
  error?: string;
  helper?: string;
}

const Input = forwardRef<HTMLInputElement, InputProps>(
  ({ className, size, variant, label, error, helper, id, required, ...props }, ref) => {
    const inputId = id || label?.toLowerCase().replace(/\s+/g, "-") || `input-${Math.random().toString(36).substr(2, 9)}`;
    const inputVariant = error ? "error" : variant;
    const helperId = helper ? `${inputId}-helper` : undefined;
    const errorId = error ? `${inputId}-error` : undefined;

    return (
      <div className="w-full space-y-2">
        {label && (
          <label
            htmlFor={inputId}
            className="block text-sm font-medium text-neutral-700"
          >
            {label}
            {required && <span className="text-accent-500 ml-1" aria-label="required">*</span>}
          </label>
        )}
        <div className="relative">
          <input
            id={inputId}
            className={inputVariants({ size, variant: inputVariant, className })}
            ref={ref}
            required={required}
            aria-invalid={error ? "true" : "false"}
            aria-describedby={error ? errorId : helperId}
            {...props}
          />
        </div>
        {error && (
          <p id={errorId} className="text-sm text-error-600 flex items-center gap-1" role="alert">
            <svg className="w-4 h-4 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
            </svg>
            {error}
          </p>
        )}
        {helper && !error && (
          <p id={helperId} className="text-sm text-neutral-500">
            {helper}
          </p>
        )}
      </div>
    );
  }
);

Input.displayName = "Input";

export default Input;
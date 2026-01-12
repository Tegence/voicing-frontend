import { SelectHTMLAttributes, forwardRef } from "react";
import { cva, type VariantProps } from "class-variance-authority";

const selectVariants = cva(
  "w-full border rounded-xl transition-all duration-200 bg-neutral-0 text-neutral-800 focus:outline-none focus:ring-2 appearance-none cursor-pointer",
  {
    variants: {
      size: {
        sm: "h-9 px-3 text-sm",
        md: "h-11 px-4 text-base",
        lg: "h-12 px-5 text-lg",
      },
      variant: {
        default: "border-neutral-200 hover:border-neutral-300 focus:border-brand-400 focus:ring-brand-400/20",
        error: "border-error-300 focus:border-error-500 focus:ring-error-500/20",
        success: "border-success-300 focus:border-success-500 focus:ring-success-500/20",
      },
    },
    defaultVariants: {
      size: "md",
      variant: "default",
    },
  }
);

export interface SelectProps
  extends Omit<SelectHTMLAttributes<HTMLSelectElement>, "size">,
    VariantProps<typeof selectVariants> {
  label?: string;
  error?: string;
  helper?: string;
}

const Select = forwardRef<HTMLSelectElement, SelectProps>(
  ({ className, size, variant, label, error, helper, id, children, ...props }, ref) => {
    const selectId = id || label?.toLowerCase().replace(/\s+/g, "-");
    const selectVariant = error ? "error" : variant;

    return (
      <div className="w-full">
        {label && (
          <label
            htmlFor={selectId}
            className="block text-sm font-medium text-neutral-700 mb-2"
          >
            {label}
          </label>
        )}
        <div className="relative">
          <select
            id={selectId}
            className={selectVariants({ size, variant: selectVariant, className })}
            ref={ref}
            {...props}
          >
            {children}
          </select>
          <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center pr-3">
            <svg
              className="h-5 w-5 text-neutral-400"
              xmlns="http://www.w3.org/2000/svg"
              viewBox="0 0 20 20"
              fill="currentColor"
            >
              <path
                fillRule="evenodd"
                d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z"
                clipRule="evenodd"
              />
            </svg>
          </div>
        </div>
        {error && (
          <p className="mt-1 text-xs text-error-600">{error}</p>
        )}
        {helper && !error && (
          <p className="mt-1 text-xs text-neutral-500">{helper}</p>
        )}
      </div>
    );
  }
);

Select.displayName = "Select";

export default Select;
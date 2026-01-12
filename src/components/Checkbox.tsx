import { InputHTMLAttributes, forwardRef } from "react";

export interface CheckboxProps extends Omit<InputHTMLAttributes<HTMLInputElement>, "type"> {
  label?: string;
  helper?: string;
  error?: string;
}

const Checkbox = forwardRef<HTMLInputElement, CheckboxProps>(
  ({ className, label, helper, error, id, required, ...props }, ref) => {
    const checkboxId = id || label?.toLowerCase().replace(/\s+/g, "-") || `checkbox-${Math.random().toString(36).substr(2, 9)}`;
    const helperId = helper ? `${checkboxId}-helper` : undefined;
    const errorId = error ? `${checkboxId}-error` : undefined;

    return (
      <div className="w-full">
        <div className="flex items-start space-x-3">
          <input
            id={checkboxId}
            type="checkbox"
            className={`mt-1 h-4 w-4 text-brand-500 border-neutral-300 rounded focus:ring-brand-500/20 focus:ring-2 transition-colors ${error ? 'border-error-300 focus:border-error-500 focus:ring-error-500/20' : ''} ${className || ''}`}
            ref={ref}
            required={required}
            aria-invalid={error ? "true" : "false"}
            aria-describedby={error ? errorId : helperId}
            {...props}
          />
          {label && (
            <label
              htmlFor={checkboxId}
              className="text-sm font-medium text-neutral-700 leading-relaxed cursor-pointer"
            >
              {label}
              {required && <span className="text-accent-500 ml-1" aria-label="required">*</span>}
            </label>
          )}
        </div>
        {error && (
          <p id={errorId} className="mt-2 text-sm text-error-600" role="alert">
            {error}
          </p>
        )}
        {helper && !error && (
          <p id={helperId} className="mt-2 text-sm text-neutral-500">
            {helper}
          </p>
        )}
      </div>
    );
  }
);

Checkbox.displayName = "Checkbox";

export default Checkbox;
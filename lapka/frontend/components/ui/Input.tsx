export interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
}

export default function Input({ label, error, className = '', id, required, ...props }: InputProps) {
  const inputId = id || `input-${Math.random().toString(36).slice(2, 8)}`;
  const hasError = Boolean(error);
  return (
    <label className="block">
      {label ? (
        <span className="label">
          {label}
          {required && <span className="text-red-500 ml-0.5" aria-hidden="true">*</span>}
        </span>
      ) : null}
      <input
        id={inputId}
        className={`input ${hasError ? 'border-red-400 focus:border-red-500 focus:ring-red-200' : ''} ${className}`}
        aria-invalid={hasError ? 'true' : undefined}
        aria-required={required ? 'true' : undefined}
        aria-describedby={hasError ? `${inputId}-error` : undefined}
        required={required}
        {...props}
      />
      {hasError ? (
        <p id={`${inputId}-error`} className="mt-1 text-xs text-red-600" role="alert">
          {error}
        </p>
      ) : null}
    </label>
  );
}

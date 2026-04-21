export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'danger' | 'ghost' | 'subtle';
  size?: 'sm' | 'md' | 'lg' | 'icon';
  fullWidth?: boolean;
  loading?: boolean;
  'aria-label'?: string;
}

export default function Button({
  variant = 'primary',
  size = 'md',
  fullWidth = false,
  loading = false,
  className = '',
  type = 'button',
  children,
  disabled,
  ...props
}: ButtonProps) {
  const map = {
    primary: 'btn-primary',
    secondary: 'btn-secondary',
    danger: 'btn-danger',
    ghost: 'btn-ghost',
    subtle: 'btn-subtle',
  };
  const sizeMap = {
    sm: '!px-3 !py-2 text-xs',
    md: '',
    lg: '!px-5 !py-3 text-base',
    icon: '!h-10 !w-10 !rounded-full !px-0 !py-0',
  };
  const isIconOnly = size === 'icon';
  const ariaLabel = props['aria-label'];
  const effectiveDisabled = disabled || loading;

  return (
    <button
      type={type as React.ButtonType}
      className={`${map[variant] || map.primary} ${sizeMap[size] || ''} ${fullWidth ? 'w-full' : ''} focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-lapka-500 ${className}`}
      aria-busy={loading ? 'true' : undefined}
      aria-disabled={effectiveDisabled ? 'true' : undefined}
      aria-label={isIconOnly && !ariaLabel && typeof children === 'string' ? children : ariaLabel}
      disabled={effectiveDisabled}
      {...props}
    >
      {loading ? <span className="inline-flex h-4 w-4 animate-spin rounded-full border-2 border-current border-r-transparent" aria-hidden="true" /> : null}
      <span aria-hidden={isIconOnly && loading}>{children}</span>
    </button>
  );
}

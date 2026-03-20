export default function Button({
  variant = 'primary',
  size = 'md',
  className = '',
  type = 'button',
  children,
  ...props
}) {
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

  return (
    <button type={type} className={`${map[variant] || map.primary} ${sizeMap[size] || ''} ${className}`} {...props}>
      {children}
    </button>
  );
}

export default function Input({ label, className = '', ...props }) {
  return (
    <label className="block">
      {label ? <span className="label">{label}</span> : null}
      <input className={`input ${className}`} {...props} />
    </label>
  );
}

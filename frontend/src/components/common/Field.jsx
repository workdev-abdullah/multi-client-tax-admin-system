export default function Field({ label, value, onChange, required = false, type = 'text', placeholder = '' }) {
  return (
    <div className="field">
      <label>
        {label} {required && <span className="required-mark">*</span>}
      </label>
      <input
        value={value}
        onChange={(event) => onChange(event.target.value)}
        required={required}
        type={type}
        placeholder={placeholder}
      />
    </div>
  );
}

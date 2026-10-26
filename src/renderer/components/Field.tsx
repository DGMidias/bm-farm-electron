import type { FIELD_LIMITS } from "@harness/ui-contract";

interface FieldProps {
  id: string;
  label: string;
  value: string;
  onChange: (value: string) => void;
  kind?: keyof typeof FIELD_LIMITS;
  maxLength: number;
  type?: string;
  wide?: boolean;
  multiline?: boolean;
  placeholder?: string;
}

export function Field({
  id,
  label,
  value,
  onChange,
  maxLength,
  type = "text",
  wide,
  multiline,
  placeholder,
}: FieldProps) {
  return (
    <label className={wide ? "field wide" : "field"} htmlFor={id}>
      <span>
        {label} <small className="muted">{value.length}/{maxLength}</small>
      </span>
      {multiline ? (
        <textarea
          id={id}
          value={value}
          maxLength={maxLength}
          placeholder={placeholder}
          onChange={(event) => onChange(event.target.value)}
        />
      ) : (
        <input
          id={id}
          type={type}
          value={value}
          maxLength={maxLength}
          placeholder={placeholder}
          onChange={(event) => onChange(event.target.value)}
        />
      )}
    </label>
  );
}

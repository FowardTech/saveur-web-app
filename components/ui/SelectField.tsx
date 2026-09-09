import React from "react";

interface SelectFieldProps extends React.SelectHTMLAttributes<HTMLSelectElement> {
  label: string;
}

export const SelectField = React.forwardRef<HTMLSelectElement, SelectFieldProps>(function SelectField(
  { label, id, className = "", children, ...props },
  ref
) {
  const fieldId = id ?? props.name;
  return (
    <label htmlFor={fieldId} className="flex flex-col gap-1.5">
      <span className="text-sm font-medium text-primary">{label}</span>
      <select
        ref={ref}
        id={fieldId}
        className={`w-full rounded-lg border border-border bg-surface-1 px-3.5 py-2.5 text-sm text-primary focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand/20 ${className}`}
        {...props}
      >
        {children}
      </select>
    </label>
  );
});

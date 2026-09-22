import { cloneElement, isValidElement } from 'react';
import type { ReactElement, ReactNode } from 'react';

export interface FormFieldProps {
  /** Id shared by the label and the control; also seeds the hint/error ids. */
  id: string;
  label: string;
  labelAction?: ReactNode;
  /** Field-level message, usually `ApiRequestError.fieldError(name)`. */
  error?: string | undefined;
  hint?: string;
  required?: boolean;
  className?: string;
  children: ReactNode;
}

/**
 * Label + control + hint/error with the aria wiring done once.
 *
 * The child control receives `id`, `aria-invalid` and `aria-describedby`. Any
 * control that renders a wrapper element (e.g. `PasswordInput`) must forward
 * those props to its inner `<input>`.
 */
export function FormField({
  id,
  label,
  labelAction,
  error,
  hint,
  required = false,
  className,
  children,
}: FormFieldProps) {
  const hintId = hint ? `${id}-hint` : undefined;
  const errorId = error ? `${id}-error` : undefined;
  const describedBy =
    [errorId ?? hintId].filter(Boolean).join(' ') || undefined;

  const control = isValidElement(children)
    ? cloneElement(children as ReactElement<Record<string, unknown>>, {
        id,
        'aria-describedby': describedBy,
        'aria-invalid': error ? true : undefined,
      })
    : children;

  return (
    <div className={className ? `field ${className}` : 'field'}>
      <div className="field-heading">
        <label className="field__label" htmlFor={id}>
          {label}
          {required ? (
            <span className="field__required" aria-hidden="true">
              *
            </span>
          ) : null}
        </label>
        {labelAction}
      </div>
      {control}
      {hint && !error ? (
        <p className="field__hint" id={hintId}>
          {hint}
        </p>
      ) : null}
      {error ? (
        <p className="field__error" id={errorId}>
          {error}
        </p>
      ) : null}
    </div>
  );
}

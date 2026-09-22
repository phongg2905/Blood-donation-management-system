import type { ComponentPropsWithRef, ReactNode } from 'react';

export interface CheckboxProps extends Omit<
  ComponentPropsWithRef<'input'>,
  'type' | 'children'
> {
  children: ReactNode;
  /** Field-level message rendered under the control. */
  error?: string | undefined;
}

export function Checkbox({
  children,
  error,
  id,
  className,
  ...rest
}: CheckboxProps) {
  const errorId = error && id ? `${id}-error` : undefined;
  return (
    <div className={className}>
      <label className="checkbox" htmlFor={id}>
        <input
          {...rest}
          id={id}
          type="checkbox"
          aria-invalid={error ? true : undefined}
          aria-describedby={errorId}
        />
        <span>{children}</span>
      </label>
      {error ? (
        <p className="field__error" id={errorId}>
          {error}
        </p>
      ) : null}
    </div>
  );
}

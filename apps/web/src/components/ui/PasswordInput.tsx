import { useState } from 'react';
import type { ComponentPropsWithRef } from 'react';
import { Input } from './Input';

export interface PasswordInputProps extends Omit<
  ComponentPropsWithRef<'input'>,
  'type'
> {
  /** Label for the toggle when the password is hidden. */
  showLabel?: string;
  /** Label for the toggle when the password is visible. */
  hideLabel?: string;
}

/**
 * Password field with a show/hide toggle.
 *
 * The root element is a wrapper `div`, so every input-related prop (including
 * `id` and aria attributes injected by `FormField`) is forwarded to the inner
 * `<input>` rather than landing on the wrapper.
 */
export function PasswordInput({
  className,
  showLabel = 'Hiện',
  hideLabel = 'Ẩn',
  ...rest
}: PasswordInputProps) {
  const [visible, setVisible] = useState(false);

  return (
    <div className="password">
      <Input
        {...rest}
        type={visible ? 'text' : 'password'}
        className={className}
      />
      <button
        type="button"
        className="password__toggle"
        onClick={() => setVisible((value) => !value)}
        aria-pressed={visible}
        aria-controls={rest.id}
      >
        {visible ? hideLabel : showLabel}
      </button>
    </div>
  );
}

import type { ComponentPropsWithRef } from 'react';

export interface InputProps extends ComponentPropsWithRef<'input'> {
  /** Mark the control as invalid (also settable via aria-invalid). */
  invalid?: boolean;
}

export function Input({ className, invalid, ...rest }: InputProps) {
  const classes = className ? `input ${className}` : 'input';
  return (
    <input
      {...rest}
      className={classes}
      aria-invalid={invalid ?? rest['aria-invalid']}
    />
  );
}

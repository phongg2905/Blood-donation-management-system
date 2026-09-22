/**
 * Loading indicator.
 *
 * Presentational by default (`aria-hidden`) because it is usually rendered
 * inside a button that already carries `aria-busy`. Pass `label` when the
 * spinner is the only cue for a loading region and it must be announced.
 */
export interface SpinnerProps {
  className?: string;
  label?: string;
}

export function Spinner({ className, label }: SpinnerProps) {
  const classes = className ? `spinner ${className}` : 'spinner';
  if (!label) return <span className={classes} aria-hidden="true" />;
  return <span className={classes} role="status" aria-label={label} />;
}

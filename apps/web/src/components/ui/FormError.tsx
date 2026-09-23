import { StatusMessage } from './StatusMessage';

export interface FormErrorProps {
  /** `null` renders nothing, so callers can pass state straight through. */
  message: string | null | undefined;
  title?: string;
}

/**
 * Form-level error banner.
 *
 * Field-level errors belong on `FormField`; this is for errors that apply to the
 * whole submit (bad credentials, expired token, network failure).
 */
export function FormError({ message, title }: FormErrorProps) {
  if (!message) return null;
  return (
    <StatusMessage tone="error" title={title}>
      {message}
    </StatusMessage>
  );
}

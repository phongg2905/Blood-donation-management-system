import { StatusMessage } from './StatusMessage';

export interface FormErrorProps {
  /** `null` renders nothing, so callers can pass state straight through. */
  message: string | null | undefined;
  /** Raw error code, shown as de-emphasised context (handy pre-integration). */
  code?: string | null;
  title?: string;
}

/**
 * Form-level error banner.
 *
 * Field-level errors belong on `FormField`; this is for errors that apply to the
 * whole submit (bad credentials, expired token, network failure).
 */
export function FormError({ message, code, title }: FormErrorProps) {
  if (!message) return null;
  return (
    <StatusMessage
      tone="error"
      title={title}
      detail={code ? `Mã lỗi: ${code}` : null}
    >
      {message}
    </StatusMessage>
  );
}

import { Button } from '@/components/ui';
import { useAuth } from '@/features/auth/hooks/useAuth';

export interface RegistrationActionProps {
  /** Id of the visible note that explains why the control is unavailable. */
  noteId?: string;
}

/**
 * The only "Đăng ký hiến máu" control on the landing page.
 *
 * Registration belongs to Phase 4, so the control
 * is rendered disabled next to a visible explanation instead of pretending to
 * open a workflow that does not exist. It renders once, in the hero, so the
 * closing call to action can point back at it.
 */
export function RegistrationAction({
  noteId = 'registration-availability',
}: RegistrationActionProps) {
  const { hasPermission } = useAuth();
  if (!hasPermission('registration.create')) return null;

  return (
    <div className="landing-registration">
      <Button
        className="landing-cta"
        disabled
        aria-describedby={noteId}
        title="Đăng ký trực tuyến sắp ra mắt"
      >
        Đăng ký hiến máu
      </Button>
      <p className="landing-registration__note" id={noteId}>
        Đăng ký trực tuyến sắp ra mắt.
      </p>
    </div>
  );
}

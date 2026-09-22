import { PASSWORD_REQUIREMENTS } from '../validation';

export interface PasswordRequirementsProps {
  value: string;
  className?: string;
}

/**
 * Live checklist for the password policy.
 *
 * Reads the same rule list the validator uses, so the hints and the submit-time
 * errors can never disagree.
 */
export function PasswordRequirements({
  value,
  className,
}: PasswordRequirementsProps) {
  return (
    <ul
      className={
        className
          ? `password-requirements ${className}`
          : 'password-requirements'
      }
      aria-label="Yêu cầu mật khẩu"
    >
      {PASSWORD_REQUIREMENTS.map((requirement) => {
        const met = requirement.test(value);
        return (
          <li key={requirement.id} data-met={met}>
            <span className="password-requirements__mark" aria-hidden="true">
              {met ? '✓' : '○'}
            </span>
            <span>{requirement.label}</span>
            <span className="visually-hidden">
              {met ? ' — đã đạt' : ' — chưa đạt'}
            </span>
          </li>
        );
      })}
    </ul>
  );
}

import { Link } from 'react-router-dom';
import type { PermissionCode } from '@blood/shared-types';
import { useAuth } from '@/features/auth/hooks/useAuth';
import { LANDING_ANCHORS, LANDING_CHAPTERS } from './landing-content';
import { Reveal } from './Reveal';
import { SectionHead } from './SectionHead';

interface LandingAction {
  label: string;
  text: string;
  /** Route for real pages, in-page anchor for the landing's own sections. */
  href: string;
  /** Hidden unless the visitor holds this permission. */
  permission?: PermissionCode;
}

/**
 * Only what the application really serves today: the profile screen and the
 * landing's own sections. Registration, schedules and donation history are not
 * links because those features do not exist yet — no fabricated routes.
 */
const ACTIONS: readonly LandingAction[] = [
  {
    label: 'Hồ sơ cá nhân',
    text: 'Xem và cập nhật thông tin liên hệ của bạn.',
    href: '/profile',
    permission: 'auth.profile.read',
  },
  {
    label: 'Đợt hiến máu sắp tới',
    text: 'Khu vực đợt hiến máu — đang được chuẩn bị.',
    href: `#${LANDING_ANCHORS.campaigns}`,
    permission: 'campaign.read',
  },
  {
    label: 'Hành trình hiến máu',
    text: 'Năm bước từ lúc bạn sẵn lòng đến khi trao đi.',
    href: `#${LANDING_ANCHORS.journey}`,
  },
];

/**
 * Section 07 — personal action area.
 *
 * Entries are filtered by permission, but no permission code, role id or
 * session detail is ever rendered.
 */
export function PersonalActionsSection() {
  const { hasPermission } = useAuth();
  const actions = ACTIONS.filter(
    (action) => !action.permission || hasPermission(action.permission),
  );

  return (
    <section
      className="landing-section landing-section--ivory"
      id={LANDING_ANCHORS.actions}
      aria-labelledby="actions-title"
    >
      <div className="landing-section__inner">
        <SectionHead
          index={LANDING_CHAPTERS.actions}
          eyebrow="Tiếp tục hành trình của bạn"
          titleId="actions-title"
          title={['Bước tiếp theo', 'của bạn.']}
          lead="Những lối đi hiện đang mở cùng hệ thống."
        />

        <Reveal className="landing-actions">
          <ul className="landing-actions__list">
            {actions.map((action) => {
              const content = (
                <>
                  <span className="landing-actions__label">{action.label}</span>
                  <span className="landing-actions__text">{action.text}</span>
                  <span className="landing-actions__mark" aria-hidden="true">
                    ↗
                  </span>
                </>
              );
              return (
                <li className="landing-actions__item" key={action.label}>
                  {action.href.startsWith('#') ? (
                    <a className="landing-link" href={action.href}>
                      {content}
                    </a>
                  ) : (
                    <Link className="landing-link" to={action.href}>
                      {content}
                    </Link>
                  )}
                </li>
              );
            })}
          </ul>
        </Reveal>
      </div>
    </section>
  );
}

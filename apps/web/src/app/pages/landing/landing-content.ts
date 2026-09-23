/**
 * Landing page content model.
 *
 * Anchors are declared once so sections and the links pointing at them cannot
 * drift apart. Copy that is static (the donation journey and preparation
 * guidance) lives here as data instead of being duplicated inside markup.
 *
 * Nothing here is business data: campaigns, registrations, schedules and
 * donation history are not implemented yet (Phase 3), so the landing offers no
 * numbers and no placeholder records.
 */

/** In-page destinations used by the landing navigation. */
export const LANDING_ANCHORS = {
  /**
   * The cover itself. Paged desktop resolves every in-page jump to a chapter
   * boundary, so the closing call to action targets the chapter that carries
   * the single registration control rather than a point inside it.
   */
  hero: 'hero',
  humanStory: 'human-story',
  journey: 'donation-journey',
  impact: 'impact',
  campaigns: 'upcoming-campaigns',
  preparation: 'preparation',
  actions: 'your-journey',
} as const;

/**
 * Chapter numbers in reading order.
 *
 * Declared once so every section agrees: a numeral that is hard-coded per
 * component drifts as soon as a chapter is added or removed.
 *
 * The cover carries no number on purpose — it is a cover, not a chapter, so
 * the numbered story starts at the first section after it.
 */
export const LANDING_CHAPTERS = {
  humanStory: '01',
  journey: '02',
  impact: '03',
  campaigns: '04',
  preparation: '05',
  actions: '06',
  closing: '07',
} as const;

export interface LandingStep {
  title: string;
  description: string;
}

/** Section 03 — the five steps a donor walks through. */
export const DONATION_JOURNEY: readonly LandingStep[] = [
  {
    title: 'Đăng ký',
    description: 'Chọn đợt hiến phù hợp và giữ chỗ cho hành trình của bạn.',
  },
  {
    title: 'Khai báo sức khỏe',
    description:
      'Chia sẻ thông tin sức khỏe trung thực để bảo vệ bạn và người nhận.',
  },
  {
    title: 'Khám & sàng lọc',
    description: 'Nhân viên y tế thăm khám, tư vấn trước khi bạn hiến.',
  },
  {
    title: 'Hiến máu',
    description:
      'Phần máu của bạn được trao đi trong một quy trình an toàn, khép kín.',
  },
  {
    title: 'Theo dõi sau hiến',
    description:
      'Nghỉ ngơi, uống đủ nước và làm theo hướng dẫn của nhân viên y tế.',
  },
];

/** Section 06 — what a donor should prepare before arriving. */
export const PREPARATION_STEPS: readonly LandingStep[] = [
  {
    title: 'Nghỉ ngơi đầy đủ',
    description: 'Ngủ đủ giấc vài ngày trước khi hiến để cơ thể sẵn sàng.',
  },
  {
    title: 'Ăn uống hợp lý',
    description: 'Ăn nhẹ, tránh rượu bia và uống đủ nước trước khi đến.',
  },
  {
    title: 'Chuẩn bị giấy tờ',
    description: 'Mang giấy tờ tuỳ thân để xác nhận thông tin người hiến.',
  },
  {
    title: 'Khai báo trung thực',
    description:
      'Thông tin sức khỏe chính xác giúp máu của bạn an toàn cho người nhận.',
  },
];

/** Two-digit editorial index, e.g. `4` → `04`. */
export const formatIndex = (position: number): string =>
  String(position).padStart(2, '0');

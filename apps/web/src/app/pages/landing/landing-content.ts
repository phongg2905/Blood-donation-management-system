/**
 * Clean Modern Medical Portal - Landing Page Content Model
 *
 * Provides typed data structures for:
 * - In-page anchor navigation
 * - Real-time blood group need levels (Bento grid)
 * - 4-step digital donation journey
 * - Community impact metrics
 * - Verified donor & medical staff stories
 * - Medical FAQ accordion
 * - Backwards-compatible anchors and steps
 */

export const LANDING_ANCHORS = {
  hero: 'hero',
  quickBooking: 'quick-booking',
  campaigns: 'upcoming-campaigns',
  impact: 'impact-needs',
  journey: 'donation-journey',
  storiesFaq: 'stories-faq',
  preparation: 'preparation',
  humanStory: 'human-story',
  actions: 'your-journey',
} as const;

export const LANDING_CHAPTERS = {
  hero: '01',
  campaigns: '02',
  impact: '03',
  journey: '04',
  storiesFaq: '05',
  humanStory: '01',
  actions: '06',
  preparation: '05',
  closing: '07',
} as const;

export interface LandingStep {
  title: string;
  description: string;
}

/** Legacy preparation steps retained for type compatibility */
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

export const formatIndex = (position: number): string =>
  String(position).padStart(2, '0');

/** 4-step digitalized donation journey */
export interface JourneyStep {
  step: string;
  title: string;
  subtitle: string;
  description: string;
  iconName: 'calendar' | 'qr' | 'stethoscope' | 'award';
  badge: string;
}

export const DIGITAL_JOURNEY_STEPS: readonly JourneyStep[] = [
  {
    step: '01',
    title: 'Đăng ký online',
    subtitle: 'Nhanh chóng & Tiện lợi',
    description:
      'Lựa chọn đợt hiến, địa điểm thuận tiện và hoàn thành phiếu khai báo y tế trực tuyến trong 2 phút.',
    iconName: 'calendar',
    badge: 'Chỉ mất 2 phút',
  },
  {
    step: '02',
    title: 'QR Check-in',
    subtitle: 'Không chờ đợi giấy tờ',
    description:
      'Nhận vé hiến máu điện tử kèm mã QR. Quét mã tại quầy tiếp đón để xác thực thông tin ngay lập tức.',
    iconName: 'qr',
    badge: 'Ưu tiên không đợi',
  },
  {
    step: '03',
    title: 'Sàng lọc & Hiến máu',
    subtitle: 'An toàn tuyệt đối 100%',
    description:
      'Bác sĩ thăm khám đo huyết áp, xét nghiệm máu nhanh và lấy máu bằng bộ dụng cụ vô trùng dùng một lần.',
    iconName: 'stethoscope',
    badge: 'Chuẩn Bộ Y Tế',
  },
  {
    step: '04',
    title: 'Chứng nhận điện tử',
    subtitle: 'Lưu trữ & Tra cứu trọn đời',
    description:
      'Chứng nhận hiến máu điện tử được cấp tức thì trên hệ thống, được công nhận trên toàn quốc.',
    iconName: 'award',
    badge: 'Có giá trị toàn quốc',
  },
];

/** Real-time blood group supply & need indicators for Bento card */
export interface BloodGroupNeed {
  group: 'O' | 'A' | 'B' | 'AB';
  rh: '+/-';
  level: 'CRITICAL' | 'HIGH' | 'NORMAL';
  levelText: string;
  reservePercent: number;
  description: string;
}

export const BLOOD_GROUP_NEEDS: readonly BloodGroupNeed[] = [
  {
    group: 'O',
    rh: '+/-',
    level: 'CRITICAL',
    levelText: 'Cần khẩn cấp',
    reservePercent: 34,
    description: 'Nhóm máu truyền cấp cứu cho mọi người, đang thiếu hụt trầm trọng.',
  },
  {
    group: 'A',
    rh: '+/-',
    level: 'HIGH',
    levelText: 'Cần bổ sung',
    reservePercent: 52,
    description: 'Lượng dự trữ dưới ngưỡng an toàn 7 ngày tại các bệnh viện tuyến đầu.',
  },
  {
    group: 'B',
    rh: '+/-',
    level: 'NORMAL',
    levelText: 'Mức ổn định',
    reservePercent: 78,
    description: 'Duy trì đủ cơ số máu điều trị thường quy trong tuần này.',
  },
  {
    group: 'AB',
    rh: '+/-',
    level: 'NORMAL',
    levelText: 'Đủ dự trữ',
    reservePercent: 90,
    description: 'Kho dự trữ đảm bảo tốt nhu cầu điều trị hiện tại.',
  },
];

/** Human Stories / Testimonials */
export interface HumanStory {
  author: string;
  role: string;
  avatarText: string;
  timesDonated?: number;
  quote: string;
  highlight: string;
}

export const HUMAN_STORIES: readonly HumanStory[] = [
  {
    author: 'BS. Lê Thị Phương Thảo',
    role: 'Bác sĩ Hồi sức Cấp cứu · BV Bạch Mai',
    avatarText: 'PT',
    quote:
      'Trong phòng cấp cứu, mỗi phút đều là ranh giới mong manh giữa sự sống và cái chết. Những đơn vị máu được chuẩn bị sẵn chính là chiếc phao cứu sinh trực tiếp nhất cho người bệnh.',
    highlight: 'Hơn 850 bệnh nhân được truyền máu kịp thời mỗi tháng',
  },
  {
    author: 'Nguyễn Minh Quân',
    role: 'Tình nguyện viên hiến máu',
    avatarText: 'MQ',
    timesDonated: 14,
    quote:
      'Quy trình đăng ký online và quét QR mới này siêu nhanh, chỉ mất tầm 20 phút là mình đã hoàn thành. Cảm giác nhìn thấy chứng nhận số gửi về máy thực sự rất ấm lòng và tự hào.',
    highlight: '14 lần hiến máu tình nguyện',
  },
  {
    author: 'Trần Thuỳ Linh',
    role: 'Người hiến máu lần đầu',
    avatarText: 'TL',
    timesDonated: 2,
    quote:
      'Lúc đầu mình rất sợ đau, nhưng các bác sĩ và nhân viên cực kỳ nhẹ nhàng và chu đáo. Sau khi hiến còn được nhận quà bồi dưỡng và theo dõi sức khỏe rất kỹ lưỡng.',
    highlight: 'Đã hoàn thành 2 lần hiến máu an toàn',
  },
];

/** FAQ Items */
export interface FaqItem {
  id: string;
  question: string;
  answer: string;
}

export const FAQ_ITEMS: readonly FaqItem[] = [
  {
    id: 'faq-1',
    question: 'Ai có thể tham gia hiến máu tình nguyện?',
    answer:
      'Mọi công dân khỏe mạnh từ đủ 18 đến 60 tuổi, cân nặng từ 45kg trở lên đối với nữ và 48kg đối với nam, không mắc các bệnh truyền nhiễm qua đường máu (HIV, viêm gan B, viêm gan C, giang mai...) và có huyết áp ổn định đều có thể tham gia hiến máu.',
  },
  {
    id: 'faq-2',
    question: 'Hiến máu có làm ảnh hưởng đến sức khỏe hay không?',
    answer:
      'Hoàn toàn không. Lượng máu hiến (khoảng 250ml - 450ml) chiếm khoảng 1/10 tổng lượng máu trong cơ thể. Tủy xương sẽ được kích thích tái tạo lượng máu mới chỉ sau vài ngày, giúp cơ thể khỏe mạnh và hoạt bát hơn.',
  },
  {
    id: 'faq-3',
    question: 'Cần chuẩn bị gì trước khi đến hiến máu?',
    answer:
      'Đêm trước ngày hiến máu bạn nên ngủ đủ giấc (ít nhất 6 tiếng), không uống rượu bia hay chất kích thích. Sáng ngày hiến nên ăn nhẹ (tránh đồ ăn nhiều dầu mỡ), uống nhiều nước (khoảng 300 - 500ml) và mang theo CCCD/VNeID để đối soát thông tin.',
  },
  {
    id: 'faq-4',
    question: 'Khoảng cách giữa hai lần hiến máu là bao lâu?',
    answer:
      'Theo quy định y tế, khoảng cách tối thiểu giữa 2 lần hiến máu toàn phần là 12 tuần (khoảng 84 ngày). Đối với hiến thành phần máu (gạn tiểu cầu), khoảng cách tối thiểu là 3 tuần.',
  },
  {
    id: 'faq-5',
    question: 'Giấy chứng nhận hiến máu điện tử có quyền lợi gì?',
    answer:
      'Giấy chứng nhận hiến máu điện tử có giá trị tương đương bản giấy trên toàn quốc. Khi bản thân người hiến cần truyền máu tại bất kỳ bệnh viện công lập nào sẽ được bồi hoàn miễn phí số lượng máu tương ứng đã hiến.',
  },
];

/** Impact numbers */
export const IMPACT_METRICS = [
  {
    label: 'Đơn vị máu đã tiếp nhận',
    value: '4,850+',
    subtext: 'Đã phân phối tới 24 bệnh viện',
  },
  {
    label: 'Người đăng ký số hoá',
    value: '14,200+',
    subtext: 'Cộng đồng tình nguyện viên tích cực',
  },
  {
    label: 'Thời gian check-in trung bình',
    value: '1.5 phút',
    subtext: 'Nhanh hơn 80% so với thủ công',
  },
  {
    label: 'Tỷ lệ an toàn truyền máu',
    value: '100%',
    subtext: 'Quy trình kiểm định 5 bước khép kín',
  },
] as const;

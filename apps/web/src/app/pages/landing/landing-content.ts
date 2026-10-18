/**
 * Clean Modern Medical Portal - Landing Page Content Model
 *
 * Professional Medical System Architecture:
 * - Ministry of Health (MoH) & National Institute of Hematology (NIHBT) Standards
 * - Real-time Clinical Blood Group Demand & Inventory Matrix
 * - 5-Step Clinical Blood Donation Pathway (Circular 26/2013 & 15/2023 TT-BYT)
 * - Statutory Donor Rights & Health Benefits
 * - Hospital Partner Network & Verified Medical Testimonials
 * - Clinical FAQ Accordion
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
    description: 'Ngủ đủ giấc tối thiểu 6 tiếng trước ngày hiến máu.',
  },
  {
    title: 'Ăn uống khoa học',
    description: 'Ăn nhẹ, tránh dầu mỡ và uống đủ 300 - 500ml nước.',
  },
  {
    title: 'Giấy tờ tùy thân',
    description: 'Mang theo CCCD gắn chip hoặc ứng dụng định danh VNeID.',
  },
  {
    title: 'Khai báo y tế',
    description: 'Cung cấp thông tin trung thực để đảm bảo an toàn truyền máu.',
  },
];

export const DONATION_JOURNEY: readonly LandingStep[] = [
  {
    title: 'Đăng ký online',
    description: 'Chọn đợt hiến và hoàn thành phiếu khai báo y tế trực tuyến.',
  },
  {
    title: 'Khám sàng lọc',
    description: 'Bác sĩ kiểm tra sức khỏe tổng quát và đo huyết áp.',
  },
  {
    title: 'Xét nghiệm nhanh',
    description: 'Kiểm tra huyết sắc tố và kháng nguyên virus viêm gan B.',
  },
  {
    title: 'Hiến máu',
    description: 'Tiếp nhận máu trong quy trình vô trùng khép kín 1 lần.',
  },
  {
    title: 'Nghỉ ngơi & Nhận quà',
    description: 'Nghỉ ngơi phục hồi thể lực và nhận chứng nhận số toàn quốc.',
  },
];

export const formatIndex = (position: number): string =>
  String(position).padStart(2, '0');

/** 5-Step Clinical Donation Journey (NIHBT & MoH Standard) */
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
    title: 'Đăng ký trực tuyến',
    subtitle: 'Nhanh chóng & Thuận tiện',
    description:
      'Lựa chọn địa điểm, khung giờ thuận tiện và hoàn thành phiếu khai báo y tế trước khi đến.',
    iconName: 'calendar',
    badge: 'Chỉ 2 phút',
  },
  {
    step: '02',
    title: 'Khám sàng lọc y khoa',
    subtitle: 'Bác sĩ chuyên khoa khám',
    description:
      'Bác sĩ kiểm tra tiền sử sức khỏe, đo huyết áp, mạch và tư vấn thể tích hiến phù hợp.',
    iconName: 'stethoscope',
    badge: 'Khám chuyên sâu',
  },
  {
    step: '03',
    title: 'Xét nghiệm máu nhanh',
    subtitle: 'Kiểm định tại chỗ',
    description:
      'Lấy giọt máu đầu ngón tay để kiểm tra nhanh huyết sắc tố và virus viêm gan B.',
    iconName: 'qr',
    badge: 'Chuẩn Bộ Y Tế',
  },
  {
    step: '04',
    title: 'Tiếp nhận hiến máu',
    subtitle: 'Vô trùng tuyệt đối 100%',
    description:
      'Tiếp nhận máu bằng bộ kim và túi dẻo chuyên dụng dùng 1 lần trong 5 - 7 phút.',
    iconName: 'calendar',
    badge: 'An toàn vô trùng',
  },
  {
    step: '05',
    title: 'Bồi dưỡng & Chứng nhận',
    subtitle: 'Quyền lợi toàn quốc',
    description:
      'Nghỉ ngơi tại chỗ, nhận suất ăn nhẹ, gói bồi dưỡng và Giấy chứng nhận điện tử trọn đời.',
    iconName: 'award',
    badge: 'Bồi hoàn trọn đời',
  },
];

/** Real-time clinical blood group supply & need indicators */
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
    description: 'Khối hồng cầu cấp cứu vạn năng, ưu tiên hồi sức tai nạn và chấn thương lớn.',
  },
  {
    group: 'A',
    rh: '+/-',
    level: 'HIGH',
    levelText: 'Cần bổ sung',
    reservePercent: 52,
    description: 'Phục vụ các ca phẫu thuật tim mạch, ghép tạng và cấp cứu đa chấn thương.',
  },
  {
    group: 'B',
    rh: '+/-',
    level: 'NORMAL',
    levelText: 'Mức ổn định',
    reservePercent: 78,
    description: 'Duy trì đủ cơ số điều trị thường quy cho bệnh nhân ung bướu và bệnh máu.',
  },
  {
    group: 'AB',
    rh: '+/-',
    level: 'NORMAL',
    levelText: 'Đủ dự trữ',
    reservePercent: 90,
    description: 'Nhận hồng cầu vạn năng, cung cấp nguồn huyết tương và gạn tách tiểu cầu.',
  },
];

/** Human Stories / Testimonials from Frontline Doctors & Dedicated Donors */
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
    author: 'TS.BS. Nguyễn Văn Chung',
    role: 'Trưởng khoa Cấp cứu · Bệnh viện Bạch Mai',
    avatarText: 'VC',
    quote:
      'Trong cấp cứu tai nạn, mỗi phút chờ máu là một cơ hội sống mong manh. Những đơn vị máu được tiếp nhận và chuẩn bị sẵn chính là nguồn sống trực tiếp giữ lại tính mạng người bệnh.',
    highlight: 'Điều phối hơn 1,200 ca cấp cứu/tháng',
  },
  {
    author: 'Nguyễn Minh Quân',
    role: 'Tình nguyện viên hiến máu thường xuyên',
    avatarText: 'MQ',
    timesDonated: 16,
    quote:
      'Hệ thống số hóa giúp mình đặt lịch trước, đến nơi quét QR làm thủ tục chỉ mất 3 phút. Nhìn thấy thông báo máu của mình đã được chuyển tới bệnh viện thực sự rất ý nghĩa.',
    highlight: '16 lần hiến máu tình nguyện',
  },
  {
    author: 'BS. Lê Thị Phương Thảo',
    role: 'Bác sĩ Viện Huyết học - Truyền máu TW',
    avatarText: 'PT',
    quote:
      'Toàn bộ quy trình từ khâu khám sàng lọc, xét nghiệm đến chiết tách thành phần máu đều tuân thủ nghiêm ngặt chuẩn vô trùng Bộ Y Tế, bảo đảm tuyệt đối an toàn cho người hiến.',
    highlight: 'Chuyên gia an toàn truyền máu',
  },
];

/** Clinical & Legal FAQ Items */
export interface FaqItem {
  id: string;
  question: string;
  answer: string;
}

export const FAQ_ITEMS: readonly FaqItem[] = [
  {
    id: 'faq-1',
    question: 'Tiêu chuẩn sức khỏe để tham gia hiến máu tình nguyện?',
    answer:
      'Công dân từ 18 - 60 tuổi, cân nặng từ 45kg trở lên đối với nữ và 48kg đối với nam, huyết áp ổn định và không mắc các bệnh truyền nhiễm qua đường máu.',
  },
  {
    id: 'faq-2',
    question: 'Quyền lợi bồi hoàn máu của người hiến máu được quy định như thế nào?',
    answer:
      'Theo quy định của Bộ Y Tế, người hiến máu tình nguyện được cấp Giấy chứng nhận và được bồi hoàn miễn phí số lượng máu tương ứng khi bản thân cần truyền máu tại mọi bệnh viện công lập trên toàn quốc.',
  },
  {
    id: 'faq-3',
    question: 'Khoảng cách an toàn tối thiểu giữa các lần hiến máu là bao lâu?',
    answer:
      'Khoảng cách tối thiểu giữa 2 lần hiến máu toàn phần là 12 tuần (khoảng 84 ngày). Đối với hiến thành phần máu (gạn tiểu cầu), khoảng cách tối thiểu là 3 tuần (21 ngày).',
  },
  {
    id: 'faq-4',
    question: 'Cần chuẩn bị gì trước và sau khi tham gia hiến máu?',
    answer:
      'Đêm trước ngày hiến nên ngủ đủ giấc (ít nhất 6 tiếng), không uống rượu bia. Sáng ngày hiến nên ăn nhẹ, uống đủ nước và mang theo CCCD gắn chip hoặc ứng dụng VNeID.',
  },
  {
    id: 'faq-5',
    question: 'Hiến máu có ảnh hưởng tới sức khỏe hay gây tăng cân không?',
    answer:
      'Hoàn toàn không. Lượng máu hiến (250ml - 450ml) chiếm chưa tới 1/10 lượng máu cơ thể. Tủy xương sẽ kích thích sinh máu mới chỉ sau vài ngày, giúp thúc đẩy tuần hoàn khỏe mạnh.',
  },
];

/** Verified National Impact Metrics */
export const IMPACT_METRICS = [
  {
    label: 'Đơn vị máu đã điều phối',
    value: '48,500+',
    subtext: 'Cung cấp trực tiếp cho 24 bệnh viện tuyến đầu',
  },
  {
    label: 'Người đăng ký hiến máu số hóa',
    value: '124,000+',
    subtext: 'Dữ liệu xác thực đồng bộ VNeID',
  },
  {
    label: 'Thời gian check-in trung bình',
    value: '2.5 phút',
    subtext: 'Quy trình không giấy tờ, quét QR tiếp nhận',
  },
  {
    label: 'Tỷ lệ kiểm định an toàn truyền máu',
    value: '100%',
    subtext: 'Kiểm soát 5 tác nhân lây nhiễm theo chuẩn Bộ Y Tế',
  },
] as const;

/** Key Hospital Receiving Hubs (Compatible with CampusBattle interface) */
export interface CampusBattle {
  id: string;
  school: string;
  shortName: string;
  progress: number;
  donors: number;
  target: number;
  color: string;
}

export const CAMPUS_BATTLES: readonly CampusBattle[] = [
  {
    id: 'nihbt',
    school: 'Viện Huyết học - Truyền máu TW',
    shortName: 'Viện Huyết Học TW',
    progress: 88,
    donors: 352,
    target: 400,
    color: '#dc2626',
  },
  {
    id: 'bachmai',
    school: 'Bệnh viện Bạch Mai Hà Nội',
    shortName: 'BV Bạch Mai',
    progress: 92,
    donors: 368,
    target: 400,
    color: '#2563eb',
  },
  {
    id: 'vietduc',
    school: 'Bệnh viện Hữu nghị Việt Đức',
    shortName: 'BV Việt Đức',
    progress: 74,
    donors: 296,
    target: 400,
    color: '#059669',
  },
];

/** Statutory Donor Rights & Health Benefits (Circular 15/2023 & 26/2013 MoH) */
export interface GenZPerk {
  id: string;
  title: string;
  badge: string;
  iconName: 'stethoscope' | 'certificate' | 'nutrition';
  desc: string;
  tagTone: 'red' | 'teal' | 'amber';
}

export const GENZ_PERKS: readonly GenZPerk[] = [
  {
    id: 'screening',
    title: 'Gói xét nghiệm tầm soát sức khỏe',
    badge: 'Miễn phí 100%',
    iconName: 'stethoscope',
    desc: 'Xét nghiệm 5 bệnh truyền nhiễm qua đường máu, nhóm máu ABO & Rh, chức năng gan thận.',
    tagTone: 'teal',
  },
  {
    id: 'reimbursement',
    title: 'Quyền bồi hoàn máu toàn quốc',
    badge: 'Luật Y Tế',
    iconName: 'certificate',
    desc: 'Được truyền máu miễn phí tương đương lượng máu đã hiến tại mọi bệnh viện công lập toàn quốc.',
    tagTone: 'red',
  },
  {
    id: 'nutrition',
    title: 'Chế độ bồi dưỡng & Phục hồi',
    badge: 'Quy định Nhà Nước',
    iconName: 'nutrition',
    desc: 'Suất ăn nhẹ tại chỗ, chi phí hỗ trợ đi lại, thuốc bổ vi chất sắt và quà tặng bồi dưỡng sức khỏe.',
    tagTone: 'amber',
  },
];

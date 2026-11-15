import {
  BloodType,
  Gender,
  CampaignStatus,
  CampaignAssignment,
} from '@prisma/client';
import {
  PERMISSION_CODES,
  ROLE_CODES,
  ROLE_NAMES,
  ROLE_PERMISSIONS,
} from '@blood/shared-types';
import { hashPassword } from '../../common/security/password';
import { database } from '../../config/database';
import { env } from '../../config/env';

const DEMO_PASSWORD = 'Donation@2026';

// ---------------------------------------------------------------------------
// 1. Core Base Setup (Roles, Permissions, Core Demo Accounts)
// ---------------------------------------------------------------------------

async function ensureRolesAndPermissions(): Promise<{
  donorRoleId: string;
  staffRoleId: string;
  coordinatorRoleId: string;
  adminRoleId: string;
}> {
  for (const code of ROLE_CODES) {
    await database.role.upsert({
      where: { code },
      create: { code, name: ROLE_NAMES[code] },
      update: { name: ROLE_NAMES[code] },
    });
  }

  for (const code of PERMISSION_CODES) {
    await database.permission.upsert({
      where: { code },
      create: { code, name: code },
      update: { name: code },
    });
  }

  const [roles, permissions, existing] = await Promise.all([
    database.role.findMany({ select: { id: true, code: true } }),
    database.permission.findMany({ select: { id: true, code: true } }),
    database.rolePermission.findMany({ select: { id: true, roleId: true, permissionId: true } }),
  ]);

  const roleIdByCode = new Map(roles.map((r) => [r.code, r.id]));
  const permissionIdByCode = new Map(permissions.map((p) => [p.code, p.id]));
  const desired = new Set<string>();
  const toCreate: { roleId: string; permissionId: string }[] = [];

  for (const roleCode of ROLE_CODES) {
    const roleId = roleIdByCode.get(roleCode);
    if (!roleId) continue;
    for (const permCode of ROLE_PERMISSIONS[roleCode]) {
      const permId = permissionIdByCode.get(permCode);
      if (!permId) continue;
      const key = `${roleId}:${permId}`;
      desired.add(key);
    }
  }

  const existingKeys = new Set(existing.map((row) => `${row.roleId}:${row.permissionId}`));
  for (const key of desired) {
    if (existingKeys.has(key)) continue;
    const parts = key.split(':');
    const roleId = parts[0];
    const permissionId = parts[1];
    if (roleId && permissionId) toCreate.push({ roleId, permissionId });
  }

  if (toCreate.length > 0) {
    await database.rolePermission.createMany({ data: toCreate, skipDuplicates: true });
  }

  return {
    donorRoleId: roleIdByCode.get('DONOR')!,
    staffRoleId: roleIdByCode.get('DONATION_STAFF')!,
    coordinatorRoleId: roleIdByCode.get('COORDINATOR')!,
    adminRoleId: roleIdByCode.get('SYSTEM_ADMIN')!,
  };
}

// ---------------------------------------------------------------------------
// 2. Clean previous rich demo seed data (while strictly keeping 4 core accounts)
// ---------------------------------------------------------------------------

async function cleanupPreviousRichData(): Promise<void> {
  console.info('Dọn dẹp dữ liệu rich seed trước đó (giữ nguyên 4 tài khoản hệ thống gốc)...');

  const CORE_EMAILS = [
    'admin@example.local',
    'donor.demo@example.local',
    'donation-staff.demo@example.local',
    'donation-staff-2.demo@example.local',
    'donation-staff-3.demo@example.local',
    'coordinator.demo@example.local',
    env.ADMIN_EMAIL ?? '',
  ].filter(Boolean);

  // Clean operational data first
  await database.postDonationReaction.deleteMany({});
  await database.bloodBag.deleteMany({});
  await database.certificate.deleteMany({});
  await database.donation.deleteMany({});
  await database.screeningTest.deleteMany({});
  await database.screening.deleteMany({});
  await database.checkIn.deleteMany({});
  await database.healthDeclaration.deleteMany({});
  await database.registration.deleteMany({});
  await database.campaignStaff.deleteMany({});
  await database.campaignTimeSlot.deleteMany({});
  await database.donationCampaign.deleteMany({});
  await database.notification.deleteMany({});

  // Ensure core demo accounts have realistic names and complete contact info
  const coreDonorUser = await database.user.findUnique({
    where: { email: 'donor.demo@example.local' },
    select: { id: true },
  });
  if (coreDonorUser) {
    await database.user.update({
      where: { id: coreDonorUser.id },
      data: { fullName: 'Nguyễn Minh Quân' },
    });
    await database.donorProfile.updateMany({
      where: { userId: coreDonorUser.id },
      data: {
        phone: '0901234567',
        address: '124 Nguyễn Huệ, Quận 1, TP.HCM',
        gender: 'MALE',
        dateOfBirth: new Date('1995-05-15T00:00:00.000Z'),
        bloodType: 'O_POSITIVE',
      },
    });
  }

  const coreStaffUser = await database.user.findUnique({
    where: { email: 'donation-staff.demo@example.local' },
    select: { id: true },
  });
  if (coreStaffUser) {
    await database.user.update({
      where: { id: coreStaffUser.id },
      data: { fullName: 'CN. Nguyễn Hoàng Minh' },
    });
    await database.donorProfile.updateMany({
      where: { userId: coreStaffUser.id },
      data: {
        phone: '0901001003',
        address: '456 Hai Bà Trưng, Quận 1, TP.HCM',
        gender: 'MALE',
        dateOfBirth: new Date('1995-08-20T00:00:00.000Z'),
      },
    });
  }

  // Ensure the 2nd demo staff account (donation-staff-2.demo@example.local) exists with Demo@Password1
  const demoStaff2PasswordHash = await hashPassword('Demo@Password1');
  const staffRoleRecord = await database.role.findUnique({
    where: { code: 'DONATION_STAFF' },
    select: { id: true },
  });
  if (staffRoleRecord) {
    const coreStaff2User = await database.user.upsert({
      where: { email: 'donation-staff-2.demo@example.local' },
      create: {
        email: 'donation-staff-2.demo@example.local',
        fullName: 'BS. Trần Minh Đức',
        passwordHash: demoStaff2PasswordHash,
        isActive: true,
        emailVerifiedAt: new Date('2025-12-01T08:00:00Z'),
      },
      update: {
        fullName: 'BS. Trần Minh Đức',
        passwordHash: demoStaff2PasswordHash,
        isActive: true,
      },
    });
    await database.userRole.upsert({
      where: {
        userId_roleId: {
          userId: coreStaff2User.id,
          roleId: staffRoleRecord.id,
        },
      },
      create: {
        userId: coreStaff2User.id,
        roleId: staffRoleRecord.id,
      },
      update: {},
    });
    await database.donorProfile.upsert({
      where: { userId: coreStaff2User.id },
      create: {
        userId: coreStaff2User.id,
        citizenId: '079091001005',
        phone: '0901001005',
        address: '88 Lý Tự Trọng, Quận 1, TP.HCM',
        gender: 'MALE',
        dateOfBirth: new Date('1991-04-12T00:00:00.000Z'),
      },
      update: {
        citizenId: '079091001005',
        phone: '0901001005',
        address: '88 Lý Tự Trọng, Quận 1, TP.HCM',
        gender: 'MALE',
        dateOfBirth: new Date('1991-04-12T00:00:00.000Z'),
      },
    });

    const coreStaff3User = await database.user.upsert({
      where: { email: 'donation-staff-3.demo@example.local' },
      create: {
        email: 'donation-staff-3.demo@example.local',
        fullName: 'KTV. Lê Thị Thu Hà',
        passwordHash: demoStaff2PasswordHash,
        isActive: true,
        emailVerifiedAt: new Date('2025-12-01T08:00:00Z'),
      },
      update: {
        fullName: 'KTV. Lê Thị Thu Hà',
        passwordHash: demoStaff2PasswordHash,
        isActive: true,
      },
    });
    await database.userRole.upsert({
      where: {
        userId_roleId: {
          userId: coreStaff3User.id,
          roleId: staffRoleRecord.id,
        },
      },
      create: {
        userId: coreStaff3User.id,
        roleId: staffRoleRecord.id,
      },
      update: {},
    });
    await database.donorProfile.upsert({
      where: { userId: coreStaff3User.id },
      create: {
        userId: coreStaff3User.id,
        citizenId: '079194001006',
        phone: '0901001006',
        address: '152 Điện Biên Phủ, Quận 3, TP.HCM',
        gender: 'FEMALE',
        dateOfBirth: new Date('1994-09-18T00:00:00.000Z'),
      },
      update: {
        citizenId: '079194001006',
        phone: '0901001006',
        address: '152 Điện Biên Phủ, Quận 3, TP.HCM',
        gender: 'FEMALE',
        dateOfBirth: new Date('1994-09-18T00:00:00.000Z'),
      },
    });
  }

  const coreCoordUser = await database.user.findUnique({
    where: { email: 'coordinator.demo@example.local' },
    select: { id: true },
  });
  if (coreCoordUser) {
    await database.user.update({
      where: { id: coreCoordUser.id },
      data: { fullName: 'ThS. Trần Minh Khôi' },
    });
    await database.donorProfile.updateMany({
      where: { userId: coreCoordUser.id },
      data: {
        phone: '0901001004',
        address: '201B Nguyễn Chí Thanh, Quận 5, TP.HCM',
        gender: 'MALE',
        dateOfBirth: new Date('1990-03-10T00:00:00.000Z'),
      },
    });
  }

  // Delete non-core rich seed users
  const richUsers = await database.user.findMany({
    where: {
      email: {
        notIn: CORE_EMAILS,
      },
    },
    select: { id: true },
  });

  if (richUsers.length > 0) {
    const userIds = richUsers.map((u) => u.id);
    await database.donorProfile.deleteMany({ where: { userId: { in: userIds } } });
    await database.userRole.deleteMany({ where: { userId: { in: userIds } } });
    await database.authSession.deleteMany({ where: { userId: { in: userIds } } });
    await database.notification.deleteMany({ where: { userId: { in: userIds } } });
    await database.auditLog.deleteMany({ where: { actorId: { in: userIds } } });
    await database.user.deleteMany({ where: { id: { in: userIds } } });
    console.info(`Đã dọn dẹp ${userIds.length} tài khoản mẫu cũ.`);
  }
}

// ---------------------------------------------------------------------------
// 3. Coordinators (5 accounts)
// ---------------------------------------------------------------------------

const COORDINATOR_SPECS = [
  {
    email: 'coordinator.choray@example.com',
    fullName: 'BS. CKII Lê Hoàng Nam',
    org: 'Bệnh viện Chợ Rẫy TP.HCM',
  },
  {
    email: 'coordinator.nihbt@example.com',
    fullName: 'ThS. BS. Nguyễn Thị Mai Anh',
    org: 'Viện Huyết học - Truyền máu TW Hà Nội',
  },
  {
    email: 'coordinator.bth@example.com',
    fullName: 'BS. Trần Quốc Tuấn',
    org: 'BV Truyền máu Huyết học TP.HCM',
  },
  {
    email: 'coordinator.danang@example.com',
    fullName: 'BS. CKI Phan Thị Minh Trang',
    org: 'BV Đa khoa Đà Nẵng',
  },
  {
    email: 'coordinator.hcmredcross@example.com',
    fullName: 'Ông Đặng Hữu Phúc',
    org: 'Hội Chữ Thập Đỏ TP.HCM',
  },
];

// ---------------------------------------------------------------------------
// 4. Donation Staff (45 accounts: 15 doctors, 20 technicians/nurses, 10 receptionists)
// ---------------------------------------------------------------------------

const STAFF_SPECS: { email: string; fullName: string; defaultAssignment: CampaignAssignment }[] = [
  // 15 Doctors for Screening
  { email: 'staff.bs.hung@example.com', fullName: 'BS. Nguyễn Văn Hùng', defaultAssignment: 'SCREENING' },
  { email: 'staff.bs.oanh@example.com', fullName: 'BS. Đỗ Kim Oanh', defaultAssignment: 'SCREENING' },
  { email: 'staff.bs.hunglq@example.com', fullName: 'BS. Lê Quang Hưng', defaultAssignment: 'SCREENING' },
  { email: 'staff.bs.thao@example.com', fullName: 'BS. Phạm Thanh Thảo', defaultAssignment: 'SCREENING' },
  { email: 'staff.bs.long@example.com', fullName: 'BS. Trương Hoàng Long', defaultAssignment: 'SCREENING' },
  { email: 'staff.bs.duyen@example.com', fullName: 'BS. Vũ Mỹ Duyên', defaultAssignment: 'SCREENING' },
  { email: 'staff.bs.khoa@example.com', fullName: 'BS. Đặng Đăng Khoa', defaultAssignment: 'SCREENING' },
  { email: 'staff.bs.linh@example.com', fullName: 'BS. Hoàng Thùy Linh', defaultAssignment: 'SCREENING' },
  { email: 'staff.bs.hai@example.com', fullName: 'BS. Trần Thanh Hải', defaultAssignment: 'SCREENING' },
  { email: 'staff.bs.ngan@example.com', fullName: 'BS. Bùi Kim Ngân', defaultAssignment: 'SCREENING' },
  { email: 'staff.bs.thanh@example.com', fullName: 'BS. Ngô Tiến Thành', defaultAssignment: 'SCREENING' },
  { email: 'staff.bs.huong@example.com', fullName: 'BS. Dương Thu Hương', defaultAssignment: 'SCREENING' },
  { email: 'staff.bs.phong@example.com', fullName: 'BS. Lý Hải Phong', defaultAssignment: 'SCREENING' },
  { email: 'staff.bs.mai@example.com', fullName: 'BS. Đinh Tuyết Mai', defaultAssignment: 'SCREENING' },
  { email: 'staff.bs.nam@example.com', fullName: 'BS. Hà Quốc Nam', defaultAssignment: 'SCREENING' },

  // 20 Nurses/Technicians for Collection
  { email: 'staff.ktv.thuy@example.com', fullName: 'ĐD. Nguyễn Thị Thúy', defaultAssignment: 'COLLECTION' },
  { email: 'staff.ktv.thang@example.com', fullName: 'KTV. Phan Đình Thắng', defaultAssignment: 'COLLECTION' },
  { email: 'staff.ktv.dieu@example.com', fullName: 'ĐD. Lê Thị Diệu', defaultAssignment: 'COLLECTION' },
  { email: 'staff.ktv.cuong@example.com', fullName: 'KTV. Vũ Đức Cường', defaultAssignment: 'COLLECTION' },
  { email: 'staff.ktv.thuyht@example.com', fullName: 'ĐD. Hoàng Thu Thủy', defaultAssignment: 'COLLECTION' },
  { email: 'staff.ktv.hau@example.com', fullName: 'KTV. Đoàn Văn Hậu', defaultAssignment: 'COLLECTION' },
  { email: 'staff.ktv.tam@example.com', fullName: 'ĐD. Tạ Minh Tâm', defaultAssignment: 'COLLECTION' },
  { email: 'staff.ktv.vinh@example.com', fullName: 'KTV. Trương Công Vinh', defaultAssignment: 'COLLECTION' },
  { email: 'staff.ktv.ha@example.com', fullName: 'ĐD. Cao Ngọc Hà', defaultAssignment: 'COLLECTION' },
  { email: 'staff.ktv.phat@example.com', fullName: 'KTV. Lâm Văn Phát', defaultAssignment: 'COLLECTION' },
  { email: 'staff.ktv.tram@example.com', fullName: 'ĐD. Huỳnh Bảo Trâm', defaultAssignment: 'COLLECTION' },
  { email: 'staff.ktv.dung@example.com', fullName: 'KTV. Đỗ Mạnh Dũng', defaultAssignment: 'COLLECTION' },
  { email: 'staff.ktv.anh@example.com', fullName: 'ĐD. Ngô Quỳnh Anh', defaultAssignment: 'COLLECTION' },
  { email: 'staff.ktv.buu@example.com', fullName: 'KTV. Tạ Quang Bửu', defaultAssignment: 'COLLECTION' },
  { email: 'staff.ktv.hanh@example.com', fullName: 'ĐD. Võ Mỹ Hạnh', defaultAssignment: 'COLLECTION' },
  { email: 'staff.ktv.bao@example.com', fullName: 'KTV. Trần Quốc Bảo', defaultAssignment: 'COLLECTION' },
  { email: 'staff.ktv.huu@example.com', fullName: 'ĐD. Lương Bích Hữu', defaultAssignment: 'COLLECTION' },
  { email: 'staff.ktv.truong@example.com', fullName: 'KTV. Mai Xuân Trường', defaultAssignment: 'COLLECTION' },
  { email: 'staff.ktv.thao@example.com', fullName: 'ĐD. Đặng Thu Thảo', defaultAssignment: 'COLLECTION' },
  { email: 'staff.ktv.huy@example.com', fullName: 'KTV. Phạm Đức Huy', defaultAssignment: 'COLLECTION' },

  // 10 Receptionists for Check-in
  { email: 'staff.tiepdon.phuong@example.com', fullName: 'ĐD. Bùi Bích Phương', defaultAssignment: 'CHECK_IN' },
  { email: 'staff.tiepdon.canh@example.com', fullName: 'CN. Mai Văn Cảnh', defaultAssignment: 'CHECK_IN' },
  { email: 'staff.tiepdon.nhung@example.com', fullName: 'ĐD. Nguyễn Thị Hồng Nhung', defaultAssignment: 'CHECK_IN' },
  { email: 'staff.tiepdon.quyet@example.com', fullName: 'CN. Trịnh Văn Quyết', defaultAssignment: 'CHECK_IN' },
  { email: 'staff.tiepdon.trang@example.com', fullName: 'ĐD. Trần Thu Trang', defaultAssignment: 'CHECK_IN' },
  { email: 'staff.tiepdon.dang@example.com', fullName: 'CN. Hồ Hải Đăng', defaultAssignment: 'CHECK_IN' },
  { email: 'staff.tiepdon.chi@example.com', fullName: 'ĐD. Lê Thùy Chi', defaultAssignment: 'CHECK_IN' },
  { email: 'staff.tiepdon.anh@example.com', fullName: 'CN. Phạm Tuấn Anh', defaultAssignment: 'CHECK_IN' },
  { email: 'staff.tiepdon.tuong@example.com', fullName: 'ĐD. Vũ Cát Tường', defaultAssignment: 'CHECK_IN' },
  { email: 'staff.tiepdon.khanh@example.com', fullName: 'CN. Đặng Xuân Khánh', defaultAssignment: 'CHECK_IN' },
];

// ---------------------------------------------------------------------------
// 5. 150 Donors (Realistic demographic distribution)
// ---------------------------------------------------------------------------

const FIRST_NAMES_MALE = [
  'Văn An', 'Minh Tuấn', 'Đức Cường', 'Hoàng Long', 'Thanh Hải', 'Quốc Bảo', 'Hữu Phúc', 'Thành Đạt',
  'Tuấn Anh', 'Quang Vinh', 'Hồng Quân', 'Xuân Bách', 'Trọng Hiếu', 'Đình Trọng', 'Văn Hậu', 'Tiến Dũng',
  'Công Phượng', 'Quang Hải', 'Hùng Dũng', 'Văn Toàn', 'Đức Huy', 'Duy Mạnh', 'Minh Vương', 'Xuân Trường',
  'Đức Chinh', 'Tấn Tài', 'Việt Anh', 'Thanh Bình', 'Hoàng Đức', 'Tuấn Hải', 'Văn Khang', 'Quốc Việt',
  'Thanh Nhân', 'Văn Tùng', 'Ngọc Hải', 'Trọng Hoàng', 'Anh Đức', 'Văn Quyết', 'Thành Lương', 'Minh Phương',
];

const FIRST_NAMES_FEMALE = [
  'Thị Mai', 'Thu Hà', 'Thanh Thảo', 'Mỹ Linh', 'Hồng Nhung', 'Bích Phương', 'Tuyết Mai', 'Ngọc Anh',
  'Thu Trang', 'Kim Ngân', 'Phương Thảo', 'Thùy Chi', 'Bảo Trâm', 'Mỹ Hạnh', 'Quỳnh Anh', 'Thu Thủy',
  'Bích Ngọc', 'Lan Hương', 'Minh Hằng', 'Khánh Linh', 'Diệu Nhi', 'Ánh Tuyết', 'Thanh Hằng', 'Hà My',
  'Yến Nhi', 'Phương Linh', 'Thảo My', 'Ngọc Trâm', 'Kim Oanh', 'Thùy Dung', 'Bảo Ngọc', 'Hoàng Yến',
  'Minh Thư', 'Như Quỳnh', 'Thanh Vân', 'Hồng Hạnh', 'Thúy Hằng', 'Mai Phương', 'Tú Anh', 'Hương Giang',
];

const SURNAMES = [
  'Nguyễn', 'Trần', 'Lê', 'Phạm', 'Hoàng', 'Huỳnh', 'Phan', 'Vũ', 'Võ', 'Đặng', 'Bùi', 'Đỗ', 'Hồ', 'Ngô', 'Dương', 'Lý',
];

const PROVINCE_CODES = [
  { code: '079', name: 'TP. Hồ Chí Minh' },
  { code: '001', name: 'TP. Hà Nội' },
  { code: '048', name: 'TP. Đà Nẵng' },
  { code: '074', name: 'Bình Dương' },
  { code: '080', name: 'Long An' },
  { code: '046', name: 'Thừa Thiên Huế' },
  { code: '092', name: 'TP. Cần Thơ' },
];

const STREET_ADDRESSES: Record<string, string[]> = {
  '079': [
    '124 Nguyễn Huệ, Phường Bến Nghé, Quận 1, TP.HCM',
    '45/2 Điện Biên Phủ, Phường 15, Bình Thạnh, TP.HCM',
    '312 Cách Mạng Tháng 8, Phường 10, Quận 3, TP.HCM',
    '78 Lý Thường Kiệt, Phường 7, Tân Bình, TP.HCM',
    '562 Nguyễn Trãi, Phường 8, Quận 5, TP.HCM',
    '89 Đường 3/2, Phường 11, Quận 10, TP.HCM',
    '230 Võ Văn Ngân, Bình Thọ, TP. Thủ Đức, TP.HCM',
    '15 Tân Hương, Phường Tân Quý, Tân Phú, TP.HCM',
    '400 Nguyễn Văn Linh, Tân Phú, Quận 7, TP.HCM',
    '180 Lê Văn Sỹ, Phường 14, Quận 3, TP.HCM',
  ],
  '001': [
    '25 Tràng Tiền, Hoàn Kiếm, Hà Nội',
    '180 Cầu Giấy, Quan Hoa, Cầu Giấy, Hà Nội',
    '88 Kim Mã, Giảng Võ, Ba Đình, Hà Nội',
    '310 Nguyễn Trãi, Thanh Xuân Trung, Thanh Xuân, Hà Nội',
    '54 Phố Huế, Hàng Bài, Hai Bà Trưng, Hà Nội',
    '142 Hoàng Hoa Thám, Thụy Khuê, Tây Hồ, Hà Nội',
  ],
  '048': [
    '56 Bạch Đằng, Hải Châu 1, Hải Châu, Đà Nẵng',
    '108 Nguyễn Văn Linh, Nam Dương, Hải Châu, Đà Nẵng',
    '240 Điện Biên Phủ, Chính Gián, Thanh Khê, Đà Nẵng',
    '72 Võ Nguyên Giáp, Phước Mỹ, Sơn Trà, Đà Nẵng',
  ],
  '074': [
    '85 Đại lộ Bình Dương, Phú Hòa, Thủ Dầu Một, Bình Dương',
    '12 Yersin, Hiệp Thành, Thủ Dầu Một, Bình Dương',
    '45 ĐT743, Dĩ An, TP. Dĩ An, Bình Dương',
  ],
  '080': [
    '12 Trương Định, Phường 2, TP. Tân An, Long An',
    '88 Quốc Lộ 1A, Bến Lức, Long An',
  ],
  '046': [
    '18 Lê Lợi, Vĩnh Ninh, TP. Huế, Thừa Thiên Huế',
    '50 Hùng Vương, Phú Nhuận, TP. Huế, Thừa Thiên Huế',
  ],
  '092': [
    '68 Đại lộ Hòa Bình, Tân An, Ninh Kiều, Cần Thơ',
    '132 Đường 30/4, Xuân Khánh, Ninh Kiều, Cần Thơ',
  ],
};

function generate150Donors() {
  const donors: {
    index: number;
    email: string;
    fullName: string;
    gender: Gender;
    dateOfBirth: Date;
    citizenId: string;
    bloodType: BloodType | null;
    phone: string;
    address: string;
    emergencyName: string;
    emergencyPhone: string;
  }[] = [];

  const bloodTypePool: (BloodType | null)[] = [
    ...Array(92).fill('O_POSITIVE'),
    ...Array(65).fill('B_POSITIVE'),
    ...Array(42).fill('A_POSITIVE'),
    ...Array(11).fill('AB_POSITIVE'),
    'O_NEGATIVE',
    'B_NEGATIVE',
    'A_NEGATIVE',
    null,
    null,
    null,
    null,
    null,
    null,
    null,
  ];

  for (let i = 1; i <= 220; i++) {
    const isMale = i % 2 !== 0;
    const gender: Gender = isMale ? 'MALE' : 'FEMALE';
    const surname = SURNAMES[(i * 7) % SURNAMES.length] ?? 'Nguyễn';
    const givenName = isMale
      ? FIRST_NAMES_MALE[(i * 3) % FIRST_NAMES_MALE.length] ?? 'Văn An'
      : FIRST_NAMES_FEMALE[(i * 3) % FIRST_NAMES_FEMALE.length] ?? 'Thị Mai';
    const fullName = `${surname} ${givenName}`;

    // Age between 19 and 52
    const birthYear = 1974 + ((i * 13) % 33);
    const birthMonth = 1 + ((i * 5) % 12);
    const birthDay = 1 + ((i * 7) % 28);
    const dateOfBirth = new Date(Date.UTC(birthYear, birthMonth - 1, birthDay));

    const prov = PROVINCE_CODES[i % PROVINCE_CODES.length] ?? { code: '079', name: 'TP. Hồ Chí Minh' };
    const provCode = prov.code;
    let genderCenturyDigit = 0;
    if (birthYear < 2000) {
      genderCenturyDigit = isMale ? 0 : 1;
    } else {
      genderCenturyDigit = isMale ? 2 : 3;
    }
    const yearDigits = String(birthYear).slice(-2);
    const uniqueDigits = String(100000 + i * 271).slice(-6);
    const citizenId = `${provCode}${genderCenturyDigit}${yearDigits}${uniqueDigits}`;

    const bloodType = (bloodTypePool[i - 1] !== undefined) ? bloodTypePool[i - 1]! : null;

    const phonePrefix = ['090', '091', '093', '094', '097', '098', '089', '038', '039'][(i * 3) % 9] ?? '090';
    const phone = `${phonePrefix}${String(1000000 + i * 4921).slice(-7)}`;

    const addresses = STREET_ADDRESSES[provCode] ?? STREET_ADDRESSES['079'] ?? [];
    const address = addresses[(i * 2) % addresses.length] ?? '124 Nguyễn Huệ, Quận 1, TP.HCM';

    const emergencySurname = SURNAMES[(i * 3) % SURNAMES.length] ?? 'Trần';
    const emergencyName = `${emergencySurname} ${isMale ? 'Thị Lan (Vợ/Mẹ)' : 'Văn Dũng (Chồng/Bố)'}`;
    const emergencyPhone = `09${String(10000000 + i * 8312).slice(-8)}`;

    donors.push({
      index: i,
      email: `donor${String(i).padStart(3, '0')}@example.com`,
      fullName,
      gender,
      dateOfBirth,
      citizenId,
      bloodType,
      phone,
      address,
      emergencyName,
      emergencyPhone,
    });
  }

  return donors;
}

// ---------------------------------------------------------------------------
// 6. 20 Donation Campaigns (Matching the approved plan)
// ---------------------------------------------------------------------------

interface CampaignSpec {
  name: string;
  location: string;
  organizerName: string;
  contactPhone: string;
  description: string;
  status: CampaignStatus;
  startsAt: Date;
  endsAt: Date;
  targetDonors: number;
  targetBloodVolumeMl: number;
  hospitalPrefix: string;
  registrationOpensAt?: Date;
  registrationClosesAt?: Date;
}

const CAMPAIGN_SPECS: CampaignSpec[] = [
  // 10 COMPLETED Campaigns (Jan to Sep 2026)
  {
    name: 'Xuân Hồng Chợ Rẫy 2026',
    location: 'Bệnh viện Chợ Rẫy - 201B Nguyễn Chí Thanh, Phường 12, Quận 5, TP.HCM',
    organizerName: 'Trung tâm Truyền máu Bệnh viện Chợ Rẫy',
    contactPhone: '02838554137',
    description: 'Chiến dịch hiến máu tình nguyện đầu xuân tại Bệnh viện Chợ Rẫy, bổ sung nguồn máu dự trữ điều trị dịp Tết.',
    status: 'COMPLETED',
    startsAt: new Date('2026-01-15T07:30:00+07:00'),
    endsAt: new Date('2026-01-15T16:30:00+07:00'),
    targetDonors: 250,
    targetBloodVolumeMl: 87500,
    hospitalPrefix: 'CR',
  },
  {
    name: 'Giọt Hồng Blouse Trắng',
    location: 'Viện Huyết học - Truyền máu TW - Phố Phạm Văn Bạch, Cầu Giấy, Hà Nội',
    organizerName: 'Đoàn Thanh niên Viện Huyết học - Truyền máu TW',
    contactPhone: '02437821895',
    description: 'Chương trình hiến máu nhân dịp kỷ niệm Ngày Thầy thuốc Việt Nam 27/2, quy tụ y bác sĩ và nhân dân Thủ đô.',
    status: 'COMPLETED',
    startsAt: new Date('2026-02-27T07:30:00+07:00'),
    endsAt: new Date('2026-02-27T16:30:00+07:00'),
    targetDonors: 300,
    targetBloodVolumeMl: 105000,
    hospitalPrefix: 'NIHBT',
  },
  {
    name: 'Hành Trình Đỏ - Ngày Hội Bách Khoa',
    location: 'ĐH Bách Khoa ĐHQG TP.HCM - 268 Lý Thường Kiệt, Phường 14, Quận 10, TP.HCM',
    organizerName: 'Hội Sinh viên ĐH Bách Khoa phối hợp Bệnh viện Chợ Rẫy',
    contactPhone: '02838647256',
    description: 'Ngày hội hiến máu truyền thống của sinh viên Bách Khoa, lan tỏa nghĩa cử cao đẹp vì cộng đồng.',
    status: 'COMPLETED',
    startsAt: new Date('2026-03-12T07:30:00+07:00'),
    endsAt: new Date('2026-03-12T15:30:00+07:00'),
    targetDonors: 400,
    targetBloodVolumeMl: 140000,
    hospitalPrefix: 'CR',
  },
  {
    name: 'Sắc Đỏ Sông Hàn 2026',
    location: 'Bệnh viện Đa khoa Đà Nẵng - 124 Hải Phòng, Thạch Thang, Hải Châu, Đà Nẵng',
    organizerName: 'Khoa Huyết học Truyền máu BV Đà Nẵng',
    contactPhone: '02363821118',
    description: 'Chương trình vận động hiến máu tình nguyện quy mô lớn khu vực miền Trung, đón nhận đông đảo người dân Đà Nẵng.',
    status: 'COMPLETED',
    startsAt: new Date('2026-04-05T07:30:00+07:00'),
    endsAt: new Date('2026-04-05T16:00:00+07:00'),
    targetDonors: 200,
    targetBloodVolumeMl: 70000,
    hospitalPrefix: 'DNG',
  },
  {
    name: 'Trái Tim Tình Nguyện - ĐH Y Dược',
    location: 'BV ĐH Y Dược TP.HCM - 215 Hồng Bàng, Phường 11, Quận 5, TP.HCM',
    organizerName: 'Đoàn Thanh niên Bệnh viện Đại học Y Dược TP.HCM',
    contactPhone: '02838554269',
    description: 'Ngày hội hiến máu do đoàn viên, giảng viên và sinh viên khối ngành khoa học sức khỏe ĐHYD TP.HCM tham gia.',
    status: 'COMPLETED',
    startsAt: new Date('2026-04-22T08:00:00+07:00'),
    endsAt: new Date('2026-04-22T16:00:00+07:00'),
    targetDonors: 220,
    targetBloodVolumeMl: 77000,
    hospitalPrefix: 'UMP',
  },
  {
    name: 'Giọt Máu Tri Ân Tháng 5',
    location: 'Bệnh viện Bạch Mai - 78 Giải Phóng, Phương Mai, Đống Đa, Hà Nội',
    organizerName: 'Trung tâm Huyết học và Truyền máu - Bệnh viện Bạch Mai',
    contactPhone: '02438693731',
    description: 'Chương trình hiến máu thường niên của Bệnh viện Bạch Mai, tiếp nhận nguồn máu phục vụ cấp cứu bệnh nhân nặng.',
    status: 'COMPLETED',
    startsAt: new Date('2026-05-15T07:30:00+07:00'),
    endsAt: new Date('2026-05-15T16:30:00+07:00'),
    targetDonors: 280,
    targetBloodVolumeMl: 98000,
    hospitalPrefix: 'BM',
  },
  {
    name: 'Hành Trình Đỏ - Trái Tim Miền Trung',
    location: 'Bệnh viện Trung ương Huế - 16 Lê Lợi, Vĩnh Ninh, TP. Huế',
    organizerName: 'Trung tâm Huyết học Truyền máu khu vực Huế',
    contactPhone: '02343822325',
    description: 'Điểm dừng chân của chiến dịch Hành trình Đỏ quốc gia tại cố đô Huế, thu hút tình nguyện viên các trường đại học.',
    status: 'COMPLETED',
    startsAt: new Date('2026-06-08T07:30:00+07:00'),
    endsAt: new Date('2026-06-08T15:30:00+07:00'),
    targetDonors: 180,
    targetBloodVolumeMl: 63000,
    hospitalPrefix: 'HUE',
  },
  {
    name: 'Hưởng Ứng Ngày Quốc Tế Người Hiến Máu (14/6)',
    location: 'BV Truyền Máu Huyết Học - 1 Trần Hữu Nghiệp, Tân Kiên, Bình Chánh, TP.HCM',
    organizerName: 'Ban Chỉ đạo Vận động Hiến máu tình nguyện TP.HCM',
    contactPhone: '02839571342',
    description: 'Tôn vinh người hiến máu tình nguyện tiêu biểu và tổ chức tiếp nhận máu quy mô lớn toàn thành phố.',
    status: 'COMPLETED',
    startsAt: new Date('2026-06-14T07:00:00+07:00'),
    endsAt: new Date('2026-06-14T16:30:00+07:00'),
    targetDonors: 350,
    targetBloodVolumeMl: 122500,
    hospitalPrefix: 'BTH',
  },
  {
    name: 'Giọt Nắng Yêu Thương Bình Dương',
    location: 'Trung tâm Văn hóa TP. Thủ Dầu Một - 50 Bạch Đằng, Phú Cường, Thủ Dầu Một, Bình Dương',
    organizerName: 'Hội Chữ Thập Đỏ tỉnh Bình Dương phối hợp BV Chợ Rẫy',
    contactPhone: '02743822145',
    description: 'Điểm hiến máu lưu động phối hợp cùng BV Chợ Rẫy nhằm tăng cường nguồn máu cấp cứu cho các tỉnh Đông Nam Bộ.',
    status: 'COMPLETED',
    startsAt: new Date('2026-07-18T07:30:00+07:00'),
    endsAt: new Date('2026-07-18T15:00:00+07:00'),
    targetDonors: 150,
    targetBloodVolumeMl: 52500,
    hospitalPrefix: 'CR',
  },
  {
    name: 'Tấm Lòng Vàng Mùa Thu 2026',
    location: 'Cung Văn Hóa Lao Động TP.HCM - 55B Nguyễn Thị Minh Khai, Bến Thành, Quận 1, TP.HCM',
    organizerName: 'Liên đoàn Lao động TP.HCM phối hợp Trung tâm Hiến máu Nhân đạo',
    contactPhone: '02839301819',
    description: 'Ngày hội hiến máu dành cho đoàn viên công đoàn, người lao động các doanh nghiệp trên địa bàn TP. Hồ Chí Minh.',
    status: 'COMPLETED',
    startsAt: new Date('2026-08-25T07:30:00+07:00'),
    endsAt: new Date('2026-08-25T16:00:00+07:00'),
    targetDonors: 300,
    targetBloodVolumeMl: 105000,
    hospitalPrefix: 'RC',
  },

  // Current & Upcoming Campaigns (Aligned with Nov 15, 2026 -> Mar 2027, 35 total)
  {
    name: 'Ngày Hội Sinh Viên Hiến Máu Tình Nguyện',
    location: 'Nhà Văn Hóa Sinh Viên - ĐHQG TP.HCM, Đông Hòa, Dĩ An, Bình Dương',
    organizerName: 'Ban Thường vụ Đoàn ĐHQG TP.HCM phối hợp BV Chợ Rẫy',
    contactPhone: '02837242160',
    description: 'Đợt hiến máu sinh viên lớn nhất trong năm của Đại học Quốc gia TP.HCM.',
    status: 'COMPLETED',
    startsAt: new Date('2026-10-24T07:30:00+07:00'),
    endsAt: new Date('2026-10-24T16:00:00+07:00'),
    registrationOpensAt: new Date('2026-10-01T07:30:00+07:00'),
    registrationClosesAt: new Date('2026-10-23T18:00:00+07:00'),
    targetDonors: 350,
    targetBloodVolumeMl: 122500,
    hospitalPrefix: 'CR',
  },
  {
    name: 'Sẻ Chia Sự Sống - Đợt Thu Viện Huyết Học',
    location: 'Viện Huyết học - Truyền máu TW - Tầng 2 Khoa Tiếp nhận máu, Cầu Giấy, Hà Nội',
    organizerName: 'Viện Huyết học - Truyền máu Trung ương',
    contactPhone: '02437821895',
    description: 'Tiếp nhận người hiến máu tình nguyện trực tiếp tại Viện Huyết học - Truyền máu TW.',
    status: 'COMPLETED',
    startsAt: new Date('2026-10-14T07:30:00+07:00'),
    endsAt: new Date('2026-10-14T17:00:00+07:00'),
    targetDonors: 250,
    targetBloodVolumeMl: 87500,
    hospitalPrefix: 'NIHBT',
  },
  {
    name: 'Mỗi Giọt Máu Cho Đi - Một Cuộc Đời Ở Lại',
    location: 'Bệnh viện Quân Y 175 - 786 Nguyễn Kiệm, Phường 3, Gò Vấp, TP.HCM',
    organizerName: 'Khoa Truyền máu Bệnh viện Quân Y 175',
    contactPhone: '02838954988',
    description: 'Chương trình hiến máu mở rộng của cán bộ chiến sĩ và nhân dân quận Gò Vấp tại BV Quân Y 175.',
    status: 'COMPLETED',
    startsAt: new Date('2026-11-10T08:00:00+07:00'),
    endsAt: new Date('2026-11-10T16:30:00+07:00'),
    registrationOpensAt: new Date('2026-10-20T08:00:00+07:00'),
    registrationClosesAt: new Date('2026-11-08T18:00:00+07:00'),
    targetDonors: 200,
    targetBloodVolumeMl: 70000,
    hospitalPrefix: 'QY175',
  },
  {
    name: 'Chung Dòng Máu Việt - Mùa Đông 2026',
    location: 'Bệnh viện Thống Nhất - 1 Lý Thường Kiệt, Phường 7, Tân Bình, TP.HCM',
    organizerName: 'Bệnh viện Thống Nhất TP.HCM',
    contactPhone: '02838642142',
    description: 'Đợt vận động hiến máu trước thềm mùa đông của Bệnh viện Thống Nhất, phục vụ điều trị người cao tuổi.',
    status: 'COMPLETED',
    startsAt: new Date('2026-11-14T07:30:00+07:00'),
    endsAt: new Date('2026-11-14T16:30:00+07:00'),
    registrationOpensAt: new Date('2026-10-25T07:30:00+07:00'),
    registrationClosesAt: new Date('2026-11-13T18:00:00+07:00'),
    targetDonors: 180,
    targetBloodVolumeMl: 63000,
    hospitalPrefix: 'TN',
  },
  // Live happening today (Nov 15, 2026)
  {
    name: 'Hiến Máu Cứu Người - Chung Tay Vì Sự Sống',
    location: 'Trung tâm Hiến Máu Nhân Đạo TP.HCM - 106 Thiên Phước, Phường 9, Tân Bình, TP.HCM',
    organizerName: 'Hội Chữ Thập Đỏ TP. Hồ Chí Minh',
    contactPhone: '02838685507',
    description: 'Điểm tiếp nhận máu cố định mở cửa phục vụ người dân đăng ký hiến máu tình nguyện hàng tuần.',
    status: 'OPEN',
    startsAt: new Date('2026-11-15T07:00:00+07:00'),
    endsAt: new Date('2026-11-15T21:00:00+07:00'),
    registrationOpensAt: new Date('2026-10-25T07:30:00+07:00'),
    registrationClosesAt: new Date('2026-11-15T20:30:00+07:00'),
    targetDonors: 200,
    targetBloodVolumeMl: 70000,
    hospitalPrefix: 'RC',
  },
  {
    name: 'Giọt Hồng Ấm Áp Thủ Đô',
    location: 'ĐH Ngoại Thương - 91 Chùa Láng, Láng Thượng, Đống Đa, Hà Nội',
    organizerName: 'CLB Sinh viên Tình nguyện ĐH Ngoại Thương & Viện Huyết học TW',
    contactPhone: '02438356800',
    description: 'Ngày hội hiến máu sinh viên FTU, kêu gọi các bạn trẻ chung tay trao gửi hơi ấm giọt máu đầu đông.',
    status: 'OPEN',
    startsAt: new Date('2026-11-15T07:30:00+07:00'),
    endsAt: new Date('2026-11-15T20:30:00+07:00'),
    registrationOpensAt: new Date('2026-10-28T08:00:00+07:00'),
    registrationClosesAt: new Date('2026-11-15T20:00:00+07:00'),
    targetDonors: 300,
    targetBloodVolumeMl: 105000,
    hospitalPrefix: 'NIHBT',
  },
  // +15 Campaigns from Now into Future (Nov 2026 -> Mar 2027)
  {
    name: 'Tri Ân Nhà Giáo - Giọt Hồng Nhân Ái 20/11',
    location: 'Trường ĐH Sư Phạm TP.HCM - 280 An Dương Vương, Phường 4, Quận 5, TP.HCM',
    organizerName: 'Đoàn Trường ĐH Sư Phạm TP.HCM & BV Truyền Máu Huyết Học',
    contactPhone: '02838352020',
    description: 'Chương trình hiến máu kỷ niệm Ngày Nhà giáo Việt Nam 20/11 của giảng viên và sinh viên sư phạm.',
    status: 'OPEN',
    startsAt: new Date('2026-11-19T07:30:00+07:00'),
    endsAt: new Date('2026-11-19T16:30:00+07:00'),
    registrationOpensAt: new Date('2026-11-01T07:30:00+07:00'),
    registrationClosesAt: new Date('2026-11-18T20:00:00+07:00'),
    targetDonors: 240,
    targetBloodVolumeMl: 84000,
    hospitalPrefix: 'BTH',
  },
  {
    name: 'Kết Nối Nhịp Tim - Bệnh Viện Chợ Rẫy',
    location: 'Bệnh viện Chợ Rẫy - 201B Nguyễn Chí Thanh, Phường 12, Quận 5, TP.HCM',
    organizerName: 'Trung tâm Truyền máu Bệnh viện Chợ Rẫy',
    contactPhone: '02838554137',
    description: 'Đợt tiếp nhận máu định kỳ cuối tháng 11 nhằm đảm bảo nguồn máu cấp cứu ngoại khoa khu vực phía Nam.',
    status: 'OPEN',
    startsAt: new Date('2026-11-22T07:30:00+07:00'),
    endsAt: new Date('2026-11-22T16:30:00+07:00'),
    registrationOpensAt: new Date('2026-11-02T07:30:00+07:00'),
    registrationClosesAt: new Date('2026-11-21T20:00:00+07:00'),
    targetDonors: 260,
    targetBloodVolumeMl: 91000,
    hospitalPrefix: 'CR',
  },
  {
    name: 'Giọt Hồng Sông Hàn - Chung Tay Cứu Người',
    location: 'Bệnh viện Đa khoa Đà Nẵng - 124 Hải Phòng, Thạch Thang, Hải Châu, Đà Nẵng',
    organizerName: 'Khoa Huyết học Truyền máu BV Đà Nẵng',
    contactPhone: '02363821118',
    description: 'Vận động hiến máu tình nguyện phục vụ cấp cứu và điều trị tại các bệnh viện tuyến đầu TP. Đà Nẵng.',
    status: 'OPEN',
    startsAt: new Date('2026-11-26T07:30:00+07:00'),
    endsAt: new Date('2026-11-26T16:00:00+07:00'),
    registrationOpensAt: new Date('2026-11-05T07:30:00+07:00'),
    registrationClosesAt: new Date('2026-11-25T19:00:00+07:00'),
    targetDonors: 180,
    targetBloodVolumeMl: 63000,
    hospitalPrefix: 'DNG',
  },
  {
    name: 'Trái Tim Hồng Thủ Đô - Viện Huyết Học TW',
    location: 'Viện Huyết học - Truyền máu TW - Phố Phạm Văn Bạch, Cầu Giấy, Hà Nội',
    organizerName: 'Viện Huyết học - Truyền máu Trung ương',
    contactPhone: '02437821895',
    description: 'Chương trình tiếp nhận máu cuối tuần dành cho cán bộ công chức và sinh viên khu vực Cầu Giấy.',
    status: 'OPEN',
    startsAt: new Date('2026-11-29T07:30:00+07:00'),
    endsAt: new Date('2026-11-29T16:30:00+07:00'),
    registrationOpensAt: new Date('2026-11-08T07:30:00+07:00'),
    registrationClosesAt: new Date('2026-11-28T20:00:00+07:00'),
    targetDonors: 280,
    targetBloodVolumeMl: 98000,
    hospitalPrefix: 'NIHBT',
  },
  {
    name: 'Tình Người Xứ Huế - Đông 2026',
    location: 'Bệnh viện Trung ương Huế (Cơ sở 2) - Phong An, Phong Điền, Thừa Thiên Huế',
    organizerName: 'Hội Chữ Thập Đỏ tỉnh Thừa Thiên Huế',
    contactPhone: '02343761234',
    description: 'Chiến dịch đưa xe hiến máu lưu động về huyện Phong Điền phục vụ bà con vùng ven cố đô Huế.',
    status: 'OPEN',
    startsAt: new Date('2026-12-03T07:30:00+07:00'),
    endsAt: new Date('2026-12-03T15:30:00+07:00'),
    registrationOpensAt: new Date('2026-11-11T07:30:00+07:00'),
    registrationClosesAt: new Date('2026-12-02T18:00:00+07:00'),
    targetDonors: 160,
    targetBloodVolumeMl: 56000,
    hospitalPrefix: 'HUE',
  },
  {
    name: 'Ngày Hội Tình Nguyện Quốc Tế 5/12 - Bạch Mai',
    location: 'Bệnh viện Bạch Mai - 78 Giải Phóng, Phương Mai, Đống Đa, Hà Nội',
    organizerName: 'Trung tâm Huyết học và Truyền máu - Bệnh viện Bạch Mai',
    contactPhone: '02438693731',
    description: 'Hưởng ứng Ngày Tình nguyện viên Quốc tế 5/12, tiếp nhận máu điều trị bệnh nhân nội trú nặng.',
    status: 'OPEN',
    startsAt: new Date('2026-12-06T07:30:00+07:00'),
    endsAt: new Date('2026-12-06T16:30:00+07:00'),
    registrationOpensAt: new Date('2026-11-12T07:30:00+07:00'),
    registrationClosesAt: new Date('2026-12-05T19:00:00+07:00'),
    targetDonors: 300,
    targetBloodVolumeMl: 105000,
    hospitalPrefix: 'BM',
  },
  {
    name: 'Giọt Hồng Công Nghệ - Khu Công Nghệ Cao TP.HCM',
    location: 'Trung tâm Đào tạo Khu Công nghệ cao - Xa lộ Hà Nội, Hiệp Phú, TP. Thủ Đức, TP.HCM',
    organizerName: 'Công đoàn Khu Công nghệ cao phối hợp BV Chợ Rẫy',
    contactPhone: '02837360291',
    description: 'Ngày hội hiến máu của đội ngũ kỹ sư, chuyên gia và người lao động tại Khu Công nghệ cao TP.HCM.',
    status: 'OPEN',
    startsAt: new Date('2026-12-12T07:30:00+07:00'),
    endsAt: new Date('2026-12-12T16:00:00+07:00'),
    registrationOpensAt: new Date('2026-11-14T07:30:00+07:00'),
    registrationClosesAt: new Date('2026-12-11T18:00:00+07:00'),
    targetDonors: 220,
    targetBloodVolumeMl: 77000,
    hospitalPrefix: 'CR',
  },
  {
    name: 'Sắc Đỏ Quân Dân - Bệnh Viện Quân Y 175',
    location: 'Bệnh viện Quân Y 175 - 786 Nguyễn Kiệm, Phường 3, Gò Vấp, TP.HCM',
    organizerName: 'Khoa Truyền máu Bệnh viện Quân Y 175',
    contactPhone: '02838954988',
    description: 'Đợt hiến máu kỷ niệm Ngày thành lập Quân đội Nhân dân Việt Nam 22/12 tại Bệnh viện Quân Y 175.',
    status: 'OPEN',
    startsAt: new Date('2026-12-18T07:30:00+07:00'),
    endsAt: new Date('2026-12-18T16:30:00+07:00'),
    registrationOpensAt: new Date('2026-11-15T07:30:00+07:00'),
    registrationClosesAt: new Date('2026-12-17T19:00:00+07:00'),
    targetDonors: 250,
    targetBloodVolumeMl: 87500,
    hospitalPrefix: 'QY175',
  },
  {
    name: 'Xuân Tình Nguyện - Nghĩa Tình Phương Nam',
    location: 'Bệnh viện Ung Bướu TP.HCM (Cơ sở 2) - 12 Đường 400, Long Thạnh Mỹ, TP. Thủ Đức, TP.HCM',
    organizerName: 'Đoàn Thanh niên Bệnh viện Ung Bướu & BV Truyền Máu Huyết Học',
    contactPhone: '02838433021',
    description: 'Chương trình hiến máu gây quỹ hỗ trợ bệnh nhi ung thư nghèo dịp Tết Dương Lịch 2027.',
    status: 'OPEN',
    startsAt: new Date('2026-12-22T07:30:00+07:00'),
    endsAt: new Date('2026-12-22T16:30:00+07:00'),
    registrationOpensAt: new Date('2026-11-15T07:30:00+07:00'),
    registrationClosesAt: new Date('2026-12-21T18:00:00+07:00'),
    targetDonors: 250,
    targetBloodVolumeMl: 87500,
    hospitalPrefix: 'BTH',
  },
  {
    name: 'Giáng Sinh Hồng - Trao Yêu Thương 2026',
    location: 'BV ĐH Y Dược TP.HCM - 215 Hồng Bàng, Phường 11, Quận 5, TP.HCM',
    organizerName: 'Bệnh viện Đại học Y Dược TP.HCM',
    contactPhone: '02838554269',
    description: 'Ngày hội hiến máu mùa Giáng Sinh bổ sung ngân hàng máu dự trữ dịp cuối năm tại ĐHYD TP.HCM.',
    status: 'OPEN',
    startsAt: new Date('2026-12-26T07:30:00+07:00'),
    endsAt: new Date('2026-12-26T16:30:00+07:00'),
    registrationOpensAt: new Date('2026-11-15T08:00:00+07:00'),
    registrationClosesAt: new Date('2026-12-25T19:00:00+07:00'),
    targetDonors: 200,
    targetBloodVolumeMl: 70000,
    hospitalPrefix: 'UMP',
  },
  {
    name: 'Chào Năm Mới 2027 - Giọt Máu Khởi Đầu Mới',
    location: 'Trung tâm Hiến Máu Nhân Đạo TP.HCM - 106 Thiên Phước, Phường 9, Tân Bình, TP.HCM',
    organizerName: 'Hội Chữ Thập Đỏ TP. Hồ Chí Minh',
    contactPhone: '02838685507',
    description: 'Chương trình tiếp nhận máu đầu năm mới Dương lịch 2027 phục vụ các bệnh viện trên địa bàn thành phố.',
    status: 'OPEN',
    startsAt: new Date('2027-01-05T07:30:00+07:00'),
    endsAt: new Date('2027-01-05T16:30:00+07:00'),
    registrationOpensAt: new Date('2026-11-15T08:00:00+07:00'),
    registrationClosesAt: new Date('2027-01-04T19:00:00+07:00'),
    targetDonors: 220,
    targetBloodVolumeMl: 77000,
    hospitalPrefix: 'RC',
  },
  {
    name: 'Ngày Hội Học Sinh Sinh Viên 9/1 - ĐH Kinh Tế',
    location: 'ĐH Kinh Tế TP.HCM (Cơ sở B) - 279 Nguyễn Tri Phương, Phường 5, Quận 10, TP.HCM',
    organizerName: 'Hội Sinh viên ĐH Kinh Tế TP.HCM phối hợp BV Truyền Máu Huyết Học',
    contactPhone: '02838551777',
    description: 'Ngày hội hiến máu truyền thống kỷ niệm Ngày Học sinh - Sinh viên Việt Nam 9/1 của sinh viên UEH.',
    status: 'OPEN',
    startsAt: new Date('2027-01-10T07:30:00+07:00'),
    endsAt: new Date('2027-01-10T16:00:00+07:00'),
    registrationOpensAt: new Date('2026-11-15T08:00:00+07:00'),
    registrationClosesAt: new Date('2027-01-09T19:00:00+07:00'),
    targetDonors: 320,
    targetBloodVolumeMl: 112000,
    hospitalPrefix: 'BTH',
  },
  {
    name: 'Chủ Nhật Đỏ 2027 - Điểm Cầu Hà Nội',
    location: 'ĐH Bách Khoa Hà Nội - Số 1 Đại Cồ Việt, Bách Khoa, Hai Bà Trưng, Hà Nội',
    organizerName: 'Viện Huyết học - Truyền máu TW & Báo Tiền Phong',
    contactPhone: '02437821895',
    description: 'Sự kiện Chủ Nhật Đỏ toàn quốc lần thứ XIX khắc phục tình trạng khan hiếm máu dịp Tết Nguyên Đán Đinh Mùi.',
    status: 'OPEN',
    startsAt: new Date('2027-01-17T07:30:00+07:00'),
    endsAt: new Date('2027-01-17T16:30:00+07:00'),
    registrationOpensAt: new Date('2026-11-15T08:00:00+07:00'),
    registrationClosesAt: new Date('2027-01-16T19:00:00+07:00'),
    targetDonors: 400,
    targetBloodVolumeMl: 140000,
    hospitalPrefix: 'NIHBT',
  },
  {
    name: 'Giọt Hồng Tây Đô - Xuân Đinh Mùi 2027',
    location: 'Bệnh viện Huyết học - Truyền máu Cần Thơ - 317 Nguyễn Văn Cừ, An Bình, Ninh Kiều, Cần Thơ',
    organizerName: 'Bệnh viện Huyết học - Truyền máu TP. Cần Thơ',
    contactPhone: '02923782983',
    description: 'Chiến dịch dự trữ máu trước kỳ nghỉ Tết Nguyên Đán cho khu vực Đồng bằng sông Cửu Long.',
    status: 'OPEN',
    startsAt: new Date('2027-01-24T07:30:00+07:00'),
    endsAt: new Date('2027-01-24T16:00:00+07:00'),
    registrationOpensAt: new Date('2026-11-15T08:00:00+07:00'),
    registrationClosesAt: new Date('2027-01-23T18:00:00+07:00'),
    targetDonors: 220,
    targetBloodVolumeMl: 77000,
    hospitalPrefix: 'CT',
  },
  {
    name: 'Lễ Hội Xuân Hồng 2027 - TP. Hồ Chí Minh',
    location: 'Bệnh viện Chợ Rẫy - 201B Nguyễn Chí Thanh, Phường 12, Quận 5, TP.HCM',
    organizerName: 'Trung tâm Truyền máu Bệnh viện Chợ Rẫy',
    contactPhone: '02838554137',
    description: 'Lễ hội hiến máu đầu xuân sau kỳ nghỉ Tết Nguyên Đán 2027 tại Bệnh viện Chợ Rẫy.',
    status: 'OPEN',
    startsAt: new Date('2027-02-18T07:30:00+07:00'),
    endsAt: new Date('2027-02-18T16:30:00+07:00'),
    registrationOpensAt: new Date('2026-12-15T07:30:00+07:00'),
    registrationClosesAt: new Date('2027-02-17T18:00:00+07:00'),
    targetDonors: 300,
    targetBloodVolumeMl: 105000,
    hospitalPrefix: 'CR',
  },
  {
    name: 'Blouse Trắng - Trái Tim Hồng 27/2/2027',
    location: 'Bệnh viện Thống Nhất - 1 Lý Thường Kiệt, Phường 7, Tân Bình, TP.HCM',
    organizerName: 'Bệnh viện Thống Nhất TP.HCM',
    contactPhone: '02838642142',
    description: 'Chương trình hiến máu của đội ngũ cán bộ y tế kỷ niệm Ngày Thầy thuốc Việt Nam 27/2/2027.',
    status: 'DRAFT',
    startsAt: new Date('2027-02-27T07:30:00+07:00'),
    endsAt: new Date('2027-02-27T16:30:00+07:00'),
    registrationOpensAt: new Date('2027-01-15T07:30:00+07:00'),
    registrationClosesAt: new Date('2027-02-26T18:00:00+07:00'),
    targetDonors: 200,
    targetBloodVolumeMl: 70000,
    hospitalPrefix: 'TN',
  },
  {
    name: 'Tháng Thanh Niên 2027 - Nhiệt Huyết Tuổi Trẻ',
    location: 'Nhà Văn Hóa Thanh Niên TP.HCM - 4 Phạm Ngọc Thạch, Bến Nghé, Quận 1, TP.HCM',
    organizerName: 'Thành Đoàn TP.HCM & Trung tâm Hiến Máu Nhân Đạo',
    contactPhone: '02838294345',
    description: 'Ngày hội hiến máu khởi động Tháng Thanh niên 3/2027 dành cho đoàn viên thanh niên thành phố.',
    status: 'DRAFT',
    startsAt: new Date('2027-03-14T07:30:00+07:00'),
    endsAt: new Date('2027-03-14T16:30:00+07:00'),
    registrationOpensAt: new Date('2027-02-10T07:30:00+07:00'),
    registrationClosesAt: new Date('2027-03-13T18:00:00+07:00'),
    targetDonors: 350,
    targetBloodVolumeMl: 122500,
    hospitalPrefix: 'RC',
  },

  // 2 CANCELLED Campaigns
  {
    name: 'Ngày Hội Hiến Máu Công Nhân KCN Sóng Thần',
    location: 'Nhà Thiếu nhi Dĩ An - TP. Dĩ An, Bình Dương',
    organizerName: 'Công đoàn Các Khu công nghiệp Bình Dương',
    contactPhone: '02743742333',
    description: 'Đợt hiến máu phối hợp cùng Công đoàn KCN Sóng Thần bị hủy do ảnh hưởng của áp thấp nhiệt đới và bão số 6, mưa lớn ngập đường vào địa điểm tổ chức.',
    status: 'CANCELLED',
    startsAt: new Date('2026-09-28T08:00:00+07:00'),
    endsAt: new Date('2026-09-28T15:00:00+07:00'),
    targetDonors: 200,
    targetBloodVolumeMl: 70000,
    hospitalPrefix: 'CR',
  },
  {
    name: 'Đợt Hiến Máu Khẩn Cấp Miền Trung',
    location: 'Cung Thể Thao Tiên Sơn - Phan Đăng Lưu, Hòa Cường Bắc, Hải Châu, Đà Nẵng',
    organizerName: 'Ban Chỉ đạo Vận động HMTN TP. Đà Nẵng',
    contactPhone: '02363624567',
    description: 'Đợt tiếp nhận máu khẩn cấp tại Cung Thể Thao Tiên Sơn tạm hoãn do khu vực trung tâm Đà Nẵng bị ngập lụt cục bộ, chuyển sang tổ chức tại bệnh viện.',
    status: 'CANCELLED',
    startsAt: new Date('2026-10-01T08:00:00+07:00'),
    endsAt: new Date('2026-10-01T16:00:00+07:00'),
    targetDonors: 250,
    targetBloodVolumeMl: 87500,
    hospitalPrefix: 'DNG',
  },
];

// ---------------------------------------------------------------------------
// Main Seed Function
// ---------------------------------------------------------------------------

async function seedRichData() {
  console.log('=== BẮT ĐẦU SEED DỮ LIỆU THỰC TẾ HỆ THỐNG QUẢN LÝ HIẾN MÁU ===\n');

  // 1. Ensure Roles & Matrix
  const roles = await ensureRolesAndPermissions();
  console.info('Đã xác thực danh mục 4 vai trò và ma trận quyền hạn.');

  // 2. Clean previous rich seed
  await cleanupPreviousRichData();

  // 3. Compute common password hash once for all 200 accounts
  console.info(`Đang băm mật khẩu chung (${DEMO_PASSWORD}) bằng thuật toán scrypt...`);
  const passwordHash = await hashPassword(DEMO_PASSWORD);
  console.info('Băm mật khẩu thành công!\n');

  // 4. Create 5 Coordinators
  console.info('Đang tạo 5 tài khoản Điều phối viên (COORDINATOR)...');
  const coordinatorUsers = await Promise.all(
    COORDINATOR_SPECS.map((c) =>
      database.user.create({
        data: {
          email: c.email,
          fullName: c.fullName,
          passwordHash,
          isActive: true,
          emailVerifiedAt: new Date('2025-12-01T08:00:00Z'),
          roles: {
            create: { roleId: roles.coordinatorRoleId },
          },
        },
        select: { id: true, email: true, fullName: true },
      }),
    ),
  );
  console.info(`Đã tạo thành công 5 Điều phối viên.`);

  // 5. Create 45 Donation Staff in batches of 15 + include 3 core demo staff accounts
  console.info('Đang tạo 45 tài khoản Nhân viên y tế (DONATION_STAFF)...');
  const staffUsers: { id: string; email: string; fullName: string; defaultAssignment: CampaignAssignment }[] = [];

  const coreStaffMappings: Array<{ email: string; defaultAssignment: CampaignAssignment }> = [
    { email: 'donation-staff.demo@example.local', defaultAssignment: 'CHECK_IN' },
    { email: 'donation-staff-2.demo@example.local', defaultAssignment: 'SCREENING' },
    { email: 'donation-staff-3.demo@example.local', defaultAssignment: 'COLLECTION' },
  ];
  for (const mapping of coreStaffMappings) {
    const found = await database.user.findUnique({
      where: { email: mapping.email },
      select: { id: true, email: true, fullName: true },
    });
    if (found) {
      staffUsers.push({ ...found, defaultAssignment: mapping.defaultAssignment });
    }
  }

  for (let i = 0; i < STAFF_SPECS.length; i += 15) {
    const batch = STAFF_SPECS.slice(i, i + 15);
    const created = await Promise.all(
      batch.map(async (s) => {
        const user = await database.user.create({
          data: {
            email: s.email,
            fullName: s.fullName,
            passwordHash,
            isActive: true,
            emailVerifiedAt: new Date('2025-12-01T08:00:00Z'),
            roles: {
              create: { roleId: roles.staffRoleId },
            },
          },
          select: { id: true, email: true, fullName: true },
        });
        return { ...user, defaultAssignment: s.defaultAssignment };
      }),
    );
    staffUsers.push(...created);
  }
  console.info(`Đã chuẩn bị ${staffUsers.length} Nhân viên y tế (bao gồm 3 tài khoản demo).`);

  // 6. Create 220 Donors with Profiles in batches of 20 + include core demo donor
  console.info('Đang tạo 220 tài khoản Người hiến máu (DONOR) kèm hồ sơ lâm sàng...');
  const donorSpecs = generate150Donors();
  const donorProfiles: { id: string; userId: string; email: string; bloodType: BloodType | null; fullName: string }[] = [];

  const coreDemoDonor = await database.user.findUnique({
    where: { email: 'donor.demo@example.local' },
    select: {
      id: true,
      email: true,
      fullName: true,
      donorProfile: { select: { id: true, bloodType: true } },
    },
  });
  if (coreDemoDonor?.donorProfile) {
    donorProfiles.push({
      id: coreDemoDonor.donorProfile.id,
      userId: coreDemoDonor.id,
      email: coreDemoDonor.email,
      bloodType: coreDemoDonor.donorProfile.bloodType,
      fullName: coreDemoDonor.fullName,
    });
  }

  for (let i = 0; i < donorSpecs.length; i += 20) {
    const batch = donorSpecs.slice(i, i + 20);
    const created = await Promise.all(
      batch.map(async (d) => {
        const user = await database.user.create({
          data: {
            email: d.email,
            fullName: d.fullName,
            passwordHash,
            isActive: true,
            emailVerifiedAt: new Date('2025-12-15T08:00:00Z'),
            roles: {
              create: { roleId: roles.donorRoleId },
            },
            donorProfile: {
              create: {
                dateOfBirth: d.dateOfBirth,
                phone: d.phone,
                citizenId: d.citizenId,
                gender: d.gender,
                address: d.address,
                bloodType: d.bloodType,
                emergencyName: d.emergencyName,
                emergencyPhone: d.emergencyPhone,
              },
            },
          },
          select: {
            id: true,
            email: true,
            fullName: true,
            donorProfile: { select: { id: true, bloodType: true } },
          },
        });
        return {
          id: user.donorProfile!.id,
          userId: user.id,
          email: user.email,
          bloodType: user.donorProfile!.bloodType,
          fullName: user.fullName,
        };
      }),
    );
    donorProfiles.push(...created);
  }
  console.info(`Đã tạo thành công ${donorProfiles.length} Người hiến máu.`);

  // 7. Create 35 Campaigns, TimeSlots, and Non-overlapping Staff Assignments
  console.info(`\nĐang tạo ${CAMPAIGN_SPECS.length} Đợt hiến máu thực tế và cấu hình ca hiến, phân công nhân sự...`);
  let bagGlobalCounter = 100;
  let donorCursor = 0;
  const donorDonationDates = new Map<string, Date[]>();
  const donorActiveRegistration = new Set<string>();
  const staffBookedWindows = new Map<string, Array<{ startsAt: Date; endsAt: Date }>>();
  const MIN_INTERVAL_MS = 84 * 24 * 3600 * 1000;

  function pickAvailableStaff(
    pool: typeof staffUsers,
    count: number,
    startsAt: Date,
    endsAt: Date,
    preferCoreDemo: boolean,
    offset: number,
  ) {
    const picked: typeof staffUsers = [];
    const rest = pool.slice(1);
    const rotatedRest = rest.map((_, idx) => rest[(offset + idx) % rest.length]!);
    const candidates = preferCoreDemo && pool[0]
      ? [pool[0], ...rotatedRest]
      : [...rotatedRest, ...(pool[0] ? [pool[0]] : [])];

    for (const candidate of candidates) {
      if (picked.length >= count) break;
      if (picked.some((p) => p.id === candidate.id)) continue;
      const windows = staffBookedWindows.get(candidate.id) ?? [];
      const hasOverlap = windows.some(
        (w) => w.startsAt.getTime() < endsAt.getTime() && w.endsAt.getTime() > startsAt.getTime(),
      );
      if (hasOverlap) continue;
      picked.push(candidate);
      windows.push({ startsAt, endsAt });
      staffBookedWindows.set(candidate.id, windows);
    }
    return picked;
  }

  function pickEligibleDonors(
    count: number,
    campaignDate: Date,
    holdsActiveBooking: boolean,
  ) {
    const picked: typeof donorProfiles = [];
    const pickedIds = new Set<string>();
    for (let step = 0; step < donorProfiles.length * 2 && picked.length < count; step++) {
      const candidate = donorProfiles[(donorCursor + step) % donorProfiles.length]!;
      if (pickedIds.has(candidate.id)) continue;
      if (holdsActiveBooking && donorActiveRegistration.has(candidate.id)) continue;
      const dates = donorDonationDates.get(candidate.id) ?? [];
      const tooClose = dates.some(
        (d) => Math.abs(campaignDate.getTime() - d.getTime()) < MIN_INTERVAL_MS,
      );
      if (tooClose) continue;
      picked.push(candidate);
      pickedIds.add(candidate.id);
    }
    donorCursor = (donorCursor + Math.max(1, picked.length)) % donorProfiles.length;
    return picked;
  }

  for (let cIdx = 0; cIdx < CAMPAIGN_SPECS.length; cIdx++) {
    const spec = CAMPAIGN_SPECS[cIdx]!;
    const startsAt = spec.startsAt;
    const endsAt = spec.endsAt;

    // Create campaign
    const campaign = await database.donationCampaign.create({
      data: {
        name: spec.name,
        location: spec.location,
        organizerName: spec.organizerName,
        contactPhone: spec.contactPhone,
        description: spec.description,
        status: spec.status,
        targetDonors: spec.targetDonors,
        targetBloodVolumeMl: spec.targetBloodVolumeMl,
        registrationOpensAt:
          spec.registrationOpensAt ??
          new Date(startsAt.getTime() - 21 * 24 * 3600 * 1000),
        registrationClosesAt:
          spec.registrationClosesAt ??
          new Date(endsAt.getTime() - 12 * 3600 * 1000),
        startsAt,
        endsAt,
      },
    });

    // Create 4 standard time slots strictly bounded within [startsAt, endsAt]
    const sYear = startsAt.getUTCFullYear();
    const sMonth = startsAt.getUTCMonth();
    const sDate = startsAt.getUTCDate();

    const formatVnHm = (d: Date) =>
      new Intl.DateTimeFormat('vi-VN', {
        hour: '2-digit',
        minute: '2-digit',
        hour12: false,
        timeZone: 'Asia/Ho_Chi_Minh',
      }).format(d);

    const ca1Start = new Date(
      Math.max(startsAt.getTime(), Date.UTC(sYear, sMonth, sDate, 0, 30)),
    );
    const ca1End = new Date(Date.UTC(sYear, sMonth, sDate, 2, 30));

    const ca2Start = new Date(Date.UTC(sYear, sMonth, sDate, 2, 30));
    const ca2End = new Date(Date.UTC(sYear, sMonth, sDate, 4, 30));

    const endsBy15 = endsAt.getTime() <= Date.UTC(sYear, sMonth, sDate, 8, 0);
    const ca3Start = new Date(Date.UTC(sYear, sMonth, sDate, 6, 0));
    const ca3End = endsBy15
      ? new Date(Date.UTC(sYear, sMonth, sDate, 7, 0))
      : new Date(Date.UTC(sYear, sMonth, sDate, 8, 0));

    const ca4Start = ca3End;
    const ca4End = new Date(
      Math.min(endsAt.getTime(), Date.UTC(sYear, sMonth, sDate, 9, 30)),
    );

    const slotConfigs = [
      {
        label: `Ca 1: Sáng sớm (${formatVnHm(ca1Start)} - ${formatVnHm(ca1End)})`,
        startsAt: ca1Start,
        endsAt: ca1End,
        capacity: 80,
      },
      {
        label: `Ca 2: Sáng muộn (${formatVnHm(ca2Start)} - ${formatVnHm(ca2End)})`,
        startsAt: ca2Start,
        endsAt: ca2End,
        capacity: 80,
      },
      {
        label: `Ca 3: Đầu chiều (${formatVnHm(ca3Start)} - ${formatVnHm(ca3End)})`,
        startsAt: ca3Start,
        endsAt: ca3End,
        capacity: 60,
      },
      {
        label: `Ca 4: Cuối chiều (${formatVnHm(ca4Start)} - ${formatVnHm(ca4End)})`,
        startsAt: ca4Start,
        endsAt: ca4End,
        capacity: 40,
      },
    ];

    const timeSlots = await Promise.all(
      slotConfigs.map((sc) =>
        database.campaignTimeSlot.create({
          data: {
            campaignId: campaign.id,
            label: sc.label,
            startsAt: sc.startsAt,
            endsAt: sc.endsAt,
            capacity: sc.capacity,
            isActive: true,
          },
        }),
      ),
    );

    // Assign 5 DONATION_STAFF across the 3 operational positions (CHECK_IN, SCREENING, COLLECTION) without time overlap
    const checkInPool = staffUsers.filter((s) => s.defaultAssignment === 'CHECK_IN');
    const screeningPool = staffUsers.filter((s) => s.defaultAssignment === 'SCREENING');
    const collectionPool = staffUsers.filter((s) => s.defaultAssignment === 'COLLECTION');

    const preferCoreDemo = spec.status !== 'CANCELLED';
    const assignedCheckIn = pickAvailableStaff(checkInPool, 1, startsAt, endsAt, preferCoreDemo, cIdx);
    const assignedScreening = pickAvailableStaff(screeningPool, 2, startsAt, endsAt, preferCoreDemo, cIdx * 2);
    const assignedCollection = pickAvailableStaff(collectionPool, 2, startsAt, endsAt, preferCoreDemo, cIdx * 2);

    const assignedStaffList = [
      ...assignedCheckIn,
      ...assignedScreening,
      ...assignedCollection,
    ];

    await database.campaignStaff.createMany({
      data: assignedStaffList.map((staff) => ({
        campaignId: campaign.id,
        userId: staff.id,
        assignment: staff.defaultAssignment,
      })),
      skipDuplicates: true,
    });

    // 8. Generate Realistic Registrations & Clinical Records based on status
    if (spec.status === 'COMPLETED') {
      const campaignDonors = pickEligibleDonors(13, startsAt, false);
      for (const d of campaignDonors) {
        const list = donorDonationDates.get(d.id) ?? [];
        list.push(startsAt);
        donorDonationDates.set(d.id, list);
      }

      await Promise.all(
        campaignDonors.map(async (donor, dK) => {
          const slot = timeSlots[dK % timeSlots.length]!;
          const isDeferred = dK === 3;
          const hasReaction = dK === 7;
          const localBagSeq = 100 + cIdx * 20 + dK + 1;

          // Registration: CONFIRMED if deferred at screening, COMPLETED if donated
          const registration = await database.registration.create({
            data: {
              donorId: donor.id,
              campaignId: campaign.id,
              timeSlotId: slot.id,
              status: isDeferred ? 'CONFIRMED' : 'COMPLETED',
              createdAt: new Date(startsAt.getTime() - 7 * 24 * 3600 * 1000),
            },
          });

          // Health declaration
          await database.healthDeclaration.create({
            data: {
              registrationId: registration.id,
              submittedAt: new Date(startsAt.getTime() - 24 * 3600 * 1000),
              questionnaireVersion: 'v2026.1',
              answers: {
                FEVER: false,
                INFECTION: isDeferred,
                MEDICATION: false,
                RECENT_DONATION: false,
                PREGNANCY: false,
                SURGERY: false,
              },
            },
          });

          // CheckIn
          const checkInStaff = assignedStaffList.find((s) => s.defaultAssignment === 'CHECK_IN') ?? assignedStaffList[0]!;
          const checkedInAt = new Date(slot.startsAt.getTime() + dK * 8 * 60 * 1000);
          const checkIn = await database.checkIn.create({
            data: {
              registrationId: registration.id,
              checkedInAt,
              checkedInById: checkInStaff.id,
              notes: 'Đã xuất trình CCCD gắn chip gốc, nhận diện khuôn mặt hợp lệ',
            },
          });

          // Screening
          const doctorStaff = assignedStaffList.find((s) => s.defaultAssignment === 'SCREENING') ?? assignedStaffList[1]!;
          const screeningAt = new Date(checkedInAt.getTime() + 10 * 60 * 1000);

          if (isDeferred) {
            const screening = await database.screening.create({
              data: {
                checkInId: checkIn.id,
                status: 'DEFERRED',
                screenedById: doctorStaff.id,
                weightKg: 46.5,
                systolicBp: 145,
                diastolicBp: 95,
                pulse: 88,
                temperatureC: 37.1,
                hemoglobin: 116.0,
                decisionReason: 'Huyết áp tăng nhẹ lúc khám (145/95 mmHg) kèm vừa dùng kháng sinh, tư vấn nghỉ ngơi 2 tuần',
                deferredUntil: new Date(startsAt.getTime() + 14 * 24 * 3600 * 1000),
                createdAt: screeningAt,
              },
            });

            await database.screeningTest.createMany({
              data: [
                {
                  screeningId: screening.id,
                  code: 'TEST_HB',
                  result: '116 g/L (Dưới ngưỡng 120 g/L)',
                  numericValue: 116.0,
                  unit: 'g/L',
                  referenceRange: '>= 120 g/L',
                  isPassed: false,
                },
                {
                  screeningId: screening.id,
                  code: 'TEST_HBSAG',
                  result: 'Âm tính (Negative)',
                  unit: 'rapid_strip',
                  isPassed: true,
                },
              ],
            });
          } else {
            const weight = 50 + (dK * 3) % 25;
            const systolic = 112 + (dK * 2) % 18;
            const diastolic = 70 + (dK * 2) % 14;
            const pulse = 68 + (dK * 3) % 14;
            const hb = 128 + (dK * 3) % 25;
            const indicatedVol = weight >= 60 ? 450 : weight >= 50 ? 350 : 250;

            const screening = await database.screening.create({
              data: {
                checkInId: checkIn.id,
                status: 'ELIGIBLE',
                screenedById: doctorStaff.id,
                weightKg: weight,
                systolicBp: systolic,
                diastolicBp: diastolic,
                pulse,
                temperatureC: 36.8,
                hemoglobin: hb,
                indicatedVolumeMl: indicatedVol,
                decisionReason: 'Đủ điều kiện hiến máu toàn phần',
                createdAt: screeningAt,
              },
            });

            const bloodGroupTestResult = donor.bloodType ? donor.bloodType.replace('_', ' ') : 'Chờ định nhóm tại Lab';
            await database.screeningTest.createMany({
              data: [
                {
                  screeningId: screening.id,
                  code: 'TEST_HB',
                  result: `${hb} g/L (Đạt chuẩn)`,
                  numericValue: hb,
                  unit: 'g/L',
                  referenceRange: '>= 120 g/L',
                  isPassed: true,
                },
                {
                  screeningId: screening.id,
                  code: 'TEST_HBSAG',
                  result: 'Âm tính (Negative)',
                  unit: 'rapid_strip',
                  isPassed: true,
                },
                {
                  screeningId: screening.id,
                  code: 'TEST_ABO_RAPID',
                  result: bloodGroupTestResult,
                  unit: 'serum_test',
                  isPassed: true,
                },
              ],
            });

            // Donation
            const technicianStaff = assignedStaffList.find((s) => s.defaultAssignment === 'COLLECTION') ?? assignedStaffList[2]!;
            const donationStart = new Date(screeningAt.getTime() + 15 * 60 * 1000);
            const donationEnd = new Date(donationStart.getTime() + 10 * 60 * 1000);
            const volumeMl = weight >= 60 ? 450 : weight >= 50 ? 350 : 250;

            const donation = await database.donation.create({
              data: {
                screeningId: screening.id,
                status: 'COMPLETED',
                donationType: 'WHOLE_BLOOD',
                performedById: technicianStaff.id,
                startedAt: donationStart,
                completedAt: donationEnd,
                donatedAt: donationEnd,
                volumeMl,
                notes: 'Quá trình chọc tĩnh mạch và lấy máu diễn ra thuận lợi, dòng chảy đều.',
              },
            });

            // Blood Bag
            const bagCode = `${spec.hospitalPrefix}-2026-WB-${String(localBagSeq).padStart(5, '0')}`;
            const expiresAt = new Date(donationEnd.getTime() + 35 * 24 * 3600 * 1000);

            await database.bloodBag.create({
              data: {
                donationId: donation.id,
                code: bagCode,
                status: 'ACCEPTED',
                bloodType: donor.bloodType,
                component: 'WHOLE_BLOOD',
                volumeMl,
                collectedAt: donationEnd,
                expiresAt,
                storageLocation: `Kho lạnh trung tâm ${spec.hospitalPrefix} - Tủ 2-6°C`,
              },
            });

            // Optional Mild Reaction
            if (hasReaction) {
              await database.postDonationReaction.create({
                data: {
                  donationId: donation.id,
                  occurredAt: new Date(donationEnd.getTime() + 5 * 60 * 1000),
                  severity: 'MILD',
                  description: 'Người hiến cảm thấy choáng váng nhẹ khi ngồi dậy nhanh khỏi giường hiến.',
                  actionTaken: 'Nằm đầu thấp, kê chân cao, uống 200ml trà đường ấm. Nghỉ ngơi 20 phút, huyết áp đo lại 120/80 mmHg, phục hồi hoàn toàn.',
                  resolvedAt: new Date(donationEnd.getTime() + 25 * 60 * 1000),
                },
              });
            }
          }
        }),
      );
      bagGlobalCounter += 20;
    } else if (spec.status === 'OPEN') {
      const isHappeningNow =
        startsAt.getTime() <= Date.now() && endsAt.getTime() >= Date.now();
      const targetBookings = isHappeningNow ? 8 : 7 + (cIdx % 5);
      const campaignDonors = pickEligibleDonors(targetBookings, startsAt, true);
      for (const d of campaignDonors) {
        const list = donorDonationDates.get(d.id) ?? [];
        list.push(startsAt);
        donorDonationDates.set(d.id, list);
        donorActiveRegistration.add(d.id);
      }

      const defaultAnswers = {
        FEVER: false,
        INFECTION: false,
        MEDICATION: false,
        RECENT_DONATION: false,
        PREGNANCY: false,
        SURGERY: false,
      };

      if (isHappeningNow) {
        // Stage 1: Completed donation earlier today (Donors 0 & 1)
        for (let s1 = 0; s1 < 2; s1++) {
          const donor = campaignDonors[s1]!;
          const reg = await database.registration.create({
            data: {
              donorId: donor.id,
              campaignId: campaign.id,
              timeSlotId: timeSlots[0]!.id,
              status: 'COMPLETED',
              createdAt: new Date(startsAt.getTime() - 3 * 24 * 3600 * 1000),
            },
          });
          await database.healthDeclaration.create({
            data: {
              registrationId: reg.id,
              submittedAt: new Date(startsAt.getTime() - 12 * 3600 * 1000),
              questionnaireVersion: 'v2026.1',
              answers: defaultAnswers,
            },
          });
          const chk = await database.checkIn.create({
            data: {
              registrationId: reg.id,
              checkedInAt: new Date(startsAt.getTime() + 15 * 60 * 1000),
              checkedInById: assignedStaffList[0]!.id,
            },
          });
          const scr = await database.screening.create({
            data: {
              checkInId: chk.id,
              status: 'ELIGIBLE',
              screenedById: assignedStaffList[1]!.id,
              weightKg: 62.0,
              systolicBp: 120,
              diastolicBp: 80,
              pulse: 74,
              temperatureC: 36.7,
              hemoglobin: 142.0,
              indicatedVolumeMl: 350,
              decisionReason: 'Đủ điều kiện hiến máu',
            },
          });
          const dnt = await database.donation.create({
            data: {
              screeningId: scr.id,
              status: 'COMPLETED',
              volumeMl: 350,
              performedById: assignedStaffList[2]!.id,
              startedAt: new Date(startsAt.getTime() + 45 * 60 * 1000),
              completedAt: new Date(startsAt.getTime() + 55 * 60 * 1000),
              donatedAt: new Date(startsAt.getTime() + 55 * 60 * 1000),
            },
          });
          bagGlobalCounter++;
          await database.bloodBag.create({
            data: {
              donationId: dnt.id,
              code: `${spec.hospitalPrefix}-2026-WB-${String(bagGlobalCounter).padStart(5, '0')}`,
              status: 'COLLECTED',
              bloodType: donor.bloodType,
              component: 'WHOLE_BLOOD',
              volumeMl: 350,
              collectedAt: new Date(startsAt.getTime() + 55 * 60 * 1000),
              expiresAt: new Date(startsAt.getTime() + (55 * 60 + 35 * 24 * 3600) * 1000),
              storageLocation: 'Thùng bảo quản chuyên dụng tại điểm hiến (Đang chờ vận chuyển về Lab)',
            },
          });
        }

        // Stage 2: Screened ELIGIBLE, currently waiting in queue for collection! (Donors 2 & 3)
        for (let s2 = 2; s2 < 4; s2++) {
          const donor = campaignDonors[s2]!;
          const reg = await database.registration.create({
            data: {
              donorId: donor.id,
              campaignId: campaign.id,
              timeSlotId: timeSlots[1]!.id,
              status: 'CONFIRMED',
              createdAt: new Date(startsAt.getTime() - 2 * 24 * 3600 * 1000),
            },
          });
          await database.healthDeclaration.create({
            data: {
              registrationId: reg.id,
              submittedAt: new Date(startsAt.getTime() - 6 * 3600 * 1000),
              questionnaireVersion: 'v2026.1',
              answers: defaultAnswers,
            },
          });
          const chk = await database.checkIn.create({
            data: {
              registrationId: reg.id,
              checkedInAt: new Date(startsAt.getTime() + 90 * 60 * 1000),
              checkedInById: assignedStaffList[0]!.id,
            },
          });
          await database.screening.create({
            data: {
              checkInId: chk.id,
              status: 'ELIGIBLE',
              screenedById: assignedStaffList[1]!.id,
              weightKg: 58.0,
              systolicBp: 118,
              diastolicBp: 76,
              pulse: 72,
              temperatureC: 36.6,
              hemoglobin: 135.0,
              indicatedVolumeMl: 350,
              decisionReason: 'Sức khỏe tốt, đủ điều kiện hiến 350ml máu toàn phần. Đã hướng dẫn chuyển bàn lấy máu.',
            },
          });
        }

        // Stage 3: Checked In, waiting for Doctor Screening (Donors 4 & 5)
        for (let s3 = 4; s3 < 6; s3++) {
          const donor = campaignDonors[s3]!;
          const reg = await database.registration.create({
            data: {
              donorId: donor.id,
              campaignId: campaign.id,
              timeSlotId: timeSlots[1]!.id,
              status: 'CONFIRMED',
              createdAt: new Date(startsAt.getTime() - 24 * 3600 * 1000),
            },
          });
          await database.healthDeclaration.create({
            data: {
              registrationId: reg.id,
              submittedAt: new Date(startsAt.getTime() - 2 * 3600 * 1000),
              questionnaireVersion: 'v2026.1',
              answers: defaultAnswers,
            },
          });
          const chk = await database.checkIn.create({
            data: {
              registrationId: reg.id,
              checkedInAt: new Date(startsAt.getTime() + 110 * 60 * 1000),
              checkedInById: assignedStaffList[0]!.id,
              notes: 'Người hiến đã đo thân nhiệt, đang ngồi ghế chờ gọi số vào bàn khám số 1',
            },
          });
          await database.screening.create({
            data: {
              checkInId: chk.id,
              status: 'PENDING',
            },
          });
        }

        // Stage 4: Scheduled for afternoon ca, not checked in yet (Donors 6 & 7)
        for (let s4 = 6; s4 < 8; s4++) {
          const donor = campaignDonors[s4]!;
          const reg = await database.registration.create({
            data: {
              donorId: donor.id,
              campaignId: campaign.id,
              timeSlotId: timeSlots[2]!.id,
              status: 'SCHEDULED',
              createdAt: new Date(startsAt.getTime() - 24 * 3600 * 1000),
            },
          });
          await database.healthDeclaration.create({
            data: {
              registrationId: reg.id,
              submittedAt: new Date(startsAt.getTime() - 1 * 3600 * 1000),
              questionnaireVersion: 'v2026.1',
              answers: defaultAnswers,
            },
          });
        }
      } else {
        // Upcoming OPEN campaign: ONLY pre-booked registrations (no CheckIn/Screening/Donation/BloodBag!)
        for (let uIdx = 0; uIdx < campaignDonors.length; uIdx++) {
          const donor = campaignDonors[uIdx]!;
          const slot = timeSlots[uIdx % timeSlots.length]!;
          const reg = await database.registration.create({
            data: {
              donorId: donor.id,
              campaignId: campaign.id,
              timeSlotId: slot.id,
              status: 'SCHEDULED',
              createdAt: new Date(Date.now() - (campaignDonors.length - uIdx) * 8 * 3600 * 1000),
            },
          });
          await database.healthDeclaration.create({
            data: {
              registrationId: reg.id,
              submittedAt: new Date(Date.now() - (campaignDonors.length - uIdx) * 8 * 3600 * 1000),
              questionnaireVersion: 'v2026.1',
              answers: defaultAnswers,
            },
          });
        }
      }
    } else if (spec.status === 'CLOSED') {
      const closedDonors = pickEligibleDonors(6, startsAt, true);
      for (let uK = 0; uK < closedDonors.length; uK++) {
        const donor = closedDonors[uK]!;
        const list = donorDonationDates.get(donor.id) ?? [];
        list.push(startsAt);
        donorDonationDates.set(donor.id, list);
        donorActiveRegistration.add(donor.id);
        const slot = timeSlots[uK % timeSlots.length]!;
        const reg = await database.registration.create({
          data: {
            donorId: donor.id,
            campaignId: campaign.id,
            timeSlotId: slot.id,
            status: 'SCHEDULED',
            createdAt: new Date(startsAt.getTime() - 14 * 24 * 3600 * 1000),
          },
        });
        await database.healthDeclaration.create({
          data: {
            registrationId: reg.id,
            submittedAt: new Date(startsAt.getTime() - 10 * 24 * 3600 * 1000),
            questionnaireVersion: 'v2026.1',
            answers: {
              FEVER: false,
              INFECTION: false,
              MEDICATION: false,
              RECENT_DONATION: false,
              PREGNANCY: false,
              SURGERY: false,
            },
          },
        });
      }
    } else if (spec.status === 'CANCELLED') {
      const donorSliceStart = (cIdx * 5 + 90) % donorProfiles.length;
      for (let cK = 0; cK < 4; cK++) {
        const donor = donorProfiles[(donorSliceStart + cK) % donorProfiles.length]!;
        const slot = timeSlots[cK % timeSlots.length]!;
        await database.registration.create({
          data: {
            donorId: donor.id,
            campaignId: campaign.id,
            timeSlotId: slot.id,
            status: 'CANCELLED',
            cancelReason: spec.description,
            createdAt: new Date(startsAt.getTime() - 10 * 24 * 3600 * 1000),
          },
        });
      }
    }

    console.info(`  [${cIdx + 1}/${CAMPAIGN_SPECS.length}] Đã tạo đợt: "${spec.name}" (${spec.status}) - ${spec.location.split('-')[0]?.trim() ?? ''}`);
  }

  // 9. Final Count Verification
  console.info('\nĐang kiểm tra tổng số lượng dữ liệu sau khi nạp...');
  const [
    userCount,
    donorCount,
    campaignCount,
    slotCount,
    regCount,
    screeningCount,
    donationCount,
    bagCount,
    reactionCount,
    certCount,
  ] = await Promise.all([
    database.user.count(),
    database.donorProfile.count(),
    database.donationCampaign.count(),
    database.campaignTimeSlot.count(),
    database.registration.count(),
    database.screening.count(),
    database.donation.count(),
    database.bloodBag.count(),
    database.postDonationReaction.count(),
    database.certificate.count(),
  ]);

  console.log('\n======================================================');
  console.log('              KẾT QUẢ TỔNG HỢP SEED DATA              ');
  console.log('======================================================');
  console.log(`- Tổng số Tài khoản (User):            ${userCount}`);
  console.log(`  + Điều phối viên (Coordinator):      5`);
  console.log(`  + Nhân viên y tế (Donation Staff):   45`);
  console.log(`  + Người hiến máu (Donor):            ${donorCount}`);
  console.log(`- Tổng số Đợt hiến máu (Campaign):     ${campaignCount} (14 Hoàn thành, 17 Đang mở/Sắp mở, 2 Bản nháp, 2 Hủy)`);
  console.log(`- Tổng số Khung giờ hiến (TimeSlot):   ${slotCount}`);
  console.log(`- Tổng số Lượt đăng ký (Registration): ${regCount}`);
  console.log(`- Tổng số Lượt khám (Screening):       ${screeningCount}`);
  console.log(`- Tổng số Lượt lấy máu (Donation):     ${donationCount}`);
  console.log(`- Tổng số Túi máu lưu kho (BloodBag):  ${bagCount}`);
  console.log(`- Tổng số Phản ứng phụ (Reaction):     ${reactionCount}`);
  console.log(`- Giấy chứng nhận tự sinh (Cert):      ${certCount} (ĐÚNG 0: Không tự sinh GCN điện tử)`);
  console.log('======================================================');
  console.log(`Mật khẩu đăng nhập chung cho 200 tài khoản mẫu: ${DEMO_PASSWORD}`);
  console.log('======================================================\n');
}

seedRichData()
  .catch((err) => {
    console.error('Lỗi khi seed rich data:', err);
    process.exitCode = 1;
  })
  .finally(async () => {
    await database.$disconnect();
  });

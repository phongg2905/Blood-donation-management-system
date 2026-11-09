import { database } from '../../config/database';

async function main() {
  console.log('--- Đang chuẩn hóa trạng thái và thời gian các đợt hiến máu ---');

  // 1. Chung Dòng Máu Việt - Mùa Đông 2026: Đang trong thời gian đăng ký (25/10 - 13/11) -> OPEN
  await database.donationCampaign.updateMany({
    where: { name: { contains: 'Chung Dòng Máu Việt' } },
    data: {
      status: 'OPEN',
      registrationOpensAt: new Date('2026-10-25T07:30:00+07:00'),
      registrationClosesAt: new Date('2026-11-13T18:00:00+07:00'),
      startsAt: new Date('2026-11-14T07:30:00+07:00'),
      endsAt: new Date('2026-11-14T16:30:00+07:00'),
    },
  });
  console.log('✓ "Chung Dòng Máu Việt - Mùa Đông 2026" -> OPEN (25/10 - 13/11)');

  // 2. Ngày Hội Sinh Viên Hiến Máu Tình Nguyện: Đã hoàn thành hôm 24/10 -> COMPLETED
  await database.donationCampaign.updateMany({
    where: { name: { contains: 'Ngày Hội Sinh Viên Hiến Máu Tình Nguyện' } },
    data: {
      status: 'COMPLETED',
      registrationOpensAt: new Date('2026-10-01T07:30:00+07:00'),
      registrationClosesAt: new Date('2026-10-23T18:00:00+07:00'),
      startsAt: new Date('2026-10-24T07:30:00+07:00'),
      endsAt: new Date('2026-10-24T16:00:00+07:00'),
    },
  });
  console.log('✓ "Ngày Hội Sinh Viên Hiến Máu Tình Nguyện" -> COMPLETED (24/10)');

  // 3. Mỗi Giọt Máu Cho Đi - Một Cuộc Đời Ở Lại: Đợt hiến 10/11, đã đóng đăng ký 08/11 -> CLOSED
  await database.donationCampaign.updateMany({
    where: { name: { contains: 'Mỗi Giọt Máu Cho Đi - Một Cuộc Đời Ở Lại' } },
    data: {
      status: 'CLOSED',
      registrationOpensAt: new Date('2026-10-20T08:00:00+07:00'),
      registrationClosesAt: new Date('2026-11-08T18:00:00+07:00'),
      startsAt: new Date('2026-11-10T08:00:00+07:00'),
      endsAt: new Date('2026-11-10T16:30:00+07:00'),
    },
  });
  console.log('✓ "Mỗi Giọt Máu Cho Đi - Một Cuộc Đời Ở Lại" -> CLOSED (Đóng lúc 18:00 08/11, đợt hiến: 10/11)');

  // 4. Giọt Hồng Ấm Áp Thủ Đô: Đang mở cổng đăng ký (28/10 - 14/11) -> OPEN
  await database.donationCampaign.updateMany({
    where: { name: { contains: 'Giọt Hồng Ấm Áp Thủ Đô' } },
    data: {
      status: 'OPEN',
      registrationOpensAt: new Date('2026-10-28T08:00:00+07:00'),
      registrationClosesAt: new Date('2026-11-14T18:00:00+07:00'),
      startsAt: new Date('2026-11-15T08:00:00+07:00'),
      endsAt: new Date('2026-11-15T16:30:00+07:00'),
    },
  });
  console.log('✓ "Giọt Hồng Ấm Áp Thủ Đô" -> OPEN (Mở cổng đăng ký: 28/10 - 14/11)');

  // 5. Tình Người Xứ Huế - Đông 2026: Chưa tới thời gian mở đăng ký (11/11 mới mở) -> DRAFT
  await database.donationCampaign.updateMany({
    where: { name: { contains: 'Tình Người Xứ Huế' } },
    data: {
      status: 'DRAFT',
      registrationOpensAt: new Date('2026-11-11T07:30:00+07:00'),
      registrationClosesAt: new Date('2026-12-01T18:00:00+07:00'),
      startsAt: new Date('2026-12-02T07:30:00+07:00'),
      endsAt: new Date('2026-12-02T15:30:00+07:00'),
    },
  });
  console.log('✓ "Tình Người Xứ Huế - Đông 2026" -> DRAFT (Dự kiến mở: 11/11)');

  // 6. Xuân Tình Nguyện - Nghĩa Tình Phương Nam: Chưa tới thời gian mở đăng ký (29/11 mới mở) -> DRAFT
  await database.donationCampaign.updateMany({
    where: { name: { contains: 'Xuân Tình Nguyện' } },
    data: {
      status: 'DRAFT',
      registrationOpensAt: new Date('2026-11-29T07:30:00+07:00'),
      registrationClosesAt: new Date('2026-12-19T18:00:00+07:00'),
      startsAt: new Date('2026-12-20T07:30:00+07:00'),
      endsAt: new Date('2026-12-20T16:30:00+07:00'),
    },
  });
  console.log('✓ "Xuân Tình Nguyện - Nghĩa Tình Phương Nam" -> DRAFT (Dự kiến mở: 29/11)');

  // 7. Chuẩn hóa phân công nhân sự đợt hiến: chỉ dùng 3 nhiệm vụ thực tế (CHECK_IN, SCREENING, COLLECTION) của DONATION_STAFF
  const [campaigns, staffUsers] = await Promise.all([
    database.donationCampaign.findMany({ orderBy: { createdAt: 'asc' }, select: { id: true } }),
    database.user.findMany({
      where: {
        email: { startsWith: 'staff.' },
        roles: { some: { role: { code: 'DONATION_STAFF' } } },
      },
      orderBy: { email: 'asc' },
      select: { id: true, email: true },
    }),
  ]);

  const checkInPool = staffUsers.filter((s) => s.email.startsWith('staff.tiepdon.'));
  const screeningPool = staffUsers.filter((s) => s.email.startsWith('staff.bs.'));
  const collectionPool = staffUsers.filter((s) => s.email.startsWith('staff.ktv.'));

  await database.campaignStaff.deleteMany({});
  if (
    checkInPool.length > 0 &&
    screeningPool.length > 1 &&
    collectionPool.length > 1
  ) {
    const rows = campaigns.flatMap((campaign, cIdx) => [
      {
        campaignId: campaign.id,
        userId: checkInPool[cIdx % checkInPool.length]!.id,
        assignment: 'CHECK_IN' as const,
      },
      {
        campaignId: campaign.id,
        userId: screeningPool[(cIdx * 2) % screeningPool.length]!.id,
        assignment: 'SCREENING' as const,
      },
      {
        campaignId: campaign.id,
        userId: screeningPool[(cIdx * 2 + 1) % screeningPool.length]!.id,
        assignment: 'SCREENING' as const,
      },
      {
        campaignId: campaign.id,
        userId: collectionPool[(cIdx * 2) % collectionPool.length]!.id,
        assignment: 'COLLECTION' as const,
      },
      {
        campaignId: campaign.id,
        userId: collectionPool[(cIdx * 2 + 1) % collectionPool.length]!.id,
        assignment: 'COLLECTION' as const,
      },
    ]);
    await database.campaignStaff.createMany({ data: rows, skipDuplicates: true });
    console.log(`✓ Đã chuẩn hóa phân công nhân sự (${rows.length} vị trí DONATION_STAFF: CHECK_IN, SCREENING, COLLECTION)`);
  }

  // 8. Kiểm tra và đồng bộ toàn bộ mã túi máu trong DB theo chuẩn <Mã Đơn Vị>-<YYYY>-WB-<5 chữ số>
  const allBags = await database.bloodBag.findMany({
    select: {
      id: true,
      code: true,
      donation: {
        select: {
          screening: {
            select: {
              checkIn: {
                select: {
                  registration: {
                    select: {
                      campaign: { select: { name: true } },
                    },
                  },
                },
              },
            },
          },
        },
      },
    },
    orderBy: { createdAt: 'asc' },
  });

  const dinPattern = /^(CR|NIHBT|BTH|BM|DNG|HUE|UMP|TN|QY175|RC)-\d{4}-WB-\d{5}$/;
  let updatedBags = 0;
  let seq = 50000;
  for (const bag of allBags) {
    if (!dinPattern.test(bag.code)) {
      seq++;
      const campName = bag.donation?.screening?.checkIn?.registration?.campaign?.name ?? '';
      const norm = campName.normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/đ/gi, 'd').toLowerCase();
      let prefix = 'RC';
      if (norm.includes('cho ray') || norm.includes('bach khoa') || norm.includes('binh duong') || norm.includes('sinh vien hien mau')) prefix = 'CR';
      else if (norm.includes('vien huyet hoc') || norm.includes('trung uong') || norm.includes('blouse trang') || norm.includes('thu do')) prefix = 'NIHBT';
      else if (norm.includes('truyen mau huyet hoc') || norm.includes('14/6') || norm.includes('xuan tinh nguyen')) prefix = 'BTH';
      else if (norm.includes('bach mai') || norm.includes('tri an')) prefix = 'BM';
      else if (norm.includes('da nang') || norm.includes('song han')) prefix = 'DNG';
      else if (norm.includes('hue') || norm.includes('trai tim mien trung')) prefix = 'HUE';
      else if (norm.includes('y duoc')) prefix = 'UMP';
      else if (norm.includes('thong nhat') || norm.includes('chung dong mau viet')) prefix = 'TN';
      else if (norm.includes('175') || norm.includes('moi giot mau cho di')) prefix = 'QY175';

      const newCode = `${prefix}-2026-WB-${String(seq).padStart(5, '0')}`;
      await database.bloodBag.update({
        where: { id: bag.id },
        data: { code: newCode },
      });
      updatedBags++;
    }
  }
  console.log(
    `✓ Kiểm tra ${allBags.length} túi máu trong DB: ${allBags.length - updatedBags} túi đã đúng chuẩn, ${updatedBags} túi được chuẩn hóa lại (Mẫu: ${allBags[0]?.code ?? 'N/A'} ... ${allBags[allBags.length - 1]?.code ?? 'N/A'})`,
  );

  console.log('\n--- Hoàn tất chuẩn hóa dữ liệu ---');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => database.$disconnect());

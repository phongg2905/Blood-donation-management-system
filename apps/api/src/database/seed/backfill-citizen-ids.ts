import { database } from '../../config/database';

/**
 * Backfill unique 12-digit Vietnamese CCCD (Citizen ID)
 * for all users in the database who do not have one yet.
 */
async function backfillCitizenIds() {
  console.log('=== BẮT ĐẦU BỔ SUNG CCCD CHO TẤT CẢ USER CHƯA CÓ TRONG HỆ THỐNG ===\n');

  // 1. Gather all existing citizenIds in the DB
  const existingProfiles = await database.donorProfile.findMany({
    where: { citizenId: { not: null } },
    select: { citizenId: true },
  });
  const usedCitizenIds = new Set<string>(
    existingProfiles
      .map((p) => p.citizenId)
      .filter((id): id is string => typeof id === 'string' && id.length > 0),
  );
  console.log(`Số CCCD hiện đã tồn tại trong CSDL: ${usedCitizenIds.size}`);

  // 2. Find all users who don't have a donorProfile or whose citizenId is null
  const allUsers = await database.user.findMany({
    select: {
      id: true,
      email: true,
      fullName: true,
      roles: { select: { role: { select: { code: true } } } },
      donorProfile: { select: { id: true, citizenId: true } },
    },
    orderBy: { createdAt: 'asc' },
  });

  const usersNeedingCccd = allUsers.filter(
    (u) => !u.donorProfile || !u.donorProfile.citizenId,
  );

  console.log(`Tổng số user cần bổ sung CCCD: ${usersNeedingCccd.length}`);

  let counter = 1000;
  let updatedCount = 0;

  for (const user of usersNeedingCccd) {
    const roleCodes = user.roles.map((r) => r.role.code);
    let prov = '079'; // TP.HCM
    let genderCentury = '0'; // Nam thế kỷ 20
    let birthYearSuffix = '92'; // 1992

    if (roleCodes.includes('SYSTEM_ADMIN')) {
      prov = '079';
      genderCentury = '0';
      birthYearSuffix = '88';
    } else if (roleCodes.includes('COORDINATOR')) {
      prov = '079';
      genderCentury = '1';
      birthYearSuffix = '90';
    } else if (roleCodes.includes('DONATION_STAFF')) {
      prov = '079';
      genderCentury = '0';
      birthYearSuffix = '95';
    }

    // Generate unique 12-digit number: 3 prov + 1 genderCentury + 2 birthYear + 6 unique
    let candidateId = '';
    do {
      counter += 1;
      const uniqueSuffix = String(counter).padStart(6, '0');
      candidateId = `${prov}${genderCentury}${birthYearSuffix}${uniqueSuffix}`;
    } while (usedCitizenIds.has(candidateId));

    usedCitizenIds.add(candidateId);

    // Upsert DonorProfile for this user
    await database.donorProfile.upsert({
      where: { userId: user.id },
      create: {
        userId: user.id,
        citizenId: candidateId,
        phone: '090' + String(1000000 + counter).slice(-7),
        address: 'Thành phố Hồ Chí Minh, Việt Nam',
      },
      update: {
        citizenId: candidateId,
      },
    });

    updatedCount += 1;
    console.log(
      `✓ Đã cấp CCCD ${candidateId} cho [${roleCodes.join(', ')}] ${user.email} (${user.fullName})`,
    );
  }

  console.log(`\n=== HOÀN TẤT BỔ SUNG CCCD CHO ${updatedCount} TÀI KHOẢN ===`);
  await database.$disconnect();
}

backfillCitizenIds().catch((err) => {
  console.error('Lỗi khi bổ sung CCCD:', err);
  process.exit(1);
});

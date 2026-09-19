# donation-campaigns

Phase 1 đã có rule + validation (chưa có HTTP CRUD).

`campaign.validation.ts`:

- `validateCampaign` — `startsAt < endsAt`; `registrationOpensAt < registrationClosesAt`;
  `registrationClosesAt <= startsAt`; `registrationOpensAt < startsAt`;
  `targetDonors > 0` và `targetBloodVolumeMl > 0` nếu có (lỗi `CAMPAIGN_TARGET_INVALID`).
  Lỗi thời gian trả `CAMPAIGN_DATE_INVALID` kèm `fields`.
- `assertCampaignTransition` — `CAMPAIGN_TRANSITIONS`: `DRAFT → OPEN | CANCELLED`;
  `OPEN → CLOSED | CANCELLED`; `CLOSED → COMPLETED | CANCELLED`.
  Bị chặn: `COMPLETED → OPEN`, `CANCELLED → OPEN`, `CLOSED → DRAFT`, và mọi chuyển đổi từ trạng thái kết thúc.
- `assertCampaignAcceptsRegistration` — chỉ `OPEN` nhận đăng ký; `CANCELLED`/`CLOSED`/`COMPLETED` trả `REGISTRATION_CLOSED`, `DRAFT` trả `CAMPAIGN_NOT_OPEN`.
- `assertRegistrationWindowOpen` — cửa sổ đăng ký (bao gồm `registrationOpensAt`, không gồm `registrationClosesAt`).
- `assertCampaignEditable` — `COMPLETED` bị đóng băng (`CAMPAIGN_NOT_EDITABLE`).

Phase 2 ghi audit tương ứng: `CAMPAIGN_CREATED`, `CAMPAIGN_UPDATED`, `CAMPAIGN_OPENED`, `CAMPAIGN_CLOSED`, `CAMPAIGN_CANCELLED`.

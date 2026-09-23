# Landing page — editorial redesign

Trang `/` (Home đã đăng nhập) được thiết kế lại theo hướng **editorial /
immersive / storytelling**, bám art direction mới nhưng giữ nguyên bản sắc
Blood Donation và toàn bộ hành vi của hệ thống.

Phạm vi: chỉ giao diện Landing và CSS/asset phục vụ Landing. Không thay đổi
framework, router, AuthProvider, API contract, ProtectedRoute, Profile hay cấu
trúc thư mục. Không triển khai Phase 3.

## Art direction

- **Nhịp DARK → LIGHT → DARK**: hero nền tối, chương người kể chuyện nền ivory,
  hành trình nền tối, impact nền blush, đợt hiến nền tối, chuẩn bị nền paper,
  khu vực hành động nền ivory, closing nền burgundy. Mỗi chương có nhịp riêng
  thay vì dùng chung một card.
- **Typography dẫn dắt**: headline oversized (tới `clamp(2.6rem, 6.2vw, 5.4rem)`
  ở hero), chỉ số chương lớn (`01`…`06`), eyebrow uppercase tracking rộng,
  hairline 1px thay cho border/shadow.
- **Bố cục bất đối xứng**: hero hai cột (nội dung / hình), story lệch cột với
  pull-quote, timeline 5 bước trên một đường kẻ liền, hàng chuẩn bị dạng bảng
  biên tập.
- **Motif giọt máu**: giọt gradient + vòng tuần hoàn quay chậm + đường chảy
  dash-animation ở hero, ripple + đường flow ở impact, giọt nhỏ ở closing.
- **Palette**: kế thừa token brand của project (`brand-200/300/400/500/600/700`,
  `ink`, `panel-dark`) và khai báo thêm vài giá trị landing-only
  (`--landing-ink`, `--landing-burgundy`, `--landing-ivory`, `--landing-paper`,
  `--landing-blush`) tập trung ở đầu `home.css`. Không hardcode màu rải rác.
- **Không dùng**: card bo tròn + shadow tràn lan, pill, glassmorphism,
  dashboard, SaaS template, fashion/agency, số liệu giả.

## Cấu trúc trang

| #   | Section            | Nền      | Nội dung                                                               |
| --- | ------------------ | -------- | ---------------------------------------------------------------------- |
| —   | Cover              | dark     | Lời chào cá nhân, eyebrow, headline, lead, CTA, scroll cue, giọt máu    |
| 01  | Human story        | ivory    | Hình duotone + pull-quote + 3 hàng chi tiết (an toàn/tư vấn/minh bạch) |
| 02  | Donation journey   | dark     | 5 bước, timeline ngang trên desktop, dọc trên mobile                   |
| 03  | Impact             | blush    | “Một hành động. Một cơ hội mới.” + ghi chú không có số liệu giả        |
| 04  | Upcoming campaigns | dark     | Empty state thật, `dl` Thời gian/Địa điểm/Số chỗ = “Chưa công bố”      |
| 05  | Preparation        | paper    | 4 hàng đánh số trước khi hiến máu                                      |
| 06  | Personal actions   | ivory    | Hồ sơ, đợt hiến, hành trình — lọc theo quyền, không lộ mã quyền        |
| 07  | Closing CTA        | burgundy | “Sẵn sàng bắt đầu hành trình của bạn?” + CTA + ghi chú                 |

Cover **không đánh số**: nó là bìa, không phải chương, nên câu chuyện được đánh
số bắt đầu từ section ngay sau nó. Số chương **không hardcode trong từng
component**: `LANDING_CHAPTERS` (`landing-content.ts`) là nguồn duy nhất, theo
đúng thứ tự đọc 01 → 07; mỗi section nhận số qua `SectionHead` (riêng Impact và
Closing đặt số trực tiếp trong khối của mình vì scene không dùng `SectionHead`).
Nhờ vậy số chương không thể lệch khi thêm/bớt chương.

## Hành động và dữ liệu

- Chỉ một control “Đăng ký hiến máu” tồn tại trên trang (hero), hiển thị
  `disabled` kèm ghi chú “Đăng ký trực tuyến sắp ra mắt.” vì campaign/registration
  chưa có endpoint. Closing CTA trỏ về cover (`#hero`) — nơi đặt control đó — vì
  ở chế độ paging mọi cú nhảy trong trang đều dừng ở ranh giới chương; khi bấm,
  quả nút đăng ký nằm trọn trong màn hình (đo ở 1440×900: nút ở 683..737).
- Nút “Khám phá đợt hiến” và section đợt hiến chỉ hiện khi có `campaign.read`;
  khu vực hành động lọc theo `auth.profile.read` / `campaign.read`. Không hiển
  thị JWT, role thô, mã quyền, id nội bộ hay trạng thái API.
- Không có số liệu, đợt hiến, lịch hay lịch sử giả. Chỉ dùng route đang tồn tại
  (`/profile`) và anchor nội trang.

## File

Thêm:

- `src/app/pages/landing/` — `landing-content.ts`, `landingScroll.ts`,
  `SectionHead.tsx`, `Reveal.tsx`, `useRevealOnScroll.ts`, `useLandingPaging.ts`,
  `usePagedScroll.ts`, `RegistrationAction.tsx`,
  `LandingHero.tsx`, `HumanStorySection.tsx`, `DonationJourneySection.tsx`,
  `ImpactSection.tsx`, `CampaignSection.tsx`, `PreparationSection.tsx`,
  `PersonalActionsSection.tsx`, `FinalCtaSection.tsx`.
- `docs/landing-redesign.md` — tài liệu này.

Thay thế toàn bộ:

- `src/app/pages/HomePage.tsx` — chỉ còn là composition của 8 section.
- `src/app/styles/home.css` — viết lại từ đầu (trước đây là 8 khối override
  chồng lên nhau: dark → light → liquid glass → solid → final overrides).

Không sửa: `AppRoutes.tsx`, `AppShell.tsx`, `AuthProvider`, routing/guard,
Profile, các trang auth, token dùng chung, backend.

## Responsive

- ≥1440 / 1200 / 1024: hero hai cột, timeline ngang 5 cột, hàng hành động 3 cột.
- 768–899: hero một cột (ảnh art xuống dưới), story một cột, timeline dọc có cột
  số, chuẩn bị dạng bảng 3 cột.
- ≤720: masthead wrap (đo được 125px ở 390px) nên mọi `scroll-margin-top` dùng
  `--landing-header` do JS đo, CTA full-width, giọt máu nhỏ lại (260px), giảm
  padding chương.
- Chiều cao masthead **không hardcode**: `useLandingPaging` đo `.app-header` và ghi
  `--landing-header` lên `<html>` (gỡ khi rời trang), nên `.landing-hero`/`.landing-section`
  luôn có `scroll-margin-top: calc(var(--landing-header) + var(--space-4))` đúng ở
  mọi breakpoint — trước đây 132px hardcode làm anchor trượt dưới thanh header ở
  khổ hẹp.
- ≤480: hạ thêm cỡ headline.
- Không dùng `height: 100vh` hay `overflow: hidden` trên wrapper; hero dùng
  `min-height: clamp(540px, 74svh, 720px)` và bỏ min-height trên mobile để chương
  kế tiếp luôn lộ ra.
- Đã đo ở 1440/1200/1024/768/720/390/320 và ở zoom 200%: `scrollWidth` luôn bằng
  `innerWidth`, không có horizontal overflow.

## Paging trên desktop (mỗi cuộn = 1 màn hình)

- Từ **1024px** trở lên, mỗi chương là **một trang**: `<html>` dùng
  `scroll-snap-type: y mandatory`, mỗi `.landing-hero`/`.landing-section` có
  `scroll-snap-align: start` + `scroll-snap-stop: always`, cao
  `calc(100svh - var(--header-height))` và nội dung được canh giữa. Vì thế một
  thao tác cuộn (wheel/trackpad/phím) luôn dừng ở đúng chương kế tiếp, và không
  bao giờ dừng giữa chương.
- `scroll-margin-top: var(--landing-header)` giữ cho anchor và điểm snap trùng
  nhau: chương luôn nằm gọn dưới masthead.
- **Van an toàn** — `useLandingPaging` đo chiều cao từng chương ở layout tự nhiên,
  so với vùng khả dụng (viewport trừ masthead) và ghi `data-landing-paging`:
  - `full`: mọi chương vừa một màn hình → paging như trên;
  - `soft`: có chương cao hơn vùng khả dụng (cửa sổ thấp, zoom lớn, chữ to) →
    hạ xuống `scroll-snap-type: y proximity`, không khoá nội dung;
  - `none`: `prefers-reduced-motion: reduce` → không paging, không snap, cuộn hoàn
    toàn tự nhiên (đọc lại preference ở mỗi thao tác cuộn, không chỉ lúc mount).
    Đo lại khi đổi kích thước/zoom và sau khi webfont tải xong; thuộc tính bị gỡ
    khi rời trang để các route khác cuộn bình thường.
- Dưới 1024px (tablet/mobile) **không** snap: cuộn tự nhiên, vì nhiều chương cao
  hơn một màn hình ở khổ hẹp.
- `.app-footer` là một điểm snap (`align: end`) nên phần cuối trang vẫn tới được.
- Để paging hoạt động, nhịp chương trên desktop được siết lại theo ba mức (xem
  `home.css`): mặc định, `max-height: 860px` (cover gọn) và `max-height: 760px`
  (siết thêm padding + crop ảnh 4:1). Nhờ canh giữa theo trang, màn hình cao vẫn
  thoáng dù padding tối thiểu nhỏ.
- `usePagedScroll` biến **một** thao tác wheel thành **một** trang: glide bằng
  `requestAnimationFrame` với easing quartic in/out, `880ms` nền +
  `0.075ms/px`, trần `1300ms`; trong lúc glide, `data-landing-glide` được đặt lên
  `<html>` để CSS tạm tắt snapping (nếu không trình duyệt sẽ giành lại quyền cuộn)
  và mọi wheel tiếp theo của cùng thao tác bị nuốt. Sau khi dừng, cooldown
  `300ms` hấp thụ đà quán tính — đo được: 5 wheel trong một thao tác vẫn chỉ sang
  đúng 1 chương.

## Scroll và animation

- Scroll tự nhiên, không scroll trap; `scroll-behavior: smooth` của `base.css`
  được tôn trọng, mọi anchor có `scroll-margin-top`.
- Reveal dùng **một coordinator dùng chung** (`useRevealOnScroll.ts`): một listener
  `scroll`/`resize` (rAF-throttled) thay cho một `IntersectionObserver` mỗi phần tử.
  Một phần tử hiện khi đỉnh của nó vượt mốc 94% chiều cao viewport — kể cả khi đã bị
  cuộn vượt qua — nên **không có chữ nào có thể kẹt ở `opacity: 0`** (nhảy anchor,
  kéo scrollbar, phím, hay teleport đều an toàn). Chỉ animate `opacity` + `transform`,
  không layout shift.
- Nội dung của chương chỉ hiện sau khi **trang đã dừng**: khi `data-landing-glide`
  kết thúc, coordinator chờ thêm `200ms` (`SETTLE_MS`) rồi mới reveal, fade
  `400ms`, nên chữ không mờ nhoè trong lúc trang còn đang lướt mà cũng không
  khiến người đọc chờ. Thiếu `requestAnimationFrame` (jsdom) hoặc
  `prefers-reduced-motion: reduce` thì nội dung hiện ngay.
- Animation trang trí: vòng tuần hoàn quay chậm, đường chảy dash, giọt float nhẹ,
  scroll cue 1px, underline điều hướng, mũi tên link nhích khi hover. Tất cả bị
  tắt khi `prefers-reduced-motion: reduce`.
- Các lớp art của cover (`__art`, `__rings`, `__flow`) và của impact đều
  `pointer-events: none`; đường flow được giữ trong khung art nên không bao giờ
  vẽ lên caption.

## Accessibility

- Một `h1`, mỗi chương là `h2` có `aria-labelledby`, thứ tự heading liền mạch.
- Skip link và thứ tự tab không đổi: skip link → brand → nav → account menu →
  link trong hero → scroll cue → các chương.
- Hình trang trí dùng `alt=""`, các lớp art dùng `aria-hidden="true"`.
- Focus-visible đổi màu theo nền chương (crimson trên nền sáng, rose trên nền tối).

## Kiểm chứng

- `pnpm lint`, `pnpm typecheck`, `pnpm build` đạt; `pnpm --filter @blood/web test`
  120/120 đạt (không sửa test nào).
- Chromium headless (CDP): không horizontal overflow ở 1440/1200/1024/768/720/390/320
  và ở zoom 200%; reveal luôn hiện sau khi cuộn, kể cả khi nhảy thẳng xuống cuối
  trang; reduced-motion tắt animation và vẫn hiện đủ nội dung; không có console
  error hay exception.
- **Audit màu chữ bằng pixel thật** (screenshot Chromium + đo độ tương phản tại
  chỗ, quét mọi phần tử text ở cả 8 chương, 1600×1000 / 1440×900 / 1280×800 /
  1366×650 / 1024×768 / 768×1024 / 390×844): 0 trường hợp dưới ngưỡng WCAG
  (4.5:1 cho chữ thường, 3:1 cho chữ lớn), 0 phần tử bị che, 0 phần tử còn
  `opacity < 1` khi đang trong tầm nhìn, 0 overflow ngang. Audit này phát hiện và
  đã sửa: (1) `base.css` tô mọi `h1..h6` màu ink nên headline cover đen trên nền
  đen (1.13:1 — gần như vô hình), nay là trắng;
  (2) số chương `--landing-index` chỉ đạt 2.8–3.2:1 ở một số nền, nay 4.3–7.0:1;
  (3) đường “flow” của cover dài quá khung art nên vẽ đè lên caption;
  (4) `scroll-margin-top: 132px` hardcode nhỏ hơn masthead thật ở khổ hẹp.
- Paging: `full` ở 1600×1000, 1440×900, 1280×800/720, 1366×650, 1024×768/640,
  1024×900 — đo chiều cao tự nhiên của từng chương, không chương nào vượt vùng
  khả dụng; `soft` chỉ còn khi cửa sổ thấp hơn ~600px; `snapType: none` ở
  768×1024 và 390×844.
- Đo bằng **wheel thật** qua CDP (`Input.dispatchMouseEvent` → sự kiện wheel tin cậy):
  một notch đi 0 → 835, một thao tác 5 notch liên tiếp vẫn chỉ 835 → 1670, notch
  ngược lại lùi đúng 1 chương, mọi lần dừng **đúng ranh giới chương**; mỗi lần
  trang dừng sau ~950ms và nội dung chương mới đạt `opacity: 1` sau khi dừng
  ~0.6s (200ms chờ + 400ms fade; trước khi rút ngắn là ~0.9s).
- Dãy số chương kiểm tra trực tiếp trên DOM: cover `no number`, rồi 01 human
  story → 02 journey → 03 impact → 04 campaigns → 05 preparation → 06 actions →
  07 closing; headline cover `rgb(255, 255, 255)`.
- Luồng thật trên browser: login → Home, glyph anchor của scroll cue, nút đăng ký
  disabled không điều hướng, closing CTA cuộn về control đăng ký (88px, dưới
  header), menu tài khoản (panel tối, Đăng xuất là button), sang `/profile`, F5
  giữ phiên, đăng xuất về `/login`.

## Còn lại cho Phase 3

- Nối campaign/registration API để thay empty state bằng dữ liệu thật và bật nút
  đăng ký; khi đó CTA closing có thể trỏ thẳng tới luồng đăng ký.
- Lịch của tôi, lịch sử hiến, chứng nhận: chỉ bổ sung vào khu vực hành động khi có
  route thật.
- `public/images/auth-blood-donation.png` nặng 1.74 MB (1672×941). Trang chỉ dùng
  một lần với `loading="lazy"`, nhưng nên chuyển sang WebP/AVIF ở bước tối ưu asset.
- Kiểm thử browser với API thật và email thật vẫn cần môi trường tích hợp phù hợp.

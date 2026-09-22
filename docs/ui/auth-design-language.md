# Auth design language

## Reference priority

The user selected auth-reference-02.jpg as the primary reference. References 01 and 03 are supplementary. This supersedes the earlier full-page split-screen specification.

- Reference 02: full-viewport pink/purple sunset mountains and lake, one centered translucent glass form, fine border, underlined inputs, purple submit button.
- Reference 01: restrained inset highlight and soft elevation.
- Reference 03: pink/lilac glass tint and rounded edges.

The references were visually inspected. The previous claim that all three references showed a split-screen layout was incorrect.

## Implementation

All four auth pages share AuthLayout and AuthCard. Following the user's request to connect the design to Blood Donation, a generated, text-free donation illustration is stored at apps/web/public/images/auth-blood-donation.png. It shows a donor and nurse on the left, and a blood drop held by caring hands on the right. The centered glass composition and pink/purple atmosphere of reference 02 remain. Mobile framing favors the blood drop. Reference screenshots are never imported into the application.

The page uses a header / main / footer grid. The form sits in a 448px glass surface with 32px horizontal padding; registration uses 496px and flows from the top. On mobile the form uses 24px side gutters and 24px internal padding. Longer forms scroll normally. The landscape fills the viewport behind the document.

Color overrides are scoped to .auth-layout in auth.css, leaving the application and error pages' palette intact. Inputs and submit buttons remain 52px high. Fields retain explicit labels, 8px label spacing, 24px group spacing, and existing error associations. Glass uses a pale tint to maintain dark text readability, with an opaque fallback for reduced transparency.

Demo accounts remains collapsed by default and is rendered only in mock mode. Authentication, validation, role permissions, and routing behavior are unchanged. No social login, captcha, remember-me control, or decorative navigation was added.

## Verification

Use Chromium screenshots at 1440×900, 1920×1080, 1024×768, 768×1024, and 390×844 for login and registration; also inspect forgot/reset pages, expanded demo accounts, and error states.

Required checks: pnpm typecheck, pnpm lint, pnpm test, pnpm build.

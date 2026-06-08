---
name: Phone auth in no-OTP (free) mode
description: How phone login/register works while OTP_REQUIRED is false, and the security tradeoff it accepts.
---

# Phone auth in no-OTP (free) mode

When `OTP_REQUIRED = false` (client `Auth.tsx`), phone identity is verified
manually by admins confirming orders — there is NO OTP or password check on
phone accounts (phone users have `passwordHash` null).

The free-mode phone flow is **phone-first, two-step**:
- `POST /api/auth/phone-login` (in `server/replit_integrations/auth/routes.ts`)
  normalizes the number and looks it up: existing → logs in via session and
  returns `{exists:true}`; new → returns `{exists:false}` WITHOUT creating an
  account. It does not require a name.
- New numbers then go to `POST /api/auth/register-direct` (name + phone) which
  creates the account. register-direct still returns 409 on duplicate phone as
  a race-condition safety net.

**Why:** existing users were blocked because every phone entry hit
register-direct → 409. Splitting login from register fixes that.

**How to apply:** any change to phone auth must keep both branches working and
remember that login-by-phone is intentionally unverified in this mode. The
disabled OTP flow (renderPhoneStep/renderOtpStep/renderNameStep, gated by
OTP_REQUIRED) is the path to re-enable when SMS/WhatsApp credit returns.

**Known gap:** phone-login has no rate limit and leaks existence
(exists:true/false), enabling account enumeration / login by guessing numbers.

# Projector and security review

The projector is rendered through a React portal attached to document.body. Dashboard card hover transforms and entry animations can no longer move or clip its fixed overlay. The existing QR image stays mounted during countdowns and token changes.

## Fixed findings

- Removed the invalid-QR fallback that accepted any active classroom session, session UUIDs, cached tokens, and expired sessions. QR capabilities are signed on the server, rotate each minute, expire after at most two minutes, and always require a live database session. Ending a session now persists revocation. Only staff can fetch QR capabilities; faculty can end only their own sessions.
- Login JWTs must have a subject, expiry, access purpose and valid role. Every request checks that the corresponding database account still exists and is approved. Enrollment and QR tokens cannot serve as login tokens. Logout persists session revocation in the existing audit-log table; changing a password invalidates earlier sessions through a credential-version claim.
- Frontend guards wait for backend session restoration and do not trust a cached localStorage profile. Student routes and administrator registration routes are guarded. Removed local user-switch impersonation and stopped storing new bearer tokens in localStorage; browser authentication uses the httpOnly cookie.
- Restricted attendance lists/capture/matching and live WebSocket connections to staff. Student reports require staff authentication or an email-verified, ten-minute token bound to the requested hall ticket. Public enrollment-status responses no longer contain student names or attendance records.
- Public registration cannot self-approve accounts. Student profile updates and face payload identifiers enforce ownership. Biometric enrollment no longer changes approval status or accepts client-supplied passkey IDs as verified credentials.
- Replaced the passkey verifier that never checked signatures with real registration and authentication verification: COSE public keys, signatures, origin/RP ID, user verification and challenge replay checks. Registration requires staff authorization or an email-verified enrollment token. The browser now reports rejected registration as failure.
- Liveness challenges are mandatory and consumed atomically. Enabled Redis TLS certificate verification. Shared the route rate limiter with the application. Reject untrusted browser mutation origins, suppress sensitive API caching and referrers, and reduce public health diagnostics.
- Startup no longer overwrites a reset administrator password from the bootstrap environment variable.
- Updated vulnerable frontend and backend dependencies and committed their manifests/lockfile changes. Node 20+ remains required for frontend builds.

## Verification

- All 86 backend regression tests passed. The suite covers anonymous route rejection, staff role rejection, route inventory, deleted/disabled accounts, JWT purpose, invalid QR capabilities, session ownership, WebSocket access, cross-origin mutation rejection, report token scope, enrollment authorization, self-approval, profile ownership, signed passkey success, tampered signature rejection and replay rejection.
- Chromium check visited all 12 protected frontend paths with a forged cached admin profile: all redirected to login. With a mocked approved faculty session, the projector stayed attached directly to body at 1440 x 1000 through countdown updates and a QR token rotation. The image DOM node was not removed or replaced; Escape closed the overlay.
- Frontend production build passed. npm audit and pip-audit reported zero known vulnerabilities after upgrades; pip check passed.
- Browser test used mocked API responses. Backend tests used mocked database sessions; no production database, real camera, physical projector, SMTP delivery or real hardware authenticator was exercised. The passkey signature tests generate and verify real EC signatures.

## Deployment and remaining limits

Rebuild both application containers together to install the patched dependencies. All staff must sign in again because older JWTs lack the new session/version claims. Restart active attendance sessions and rescan their QR codes: old unsigned tokens/UUID links are deliberately rejected. Old passkey records contain metadata instead of a cryptographic public key and must be reset by staff and re-enrolled. Configure CORS_ORIGINS to the exact browser origin(s), including scheme and any port, for passkeys and browser writes.

Email verification is now required for student report lookup. Publicly registered students need staff approval before biometric enrollment/check-in. No database schema migration is needed.

This is a code review and regression pass, not a claim of exhaustive penetration-test coverage. Browser-supplied GPS and face/liveness measurements do not constitute trusted hardware attestation. Faculty currently share the staff-wide roster/attendance permissions designed into the app; per-class isolation would require an explicit authorization policy.

## HTTP route inventory

Every registered API route was inventoried below. The regression suite fails if an API route is neither explicitly public nor attached to one of the recognized authorization dependencies. Public routes still require endpoint-level proof where described above.

| Method | Route | Access boundary |
| --- | --- | --- |
| GET | `/health` | Public; QR, OTP, challenge, or passkey proof required where applicable |
| GET | `/api/health` | Public; QR, OTP, challenge, or passkey proof required where applicable |
| POST | `/api/students/{student_id}/face` | Approved account; object ownership where applicable |
| POST | `/api/students/{student_id}/enroll-face` | Approved account; object ownership where applicable |
| PUT | `/api/students/{student_id}/face` | Approved account; object ownership where applicable |
| DELETE | `/api/students/{student_id}/face` | Approved account; object ownership where applicable |
| DELETE | `/api/students/{student_id}/revoke-face-data` | Approved account; object ownership where applicable |
| POST | `/api/qr-session/start` | Approved account plus endpoint staff/admin role |
| GET | `/api/qr-session/current` | Approved account plus endpoint staff/admin role |
| POST | `/api/qr-session/{session_id}/end` | Approved account plus endpoint staff/admin role |
| GET | `/api/checkin/session/{token:path}` | Public; QR, OTP, challenge, or passkey proof required where applicable |
| GET | `/api/student/check-status/{hall_ticket}` | Public; QR, OTP, challenge, or passkey proof required where applicable |
| POST | `/api/student/reset-biometrics/{hall_ticket}` | Approved account; object ownership where applicable |
| POST | `/api/admin/clear-all-biometrics` | Approved account plus endpoint staff/admin role |
| GET | `/api/checkin/challenge` | Public; QR, OTP, challenge, or passkey proof required where applicable |
| POST | `/api/student/register-biometrics` | Public student signup (pending), or staff / scoped enrollment proof; endpoint-specific checks |
| GET | `/api/student/records/{hall_ticket}` | Staff session or email-verified token scoped to this student |
| POST | `/api/checkin/verify` | Public; QR, OTP, challenge, or passkey proof required where applicable |
| GET | `/api/attendance/today` | Approved account plus endpoint staff/admin role |
| GET | `/api/embeddings/sync` | Dedicated edge API key |
| GET | `/api/attendance/records` | Approved account plus endpoint staff/admin role |
| GET | `/api/attendance/date/{target_date}` | Approved account plus endpoint staff/admin role |
| POST | `/api/attendance/capture` | Approved account plus endpoint staff/admin role |
| PATCH | `/api/attendance/override/{record_id}` | Approved account plus endpoint staff/admin role |
| PATCH | `/api/attendance/{record_id}/override` | Approved account plus endpoint staff/admin role |
| POST | `/api/attendance/toggle` | Approved account plus endpoint staff/admin role |
| POST | `/api/attendance/bulk` | Approved account plus endpoint staff/admin role |
| POST | `/api/attendance/mark` | Approved account plus endpoint staff/admin role |
| POST | `/api/attendance/verify-face` | Approved account plus endpoint staff/admin role |
| GET | `/api/admin/stats` | Approved account plus endpoint staff/admin role |
| GET | `/api/admin/geofence` | Public; QR, OTP, challenge, or passkey proof required where applicable |
| PUT | `/api/admin/geofence` | Approved account; object ownership where applicable |
| GET | `/api/admin/system/diagnostics` | Approved account plus endpoint staff/admin role |
| POST | `/api/admin/system/test-smtp` | Approved account plus endpoint staff/admin role |
| GET | `/api/auth/users` | Approved account plus endpoint staff/admin role |
| POST | `/api/auth/logout` | Public; QR, OTP, challenge, or passkey proof required where applicable |
| GET | `/api/auth/me` | Approved account; object ownership where applicable |
| POST | `/api/auth/login` | Public; QR, OTP, challenge, or passkey proof required where applicable |
| POST | `/api/auth/register` | Public student signup (pending), or staff / scoped enrollment proof; endpoint-specific checks |
| PUT | `/api/auth/users/{user_id}` | Approved account; object ownership where applicable |
| DELETE | `/api/auth/users/{user_id}` | Approved account plus endpoint staff/admin role |
| POST | `/api/auth/users/bulk-delete` | Approved account plus endpoint staff/admin role |
| POST | `/api/auth/users/bulk` | Approved account plus endpoint staff/admin role |
| POST | `/api/auth/faculty/bulk` | Approved account plus endpoint staff/admin role |
| POST | `/api/auth/request-reset` | Public; QR, OTP, challenge, or passkey proof required where applicable |
| POST | `/api/auth/reset-password` | Public; QR, OTP, challenge, or passkey proof required where applicable |
| POST | `/api/auth/admin-direct-reset` | Approved account plus endpoint staff/admin role |
| POST | `/api/auth/student/enrollment/request-otp` | Public; QR, OTP, challenge, or passkey proof required where applicable |
| POST | `/api/auth/student/enrollment/verify-otp` | Public; QR, OTP, challenge, or passkey proof required where applicable |
| POST | `/api/biometrics/webauthn/register-options` | Public student signup (pending), or staff / scoped enrollment proof; endpoint-specific checks |
| POST | `/api/biometrics/webauthn/register-verify` | Public student signup (pending), or staff / scoped enrollment proof; endpoint-specific checks |
| POST | `/api/biometrics/webauthn/auth-options` | Public; QR, OTP, challenge, or passkey proof required where applicable |
| POST | `/api/biometrics/webauthn/auth-verify` | Public; QR, OTP, challenge, or passkey proof required where applicable |

## Reference documentation

- [WebAuthn registration verification](https://duo-labs.github.io/py_webauthn/registration.html)
- [WebAuthn authentication verification](https://duo-labs.github.io/py_webauthn/authentication.html)
- [Official SheetJS package distribution](https://docs.sheetjs.com/docs/getting-started/installation/nodejs/)

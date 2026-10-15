# Manual seller portal acceptance

The frontend is connected to the gateway. **Live integration is intentionally unverified.** No live API requests or test data were created while implementing this portal. The automated checks use intercepted responses.

Use disposable accounts and material data in the authorized test environment. Test with two distinct seller accounts to verify server-side ownership. Record the screen, HTTP status, error code, and correlation ID when reporting failures; never share tokens/passwords.

## Account access

1. Open the portal signed out: protected routes redirect to login.
2. Register; confirm password matching, required fields, and backend validation feedback.
3. Verify email/mobile, resend the verification code, then sign in.
4. If MFA is enabled, complete the challenge with a valid code; verify invalid codes remain on the challenge screen. Resend the sign-in code and confirm the new challenge works.
5. Request password recovery, reset with the issued token, and sign in with the new password.
6. Expire an access token: the next authenticated request should refresh once and continue. An invalid refresh token should return to login. A service outage should display a retryable failure.
7. Sign out; ensure authenticated data is cleared and protected routes redirect.

## Seller onboarding

1. A new account sees the seller setup prompt. Create an individual and a business profile in separate accounts.
2. Confirm business creation requires a legal name and preserves country/currency.
3. Upload the required documents, optional number and dates. Check file size/type validation, storage failure feedback, completion, attachment, signed download, and removal.
4. Submit for verification; refresh and confirm status matches the backend.
5. Where multiple seller contexts exist, switch the business selector. Ensure listings and resources change accordingly.
6. Log in as suspended, pending, and approved sellers. Verify API permission errors are shown clearly and the backend denies restricted operations.

## Listings

1. Create a draft in a real category; check required metadata, category brands/conditions/grades/units, location, pricing and expiry.
2. Save and reopen: values should persist. A created listing opens its Attributes tab.
3. Fill required category attributes; save, reopen, and validate. Correct invalid values and missing requirements.
4. Upload images and documents; choose a primary image, reorder, view, and remove them. Confirm signed uploads don't receive the portal bearer token.
5. Set initial inventory, then use positive and negative adjustments; verify reserved/sellable quantities and paginated movement history.
6. Validate and submit for review. Verify feedback after an administrator approves/rejects/requests corrections.
7. After backend publication, pause (SUSPENDED) and resume. Check that administrator suspensions cannot be resumed unless the backend permits it.
8. Archive a disposable listing; verify confirmation and final status.
9. Verify search, status filters, pagination, empty states and retryable failures.
10. Edit the same resource in two tabs; the stale write must show conflict feedback. Refresh, review and save using the latest row version.
11. With a second seller account, attempt to open the first account's resource IDs. The backend must deny access.

## Inspections

1. Open a listing's Inspections tab: check empty state and paginated history.
2. Review the latest inspection's checklist result, evidence downloads, notes and summary.
3. For a failed inspection, enter remediation notes and request reinspection. Verify the resulting status with the backend.

## Account settings and responsive layout

1. Edit personal details and upload a profile photo; reload to confirm persistence.
2. Change password; check mismatch/incorrect current-password feedback and session effects.
3. Set up email OTP MFA and confirm the factor.
4. Turn off MFA: request the security challenge, verify its code, and confirm disabling. Check the account activity history.
5. Review and revoke sessions; revoke the current session and test sign-out-everywhere.
6. At mobile width, open/close navigation and complete forms. Check keyboard focus, readable error feedback and table scrolling.

## Endpoint groups

| Workflow                | Contract routes                                                                                                                                                                                                                                                   |
| ----------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Identity                | `/api/v1/auth/login`, `/register`, `/token/refresh`, `/logout`, `/logout-all`, `/sessions`                                                                                                                                                                        |
| Verification / security | `/api/v1/auth/verification/{email                                                                                                                                                                                                                                 | mobile}/{send | confirm}`, `/password/{forgot | reset | change}`, `/mfa/{verify | register | confirm}`, `/stepup/{initiate | verify}`, `/account/status` |
| Actor / sellers         | `/api/v1/marketplace/actors/me`, `/api/v1/marketplace/sellers`, `/{sellerId}`, `/{sellerId}/submit`, `/{sellerId}/documents`                                                                                                                                      |
| Catalog                 | `/api/v1/catalog/categories`, `/{categoryId}/listing-requirements`                                                                                                                                                                                                |
| Seller listings         | `/api/v1/marketplace/sellers/{sellerId}/listings`, `/{listingId}`                                                                                                                                                                                                 |
| Listing children        | `/attributes`, `/validate`, `/media`, `/inventory`, `/inventory/adjustments`, `/inventory/movements`, `/moderation-status`, `/submit`, `/pause`, `/resume`, `/archive`, `/inspections`, `/inspections/latest`, `/inspections/{inspectionId}/request-reinspection` |
| Files                   | `/api/v1/files/upload-requests`, `/{fileId}/complete`, `/{fileId}/download-url`                                                                                                                                                                                   |
| Profile                 | `/api/v1/users/me`                                                                                                                                                                                                                                                |

Relative paths in this table are appended to the resource in their group, not the gateway root. Exact methods and payloads are in the frontend source.

# Stockout Seller Portal

React + TypeScript seller workspace connected to `https://stockout.flowb.io`.

## Run

Use Node.js 24 (Node 22.12+ is also supported).

```sh
cd /workspace/STOCKOUT_FRONTEND
npm ci
npm run dev -- --host 0.0.0.0 --port 5173
```

Open the development server using your environment's port forwarding. The portal starts at `/login`.

`VITE_API_BASE_URL` overrides the gateway URL. Copy `.env.example` to `.env.local` if needed; restart Vite after changing it. Never put passwords, API secrets, or access tokens in `VITE_*` variables: they are public browser configuration.

```sh
npm run build
npm run preview -- --host 0.0.0.0 --port 5173
```

Deploy `dist/` to a static host with SPA fallback to `index.html`, including `/listings/:id`. API and upload storage must allow the deployed frontend origin through CORS. Signed storage uploads use the exact method and required headers supplied by the backend, without forwarding the portal's bearer token.

## Implemented screens

- Login, registration, email/mobile verification and resend, MFA login, password recovery/reset.
- Overview with real API listing counts and recent listings; no seeded runtime data.
- Seller creation and context selection, business status, review submission.
- Verification documents: direct upload, attach, download, remove.
- Listings: search, aggregate status filter, pagination, draft creation and updates.
- Category-dependent brands, conditions, grades, units, and attributes.
- Listing images/documents, primary image, ordering, removal, signed downloads.
- Inventory: on-hand/reserved/sellable quantities, set/adjust stock, movement history.
- Completeness validation, moderation feedback, submit for review, pause/resume/archive.
- Inspection history, latest report and evidence, request reinspection after failure.
- Personal profile/photo, password change, account verification, email OTP MFA setup/status/disable with step-up verification, account activity, session revocation and logout.

The UI follows the supplied admin reference's dark sidebar, yellow accent, Geist typography, and restrained cards. The seller information architecture is purpose-built. Logo and font are local assets copied from the supplied reference.

## Frontend verification

```sh
npx playwright install chromium
npm test
```

For a sandbox that cannot write its home cache:

```sh
PLAYWRIGHT_BROWSERS_PATH=/tmp/stockout-playwright npx playwright install chromium
PLAYWRIGHT_BROWSERS_PATH=/tmp/stockout-playwright npm test
```

The Playwright suite intercepts gateway requests and uses **local fixtures only**. It checks frontend behavior; it does not test the live APIs. Fixtures live only in `tests/` and are not included in the application bundle.

TypeScript and production build: `npm run build`. Format sources: `npm run format`.

## Integration details and limits

Request models were mapped against `tsforcetech/STOCKOUT` commit `4f7b0aaf6497e40f84c90b7b3d42a86375f1004e`. The gateway was not called during implementation, as requested. Verify compatibility with the deployed backend manually using [MANUAL_TESTING.md](MANUAL_TESTING.md).

The API client handles raw and `success/data` responses, initial PascalCase/camelCase keys, structured errors, timeout/network failures, and a single concurrent token refresh. Tokens persist in `sessionStorage` for the current tab, not `localStorage`; closing the tab signs the user out locally. Logout clears local credentials even if the service is unavailable. Production authentication should be reviewed with the backend team if an HttpOnly-cookie flow becomes available. No client secret is embedded.

Seller identity comes from `/api/v1/marketplace/actors/me`; the backend must enforce ownership. Updates use the matching resource's row version. Create and submit requests include `X-Idempotency-Key`. Writes are not retried automatically. On conflicts, refresh and review before saving again.

Seller profile updates, sales/orders, bids/deals, billing/payouts, chat, notification inbox, and analytics require additional usable seller APIs; this release does not fabricate those workflows. Seller profile details are read-only after creation because the inspected contract has no seller update endpoint. Publication remains controlled by marketplace review. A paused listing is represented by the backend aggregate status `SUSPENDED`; resume eligibility is enforced by the backend.

Inventory and inspections are available per listing, so the top-level pages let sellers choose a listing. Only the latest inspection has a seller detail endpoint; older inspection records show the available summary. The API's aggregate listing statuses are DRAFT, PUBLISHED, SUSPENDED, EXPIRED, ARCHIVED; review decisions are shown separately in the Moderation tab.

The inspected backend supports EMAIL_OTP MFA only; authenticator enrollment and recovery-code login are not exposed as working features.

## GitHub Pages

`.github/workflows/deploy-pages.yml` builds and publishes pushes to `main`. Enable GitHub Pages with **GitHub Actions** as the source. Private repositories require a GitHub plan that supports Pages; repository visibility does not need to change.

The deployment uses the Pages base path and hash routing so deep links and refreshes work without server rewrites (for example `/#/login` under the project base URL). Local development retains normal browser routing. The gateway must permit the deployed origin through CORS.

To reproduce the Pages build locally:

```sh
VITE_ROUTER_MODE=hash npm run build -- --base=/STOCKOUT_FRONTEND/
```

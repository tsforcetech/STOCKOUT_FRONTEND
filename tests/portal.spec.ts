import { test, expect, type Page } from '@playwright/test';
const sellerId = '11111111-1111-1111-1111-111111111111';
const listingId = '22222222-2222-2222-2222-222222222222';
const categoryId = '33333333-3333-3333-3333-333333333333';
const attributeId = '44444444-4444-4444-4444-444444444444';
const seller = {
  sellerId,
  displayName: 'Test Materials',
  sellerType: 'BUSINESS',
  status: 'ACTIVE',
  verificationStatus: 'VERIFIED',
  onboardingStatus: 'COMPLETED',
  isOwner: true,
};
const tokens = {
  accessToken: 'local-ui-test-token',
  refreshToken: 'local-ui-refresh',
  expiresIn: 900,
  userId: 'test-user',
  displayName: 'Test Seller',
};
const listing = {
  listingId,
  sellerId,
  status: 'DRAFT',
  rowVersion: 'AQ==',
  title: 'Surplus steel beams',
  categoryId,
  createdAtUtc: '2026-10-15T00:00:00Z',
  currentDraftVersionId: 'version-1',
  currentDraftVersion: {
    listingVersionId: 'version-1',
    title: 'Surplus steel beams',
    categoryId,
    description: 'Unused structural steel',
    pricingMode: 'FIXED_PRICE',
    currency: 'AED',
    basePrice: 120,
    location: { countryCode: 'AE', stateOrEmirate: 'Dubai', city: 'Dubai' },
  },
};
async function setup(page: Page, signedIn = true) {
  if (signedIn)
    await page.addInitScript(
      (t) => sessionStorage.setItem('stockout.seller.session', JSON.stringify(t)),
      tokens,
    );
  // Every gateway request is intercepted. These are local UI checks, not live API tests.
  await page.route('https://stockout.flowb.io/**', async (route) => {
    const url = new URL(route.request().url());
    const path = url.pathname;
    let data: unknown = {};
    if (path.endsWith('/actors/me'))
      data = { success: true, data: { userId: 'test-user', sellerContexts: [seller] } };
    else if (path === `/api/v1/marketplace/sellers/${sellerId}`)
      data = {
        success: true,
        data: {
          ...seller,
          organizationType: 'BUSINESS',
          countryCode: 'AE',
          defaultCurrency: 'AED',
          rowVersion: 'AQ==',
        },
      };
    else if (path.endsWith('/listing-requirements'))
      data = {
        attributes: [
          {
            attributeDefinitionId: attributeId,
            name: 'Length',
            code: 'LENGTH',
            dataType: 'DECIMAL',
            isRequired: true,
          },
        ],
        brands: [],
        unitRules: { units: [] },
        conditionRules: { conditions: [] },
      };
    else if (path === '/api/v1/catalog/categories')
      data = { success: true, data: [{ categoryId, name: 'Steel', children: [] }] };
    else if (path.endsWith('/attributes'))
      data = {
        rowVersion: 'AQ==',
        attributes: [{ attributeDefinitionId: attributeId, values: ['12'], dataType: 'DECIMAL' }],
      };
    else if (path.endsWith('/inventory/movements')) data = { items: [], totalCount: 0 };
    else if (path.endsWith('/inventory'))
      data = { rowVersion: 'AQ==', onHandQuantity: 24, reservedQuantity: 4, sellableQuantity: 20 };
    else if (path.endsWith('/moderation-status'))
      data = { status: 'DRAFT', sellerNotes: 'Complete your draft.' };
    else if (path.endsWith('/validate')) data = { isValid: true, errors: [] };
    else if (path.endsWith('/inspections/latest'))
      data = {
        inspectionId: 'inspection-1',
        inspectionNo: 'INS-001',
        status: 'COMPLETED',
        result: 'FAIL',
        summary: 'Surface preparation required',
        responses: [
          {
            inspectionResponseId: 'response-1',
            itemLabelSnapshot: 'Surface finish',
            itemResult: 'FAIL',
          },
        ],
      };
    else if (path.endsWith('/inspections'))
      data = {
        items: [
          {
            inspectionId: 'inspection-1',
            inspectionNo: 'INS-001',
            status: 'COMPLETED',
            result: 'FAIL',
            createdAtUtc: '2026-10-15T00:00:00Z',
          },
        ],
        totalCount: 1,
      };
    else if (path.endsWith('/media')) data = { rowVersion: 'AQ==', media: [] };
    else if (path.endsWith('/documents')) data = { success: true, data: [] };
    else if (path.endsWith('/auth/sessions'))
      data = [
        {
          sessionId: 'session-1',
          status: 'ACTIVE',
          createdAtUtc: '2026-10-15T00:00:00Z',
          isCurrentSession: true,
        },
      ];
    else if (path.endsWith('/account/status'))
      data = {
        email: 'seller@example.test',
        mobile: '+971500000000',
        emailVerified: true,
        mobileVerified: false,
        status: 'ACTIVE',
      };
    else if (path.endsWith('/mfa/status')) data = { enabled: false, type: null };
    else if (path.endsWith('/account/activity')) data = { items: [], totalCount: 0 };
    else if (path.endsWith('/users/me'))
      data = {
        success: true,
        data: { displayName: 'Test Seller', firstName: 'Test', lastName: 'Seller' },
      };
    else if (path.endsWith('/auth/login')) data = tokens;
    else if (path.endsWith(`/listings/${listingId}`)) data = listing;
    else if (path.endsWith('/listings'))
      data =
        route.request().method() === 'POST' ? { listingId } : { items: [listing], totalCount: 1 };
    else
      return route.fulfill({
        status: 500,
        json: { detail: `Unexpected local UI fixture: ${path}` },
      });
    await route.fulfill({ json: data });
  });
}
test('signed-out visitors see login and gateway errors stay visible', async ({ page }) => {
  await setup(page, false);
  await page.goto('/');
  await expect(page).toHaveURL(/login/);
  await page.getByLabel('Email or mobile').fill('seller@example.test');
  await page.getByLabel('Password', { exact: true }).fill('dummy-password');
  await page.route('**/api/v1/auth/login', (r) => r.fulfill({ status: 502, body: 'Bad Gateway' }));
  await page.getByRole('button', { name: 'Sign in', exact: true }).click();
  await expect(page.getByRole('alert')).toContainText('temporarily unavailable');
  await expect(page).toHaveURL(/login/);
});
test('login enters workspace and loads server-provided listing', async ({ page }) => {
  await setup(page, false);
  await page.goto('/login');
  await page.getByLabel('Email or mobile').fill('seller@example.test');
  await page.getByLabel('Password', { exact: true }).fill('dummy-password');
  await page.getByRole('button', { name: 'Sign in', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Good to see you, Test.' })).toBeVisible();
  await expect(page.getByText('Surplus steel beams')).toBeVisible();
  await page.getByRole('link', { name: 'My listings', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'My listings' })).toBeVisible();
});
test('create listing saves documented payload and idempotency header', async ({ page }) => {
  await setup(page);
  await page.goto('/listings/new');
  await page.getByLabel('Material category').selectOption(categoryId);
  await page.getByLabel('Listing title').fill('Copper cable');
  await page.getByLabel('State / emirate').fill('Dubai');
  await page.getByLabel('City', { exact: true }).fill('Dubai');
  const pending = page.waitForRequest(
    (r) => r.url().endsWith('/listings') && r.method() === 'POST',
  );
  await page.getByRole('button', { name: 'Save draft & continue' }).click();
  const req = await pending;
  expect(req.headers()['x-idempotency-key']).toBeTruthy();
  expect(req.postDataJSON()).toMatchObject({
    title: 'Copper cable',
    categoryId,
    pricingMode: 'FIXED_PRICE',
    currency: 'AED',
    basePrice: 0,
    location: { countryCode: 'AE', city: 'Dubai' },
  });
  await expect(page).toHaveURL(/tab=attributes/);
  await expect(page.getByLabel('Length')).toHaveValue('12');
});
test('attribute conflict preserves form and provides refresh guidance', async ({ page }) => {
  await setup(page);
  await page.goto(`/listings/${listingId}?tab=attributes`);
  await page.route('**/attributes', async (route) => {
    if (route.request().method() === 'PUT')
      return route.fulfill({
        status: 409,
        json: { detail: 'This record has changed. Refresh before saving.' },
      });
    return route.fallback();
  });
  await page.getByLabel('Length').fill('16');
  await page.getByRole('button', { name: 'Save attributes' }).click();
  await expect(page.getByRole('alert')).toContainText('Refresh before saving');
  await expect(page.getByLabel('Length')).toHaveValue('16');
});
test('inventory update includes concurrency version and refreshes data', async ({ page }) => {
  await setup(page);
  await page.goto(`/listings/${listingId}?tab=inventory`);
  await page.getByLabel('On-hand quantity').fill('30');
  const pending = page.waitForRequest(
    (r) => r.url().endsWith('/inventory') && r.method() === 'PUT',
  );
  await page.getByRole('button', { name: 'Update inventory' }).click();
  expect((await pending).postDataJSON()).toMatchObject({
    onHandQuantity: 30,
    expectedRowVersion: 'AQ==',
  });
  await expect(page.getByText('Changes saved successfully.')).toBeVisible();
});
test('inspection page renders paginated response and latest report', async ({ page }) => {
  await setup(page);
  await page.goto(`/listings/${listingId}?tab=inspections`);
  await expect(page.getByRole('heading', { name: 'Inspection history' })).toBeVisible();
  await expect(page.getByText('Surface preparation required')).toBeVisible();
  await expect(page.getByText('Surface finish')).toBeVisible();
  await expect(page.getByLabel('What have you fixed?')).toBeVisible();
});
test('mobile navigation opens and page fits viewport', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await setup(page);
  await page.goto('/');
  await page.getByRole('button', { name: 'Open navigation' }).click();
  await page.getByRole('link', { name: 'Documents', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Business documents' })).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(
    true,
  );
  await page.screenshot({
    path: '/tmp/stockout-seller-mobile.png',
    fullPage: true,
    animations: 'disabled',
  });
});
test('desktop layout renders all seller navigation without runtime errors', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.setViewportSize({ width: 1440, height: 1000 });
  await setup(page);
  await page.goto('/');
  await expect(page.getByText('Surplus steel beams')).toBeVisible();
  await page.screenshot({ path: '/tmp/stockout-seller-desktop.png', fullPage: true });
  for (const path of [
    '/business',
    '/documents',
    '/inventory',
    '/inspections',
    '/profile',
    '/security',
  ]) {
    await page.goto(path);
    await expect(page.locator('h1')).toBeVisible();
    await expect(page.getByText('Unable to display this screen')).toHaveCount(0);
  }
  expect(errors).toEqual([]);
});

test('registration moves to verification using the submitted email', async ({ page }) => {
  await setup(page, false);
  await page.route('**/api/v1/auth/register', (route) =>
    route.fulfill({ status: 201, json: { userId: 'new-user', message: 'Check your email.' } }),
  );
  await page.goto('/login?mode=register');
  await page.getByLabel('First name', { exact: true }).fill('New');
  await page.getByLabel('Last name', { exact: true }).fill('Seller');
  await page.getByLabel('Display name', { exact: true }).fill('New Seller');
  await page.getByLabel('Email address', { exact: true }).fill('new@example.test');
  await page.getByLabel('Mobile number', { exact: true }).fill('+971500000001');
  await page.getByLabel('Password', { exact: true }).fill('dummy-password');
  await page.getByLabel('Confirm password', { exact: true }).fill('dummy-password');
  await page.getByRole('button', { name: 'Create account', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Verify your account.' })).toBeVisible();
  await expect(page.getByLabel('Email address', { exact: true })).toHaveValue('new@example.test');
});

test('MFA login sends the challenge instead of accepting a partial session', async ({ page }) => {
  await setup(page, false);
  await page.route('**/api/v1/auth/login', (route) =>
    route.fulfill({
      json: { mfaRequired: true, userId: 'test-user', mfaChallengeToken: 'test-challenge' },
    }),
  );
  await page.route('**/api/v1/auth/mfa/verify', (route) => route.fulfill({ json: tokens }));
  await page.goto('/login');
  await page.getByLabel('Email or mobile', { exact: true }).fill('seller@example.test');
  await page.getByLabel('Password', { exact: true }).fill('dummy-password');
  await page.getByRole('button', { name: 'Sign in', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'One more security check.' })).toBeVisible();
  expect(await page.evaluate(() => sessionStorage.getItem('stockout.seller.session'))).toBeNull();
  await page.getByLabel('Verification code', { exact: true }).fill('123456');
  const pending = page.waitForRequest('**/api/v1/auth/mfa/verify');
  await page.getByRole('button', { name: 'Complete sign in' }).click();
  expect((await pending).postDataJSON()).toMatchObject({
    challengeToken: 'test-challenge',
    userId: 'test-user',
    code: '123456',
  });
  await expect(page.getByRole('heading', { name: 'Good to see you, Test.' })).toBeVisible();
});

test('new seller onboarding displays the real create form', async ({ page }) => {
  await setup(page);
  await page.route('**/api/v1/marketplace/actors/me', (route) =>
    route.fulfill({ json: { success: true, data: { sellerContexts: [], userId: 'test-user' } } }),
  );
  await page.goto('/business');
  await expect(page.getByRole('heading', { name: 'Create your seller profile' })).toBeVisible();
  await page.getByLabel('Display name', { exact: true }).fill('New business');
  await page.getByRole('button', { name: 'Create seller profile' }).click();
  await expect(page.getByRole('alert')).toContainText('Legal business name is required');
});

test('session refresh outage keeps the session and shows an error', async ({ page }) => {
  await setup(page);
  await page.route('**/api/v1/marketplace/actors/me', (route) =>
    route.fulfill({ status: 401, json: { detail: 'Expired token' } }),
  );
  await page.route('**/api/v1/auth/token/refresh', (route) =>
    route.fulfill({ status: 502, body: 'Bad Gateway' }),
  );
  await page.goto('/');
  await expect(page.getByRole('alert')).toContainText('Unable to refresh your session');
  expect(
    await page.evaluate(() => sessionStorage.getItem('stockout.seller.session')),
  ).not.toBeNull();
});

test('media upload completes storage before attaching with current row version', async ({
  page,
}) => {
  await setup(page);
  const fileId = '55555555-5555-5555-5555-555555555555';
  let completed = false;
  await page.route('**/api/v1/files/upload-requests', (route) =>
    route.fulfill({
      json: {
        data: {
          fileId,
          uploadUrl: 'https://storage.example.test/test-upload',
          httpMethod: 'PUT',
          requiredHeaders: { 'Content-Type': 'image/jpeg' },
        },
      },
    }),
  );
  await page.route('https://storage.example.test/**', async (route) => {
    expect(route.request().headers().authorization).toBeUndefined();
    expect(route.request().headers()['content-type']).toBe('image/jpeg');
    await route.fulfill({ status: 200, body: '' });
  });
  await page.route(`**/api/v1/files/${fileId}/complete`, async (route) => {
    completed = true;
    await route.fulfill({ json: { data: { fileId } } });
  });
  await page.route('**/media', async (route) => {
    if (route.request().method() !== 'POST') return route.fallback();
    expect(completed).toBe(true);
    expect(route.request().postDataJSON()).toMatchObject({
      fileAssetId: fileId,
      mediaType: 'IMAGE',
      isPrimary: true,
      expectedRowVersion: 'AQ==',
    });
    await route.fulfill({ json: { rowVersion: 'Ag==' } });
  });
  await page.goto(`/listings/${listingId}?tab=media`);
  await page.getByLabel('Add a material photo').setInputFiles({
    name: 'test.jpg',
    mimeType: 'image/jpeg',
    buffer: Buffer.from('local-ui-fixture'),
  });
  await expect(page.getByText('File uploaded and attached.')).toBeVisible();
});

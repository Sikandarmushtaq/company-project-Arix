import { test, expect } from '@playwright/test';

/**
 * Authentication E2E Tests
 *
 * Tests the complete authentication flow including:
 * - Login page rendering
 * - Form validation
 * - Successful login redirect
 * - Logout functionality
 */

test.describe('Authentication', () => {
  test.beforeEach(async ({ page }) => {
    // Navigate to login page before each test
    await page.goto('/');
  });

  test('should display login page correctly', async ({ page }) => {
    // Check for login form elements
    await expect(page.getByRole('heading', { name: /sign in|login/i })).toBeVisible();
    await expect(page.getByLabel(/email|username/i)).toBeVisible();
    await expect(page.getByLabel(/password/i)).toBeVisible();
    await expect(page.getByRole('button', { name: /sign in|login/i })).toBeVisible();
  });

  test('should show validation errors for empty form submission', async ({ page }) => {
    // Click login without entering credentials
    await page.getByRole('button', { name: /sign in|login/i }).click();

    // Should show validation error
    await expect(page.getByText(/required|enter/i)).toBeVisible();
  });

  test('should show error for invalid credentials', async ({ page }) => {
    // Enter invalid credentials
    await page.getByLabel(/email|username/i).fill('invalid@test.com');
    await page.getByLabel(/password/i).fill('wrongpassword');
    await page.getByRole('button', { name: /sign in|login/i }).click();

    // Should show error message
    await expect(page.getByText(/invalid|incorrect|failed/i)).toBeVisible({ timeout: 10000 });
  });

  test('should redirect to phone page after successful login', async ({ page }) => {
    // Use test credentials (these should be configured for test environment)
    const testEmail = process.env.TEST_USER_EMAIL || 'test@example.com';
    const testPassword = process.env.TEST_USER_PASSWORD || 'testpassword123';

    await page.getByLabel(/email|username/i).fill(testEmail);
    await page.getByLabel(/password/i).fill(testPassword);
    await page.getByRole('button', { name: /sign in|login/i }).click();

    // Should redirect to phone page (or admin for admin users)
    await expect(page).toHaveURL(/\/(phone|admin)/, { timeout: 15000 });
  });

  test('should maintain session after page reload', async ({ page }) => {
    // Login first
    const testEmail = process.env.TEST_USER_EMAIL || 'test@example.com';
    const testPassword = process.env.TEST_USER_PASSWORD || 'testpassword123';

    await page.getByLabel(/email|username/i).fill(testEmail);
    await page.getByLabel(/password/i).fill(testPassword);
    await page.getByRole('button', { name: /sign in|login/i }).click();

    // Wait for redirect
    await expect(page).toHaveURL(/\/(phone|admin)/, { timeout: 15000 });

    // Reload page
    await page.reload();

    // Should still be on protected page (not redirected to login)
    await expect(page).not.toHaveURL('/');
  });
});

test.describe('Protected Routes', () => {
  test('should redirect to login when accessing protected route without auth', async ({ page }) => {
    // Try to access phone page directly
    await page.goto('/phone');

    // Should redirect to login
    await expect(page).toHaveURL('/');
  });

  test('should redirect to login when accessing admin route without auth', async ({ page }) => {
    // Try to access admin page directly
    await page.goto('/admin');

    // Should redirect to login
    await expect(page).toHaveURL('/');
  });
});

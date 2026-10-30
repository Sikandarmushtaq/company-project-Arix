/**
 * EmbeddedSignupButton — order-independence + cancel/error contract.
 *
 * The `code` (FB.login callback) and `waba_id` (postMessage event) arrive on
 * independent channels in ANY order. These tests pin that the exchange fires
 * exactly once when BOTH are present — regardless of arrival order — and that
 * cancel / no-code paths surface an error without ever calling the API.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';

vi.mock('@/lib/api/services/whatsapp-org.api', () => ({
  getEmbeddedSignupConfig: vi.fn(),
  exchangeEmbeddedSignup: vi.fn(),
}));

import { EmbeddedSignupButton } from '@/components/whatsapp/EmbeddedSignupButton';
import {
  getEmbeddedSignupConfig,
  exchangeEmbeddedSignup,
} from '@/lib/api/services/whatsapp-org.api';

const getCfg = vi.mocked(getEmbeddedSignupConfig);
const exchange = vi.mocked(exchangeEmbeddedSignup);

const ENABLED_CFG = { appId: 'app123', configId: 'cfg456', graphVersion: 'v21.0', enabled: true };
const SAVED = {
  config: {} as never,
  verifyToken: 'vt',
  numbersSynced: 1,
  webhookCallbackUrl: 'https://x/webhook',
};

// Captured FB.login callback so a test can deliver the `code` on demand.
let loginCb: ((resp: { authResponse?: { code?: string } | null }) => void) | null = null;

function installFb() {
  loginCb = null;
  (window as unknown as { FB: unknown }).FB = {
    init: vi.fn(),
    login: vi.fn((cb: typeof loginCb) => {
      loginCb = cb;
    }),
  };
}

/** Simulate Meta's iframe posting the embedded-signup result to the opener. */
function postSignupEvent(event: string, data: Record<string, unknown> = {}) {
  window.dispatchEvent(
    new MessageEvent('message', {
      origin: 'https://www.facebook.com',
      data: JSON.stringify({ type: 'WA_EMBEDDED_SIGNUP', event, data }),
    })
  );
}
const postWaba = (wabaId: string) =>
  postSignupEvent('FINISH', { waba_id: wabaId, phone_number_id: 'pnid' });

describe('EmbeddedSignupButton', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    installFb();
    getCfg.mockResolvedValue(ENABLED_CFG);
    exchange.mockResolvedValue(SAVED);
  });

  afterEach(() => {
    delete (window as unknown as { FB?: unknown }).FB;
  });

  /** Render, wait for the button, click it, and wait for FB.login to register. */
  async function renderAndOpen() {
    const onConnected = vi.fn();
    render(<EmbeddedSignupButton onConnected={onConnected} />);
    const btn = await screen.findByRole('button', { name: /connect whatsapp/i });
    fireEvent.click(btn);
    await waitFor(() => expect(loginCb).not.toBeNull());
    return onConnected;
  }

  it('hides itself when Embedded Signup is not enabled on the server', async () => {
    getCfg.mockResolvedValue({
      appId: null,
      configId: null,
      graphVersion: 'v21.0',
      enabled: false,
    });
    const { container } = render(<EmbeddedSignupButton onConnected={vi.fn()} />);
    await waitFor(() => expect(getCfg).toHaveBeenCalled());
    expect(container.querySelector('button')).toBeNull();
  });

  it('completes when the message event arrives BEFORE the login code', async () => {
    const onConnected = await renderAndOpen();
    act(() => postWaba('WABA1'));
    act(() => loginCb!({ authResponse: { code: 'CODE1' } }));
    await waitFor(() => expect(exchange).toHaveBeenCalledTimes(1));
    expect(exchange).toHaveBeenCalledWith({ code: 'CODE1', wabaId: 'WABA1' });
    expect(onConnected).toHaveBeenCalledWith(SAVED);
  });

  it('completes when the login code arrives BEFORE the message event (the race fix)', async () => {
    const onConnected = await renderAndOpen();
    act(() => loginCb!({ authResponse: { code: 'CODE2' } }));
    act(() => postWaba('WABA2'));
    await waitFor(() => expect(exchange).toHaveBeenCalledTimes(1));
    expect(exchange).toHaveBeenCalledWith({ code: 'CODE2', wabaId: 'WABA2' });
    expect(onConnected).toHaveBeenCalledWith(SAVED);
  });

  it('fires the exchange only ONCE even when a duplicate event arrives', async () => {
    await renderAndOpen();
    act(() => postWaba('WABA3'));
    act(() => loginCb!({ authResponse: { code: 'CODE3' } }));
    await waitFor(() => expect(exchange).toHaveBeenCalledTimes(1));
    act(() => postWaba('WABA3')); // stray duplicate must NOT re-submit
    await Promise.resolve();
    expect(exchange).toHaveBeenCalledTimes(1);
  });

  it('shows an error and never calls the API when the user cancels', async () => {
    const onConnected = await renderAndOpen();
    act(() => postSignupEvent('CANCEL'));
    await screen.findByText(/cancelled/i);
    expect(exchange).not.toHaveBeenCalled();
    expect(onConnected).not.toHaveBeenCalled();
  });

  it('shows an error when login returns no code (popup closed early)', async () => {
    await renderAndOpen();
    act(() => loginCb!({ authResponse: null }));
    await screen.findByText(/cancelled before it finished/i);
    expect(exchange).not.toHaveBeenCalled();
  });
});

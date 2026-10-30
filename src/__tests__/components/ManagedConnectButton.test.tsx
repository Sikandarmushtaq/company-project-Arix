/**
 * ManagedConnectButton — popup + manual fallback + hide-when-unavailable.
 *
 * Pins: the component hides when managed connect isn't available; the manual
 * WABA-ID path posts the entered id; the popup path onboards by the `waba_id`
 * from the FINISH event (no OAuth code); and cancel surfaces an error without
 * ever calling the API.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';

vi.mock('@/lib/api/services/whatsapp-org.api', () => ({
  getManagedConnectConfig: vi.fn(),
  connectManagedWhatsApp: vi.fn(),
}));

import { ManagedConnectButton } from '@/components/whatsapp/ManagedConnectButton';
import {
  getManagedConnectConfig,
  connectManagedWhatsApp,
} from '@/lib/api/services/whatsapp-org.api';

const getCfg = vi.mocked(getManagedConnectConfig);
const connect = vi.mocked(connectManagedWhatsApp);

const POPUP_CFG = {
  enabled: true,
  appId: 'app1',
  configId: 'cfg1',
  solutionId: 'sol1',
  graphVersion: 'v21.0',
};
const MANUAL_CFG = {
  enabled: true,
  appId: null,
  configId: null,
  solutionId: null,
  graphVersion: 'v21.0',
};
const RESULT = {
  config: {} as never,
  numbersSynced: 2,
  paymentMethodAttached: true,
  webhookCallbackUrl: 'https://x/wh',
};

let loginCb: ((resp: { authResponse?: unknown }) => void) | null = null;
function installFb() {
  loginCb = null;
  (window as unknown as { FB: unknown }).FB = {
    init: vi.fn(),
    login: vi.fn((cb: typeof loginCb) => {
      loginCb = cb;
    }),
  };
}

function postSignup(event: string, data: Record<string, unknown> = {}) {
  window.dispatchEvent(
    new MessageEvent('message', {
      origin: 'https://www.facebook.com',
      data: JSON.stringify({ type: 'WA_EMBEDDED_SIGNUP', event, data }),
    })
  );
}

describe('ManagedConnectButton', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    connect.mockResolvedValue(RESULT);
  });
  afterEach(() => {
    delete (window as unknown as { FB?: unknown }).FB;
  });

  it('hides when managed connect is not enabled', async () => {
    getCfg.mockResolvedValue({ ...MANUAL_CFG, enabled: false });
    const { container } = render(<ManagedConnectButton onConnected={vi.fn()} />);
    await waitFor(() => expect(getCfg).toHaveBeenCalled());
    expect(container.querySelector('button')).toBeNull();
  });

  it('manual path posts the entered WABA ID', async () => {
    getCfg.mockResolvedValue(MANUAL_CFG);
    const onConnected = vi.fn();
    render(<ManagedConnectButton onConnected={onConnected} />);

    const input = await screen.findByPlaceholderText('1444659373798393');
    fireEvent.change(input, { target: { value: '998877' } });
    fireEvent.click(screen.getByRole('button', { name: /connect whatsapp/i }));

    await waitFor(() => expect(connect).toHaveBeenCalledWith({ wabaId: '998877' }));
    expect(onConnected).toHaveBeenCalledWith(RESULT);
    await screen.findByText(/whatsapp connected/i);
  });

  it('popup path onboards by the waba_id from the FINISH event', async () => {
    getCfg.mockResolvedValue(POPUP_CFG);
    installFb();
    render(<ManagedConnectButton onConnected={vi.fn()} />);

    const btn = await screen.findByRole('button', { name: /connect whatsapp/i });
    fireEvent.click(btn);
    await waitFor(() => expect(loginCb).not.toBeNull());

    act(() => postSignup('FINISH', { waba_id: 'WABA9', phone_number_id: 'pnid1' }));

    await waitFor(() => expect(connect).toHaveBeenCalledWith({ wabaId: 'WABA9' }));
  });

  it('shows an error and never calls the API when the popup is cancelled', async () => {
    getCfg.mockResolvedValue(POPUP_CFG);
    installFb();
    render(<ManagedConnectButton onConnected={vi.fn()} />);

    const btn = await screen.findByRole('button', { name: /connect whatsapp/i });
    fireEvent.click(btn);
    await waitFor(() => expect(loginCb).not.toBeNull());

    act(() => postSignup('CANCEL'));
    await screen.findByText(/cancelled/i);
    expect(connect).not.toHaveBeenCalled();
  });
});

/**
 * Test Setup
 * Location: frontend/src/__tests__/setup.ts
 *
 * Global test setup with mocks for Socket.IO, Zustand, and React Query.
 */

import { vi, beforeEach, afterEach } from 'vitest';
import '@testing-library/jest-dom/vitest';

// Mock Socket.IO client
vi.mock('socket.io-client', () => {
  const mockSocket = {
    id: 'test-socket-id',
    connected: false,
    active: true,
    on: vi.fn(),
    off: vi.fn(),
    emit: vi.fn(),
    connect: vi.fn(),
    disconnect: vi.fn(),
  };

  return {
    io: vi.fn(() => mockSocket),
    Socket: vi.fn(),
  };
});

// Mock Zustand auth store
vi.mock('@/lib/stores', () => ({
  useAuthStore: vi.fn(() => ({
    token: 'test-token',
    isAuthenticated: true,
    user: {
      id: 1,
      phone: '+15551234567',
      role: 'user',
    },
    login: vi.fn(),
    logout: vi.fn(),
    setToken: vi.fn(),
  })),
}));

// Mock next/navigation
vi.mock('next/navigation', () => ({
  useRouter: () => ({
    push: vi.fn(),
    replace: vi.fn(),
    prefetch: vi.fn(),
    back: vi.fn(),
  }),
  usePathname: () => '/phone',
  useSearchParams: () => new URLSearchParams(),
}));

// Mock localStorage
const localStorageMock = {
  getItem: vi.fn(),
  setItem: vi.fn(),
  removeItem: vi.fn(),
  clear: vi.fn(),
};
Object.defineProperty(window, 'localStorage', { value: localStorageMock });

// Mock window.matchMedia
Object.defineProperty(window, 'matchMedia', {
  writable: true,
  value: vi.fn().mockImplementation((query) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: vi.fn(),
    removeListener: vi.fn(),
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    dispatchEvent: vi.fn(),
  })),
});

// Mock ResizeObserver as a proper class
class MockResizeObserver {
  observe = vi.fn();
  unobserve = vi.fn();
  disconnect = vi.fn();
}
global.ResizeObserver = MockResizeObserver as unknown as typeof ResizeObserver;

// Mock Web Audio API - required for call-audio-service.ts
class MockAudioBuffer {
  sampleRate = 44100;
  length = 44100;
  numberOfChannels = 1;
  duration = 1;
  getChannelData = vi.fn(() => new Float32Array(44100));
  copyFromChannel = vi.fn();
  copyToChannel = vi.fn();
}

class MockAudioNode {
  connect = vi.fn(() => this);
  disconnect = vi.fn();
  context = {} as AudioContext;
  channelCount = 2;
  channelCountMode = 'max' as ChannelCountMode;
  channelInterpretation = 'speakers' as ChannelInterpretation;
  numberOfInputs = 1;
  numberOfOutputs = 1;
  addEventListener = vi.fn();
  removeEventListener = vi.fn();
  dispatchEvent = vi.fn(() => true);
}

class MockOscillatorNode extends MockAudioNode {
  type: OscillatorType = 'sine';
  frequency = { value: 440, setValueAtTime: vi.fn() };
  detune = { value: 0 };
  start = vi.fn();
  stop = vi.fn();
  setPeriodicWave = vi.fn();
  onended = null;
}

class MockGainNode extends MockAudioNode {
  gain = { value: 1, setValueAtTime: vi.fn() };
}

class MockAudioContext {
  state: AudioContextState = 'running';
  sampleRate = 44100;
  destination = new MockAudioNode();
  currentTime = 0;
  baseLatency = 0;
  outputLatency = 0;
  listener = {};
  audioWorklet = { addModule: vi.fn() };

  createOscillator = vi.fn(() => new MockOscillatorNode());
  createGain = vi.fn(() => new MockGainNode());
  createBuffer = vi.fn(() => new MockAudioBuffer());
  createBufferSource = vi.fn(() => ({
    ...new MockAudioNode(),
    buffer: null,
    start: vi.fn(),
    stop: vi.fn(),
    loop: false,
    loopStart: 0,
    loopEnd: 0,
    playbackRate: { value: 1 },
    onended: null,
  }));
  decodeAudioData = vi.fn(() => Promise.resolve(new MockAudioBuffer()));
  resume = vi.fn(() => Promise.resolve());
  suspend = vi.fn(() => Promise.resolve());
  close = vi.fn(() => Promise.resolve());
  createAnalyser = vi.fn();
  createBiquadFilter = vi.fn();
  createChannelMerger = vi.fn();
  createChannelSplitter = vi.fn();
  createConstantSource = vi.fn();
  createConvolver = vi.fn();
  createDelay = vi.fn();
  createDynamicsCompressor = vi.fn();
  createIIRFilter = vi.fn();
  createMediaElementSource = vi.fn();
  createMediaStreamDestination = vi.fn();
  createMediaStreamSource = vi.fn();
  createPanner = vi.fn();
  createPeriodicWave = vi.fn();
  createScriptProcessor = vi.fn();
  createStereoPanner = vi.fn();
  createWaveShaper = vi.fn();
  getOutputTimestamp = vi.fn(() => ({ contextTime: 0, performanceTime: 0 }));
  addEventListener = vi.fn();
  removeEventListener = vi.fn();
  dispatchEvent = vi.fn(() => true);
}

class MockOfflineAudioContext extends MockAudioContext {
  length = 44100;
  oncomplete = null;
  startRendering = vi.fn(() => Promise.resolve(new MockAudioBuffer()));
}

// Apply Web Audio API mocks globally
global.AudioContext = MockAudioContext as unknown as typeof AudioContext;
global.OfflineAudioContext = MockOfflineAudioContext as unknown as typeof OfflineAudioContext;
global.AudioBuffer = MockAudioBuffer as unknown as typeof AudioBuffer;

// Mock HTMLMediaElement play/pause for Audio elements
Object.defineProperty(HTMLMediaElement.prototype, 'play', {
  configurable: true,
  writable: true,
  value: vi.fn(() => Promise.resolve()),
});

Object.defineProperty(HTMLMediaElement.prototype, 'pause', {
  configurable: true,
  writable: true,
  value: vi.fn(),
});

Object.defineProperty(HTMLMediaElement.prototype, 'load', {
  configurable: true,
  writable: true,
  value: vi.fn(),
});

// Mock IntersectionObserver as a proper class
class MockIntersectionObserver {
  root = null;
  rootMargin = '';
  thresholds: number[] = [];
  observe = vi.fn();
  unobserve = vi.fn();
  disconnect = vi.fn();
  takeRecords = vi.fn(() => []);
}
global.IntersectionObserver = MockIntersectionObserver as unknown as typeof IntersectionObserver;

// Mock console methods to reduce noise in tests
const originalConsoleLog = console.log;
const originalConsoleError = console.error;
const originalConsoleWarn = console.warn;

beforeEach(() => {
  // Suppress console output during tests unless debugging
  if (!process.env.DEBUG_TESTS) {
    console.log = vi.fn();
    console.error = vi.fn();
    console.warn = vi.fn();
  }
});

afterEach(() => {
  // Restore console
  console.log = originalConsoleLog;
  console.error = originalConsoleError;
  console.warn = originalConsoleWarn;

  // Clear all mocks
  vi.clearAllMocks();
});

// Export mock helpers for tests
export const createMockSocket = () => ({
  id: 'test-socket-id',
  connected: false,
  active: true,
  on: vi.fn(),
  off: vi.fn(),
  emit: vi.fn(),
  connect: vi.fn(),
  disconnect: vi.fn(),
});

export const createMockQueryClient = () => ({
  invalidateQueries: vi.fn(),
  setQueryData: vi.fn(),
  getQueryData: vi.fn(),
  cancelQueries: vi.fn(),
  setQueriesData: vi.fn(),
  getQueriesData: vi.fn(),
});

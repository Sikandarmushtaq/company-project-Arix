/**
 * Debug Logger - Sends browser console and network logs to server
 */

const DEBUG_ENDPOINT = '/api/debug-log';

type LogLevel = 'log' | 'warn' | 'error' | 'info' | 'network';

interface LogEntry {
  level: LogLevel;
  message: string;
  data?: unknown;
  timestamp: string;
  url?: string;
  status?: number;
}

class DebugLogger {
  private enabled = true;
  private buffer: LogEntry[] = [];
  private flushInterval: NodeJS.Timeout | null = null;

  init() {
    if (typeof window === 'undefined') return;

    // Intercept console methods
    this.interceptConsole();

    // Intercept fetch for network logging
    this.interceptFetch();

    // Intercept XMLHttpRequest
    this.interceptXHR();

    // Catch unhandled errors
    window.addEventListener('error', (event) => {
      this.log('error', `Uncaught Error: ${event.message}`, {
        filename: event.filename,
        lineno: event.lineno,
        colno: event.colno,
      });
    });

    // Catch unhandled promise rejections
    window.addEventListener('unhandledrejection', (event) => {
      this.log('error', `Unhandled Promise Rejection: ${event.reason}`, {
        reason: String(event.reason),
      });
    });

    // Flush logs periodically
    this.flushInterval = setInterval(() => this.flush(), 1000);

    console.log('[DebugLogger] Initialized - logs will be sent to server');
  }

  private interceptConsole() {
    const originalConsole = {
      log: console.log.bind(console),
      warn: console.warn.bind(console),
      error: console.error.bind(console),
      info: console.info.bind(console),
    };

    console.log = (...args) => {
      originalConsole.log(...args);
      this.log('log', args.map((a) => this.stringify(a)).join(' '));
    };

    console.warn = (...args) => {
      originalConsole.warn(...args);
      this.log('warn', args.map((a) => this.stringify(a)).join(' '));
    };

    console.error = (...args) => {
      originalConsole.error(...args);
      this.log('error', args.map((a) => this.stringify(a)).join(' '));
    };

    console.info = (...args) => {
      originalConsole.info(...args);
      this.log('info', args.map((a) => this.stringify(a)).join(' '));
    };
  }

  private interceptFetch() {
    const originalFetch = window.fetch.bind(window);

    window.fetch = async (input, init) => {
      const url = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url;
      const method = init?.method || 'GET';

      // Don't log our own debug endpoint
      if (url.includes('debug-log')) {
        return originalFetch(input, init);
      }

      const startTime = Date.now();

      try {
        const response = await originalFetch(input, init);
        const duration = Date.now() - startTime;

        this.log('network', `${method} ${url} - ${response.status} (${duration}ms)`, {
          status: response.status,
          statusText: response.statusText,
        });

        // Log error responses
        if (!response.ok) {
          try {
            const clonedResponse = response.clone();
            const text = await clonedResponse.text();
            this.log('error', `Network Error Response: ${method} ${url}`, {
              status: response.status,
              body: text.substring(0, 500),
            });
          } catch (e) {
            // Ignore clone errors
          }
        }

        return response;
      } catch (error) {
        const duration = Date.now() - startTime;
        this.log('error', `${method} ${url} - FAILED (${duration}ms): ${error}`, {
          error: String(error),
        });
        throw error;
      }
    };
  }

  private interceptXHR() {
    const originalOpen = XMLHttpRequest.prototype.open;
    const originalSend = XMLHttpRequest.prototype.send;
    const self = this;

    XMLHttpRequest.prototype.open = function (
      method: string,
      url: string | URL,
      ...args: unknown[]
    ) {
      (this as XMLHttpRequest & { _debugUrl: string; _debugMethod: string })._debugUrl =
        String(url);
      (this as XMLHttpRequest & { _debugMethod: string })._debugMethod = method;
      return originalOpen.apply(this, [method, url, ...args] as Parameters<typeof originalOpen>);
    };

    XMLHttpRequest.prototype.send = function (body?: Document | XMLHttpRequestBodyInit | null) {
      const xhr = this as XMLHttpRequest & { _debugUrl: string; _debugMethod: string };
      const startTime = Date.now();

      this.addEventListener('load', function () {
        if (xhr._debugUrl?.includes('debug-log')) return;

        const duration = Date.now() - startTime;
        self.log(
          'network',
          `XHR ${xhr._debugMethod} ${xhr._debugUrl} - ${this.status} (${duration}ms)`
        );
      });

      this.addEventListener('error', function () {
        if (xhr._debugUrl?.includes('debug-log')) return;

        const duration = Date.now() - startTime;
        self.log('error', `XHR ${xhr._debugMethod} ${xhr._debugUrl} - FAILED (${duration}ms)`);
      });

      return originalSend.apply(this, [body]);
    };
  }

  private stringify(value: unknown): string {
    if (typeof value === 'string') return value;
    if (value instanceof Error) return `${value.name}: ${value.message}\n${value.stack}`;
    try {
      return JSON.stringify(value, null, 2);
    } catch {
      return String(value);
    }
  }

  private log(level: LogLevel, message: string, data?: unknown) {
    if (!this.enabled) return;

    this.buffer.push({
      level,
      message,
      data,
      timestamp: new Date().toISOString(),
    });

    // Flush immediately for errors
    if (level === 'error') {
      this.flush();
    }
  }

  private async flush() {
    if (this.buffer.length === 0) return;

    const logs = [...this.buffer];
    this.buffer = [];

    try {
      await fetch(DEBUG_ENDPOINT, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ logs }),
      });
    } catch {
      // Silently fail - don't cause more errors
    }
  }
}

export const debugLogger = new DebugLogger();

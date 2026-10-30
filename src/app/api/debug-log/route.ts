import { NextRequest, NextResponse } from 'next/server';

/**
 * Debug log endpoint - ONLY available in development mode
 * This endpoint is disabled in production for security.
 */

interface LogEntry {
  level: 'log' | 'warn' | 'error' | 'info' | 'network';
  message: string;
  data?: unknown;
  timestamp: string;
}

const COLORS = {
  log: '\x1b[37m', // White
  info: '\x1b[36m', // Cyan
  warn: '\x1b[33m', // Yellow
  error: '\x1b[31m', // Red
  network: '\x1b[35m', // Magenta
  reset: '\x1b[0m',
};

const isDevelopment = process.env.NODE_ENV === 'development';

// Store recent logs in memory for retrieval
const MAX_STORED_LOGS = 500;
const storedLogs: LogEntry[] = [];

/**
 * GET - Retrieve stored debug logs
 */
export async function GET() {
  if (!isDevelopment) {
    return NextResponse.json({ error: 'Debug logging is disabled in production' }, { status: 403 });
  }

  return NextResponse.json({ logs: storedLogs, count: storedLogs.length });
}

export async function POST(request: NextRequest) {
  // SECURITY: Only allow in development mode
  if (!isDevelopment) {
    return NextResponse.json({ error: 'Debug logging is disabled in production' }, { status: 403 });
  }

  try {
    const { logs } = (await request.json()) as { logs: LogEntry[] };

    for (const log of logs) {
      // Store log in memory
      storedLogs.push(log);
      if (storedLogs.length > MAX_STORED_LOGS) {
        storedLogs.shift(); // Remove oldest
      }

      const color = COLORS[log.level] || COLORS.log;
      const prefix = `[BROWSER ${log.level.toUpperCase()}]`;
      const time = new Date(log.timestamp).toLocaleTimeString();

      console.log(`${color}${prefix}${COLORS.reset} [${time}] ${log.message}`);

      if (log.data && Object.keys(log.data as object).length > 0) {
        // Filter sensitive data from logs
        const sanitizedData = { ...(log.data as object) };
        const sensitiveKeys = ['password', 'token', 'secret', 'authorization', 'cookie', 'apiKey'];
        for (const key of Object.keys(sanitizedData)) {
          if (sensitiveKeys.some((sk) => key.toLowerCase().includes(sk))) {
            (sanitizedData as Record<string, unknown>)[key] = '[REDACTED]';
          }
        }
        console.log(`${color}  └─ Data:${COLORS.reset}`, JSON.stringify(sanitizedData, null, 2));
      }
    }

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error('[DEBUG-LOG] Error processing logs:', error);
    return NextResponse.json({ error: 'Failed to process logs' }, { status: 500 });
  }
}

/**
 * SIP Failover Manager
 *
 * Handles server failover and health monitoring.
 * Automatically switches to backup server on failures
 * and returns to primary when healthy.
 *
 * @module lib/sip/managers/SipFailoverManager
 */

import type { ServerInfo, SipCredentials } from '../types';
import type { SipManagerContext } from './types';
import { sipLogger as logger } from '../logger';

export class SipFailoverManager {
  private ctx: SipManagerContext;

  private primaryServerUri: string | null = null;
  private currentServerUri: string | null = null;
  private backupServerUri: string | null = null;
  private connectionFailures = 0;
  private _currentServer: ServerInfo | null = null;
  private primaryRetryTimer: ReturnType<typeof setTimeout> | null = null;
  private healthCheckTimer: ReturnType<typeof setTimeout> | null = null;

  constructor(ctx: SipManagerContext) {
    this.ctx = ctx;
  }

  get currentServer(): ServerInfo | null {
    return this._currentServer;
  }

  /**
   * Initialize with primary server
   */
  initialize(serverUri: string, backupUri?: string | null): void {
    this.primaryServerUri = serverUri;
    this.currentServerUri = serverUri;

    this._currentServer = {
      uri: serverUri,
      isPrimary: true,
      isHealthy: true,
      failureCount: 0,
    };

    if (backupUri) {
      this.backupServerUri = backupUri;
      logger.info('Failover configured', { primary: serverUri, backup: backupUri });
    }
  }

  /**
   * Set backup server for failover
   */
  setBackupServer(uri: string): void {
    this.backupServerUri = uri;
    logger.info(`Backup server set to: ${uri}`);
  }

  /**
   * Handle connection failure for failover logic
   */
  handleConnectionFailure(): void {
    const config = this.ctx.getConfig();
    if (!config.failover.enabled) return;

    // Single-node deployment (no DISTINCT backup): failover is a pointless
    // no-op — it would only log "Already on backup server, cannot failover"
    // and churn on every transient WSS blip. The ConnectionManager's own
    // reconnect loop already handles recovery, so skip the failover machinery.
    if (!this.hasDistinctBackup()) return;

    this.connectionFailures++;
    logger.warn(`Connection failure count: ${this.connectionFailures}`);

    if (this.connectionFailures >= config.failover.failoverThreshold) {
      this.attemptFailover();
    }
  }

  /**
   * True only when a backup server exists that is genuinely different from the
   * primary and the one we're currently on. When primary === backup (single
   * Kamailio node) there is nothing to fail over to.
   */
  private hasDistinctBackup(): boolean {
    return (
      !!this.backupServerUri &&
      this.backupServerUri !== this.primaryServerUri &&
      this.backupServerUri !== this.currentServerUri
    );
  }

  /**
   * Reset connection failures on successful connection
   */
  resetConnectionFailures(): void {
    this.connectionFailures = 0;
    if (this._currentServer) {
      this._currentServer.failureCount = 0;
      this._currentServer.isHealthy = true;
      this._currentServer.lastConnected = new Date();
      this.ctx.emit({ type: 'serverHealthChanged', server: this._currentServer });
    }
  }

  /**
   * Attempt failover to backup server
   */
  private attemptFailover(): void {
    const backupServer = this.backupServerUri;
    const credentials = this.ctx.getCredentials();

    if (!backupServer || !credentials) {
      logger.warn('No backup server configured, cannot failover');
      return;
    }

    if (this.currentServerUri === backupServer) {
      logger.warn('Already on backup server, cannot failover');
      return;
    }

    const fromServer = this.currentServerUri || this.primaryServerUri || 'unknown';

    logger.info(`Failing over from ${fromServer} to ${backupServer}`);

    this.currentServerUri = backupServer;
    this._currentServer = {
      uri: backupServer,
      isPrimary: false,
      isHealthy: true,
      failureCount: 0,
    };

    this.ctx.emit({
      type: 'serverFailover',
      fromServer,
      toServer: backupServer,
      reason: `${this.connectionFailures} consecutive connection failures`,
    });

    this.connectionFailures = 0;

    const backupCredentials: SipCredentials = {
      ...credentials,
      webSocketUri: backupServer,
    };

    this.performFailover(backupCredentials);
    this.schedulePrimaryRetry();
  }

  /**
   * Perform failover to backup server
   */
  private async performFailover(backupCredentials: SipCredentials): Promise<void> {
    try {
      const connMgr = this.ctx.getConnectionManager();
      await connMgr.disconnect();
      await connMgr.connect(backupCredentials);
    } catch (err) {
      logger.error('Failed to connect to backup server:', err);
    }
  }

  /**
   * Schedule retry to primary server
   */
  private schedulePrimaryRetry(): void {
    if (this.primaryRetryTimer) {
      clearTimeout(this.primaryRetryTimer);
    }

    const config = this.ctx.getConfig();
    this.primaryRetryTimer = setTimeout(() => {
      this.attemptPrimaryReconnect();
    }, config.failover.primaryRetryDelay);
  }

  /**
   * Attempt to reconnect to primary server
   */
  private attemptPrimaryReconnect(): void {
    const credentials = this.ctx.getCredentials();
    if (!this.primaryServerUri || !credentials) return;
    if (this.currentServerUri === this.primaryServerUri) return;

    logger.info('Attempting to reconnect to primary server');

    const primaryCredentials: SipCredentials = {
      ...credentials,
      webSocketUri: this.primaryServerUri,
    };

    this.performPrimaryReconnect(primaryCredentials);
  }

  /**
   * Perform primary reconnect with health check
   */
  private async performPrimaryReconnect(primaryCredentials: SipCredentials): Promise<void> {
    try {
      const isHealthy = await this.testServerHealth(this.primaryServerUri!);

      if (isHealthy) {
        logger.info('Primary server is healthy, switching back');

        const fromServer = this.currentServerUri || 'unknown';

        this.currentServerUri = this.primaryServerUri;
        this._currentServer = {
          uri: this.primaryServerUri!,
          isPrimary: true,
          isHealthy: true,
          failureCount: 0,
          lastConnected: new Date(),
        };

        this.ctx.emit({
          type: 'serverFailover',
          fromServer,
          toServer: this.primaryServerUri!,
          reason: 'Primary server recovered',
        });

        try {
          const connMgr = this.ctx.getConnectionManager();
          await connMgr.disconnect();
          await connMgr.connect(primaryCredentials);
        } catch (err) {
          logger.error('Failed to reconnect to primary:', err);
          this.schedulePrimaryRetry();
        }
      } else {
        logger.info('Primary server still unhealthy, will retry later');
        this.schedulePrimaryRetry();
      }
    } catch (err) {
      logger.error('Error during primary reconnect:', err);
      this.schedulePrimaryRetry();
    }
  }

  /**
   * Test server health by attempting WebSocket connection
   */
  private async testServerHealth(uri: string): Promise<boolean> {
    return new Promise((resolve) => {
      let ws: WebSocket | null = null;
      let resolved = false;

      const cleanup = (result: boolean) => {
        if (resolved) return;
        resolved = true;
        clearTimeout(timeout);
        if (ws) {
          try {
            ws.close();
          } catch {
            // Ignore close errors
          }
          ws = null;
        }
        resolve(result);
      };

      const timeout = setTimeout(() => cleanup(false), 5000);

      try {
        ws = new WebSocket(uri);
        ws.onopen = () => cleanup(true);
        ws.onerror = () => cleanup(false);
        ws.onclose = () => {
          if (!resolved) cleanup(false);
        };
      } catch {
        cleanup(false);
      }
    });
  }

  /**
   * Clear all failover timers
   */
  clearTimers(): void {
    if (this.primaryRetryTimer) {
      clearTimeout(this.primaryRetryTimer);
      this.primaryRetryTimer = null;
    }
    if (this.healthCheckTimer) {
      clearTimeout(this.healthCheckTimer);
      this.healthCheckTimer = null;
    }
  }

  /**
   * Full cleanup
   */
  destroy(): void {
    this.clearTimers();
  }
}

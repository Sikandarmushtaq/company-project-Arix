/**
 * HA Monitoring Service
 *
 * API client for HA monitoring and failover endpoints.
 */

import { apiClient } from '../client';
import type { ApiResponse } from '@/lib/types';

/**
 * Server health status
 */
export type ServerStatus = 'healthy' | 'degraded' | 'down' | 'unknown';

/**
 * Keepalived VRRP role
 */
export type KeepalivedRole = 'MASTER' | 'BACKUP' | 'FAULT' | 'UNKNOWN';

/**
 * Patroni database role
 */
export type PatroniRole = 'leader' | 'replica' | 'unknown';

/**
 * Base server health info
 */
export interface ServerHealth {
  id: string;
  name: string;
  role: string;
  ip: string;
  privateIp?: string;
  status: ServerStatus;
  lastChecked: string;
  latency: number;
  error?: string;
  cpu?: number;
  memory?: number;
  uptime?: number;
}

/**
 * Kamailio server health
 */
export interface KamailioHealth extends ServerHealth {
  type: 'kamailio';
  keepalivedRole: KeepalivedRole;
  sipPort5060: boolean;
  sipTls5061: boolean;
  wssPort7443: boolean;
  wsPort5066: boolean;
  dispatcherEntries: number;
  rtpengineStatus: ServerStatus;
  redisStatus: ServerStatus;
  redisRole?: string;
  failoverMode: 'auto-do-api' | 'manual' | 'unknown';
}

/**
 * FusionPBX/FreeSWITCH server health
 */
export interface FusionPBXHealth extends ServerHealth {
  type: 'fusionpbx';
  freeswitchStatus: ServerStatus;
  internalProfile5060: boolean;
  externalProfile5080: boolean;
  activeCalls: number;
  registrations: number;
  haproxyStatus: ServerStatus;
  recordingApiStatus: ServerStatus;
}

/**
 * PostgreSQL server health
 */
export interface PostgreSQLHealth extends ServerHealth {
  type: 'postgresql';
  patroniRole: PatroniRole;
  replicationLag?: number;
  connectionCount: number;
  maxConnections: number;
  databaseSize?: string;
  inSync: boolean;
}

/**
 * Monitor server health
 */
export interface MonitorHealth extends ServerHealth {
  type: 'monitor';
  nfsStatus: ServerStatus;
  watcherStatus: ServerStatus;
  prometheusStatus: ServerStatus;
  grafanaStatus: ServerStatus;
  etcdStatus: ServerStatus;
  redisUsrlocStatus: ServerStatus;
  sentinelStatus: ServerStatus;
}

/**
 * Backup Monitor server health (bkpserver)
 */
export interface BkpserverHealth extends ServerHealth {
  type: 'bkpserver';
  redisReplicaStatus: ServerStatus;
  redisRole?: string;
  sentinelStatus: ServerStatus;
}

/**
 * API Gateway server health
 */
export interface ApiGatewayHealth extends ServerHealth {
  type: 'apigateway';
  nginxStatus: ServerStatus;
  apiStatus: ServerStatus;
  mysqlStatus: ServerStatus;
  redisStatus: ServerStatus;
}

/**
 * Floating IP status
 */
export interface FloatingIPStatus {
  ip: string;
  assignedTo: 'primary' | 'secondary' | 'unknown';
  assignedToDropletId?: number;
  assignedToDropletName?: string;
  lastMoved?: string;
}

/**
 * HA Cluster state - full system status
 */
export interface HAClusterState {
  timestamp: string;
  overallStatus: ServerStatus;
  floatingIP: FloatingIPStatus;
  kamailio: {
    primary: KamailioHealth;
    secondary: KamailioHealth;
  };
  fusionpbx: {
    primary: FusionPBXHealth;
    secondary: FusionPBXHealth;
  };
  postgresql: {
    primary: PostgreSQLHealth;
    secondary: PostgreSQLHealth;
  };
  monitor: MonitorHealth;
  bkpserver: BkpserverHealth;
  apigateway: ApiGatewayHealth;
  activeConnections: {
    webrtc: number;
    sip: number;
    api: number;
  };
}

/**
 * Failover event log entry
 */
export interface HAFailoverEvent {
  id: string;
  timestamp: string;
  component: 'kamailio' | 'fusionpbx' | 'postgresql';
  fromServer: 'primary' | 'secondary';
  toServer: 'primary' | 'secondary';
  reason: 'automatic' | 'manual';
  triggeredBy?: string;
  duration: number;
  success: boolean;
  error?: string;
}

/**
 * Server connection test result
 */
export interface ConnectionTestResult {
  from: string;
  to: string;
  success: boolean;
  latency: number;
  port: number;
  protocol: 'tcp' | 'udp';
  error?: string;
}

/**
 * HA configuration for server inventory
 */
export interface HAServerConfig {
  kamailio: {
    primary: { name: string; publicIp: string; privateIp: string; dropletId: number };
    secondary: { name: string; publicIp: string; privateIp: string; dropletId: number };
  };
  fusionpbx: {
    primary: { name: string; publicIp: string; privateIp: string };
    secondary: { name: string; publicIp: string; privateIp: string };
  };
  postgresql: {
    primary: { name: string; privateIp: string };
    secondary: { name: string; privateIp: string };
  };
  monitor: { name: string; publicIp: string; privateIp: string };
  bkpserver: { name: string; publicIp: string; privateIp: string };
  apigateway: { name: string; publicIp: string };
  floatingIp: string;
}

/**
 * Failover code response
 */
export interface FailoverCodeResponse {
  code: string;
  expiresIn: number;
  component: string;
}

/**
 * HA Monitoring Service
 */
class HAService {
  private basePath = '/admin/ha';

  /**
   * Get full cluster status
   */
  async getStatus(): Promise<HAClusterState> {
    const response = await apiClient.get<ApiResponse<HAClusterState>>(`${this.basePath}/status`);
    return response.data;
  }

  /**
   * Get server configuration/inventory
   */
  async getConfig(): Promise<HAServerConfig> {
    const response = await apiClient.get<ApiResponse<HAServerConfig>>(`${this.basePath}/config`);
    return response.data;
  }

  /**
   * Get failover event history
   */
  async getEvents(limit: number = 50): Promise<HAFailoverEvent[]> {
    const response = await apiClient.get<ApiResponse<HAFailoverEvent[]>>(
      `${this.basePath}/events`,
      {
        params: { limit },
      }
    );
    return response.data;
  }

  /**
   * Get individual server health
   */
  async getServerHealth(serverId: string): Promise<ServerHealth> {
    const response = await apiClient.get<ApiResponse<ServerHealth>>(
      `${this.basePath}/server/${serverId}`
    );
    return response.data;
  }

  /**
   * Generate failover confirmation code
   */
  async generateFailoverCode(component: 'kamailio' | 'postgresql'): Promise<FailoverCodeResponse> {
    const response = await apiClient.post<ApiResponse<FailoverCodeResponse>>(
      `${this.basePath}/failover/code`,
      { component }
    );
    return response.data;
  }

  /**
   * Initiate Kamailio failover
   */
  async initiateKamailioFailover(
    target: 'primary' | 'secondary',
    confirmationCode: string,
    reason?: string
  ): Promise<{ message: string; target: string }> {
    // Only include reason if it has content (filter empty strings)
    const payload: Record<string, string> = { target, confirmationCode };
    if (reason && reason.trim().length >= 5) {
      payload.reason = reason.trim();
    }

    const response = await apiClient.post<ApiResponse<{ message: string; target: string }>>(
      `${this.basePath}/failover/kamailio`,
      payload
    );
    return response.data;
  }

  /**
   * Initiate PostgreSQL failover
   */
  async initiatePostgresFailover(
    target: 'primary' | 'secondary',
    confirmationCode: string,
    reason?: string
  ): Promise<{ message: string; target: string }> {
    // Only include reason if it has content (filter empty strings)
    const payload: Record<string, string> = { target, confirmationCode };
    if (reason && reason.trim().length >= 5) {
      payload.reason = reason.trim();
    }

    const response = await apiClient.post<ApiResponse<{ message: string; target: string }>>(
      `${this.basePath}/failover/postgresql`,
      payload
    );
    return response.data;
  }

  /**
   * Test connectivity between servers
   */
  async testConnectivity(): Promise<ConnectionTestResult[]> {
    const response = await apiClient.post<ApiResponse<ConnectionTestResult[]>>(
      `${this.basePath}/test-connectivity`
    );
    return response.data;
  }

  /**
   * Execute a whitelisted server action
   */
  async executeServerAction(
    serverId: string,
    actionId: string
  ): Promise<{ output: string; actionSuccess: boolean }> {
    const response = await apiClient.post<ApiResponse<{ output: string; actionSuccess: boolean }>>(
      `${this.basePath}/server/${serverId}/action`,
      { actionId }
    );
    return response.data;
  }

  /**
   * Get service logs from a server
   */
  async getServiceLogs(
    serverId: string,
    service: string,
    lines: number = 50
  ): Promise<{ output: string }> {
    const response = await apiClient.get<ApiResponse<{ output: string }>>(
      `${this.basePath}/server/${serverId}/logs`,
      { params: { service, lines } }
    );
    return response.data;
  }
}

export const haService = new HAService();

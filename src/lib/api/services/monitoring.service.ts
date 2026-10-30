/**
 * Monitoring Service
 *
 * API client for system monitoring endpoints.
 */

import { apiClient } from '../client';
import type { ApiResponse } from '@/lib/types';

/**
 * System metrics interfaces
 */
export interface SystemMetrics {
  timestamp: string;
  uptime: number;
  cpu: CpuMetrics;
  memory: MemoryMetrics;
  disk: DiskMetrics;
  database: DatabaseMetrics;
  redis: RedisMetrics;
  websocket: WebSocketMetrics;
  api: ApiMetrics;
  process: ProcessMetrics;
}

export interface CpuMetrics {
  cores: number;
  model: string;
  usage: number;
  loadAverage: number[];
}

export interface MemoryMetrics {
  total: number;
  used: number;
  free: number;
  usagePercent: number;
}

export interface DiskMetrics {
  total: number;
  used: number;
  free: number;
  usagePercent: number;
}

export interface DatabaseMetrics {
  status: 'healthy' | 'degraded' | 'down';
  connectionPool: {
    active: number;
    idle: number;
    total: number;
  };
  latency: number;
  queriesPerSecond: number;
}

export interface RedisMetrics {
  status: 'healthy' | 'degraded' | 'down';
  connected: boolean;
  latency: number;
  usedMemory: string;
  connectedClients: number;
  keyCount: number;
}

export interface WebSocketMetrics {
  totalConnections: number;
  adminConnections: number;
  userConnections: number;
  roomCount: number;
}

export interface ApiMetrics {
  requestsPerMinute: number;
  averageResponseTime: number;
  errorRate: number;
  activeRequests: number;
  endpointStats: EndpointStats[];
}

export interface EndpointStats {
  endpoint: string;
  method: string;
  requests: number;
  avgResponseTime: number;
  errorCount: number;
}

export interface ProcessMetrics {
  pid: number;
  uptime: number;
  memoryUsage: {
    rss: number;
    heapTotal: number;
    heapUsed: number;
    external: number;
  };
  cpuUsage: {
    user: number;
    system: number;
  };
}

export interface HealthSummary {
  status: 'healthy' | 'degraded' | 'critical';
  checks: HealthCheck[];
}

export interface HealthCheck {
  name: string;
  status: 'healthy' | 'degraded' | 'critical';
  message: string;
}

/**
 * Monitoring Service
 */
class MonitoringService {
  private basePath = '/admin/monitoring';

  /**
   * Get current system metrics
   */
  async getMetrics(): Promise<SystemMetrics> {
    const response = await apiClient.get<ApiResponse<SystemMetrics>>(`${this.basePath}/metrics`);
    return response.data;
  }

  /**
   * Get metrics history
   */
  async getHistory(minutes: number = 60): Promise<SystemMetrics[]> {
    const response = await apiClient.get<ApiResponse<SystemMetrics[]>>(`${this.basePath}/history`, {
      params: { minutes },
    });
    return response.data;
  }

  /**
   * Get system health summary
   */
  async getHealthSummary(): Promise<HealthSummary> {
    const response = await apiClient.get<ApiResponse<HealthSummary>>(`${this.basePath}/health`);
    return response.data;
  }

  /**
   * Get CPU metrics
   */
  async getCpuMetrics(): Promise<CpuMetrics> {
    const response = await apiClient.get<ApiResponse<CpuMetrics>>(`${this.basePath}/cpu`);
    return response.data;
  }

  /**
   * Get memory metrics
   */
  async getMemoryMetrics(): Promise<MemoryMetrics> {
    const response = await apiClient.get<ApiResponse<MemoryMetrics>>(`${this.basePath}/memory`);
    return response.data;
  }

  /**
   * Get database metrics
   */
  async getDatabaseMetrics(): Promise<DatabaseMetrics> {
    const response = await apiClient.get<ApiResponse<DatabaseMetrics>>(`${this.basePath}/database`);
    return response.data;
  }

  /**
   * Get Redis metrics
   */
  async getRedisMetrics(): Promise<RedisMetrics> {
    const response = await apiClient.get<ApiResponse<RedisMetrics>>(`${this.basePath}/redis`);
    return response.data;
  }

  /**
   * Get WebSocket metrics
   */
  async getWebSocketMetrics(): Promise<WebSocketMetrics> {
    const response = await apiClient.get<ApiResponse<WebSocketMetrics>>(
      `${this.basePath}/websocket`
    );
    return response.data;
  }

  /**
   * Get API performance metrics
   */
  async getApiMetrics(): Promise<ApiMetrics> {
    const response = await apiClient.get<ApiResponse<ApiMetrics>>(`${this.basePath}/api`);
    return response.data;
  }
}

export const monitoringService = new MonitoringService();

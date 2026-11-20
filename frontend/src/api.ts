import axios from 'axios';
import type { WorkOrder, Provider, Assignment, NotificationLog } from './types';

// API Client using Vite proxy paths
const api = axios.create({
  headers: {
    'Content-Type': 'application/json',
  },
});

// ─── Work Order Service ───────────────────────────────────────────────────────
export const listWorkOrders = async (cursor?: string, limit: number = 50): Promise<{ items: WorkOrder[]; next_cursor: string | null; total: number }> => {
  const params: Record<string, any> = { limit };
  if (cursor) params.cursor = cursor;
  const res = await api.get('/api/v1/work-orders', { params });
  return res.data;
};

export const createWorkOrder = async (payload: {
  title: string;
  description: string;
  client_id: string;
  zip_code: string;
  required_skills: string[];
  max_budget?: number;
}): Promise<WorkOrder> => {
  const idempotencyKey = `web-${Date.now()}-${Math.random().toString(36).substring(7)}`;
  const res = await api.post('/api/v1/work-orders', payload, {
    headers: {
      'Idempotency-Key': idempotencyKey,
    },
  });
  return res.data;
};

export const cancelWorkOrder = async (workOrderId: string, reason: string, cancelledBy: string = 'client-web'): Promise<void> => {
  await api.post(`/api/v1/work-orders/${workOrderId}/cancel`, {
    reason,
    cancelled_by: cancelledBy,
  });
};

// ─── Provider Service ─────────────────────────────────────────────────────────
export const listProviders = async (limit: number = 100): Promise<Provider[]> => {
  const res = await api.get('/api/v1/providers', { params: { limit } });
  return res.data;
};

export const createProvider = async (payload: {
  name: string;
  email: string;
  phone?: string;
  skills: string[];
  service_zip_codes: string[];
  hourly_rate?: number;
}): Promise<Provider> => {
  const res = await api.post('/api/v1/providers', payload);
  return res.data;
};

// ─── Assignment Service ───────────────────────────────────────────────────────
export const matchAssignment = async (payload: {
  work_order_id: string;
  zip_code: string;
  required_skills: string[];
  strategy: 'rating' | 'cost' | 'distance';
}): Promise<Assignment> => {
  const res = await api.post('/api/v1/assignments/match', payload);
  return res.data;
};

export const acceptAssignment = async (
  workOrderId: string,
  providerId: string,
  expectedVersion: number = 1
): Promise<Assignment> => {
  const res = await api.post(`/api/v1/assignments/${workOrderId}/accept`, {
    provider_id: providerId,
    expected_version: expectedVersion,
  });
  return res.data;
};

export const getAssignment = async (workOrderId: string): Promise<Assignment> => {
  const res = await api.get(`/api/v1/assignments/${workOrderId}`);
  return res.data;
};

// ─── Notification Service ─────────────────────────────────────────────────────
export const listNotificationLogs = async (limit: number = 50): Promise<NotificationLog[]> => {
  const res = await api.get('/api/v1/notifications/logs', { params: { limit } });
  return res.data;
};

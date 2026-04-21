export type Role = 'owner' | 'vet' | 'clinic_admin' | 'network_admin' | null;

export interface StoredSession {
  role: Role;
  email: string | null;
  accessToken: string | null;
  refreshToken: string | null;
  user: User | null;
}

export interface User {
  id: string;
  email: string;
  role: Role;
  name?: string;
  clinic_id?: string;
  created_at?: string;
}

export interface LoginTokens {
  access_token: string;
  refresh_token: string;
}

export interface ApiError extends Error {
  status: number;
  payload: unknown;
}

export interface QueuedRequest {
  id: string;
  path: string;
  method: string;
  body: unknown;
  auth?: boolean;
  headers?: Record<string, string>;
}

export interface SyncResult {
  synced: number;
  failed: number;
}

export interface OfflineCacheStats {
  queuedRequests: number;
  localStorageKeys: number;
}
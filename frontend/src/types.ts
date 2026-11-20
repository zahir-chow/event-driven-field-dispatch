export interface WorkOrder {
  id: string;
  client_id: string;
  title: string;
  description?: string;
  status: 'OPEN' | 'ASSIGNED' | 'ACCEPTED' | 'IN_PROGRESS' | 'COMPLETED' | 'CANCELLED';
  zip_code: string;
  required_skills: string[];
  max_budget?: number;
  version: number;
  created_at: string;
  updated_at?: string;
}

export interface Provider {
  id: string;
  name: string;
  email: string;
  phone?: string;
  status: 'AVAILABLE' | 'BUSY' | 'INACTIVE';
  skills: string[];
  service_zip_codes: string[];
  hourly_rate?: number;
  rating: number;
  total_jobs: number;
  created_at: string;
}

export interface Candidate {
  provider_id: string;
  name: string;
  score: number;
  rating: number;
  hourly_rate?: number;
  matching_skills: string[];
}

export interface Assignment {
  id: string;
  work_order_id: string;
  provider_id?: string;
  status: 'PENDING' | 'ACCEPTED' | 'REJECTED' | 'EXPIRED';
  strategy_used?: string;
  version: number;
  candidates?: Candidate[];
  created_at: string;
}

export interface NotificationLog {
  id: string;
  recipient: string;
  channel: 'EMAIL' | 'SMS' | 'PUSH';
  status: 'SENT' | 'FAILED';
  subject?: string;
  body?: string;
  created_at: string;
}

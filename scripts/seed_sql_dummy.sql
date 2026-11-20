-- ==============================================================================
-- Direct SQL Dummy Data Seeder for DiZpatch (PostgreSQL)
-- ==============================================================================

-- 1. Seed Providers (dizpatch_providers)
\c dizpatch_providers;

INSERT INTO providers (id, name, email, phone, status, skills, service_zip_codes, hourly_rate, rating, total_jobs, created_at)
VALUES
  ('p-101', 'Alex Mercer', 'alex.mercer@fieldtech.com', '+1-555-0101', 'AVAILABLE', '["CCTV", "Networking", "Fiber Optic", "POS"]', '["75001", "75002", "75006", "75201"]', 65.0, 4.9, 120, NOW()),
  ('p-102', 'Sarah Connor', 'sarah.connor@cybertech.org', '+1-555-0102', 'AVAILABLE', '["Hardware Repair", "Networking", "Server Racks"]', '["75001", "75003", "75201"]', 80.0, 4.8, 95, NOW()),
  ('p-103', 'Marcus Vance', 'marcus.vance@telecompros.net', '+1-555-0103', 'AVAILABLE', '["POS", "Low Voltage Cabling", "Digital Signage"]', '["75006", "75007", "75201"]', 55.0, 4.5, 45, NOW()),
  ('p-104', 'Elena Rostova', 'elena.r@datacabling.io', '+1-555-0104', 'AVAILABLE', '["CCTV", "Access Control", "Security Alarms"]', '["75001", "75002", "75006"]', 72.5, 4.7, 80, NOW()),
  ('p-105', 'David Kim', 'david.kim@networkspec.com', '+1-555-0105', 'AVAILABLE', '["Fiber Optic", "Server Racks", "Telecom"]', '["75002", "75201", "75204"]', 90.0, 5.0, 150, NOW())
ON CONFLICT (id) DO NOTHING;

-- 2. Seed Work Orders & Outbox Events (dizpatch_work_orders)
\c dizpatch_work_orders;

INSERT INTO work_orders (id, client_id, title, description, status, zip_code, required_skills, budget, version, created_at)
VALUES
  ('wo-201', 'client-retail-01', 'Upgrade POS Terminals & Cat6 Cabling', 'Replace 4 legacy POS units and test ethernet drops.', 'OPEN', '75001', '["POS", "Networking"]', 350.0, 1, NOW()),
  ('wo-202', 'client-logistics-02', 'Install 8 IP Security Cameras in Warehouse', 'Mount PoE dome cameras and patch to NVR.', 'OPEN', '75006', '["CCTV", "Low Voltage Cabling"]', 600.0, 1, NOW()),
  ('wo-203', 'client-datacenter-03', 'Data Center Server Rack Clean-up', 'Re-cable 2 server racks and label fiber optic runs.', 'OPEN', '75201', '["Server Racks", "Fiber Optic"]', 500.0, 1, NOW())
ON CONFLICT (id) DO NOTHING;

-- Insert corresponding pending outbox events to trigger Kafka publishing
INSERT INTO outbox_events (event_id, aggregate_type, aggregate_id, event_type, payload, version, status, created_at)
VALUES
  ('evt-301', 'work_order', 'wo-201', 'WorkOrderCreated', '{"work_order_id": "wo-201", "title": "Upgrade POS Terminals & Cat6 Cabling", "zip_code": "75001", "required_skills": ["POS", "Networking"]}', 1, 'PENDING', NOW()),
  ('evt-302', 'work_order', 'wo-202', 'WorkOrderCreated', '{"work_order_id": "wo-202", "title": "Install 8 IP Security Cameras in Warehouse", "zip_code": "75006", "required_skills": ["CCTV", "Low Voltage Cabling"]}', 1, 'PENDING', NOW()),
  ('evt-303', 'work_order', 'wo-203', 'WorkOrderCreated', '{"work_order_id": "wo-203", "title": "Data Center Server Rack Clean-up", "zip_code": "75201", "required_skills": ["Server Racks", "Fiber Optic"]}', 1, 'PENDING', NOW())
ON CONFLICT (event_id) DO NOTHING;

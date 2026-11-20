-- Initialise remaining databases for Database-per-Service architecture
-- Note: 'dizpatch_work_orders' is automatically created via POSTGRES_DB env var.
CREATE DATABASE dizpatch_providers;
CREATE DATABASE dizpatch_assignments;
CREATE DATABASE dizpatch_notifications;

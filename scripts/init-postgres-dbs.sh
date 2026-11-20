#!/bin/bash
set -e

# Create isolated databases for Database-per-Service architecture
create_database() {
    local db=$1
    echo "Creating database: $db (if not exists)..."
    psql -v ON_ERROR_STOP=1 --username "$POSTGRES_USER" --dbname "$POSTGRES_DB" <<-EOSQL
        SELECT 'CREATE DATABASE $db' WHERE NOT EXISTS (SELECT FROM pg_database WHERE datname = '$db')\gexec
        GRANT ALL PRIVILEGES ON DATABASE $db TO $POSTGRES_USER;
EOSQL
}

create_database "dizpatch_work_orders"
create_database "dizpatch_providers"
create_database "dizpatch_assignments"
create_database "dizpatch_notifications"

echo "All 4 DiZpatch microservice databases initialized successfully!"

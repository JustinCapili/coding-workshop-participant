#!/usr/bin/env bash
# Starts springboot-service as a plain local server for load testing, on a fresh throwaway database.
#
# The database is dropped and recreated on every start, so each run begins from the same state:
# schema.sql creates the tables and DefaultAdminSeeder the default admin (admin@acme.inc /
# "password"). Neither your local `postgres` database nor the LocalStack stack is touched, and the
# port (8081) does not collide with the dev proxy on 3001.
#
# Usage: ./start-backend.sh        (Ctrl+C to stop)
#   LOADTEST_DB    database name   (default springboot_loadtest)
#   LOADTEST_PORT  HTTP port       (default 8081)
#   PGPASSWORD     local Postgres password, if it is not on trust authentication
set -euo pipefail

DB="${LOADTEST_DB:-springboot_loadtest}"
PORT="${LOADTEST_PORT:-8081}"
export PGPASSWORD="${PGPASSWORD:-postgres123}"

dropdb --if-exists -h localhost -U postgres "$DB"
createdb -h localhost -U postgres "$DB"
echo "Fresh database $DB; starting springboot-service on port $PORT..."

cd "$(dirname "$0")/../backend/springboot-service"
POSTGRES_NAME="$DB" SERVER_PORT="$PORT" exec mvn -q spring-boot:run -Dspring-boot.run.profiles=local

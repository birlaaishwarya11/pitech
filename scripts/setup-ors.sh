#!/usr/bin/env bash
# Download the New York OSM extract and start the self-hosted ORS container.
#
# Usage:
#   ./scripts/setup-ors.sh
#
# Prerequisites:
#   - Docker and Docker Compose installed and running
#   - ~1 GB free disk space for the NY extract + graph build
#
# First run takes 3-5 minutes to build the routing graph.
# Subsequent starts reuse the cached graph and are instant.

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"

PBF_URL="https://download.geofabrik.de/north-america/us/new-york-latest.osm.pbf"
ORS_DATA_DIR="$PROJECT_DIR/ors-data"
PBF_DIR="$ORS_DATA_DIR/files"
PBF_FILE="$PBF_DIR/new-york-latest.osm.pbf"

echo "==> Setting up self-hosted OpenRouteService for piTech"

# 1. Download the NY OSM extract if not already present
mkdir -p "$PBF_DIR"
if [ -f "$PBF_FILE" ]; then
    echo "    OSM file already exists: $PBF_FILE"
else
    echo "    Downloading New York OSM extract (~300 MB)..."
    curl -L --progress-bar -o "$PBF_FILE" "$PBF_URL"
    echo "    Download complete."
fi

# 2. Start ORS via Docker Compose (mount the local data dir)
echo "==> Starting ORS container..."
cd "$PROJECT_DIR"

# Override the volume to use our local directory instead of a named volume
docker compose up -d ors \
    -f docker-compose.yml \
    2>/dev/null || \
docker-compose up -d ors 2>/dev/null || {
    echo "ERROR: docker compose failed. Is Docker running?"
    exit 1
}

echo "==> ORS is starting up. First run builds the routing graph (3-5 min)."
echo "    Check status:  docker logs -f pitech-ors"
echo "    Health check:  curl http://localhost:8080/ors/v2/health"
echo ""
echo "    Once healthy, the backend at http://localhost:8000 will use it automatically."

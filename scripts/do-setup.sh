#!/usr/bin/env bash
# DigitalOcean App Platform setup for BeeBuddy
# Prerequisites: doctl CLI installed and authenticated (doctl auth init)
set -euo pipefail

REGION="nyc3"
APP_REGION="nyc"
SPACES_BUCKET="beebuddy-photos"
PG_CLUSTER="beebuddy-pg"
VALKEY_CLUSTER="beebuddy-valkey"

echo "=== BeeBuddy — DigitalOcean Setup ==="
echo ""

# ---------------------------------------------------------------
# Step 1: Verify doctl is installed and authenticated
# ---------------------------------------------------------------
if ! command -v doctl &> /dev/null; then
  echo "ERROR: doctl not found. Install it first:"
  echo "  https://docs.digitalocean.com/reference/doctl/how-to/install/"
  exit 1
fi

echo "[1/7] Checking doctl auth..."
if ! doctl account get &> /dev/null; then
  echo "ERROR: doctl not authenticated. Run: doctl auth init"
  exit 1
fi
ACCOUNT=$(doctl account get --format Email --no-header)
echo "  Authenticated as: $ACCOUNT"

# ---------------------------------------------------------------
# Step 2: Create Spaces bucket (manual — doctl can't do this)
# ---------------------------------------------------------------
echo ""
echo "[2/7] Spaces bucket: $SPACES_BUCKET"
echo "  Create this manually in the DO console:"
echo "    1. Spaces Object Storage > Create Bucket"
echo "    2. Name: '$SPACES_BUCKET', Region: '$REGION'"
echo "    3. Restrict File Listing (private)"
echo "    4. API > Spaces Keys > Generate New Key"
echo ""
echo "  Save these — you'll need them later:"
echo "    AWS_ACCESS_KEY_ID=<your spaces key>"
echo "    AWS_SECRET_ACCESS_KEY=<your spaces secret>"
echo ""
read -rp "  Press Enter once the Spaces bucket and keys are ready..."

# ---------------------------------------------------------------
# Helper: wait for a database cluster to come online
# ---------------------------------------------------------------
wait_for_db() {
  local db_id="$1"
  local label="$2"
  for i in {1..60}; do
    local status
    status=$(doctl databases get "$db_id" --format Status --no-header)
    if [ "$status" = "online" ]; then
      echo "  $label is online."
      return 0
    fi
    echo "  $label status: $status (waiting... ${i}/60)"
    sleep 10
  done
  echo "  WARNING: $label still not online after 10 min. Continuing anyway."
}

# ---------------------------------------------------------------
# Step 3: Create managed PostgreSQL
# ---------------------------------------------------------------
echo ""
echo "[3/7] Managed PostgreSQL cluster: $PG_CLUSTER..."
if doctl databases list --format Name --no-header | grep -qx "$PG_CLUSTER"; then
  echo "  Cluster '$PG_CLUSTER' already exists — skipping creation"
else
  doctl databases create "$PG_CLUSTER" \
    --engine pg \
    --version 16 \
    --region "$REGION" \
    --size db-s-1vcpu-1gb \
    --num-nodes 1
fi

PG_ID=$(doctl databases list --format ID,Name --no-header | grep "$PG_CLUSTER" | awk '{print $1}')
wait_for_db "$PG_ID" "Postgres"

# Use private URI — traffic stays in VPC, never hits public internet
DATABASE_URL=$(doctl databases connection "$PG_ID" --private --format URI --no-header)
echo "  DATABASE_URL (private)=$DATABASE_URL"

# ---------------------------------------------------------------
# Step 4: Create managed Valkey (Redis-compatible)
# ---------------------------------------------------------------
echo ""
echo "[4/7] Managed Valkey cluster: $VALKEY_CLUSTER..."
if doctl databases list --format Name --no-header | grep -qx "$VALKEY_CLUSTER"; then
  echo "  Cluster '$VALKEY_CLUSTER' already exists — skipping creation"
else
  doctl databases create "$VALKEY_CLUSTER" \
    --engine valkey \
    --version 8 \
    --region "$REGION" \
    --size db-s-1vcpu-1gb \
    --num-nodes 1
fi

VALKEY_ID=$(doctl databases list --format ID,Name --no-header | grep "$VALKEY_CLUSTER" | awk '{print $1}')
wait_for_db "$VALKEY_ID" "Valkey"

REDIS_URL=$(doctl databases connection "$VALKEY_ID" --private --format URI --no-header)
echo "  REDIS_URL (private)=$REDIS_URL"

# ---------------------------------------------------------------
# Step 5: Lock down database firewalls
# ---------------------------------------------------------------
echo ""
echo "[5/7] Restricting database access to App Platform only..."

# "app" type firewall = only DO App Platform apps can connect
doctl databases firewalls replace "$PG_ID" --rule app:"$PG_ID"
echo "  Postgres firewall: App Platform only"

doctl databases firewalls replace "$VALKEY_ID" --rule app:"$VALKEY_ID"
echo "  Valkey firewall:   App Platform only"

echo "  Public endpoints are now blocked. Only your App Platform app can connect."

# ---------------------------------------------------------------
# Step 6: Generate SECRET_KEY
# ---------------------------------------------------------------
echo ""
echo "[6/7] Generating SECRET_KEY..."
SECRET_KEY=$(openssl rand -hex 32)
echo "  SECRET_KEY=$SECRET_KEY"

# ---------------------------------------------------------------
# Step 7: Create the App Platform app
# ---------------------------------------------------------------
echo ""
echo "[7/7] Creating App Platform app..."
echo ""
echo "  ┌─────────────────────────────────────────────────────┐"
echo "  │ You'll be prompted for SECRET env var values.       │"
echo "  │ Use the values printed above plus:                  │"
echo "  │   - AWS_ACCESS_KEY_ID (Spaces key from step 2)     │"
echo "  │   - AWS_SECRET_ACCESS_KEY (Spaces secret)           │"
echo "  │   - ANTHROPIC_API_KEY (console.anthropic.com)       │"
echo "  │                                                     │"
echo "  │ For DATABASE_URL and REDIS_URL, use the PRIVATE     │"
echo "  │ URIs printed in steps 3 and 4 above.                │"
echo "  └─────────────────────────────────────────────────────┘"
echo ""
echo "  DATABASE_URL=$DATABASE_URL"
echo "  REDIS_URL=$REDIS_URL"
echo "  SECRET_KEY=$SECRET_KEY"
echo ""
read -rp "  Press Enter to create the app (or Ctrl+C to abort)..."

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"

doctl apps create --spec "$REPO_ROOT/.do/app.yaml" --interactive

echo ""
echo "=== Done! ==="
echo ""
APP_ID=$(doctl apps list --format ID --no-header | head -1)
echo "  App ID: $APP_ID"
echo ""
echo "Next steps:"
echo "  1. Watch deployment:  doctl apps logs $APP_ID --follow"
echo "  2. Open in browser:   doctl apps open $APP_ID"
echo "  3. Check status:      doctl apps list"
echo ""
echo "  API URL: https://<app-name>.ondigitalocean.app"
echo "  Update CORS_ORIGINS once you have a custom domain."

#!/usr/bin/env bash
set -euo pipefail

# ---------------------------------------------------------------------------
# Configuration — edit these before first run
# ---------------------------------------------------------------------------
INSTANCE_NAME="quiz-app"
ZONE="asia-southeast1-b"
MACHINE_TYPE="e2-small"
REMOTE_DIR="tapcet-lite"
GIT_REPO=""   # e.g. https://github.com/youruser/tapcet-lite.git

# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------
info()  { echo "[INFO]  $*"; }
warn()  { echo "[WARN]  $*"; }
abort() { echo "[ERROR] $*" >&2; exit 1; }

require() {
  command -v "$1" &>/dev/null || abort "'$1' is not installed or not on PATH."
}

# ---------------------------------------------------------------------------
# Pre-flight
# ---------------------------------------------------------------------------
require gcloud

info "Checking gcloud authentication..."
gcloud auth print-access-token &>/dev/null || abort "Not authenticated. Run: gcloud auth login"

PROJECT=$(gcloud config get-value project 2>/dev/null)
[[ -z "$PROJECT" ]] && abort "No gcloud project set. Run: gcloud config set project YOUR_PROJECT_ID"
info "Project: $PROJECT"

[[ -n "$GIT_REPO" ]] || abort "GIT_REPO is not set. Edit the configuration section at the top of this script."
[[ -f ".env" ]] || abort ".env file not found. Copy .env.example to .env and fill in credentials."
# Warn if password is still the placeholder
if grep -q "^POSTGRES_PASSWORD=changeme$" .env; then
  warn ".env still has POSTGRES_PASSWORD=changeme — consider setting a real password."
fi

# ---------------------------------------------------------------------------
# 1. Create VM (idempotent — skips if already exists)
# ---------------------------------------------------------------------------
if gcloud compute instances describe "$INSTANCE_NAME" --zone="$ZONE" &>/dev/null; then
  info "VM '$INSTANCE_NAME' already exists — skipping creation."
else
  info "Creating VM '$INSTANCE_NAME' ($MACHINE_TYPE, $ZONE)..."
  gcloud compute instances create "$INSTANCE_NAME" \
    --machine-type="$MACHINE_TYPE" \
    --image-family=debian-12 \
    --image-project=debian-cloud \
    --tags=http-server,https-server \
    --zone="$ZONE"
  info "Waiting 20 s for SSH to become available..."
  sleep 20
fi

# ---------------------------------------------------------------------------
# 2. Firewall rules (idempotent)
# ---------------------------------------------------------------------------
for RULE in allow-http allow-https; do
  if gcloud compute firewall-rules describe "$RULE" &>/dev/null; then
    info "Firewall rule '$RULE' already exists — skipping."
  else
    info "Creating firewall rule '$RULE'..."
    if [[ "$RULE" == "allow-http" ]]; then
      gcloud compute firewall-rules create allow-http \
        --allow tcp:80 --target-tags http-server
    else
      gcloud compute firewall-rules create allow-https \
        --allow tcp:443 --target-tags https-server
    fi
  fi
done

# ---------------------------------------------------------------------------
# 3. Install Docker on VM (idempotent)
# ---------------------------------------------------------------------------
info "Ensuring Docker is installed on VM..."
gcloud compute ssh "$INSTANCE_NAME" --zone="$ZONE" --command='
  set -e
  if command -v docker &>/dev/null; then
    echo "[INFO]  Docker already installed."
  else
    echo "[INFO]  Installing Docker..."
    sudo apt-get update -qq
    sudo apt-get install -y docker.io docker-compose-plugin
    sudo usermod -aG docker "$USER"
    echo "[INFO]  Docker installed."
  fi
'

# ---------------------------------------------------------------------------
# 4. Clone or pull latest code via git
# ---------------------------------------------------------------------------
EXTERNAL_IP=$(gcloud compute instances describe "$INSTANCE_NAME" \
  --zone="$ZONE" \
  --format='get(networkInterfaces[0].accessConfigs[0].natIP)')

info "Deploying latest code from $GIT_REPO..."
gcloud compute ssh "$INSTANCE_NAME" --zone="$ZONE" --command="
  set -e
  if [ -d ~/${REMOTE_DIR}/.git ]; then
    echo '[INFO]  Repo exists — pulling latest changes...'
    cd ~/${REMOTE_DIR}
    git fetch --all
    git reset --hard origin/\$(git symbolic-ref --short HEAD)
  else
    echo '[INFO]  Cloning repo...'
    git clone ${GIT_REPO} ~/${REMOTE_DIR}
  fi
"

# Copy .env separately (gitignored — must always be transferred explicitly)
info "Copying .env to VM..."
gcloud compute scp .env "${INSTANCE_NAME}:~/${REMOTE_DIR}/.env" --zone="$ZONE"

# ---------------------------------------------------------------------------
# 5. Start / update the stack
# ---------------------------------------------------------------------------
info "Bringing up Docker Compose stack on VM..."
gcloud compute ssh "$INSTANCE_NAME" --zone="$ZONE" --command="
  set -e
  cd ~/${REMOTE_DIR}
  # Run docker with sg so group membership takes effect without re-login
  sg docker -c 'docker compose up -d --build'
"

# ---------------------------------------------------------------------------
# Done
# ---------------------------------------------------------------------------
info "Deployed successfully!"
info "External IP : $EXTERNAL_IP"
info "To stream logs: gcloud compute ssh $INSTANCE_NAME --zone=$ZONE --command='cd ~/${REMOTE_DIR} && docker compose logs -f app'"

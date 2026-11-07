#!/usr/bin/env bash
# HatLock Linux Agent Installer
# Supports: Ubuntu 22.04+, Debian 12+, Fedora 38+, RHEL 9+

set -euo pipefail

RED='\033[0;31m'
GREEN='\033[0;32m'
BLUE='\033[0;34m'
NC='\033[0m'

echo -e "${BLUE}=== HatLock Linux Agent Installer (Luxeenet) ===${NC}"

if [ "$EUID" -ne 0 ]; then
  echo -e "${RED}Error: This script must be run as root (use sudo).${NC}"
  exit 1
fi

ENROLLMENT_TOKEN="${1:-${HATLOCK_ENROLLMENT_TOKEN:-}}"
API_URL="${2:-${HATLOCK_API_URL:-https://api.hatlock.luxeenet.com}}"

# 1. Directories
mkdir -p /etc/hatlock
mkdir -p /var/lib/hatlock
chmod 700 /etc/hatlock
chmod 700 /var/lib/hatlock

# 2. Write environment configuration
cat <<EOF > /etc/hatlock/agent.env
HATLOCK_API_URL=${API_URL}
HATLOCK_ENROLLMENT_TOKEN=${ENROLLMENT_TOKEN}
HATLOCK_HEARTBEAT_SECONDS=30
RUST_LOG=info
EOF
chmod 600 /etc/hatlock/agent.env

# 3. Copy binary if built, or build via cargo
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
BIN_PATH="${SCRIPT_DIR}/target/release/hatlock-agent"

if [ -f "$BIN_PATH" ]; then
    echo "Installing binary from $BIN_PATH..."
    cp "$BIN_PATH" /usr/local/bin/hatlock-agent
    chmod 755 /usr/local/bin/hatlock-agent
else
    echo "Binary not pre-compiled at $BIN_PATH."
    if command -v cargo &> /dev/null; then
        echo "Building release binary using local Cargo..."
        (cd "$SCRIPT_DIR" && cargo build --release)
        cp "$SCRIPT_DIR/target/release/hatlock-agent" /usr/local/bin/hatlock-agent
        chmod 755 /usr/local/bin/hatlock-agent
    else
        echo "Please build the binary (cargo build --release) or place pre-compiled binary in /usr/local/bin/hatlock-agent"
    fi
fi

# 4. Install systemd service
if [ -f "$SCRIPT_DIR/hatlock-agent.service" ]; then
    cp "$SCRIPT_DIR/hatlock-agent.service" /etc/systemd/system/
    systemctl daemon-reload
    systemctl enable hatlock-agent
    systemctl restart hatlock-agent
    echo -e "${GREEN}HatLock Agent service enabled and started!${NC}"
    systemctl status hatlock-agent --no-pager || true
fi

echo -e "${GREEN}HatLock Linux Agent installation complete.${NC}"

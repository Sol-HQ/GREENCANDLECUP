#!/usr/bin/env bash
# Run on fresh Ubuntu 22.04 VPS (NYC) after Vultr deploy
set -euo pipefail

apt-get update
apt-get install -y git curl build-essential ufw

# Node 22
curl -fsSL https://deb.nodesource.com/setup_22.x | bash -
apt-get install -y nodejs
corepack enable

# ShredStream UDP port (Triton default for GCC)
ufw allow OpenSSH
ufw allow 8002/udp
ufw --force enable

# Buffer tuning for shred packets
cat >/etc/sysctl.d/99-gcc-shreds.conf <<'EOF'
net.core.rmem_max=26214400
net.core.rmem_default=26214400
EOF
sysctl --system

mkdir -p /opt/greencandlecup
cd /opt/greencandlecup

echo "Clone GREENCANDLECUP repo here, copy .env, then:"
echo "  pnpm install && pnpm build:packages && pnpm --filter @gcc/server build"
echo "  cp deploy/gcc-bot.service /etc/systemd/system/"
echo "  systemctl enable --now gcc-bot"

# Optional: verify shreds with deshred-example
if ! command -v cargo >/dev/null; then
  curl https://sh.rustup.rs -sSf | sh -s -- -y
  . "$HOME/.cargo/env"
fi
if [ ! -d deshred-example ]; then
  git clone https://github.com/rpcpool/deshred-example
fi

echo "VPS base setup complete. Enter your public IP in Triton (port 8002, NYC)."

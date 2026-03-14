#!/usr/bin/env bash

set -euox pipefail

# Parse arguments
use_local=false
server_ip="129.212.140.176"

while [[ $# -gt 0 ]]; do
  case $1 in
    --local)
      use_local=true
      shift
      ;;
    *)
      if [ -z "$server_ip" ]; then
        server_ip=$1
      else
        echo "Unknown argument: $1"
        exit 1
      fi
      shift
      ;;
  esac
done

# Check if server_ip is provided
if [ -z "$server_ip" ]; then
  echo "Usage: $0 [--local] <server_ip>"
  echo "  --local: Use local source code instead of cloning from GitHub"
  exit 1
fi

# create a temporary directory
temp_dir=$(mktemp -d)
trap 'echo "Removing temp dir" && rm -rf -- "$temp_dir"' EXIT

if [ "$use_local" = true ]; then
  # use local source code
  echo "Using local source code..."
  source_dir=$(dirname "$(dirname "$(realpath "$0")")")
  cp -r "$source_dir" "$temp_dir/parread"
  cd "$temp_dir/parread"
  # create version file with local git info
  git -C "$source_dir" log -1 > version 2>/dev/null
  echo "local-build-$(date +%Y%m%d-%H%M%S)" >> version
else
  # create a shallow clone of the monorepo and extract parread
  cd "$temp_dir"
  git clone --depth 1 git@github.com:v0gd/lang.git
  cp -r lang/parread "$temp_dir/parread"
  cd parread
  git -C ../lang log -1 > version
  rm -rf ../lang
fi

rm -rf .git

# enable swap
ssh root@"${server_ip}" "/sbin/swapon /var/swap.1" || true

# stop the services
ssh root@"${server_ip}" "systemctl stop parread" || true
ssh root@"${server_ip}" "systemctl stop nginx" || true

# copy application files
ssh root@"${server_ip}" "rm -rf /var/www/parread"
ssh root@"${server_ip}" "mkdir -p /var/www/parread && chown -R www-data:www-data /var/www/parread"
scp -r . root@"${server_ip}":/var/www/parread
ssh root@"${server_ip}" "mkdir -p /var/www/parread/backend/cache && chown -R www-data:www-data /var/www/parread/backend/cache"

# build backend (FastAPI)
ssh root@"${server_ip}" "cd /var/www/parread/backend && python3 -m venv .venv"
ssh root@"${server_ip}" "cd /var/www/parread/backend && . .venv/bin/activate && pip install -r requirements.txt"

# build frontend (Vite)
# Source nvm so npm is available in non-interactive SSH.
ssh root@"${server_ip}" "source /root/.nvm/nvm.sh && nvm use 24 && cd /var/www/parread/frontend && npm install"
ssh root@"${server_ip}" "source /root/.nvm/nvm.sh && nvm use 24 && cd /var/www/parread/frontend && npm run build"

# install systemd configuration
ssh root@"${server_ip}" "rm -f /etc/systemd/system/parread.service"
ssh root@"${server_ip}" "cp /var/www/parread/deploy/parread.service /etc/systemd/system/parread.service"
ssh root@"${server_ip}" "systemctl daemon-reload"

# configure nginx
ssh root@"${server_ip}" "rm -f /etc/nginx/sites-enabled/parread"
ssh root@"${server_ip}" "cp /var/www/parread/deploy/nginx.conf /etc/nginx/sites-available/parread"
ssh root@"${server_ip}" "ln -s /etc/nginx/sites-available/parread /etc/nginx/sites-enabled"
ssh root@"${server_ip}" "rm -f /etc/nginx/sites-enabled/default"
ssh root@"${server_ip}" "nginx -t" # test nginx configuration

# configure log rotation
ssh root@"${server_ip}" "mkdir -p /var/log/parread"
ssh root@"${server_ip}" "chown www-data:www-data /var/log/parread"
ssh root@"${server_ip}" "chmod 750 /var/log/parread"
ssh root@"${server_ip}" "rm -f /etc/logrotate.d/parread"
ssh root@"${server_ip}" "cp /var/www/parread/deploy/logrotate.conf /etc/logrotate.d/parread"

# start the services
ssh root@"${server_ip}" "systemctl start parread"
ssh root@"${server_ip}" "systemctl enable parread"
ssh root@"${server_ip}" "systemctl status parread"
ssh root@"${server_ip}" "systemctl start nginx"
ssh root@"${server_ip}" "systemctl status nginx"

# configure https
ssh root@${server_ip} "certbot --nginx -d parread.com -n"

echo "Deployment completed successfully!"

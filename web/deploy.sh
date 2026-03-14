#!/bin/bash -euox pipefail

# Check if server_ip is provided
if [ -z "${1:-}" ]; then
  echo "Usage: $0 <server_ip> <api_address>"
  echo "Example: $0 161.35.21.74 https://polypup.org"
  exit 1
fi
server_ip=$1

# Check if api address is provided
if [ -z "${2:-}" ]; then
  echo "Usage: $0 <server_ip> <api_address>"
  echo "Example: $0 161.35.21.74 https://polypup.org"
  exit 1
fi
api_address=$2


# create a temporary directory
temp_dir=$(mktemp -d)
trap 'echo "Removing temp dir" && rm -rf -- "$temp_dir"' EXIT
echo "Temporary directory created at: $temp_dir"

# create a shallow clone of the monorepo and extract web
cd $temp_dir
git clone --depth 1 git@github.com:v0gd/lang.git
cd lang/web
git -C ../.. log -1 >> revision
rm -rf ../../.git

# deploy the application
ssh root@${server_ip} "systemctl stop nginx"
ssh root@${server_ip} "rm -rf /var/www/lang-web"
ssh root@${server_ip} "mkdir /var/www/lang-web && chown -R www-data:www-data /var/www/lang-web"
scp -r . root@${server_ip}:/var/www/lang-web
# .bashrc is not loaded in non-interactive shell, so we need to source nvm.sh manually
# Also manually increase the memory limit for the build process if machine has less than 1GB of RAM to use swap
ssh root@${server_ip} "cd /var/www/lang-web && source /root/.nvm/nvm.sh && npm install && NODE_OPTIONS=--max_old_space_size=1024 REACT_APP_API_URL=\"$api_address/api\" npm run build"
ssh root@${server_ip} "systemctl start nginx"
ssh root@${server_ip} "systemctl status nginx"

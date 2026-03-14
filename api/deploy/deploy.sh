#!/bin/bash -euox pipefail

# Check if server_ip is provided
if [ -z "${1:-}" ]; then
  echo "Usage: $0 <server_ip>"
  exit 1
fi

server_ip=$1

# create a temporary directory
temp_dir=$(mktemp -d)
trap 'echo "Removing temp dir" && rm -rf -- "$temp_dir"' EXIT

# create a shallow clone of the monorepo and extract api
cd $temp_dir
git clone --depth 1 git@github.com:v0gd/lang.git
cd lang/api
git -C ../.. log -1 >> revision
rm -rf ../../.git

# stop the services
ssh root@${server_ip} "systemctl stop l-api"
ssh root@${server_ip} "systemctl stop nginx"

# copy application files
ssh root@${server_ip} "rm -rf /var/www/l-api"
ssh root@${server_ip} "mkdir /var/www/l-api && chown -R www-data:www-data /var/www/l-api"
scp -r . root@${server_ip}:/var/www/l-api

# build the application
ssh root@${server_ip} "cd /var/www/l-api/src && /usr/local/go/bin/go mod tidy"
ssh root@${server_ip} "cd /var/www/l-api/src && mkdir ../build && /usr/local/go/bin/go build -o ../build/l-api"

# install systemd configuration
ssh root@${server_ip} "rm -f /etc/systemd/system/l-api.service"
ssh root@${server_ip} "cp /var/www/l-api/deploy/l-api.service /etc/systemd/system/l-api.service"
ssh root@${server_ip} "systemctl daemon-reload"

# configure nginx
ssh root@${server_ip} "rm -f /etc/nginx/sites-enabled/l-api"
ssh root@${server_ip} "cp /var/www/l-api/deploy/nginx.conf /etc/nginx/sites-available/l-api"
ssh root@${server_ip} "ln -s /etc/nginx/sites-available/l-api /etc/nginx/sites-enabled"
ssh root@${server_ip} "rm -f /etc/nginx/sites-enabled/default" # de-activate default configuration
ssh root@${server_ip} "nginx -t" # to test nginx configuration

# configure log rotation
ssh root@${server_ip} "mkdir -p /var/log/l-api"
ssh root@${server_ip} "chown www-data:www-data /var/log/l-api"
ssh root@${server_ip} "chmod 750 /var/log/l-api"
ssh root@${server_ip} "rm -f /etc/logrotate.d/l-api"
ssh root@${server_ip} "cp /var/www/l-api/deploy/logrotate.conf /etc/logrotate.d/l-api"

# start the services
ssh root@${server_ip} "systemctl start l-api"
ssh root@${server_ip} "systemctl enable l-api"
ssh root@${server_ip} "systemctl status l-api"
ssh root@${server_ip} "systemctl start nginx"
ssh root@${server_ip} "systemctl status nginx"

# configure https
ssh root@${server_ip} "certbot --nginx -d polypup.org -n"

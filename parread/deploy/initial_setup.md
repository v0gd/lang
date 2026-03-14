# Parread — Initial Server Setup (one-time)

These steps are required once per new server. They are **not** part of each deployment.

## 1) Connect to the server
```bash
ssh root@<SERVER_IP>
```

## 2) Firewall
```bash
ufw allow ssh
ufw allow 80/tcp
ufw allow 443/tcp
ufw enable
ufw status
```

## 3) Swap (recommended for Node builds)
```bash
/bin/dd if=/dev/zero of=/var/swap.1 bs=1M count=2048
chmod 0600 /var/swap.1
/sbin/mkswap /var/swap.1
/sbin/swapon /var/swap.1
```

## 4) System packages
```bash
apt update
apt install -y nginx certbot python3-certbot-nginx \
	python3 python3-venv python3-pip \
	git curl build-essential
```

## 5) Node.js (for Vite build)
```bash
curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.40.4/install.sh | bash
exec $SHELL -l
nvm install 24
nvm use 24
```

### Non-interactive SSH + nvm (recommended approach)
Non-interactive SSH commands do **not** load `nvm` by default. Use a login shell in deploy commands:
```bash
ssh root@<SERVER_IP> 'bash -lc "cd /var/www/parread/frontend && npm install"'
```

### Optional: auto-load nvm (trade-offs)
You can add this to `~/.bashrc` so it’s available when explicitly sourcing the file:
```bash
export NVM_DIR="$HOME/.nvm"
[ -s "$NVM_DIR/nvm.sh" ] && . "$NVM_DIR/nvm.sh"
```
**Downsides:** forcing non-interactive shells to load nvm (e.g., via `BASH_ENV`) adds overhead to every SSH command and can change PATH for scripts unexpectedly. Prefer the login-shell approach above.

## 6) Create required directories
```bash
mkdir -p /var/www
chown -R www-data:www-data /var/www

mkdir -p /var/log/parread
chown www-data:www-data /var/log/parread
chmod 750 /var/log/parread

mkdir -p /etc/parread
chmod 700 /etc/parread
```

## 7) Create environment file
```bash
touch /etc/parread/env
chown root:root /etc/parread/env
chmod 600 /etc/parread/env
```

Add your secrets (example keys):
```
API_SECRET_KEY=your-secret-key-here
OPENAI_API_KEY=...
```

## 8) Verify nginx/certbot
```bash
nginx -v
certbot --version
```

## Run certbot non-interactivly to accept stuff
```bash
certbot
```

## 9) Deploy
From your dev machine:
```bash
./deploy.sh
```

## 10) Debugging basics
```bash
systemctl status parread
journalctl -u parread -xe | more
cat /var/log/parread/error.log | more
cat /var/log/parread/stdout.log | more

ufw status
certbot renew --dry-run
systemctl status certbot.timer
```

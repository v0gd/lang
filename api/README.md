# Install (Mac)

## Repo setup history
1. [Install go](https://go.dev/doc/tutorial/getting-started)
1. `cd src`
1. `go mod init lang/api`
1. Run:
```
go get "github.com/openai/openai-go"
go get "github.com/aws/aws-sdk-go-v2"
go get "github.com/aws/aws-sdk-go-v2/aws"
go get "github.com/aws/aws-sdk-go-v2/config"
go get "github.com/aws/aws-sdk-go-v2/service/polly"
go get "github.com/invopop/jsonschema"
go get -u "github.com/go-sql-driver/mysql"
go get "firebase.google.com/go/v4@latest"
go get "google.golang.org/api/option"
```

## Firebase
To enable `Sign in with Google` using `signInWithRedirect` a few things must happen:
1. To disable third-party cookies (which is being blocked by browsers), the cookie must come from
  the same domain as the web site. Meaning that for localhost the cookie must come from localhost.
  For this Firebase should be configured to use localhost as `authDomain` firebase config param.
  `localhost` backend (API) should then redirect auth request to firebase.com. Locally it's done by
  go `http` module using `httputil.NewSingleHostReverseProxy`.<br>
  In prod nginx hanles it with:
  `location /__/auth { proxy_pass https://lang-2dd5b.firebaseapp.com; }`<br>
  Temp TLS (HTTPS) cert was generated for local development using:
  `openssl req -x509 -newkey rsa:2048 -nodes -keyout deploy/localhost.key -out deploy/localhost.crt -subj "/CN=localhost"`
1. In google cloud console `https://localhost:5001/__/auth/handler` (or
  whatever port is used locally) should be added to
  `APIs&Services -> Credentials -> OAuth 2.0 Client IDs -> Authorized redirect URIs`
  And the corresponding prod domain as well.
1. In webapp `signInWithRedirect` won't work locally, because API and web run 
on different ports and according to firebase - it's different origins, and thus
won't work (https://github.com/firebase/firebase-js-sdk/issues/7824). Shouldn't
be an issue though in prod, where API and web are on the same port. So locally
`signInWithPopup` is used.

### MySql (Mac)
Install MySql 8.X LTS from [here](https://dev.mysql.com/downloads/mysql/)

This should also create a `_mysql` user (run `id _mysql` to check)

To use mysql: `/usr/local/mysql/bin/mysql` (don't use `mysql` as it will likely use homebew version)

To start mysql server
```bash
sudo /usr/local/mysql/bin/mysqld \
  --user=_mysql \
  --basedir=/usr/local/mysql \
  --datadir=/usr/local/mysql/data \
  --plugin-dir=/usr/local/mysql/lib/plugin \
  --log-error=/usr/local/mysql/data/mysqld.local.err \
  --pid-file=/usr/local/mysql/data/mysqld.local.pid
```

To connect to the server:
`mysql -u root -p`

```sql
CREATE DATABASE lang;
USE lang;

CREATE TABLE story (
    id VARCHAR(256) NOT NULL,
    locales VARCHAR(100) NOT NULL,  -- comma separated values
    titles TEXT NOT NULL,  -- \n separated titles, the order matches locales
    language_level VARCHAR(10) NOT NULL,
    author_id VARCHAR(256) NOT NULL,
    created TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    input_params JSON NOT NULL,  -- parameters used to generate the story
    content JSON NOT NULL,
    deleted TINYINT(1) NOT NULL DEFAULT 0,
    PRIMARY KEY (id),
    INDEX (locales),
    INDEX (language_level),
    INDEX (author_id),
    INDEX (created)
);

CREATE TABLE tts (
    story_id VARCHAR(256) NOT NULL,
    l VARCHAR(10) NOT NULL,
    sentence_idx INT NOT NULL,
    data BLOB NOT NULL,
    PRIMARY KEY (story_id, l, sentence_idx)
);

CREATE TABLE explanation (
    story_id VARCHAR(256) NOT NULL,
    l VARCHAR(10) NOT NULL,
    r VARCHAR(10) NOT NULL,
    l_sentence_idx INT NOT NULL,
    r_sentence_idx INT NOT NULL,
    content TEXT NOT NULL,
    PRIMARY KEY (story_id, l, r, l_sentence_idx, r_sentence_idx)
);

COMMIT;
```

## To run locally
1. `cd src && source ../env.sh && go run .`

# Deploy (Digital Ocean)

## Create instance
```
curl -X POST -H 'Content-Type: application/json' \
    -H 'Authorization: Bearer '$TOKEN'' \
    -d '{"name":"app",
        "size":"s-1vcpu-512mb-10gb",
        "region":"fra1",
        "image":"ubuntu-24-04-x64"}' \
    "https://api.digitalocean.com/v2/droplets"
```

## Connect over SSH
```bash
ssh root@161.35.21.74
```

## Configure stuff
```bash
# firewall
ufw allow ssh
ufw allow 80/tcp
ufw allow 443/tcp
ufw enable

# swap (required for `npm install`)
/bin/dd if=/dev/zero of=/var/swap.1 bs=1M count=2048
chmod 0600 /var/swap.1
/sbin/mkswap /var/swap.1

# www dirs
mkdir /var/www
chown -R www-data:www-data /var/www

# cache dirs
mkdir /var/cache/l-api
chown www-data:www-data /var/cache/l-api
chmod 700 /var/cache/l-api

# install golang
cd
wget https://go.dev/dl/go1.23.4.linux-amd64.tar.gz
rm -rf /usr/local/go && tar -C /usr/local -xzf go1.23.4.linux-amd64.tar.gz

#include certbot
apt install certbot python3-certbot-nginx
```

## Configure l-api

### Secrets
```bash
mkdir /etc/l-api
chmod 700 /etc/l-api
vim /etc/l-api/env
chown root:root /etc/l-api/env
chmod 600 /etc/l-api/env
```

Copy content of the `env-template` file and update the secret values.

#### Google service account
Copy the json with prod service account secrets (from the firebase console) to `/etc/l-api/google-service-acc.json`.

```bash
chown www-data:www-data /etc/l-api/env
chmod 600 /etc/l-api/google-service-acc.json
```


### Deploy

On the dev machine run:
```bash
./deploy.sh <server IP address>
```

## Configure webapp

```bash
curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.39.7/install.sh | bash
exec $SHELL -l
nvm install node
```

Then run the deploy script from the webapp repo.

## Debug

Check l-api service is running and check its logs
```bash
systemctl status l-api
journalctl -u l-api -xe | more
cat /var/log/l-api/error.log | more
cat /var/log/l-api/stdout.log | more
```

Check ports 22/80/443 are allowed by firewall:
```bash
ufw status
```

Check automated certificate renewal works:
```bash
certbot renew --dry-run
systemctl status certbot.timer
```

Expected final `nginx -T` output for reference [is here](deploy/nginx-expected.md).


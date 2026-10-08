# Deploy Weatherly to Amazon EC2

This guide deploys Weatherly on an Ubuntu EC2 instance with Node.js, systemd, Nginx, and HTTPS for your domain. Replace `example.com` with your domain throughout. The app listens on port `3000`; Nginx serves as the public-facing reverse proxy. You do not need a weather API key.

## 1. Point your domain to EC2

Allocate an Elastic IP and associate it with the instance so its address stays stable. In your DNS provider, create:

- An `A` record for `@` pointing to the Elastic IP.
- An `A` record for `www` pointing to the Elastic IP.

If the instance has a configured public IPv6 address, you can use matching `AAAA` records as well. Otherwise, do not add `AAAA` records. DNS changes may take time to propagate.

## 2. Launch and secure the instance

Launch an Ubuntu 24.04 LTS EC2 instance and connect over SSH. In its EC2 security group, allow inbound:

- SSH (TCP 22) from your IP address only.
- HTTP (TCP 80) from anywhere.
- HTTPS (TCP 443) from anywhere.

Do **not** expose port `3000` publicly; Nginx will proxy requests to the app locally. Keep your SSH private key secure.

## 3. Install system packages and Node.js

On the instance:

```bash
sudo apt update
sudo apt install -y ca-certificates curl git nginx

# Install Node.js 24 LTS and npm from NodeSource.
curl -fsSL https://deb.nodesource.com/setup_24.x | sudo -E bash -
sudo apt install -y nodejs

node --version
npm --version
```

## 4. Create a service account and install the app

Create a dedicated, non-login account and clone the repository into its home directory:

```bash
sudo useradd --system --create-home --home-dir /opt/weather-app \
  --shell /usr/sbin/nologin weatherapp
sudo install -d -o weatherapp -g weatherapp /opt/weather-app
sudo -u weatherapp git clone \
  https://github.com/ayakinm/weather-app-2026.git /opt/weather-app
sudo -u weatherapp npm --prefix /opt/weather-app ci --omit=dev
```

If the repository is private, configure repository access for the `weatherapp` account before cloning. Alternatively, securely transfer a release to the instance and make `/opt/weather-app` owned by `weatherapp`.

## 5. Create the systemd service

Create `/etc/systemd/system/weather-app.service`:

```bash
sudo tee /etc/systemd/system/weather-app.service > /dev/null <<'EOF'
[Unit]
Description=Weatherly weather app
After=network.target

[Service]
Type=simple
User=weatherapp
Group=weatherapp
WorkingDirectory=/opt/weather-app
Environment=NODE_ENV=production
Environment=PORT=3000
ExecStart=/usr/bin/node /opt/weather-app/server.js
Restart=on-failure
RestartSec=5
NoNewPrivileges=true
PrivateTmp=true
ProtectSystem=strict
ProtectHome=true

[Install]
WantedBy=multi-user.target
EOF
```

Enable and start the app, then confirm that it responds locally:

```bash
sudo systemctl daemon-reload
sudo systemctl enable --now weather-app
sudo systemctl status weather-app --no-pager
curl -fsS http://127.0.0.1:3000/ > /dev/null && echo "Weatherly is responding"
```

To inspect service logs:

```bash
sudo journalctl -u weather-app -n 100 --no-pager
```

## 6. Configure Nginx

Create `/etc/nginx/sites-available/weather-app` and replace `example.com` with your domain:

```nginx
server {
    listen 80;
    listen [::]:80;
    server_name example.com www.example.com;

    location / {
        proxy_pass http://127.0.0.1:3000;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

Enable the site, validate the Nginx configuration, and reload it:

```bash
sudo ln -s /etc/nginx/sites-available/weather-app \
  /etc/nginx/sites-enabled/weather-app
sudo nginx -t
sudo systemctl reload nginx
```

Once DNS resolves to the instance, confirm `http://example.com` loads before requesting the certificate.

## 7. Enable HTTPS

Install Certbot and request a certificate for both hostnames:

```bash
sudo apt install -y certbot python3-certbot-nginx
sudo certbot --nginx -d example.com -d www.example.com
```

Follow the prompts to enter an email address and redirect HTTP traffic to HTTPS. Certbot configures Nginx and renews the certificate automatically. You can check renewal with:

```bash
sudo certbot renew --dry-run
```

The app's browser geolocation feature requires HTTPS (except on localhost), so confirm the dashboard works at `https://example.com`.

## Updating the app

After publishing changes to the repository:

```bash
sudo -u weatherapp git -C /opt/weather-app pull --ff-only
sudo -u weatherapp npm --prefix /opt/weather-app ci --omit=dev
sudo systemctl restart weather-app
sudo systemctl status weather-app --no-pager
```

If an update fails, inspect `sudo journalctl -u weather-app -n 100 --no-pager` and `sudo journalctl -u nginx -n 100 --no-pager`.

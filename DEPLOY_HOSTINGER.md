# Déploiement sur Hostinger (VPS KVM)

Cible : un VPS Hostinger sous Ubuntu 22.04 LTS exécutant le backend Spring Boot,
PostgreSQL 16 et le frontend statique Vite, exposé via Nginx + Certbot (TLS).

> Le projet utilise **Java 21** et **Node 20+**. Vérifier que le plan VPS
> dispose d'au moins **2 vCPU / 2 Go de RAM** (le démarrage de Spring Boot +
> PostgreSQL est lourd sur 1 Go).

---

## 1. Préparation du VPS

```bash
# en root
apt update && apt upgrade -y
apt install -y curl gnupg2 ca-certificates lsb-release ufw \
               openjdk-21-jre-headless postgresql-16 postgresql-contrib \
               nginx certbot python3-certbot-nginx

# Utilisateur de service
adduser --system --group --home /opt/finace finace
mkdir -p /opt/finace /etc/finace /var/log/finace /var/www/finace-frontend /var/lib/finace/storage
chown -R finace:finace /opt/finace /var/log/finace /var/lib/finace
```

Firewall :

```bash
ufw allow OpenSSH
ufw allow "Nginx Full"
ufw enable
```

---

## 2. PostgreSQL

```bash
sudo -u postgres psql <<'SQL'
CREATE USER finace WITH PASSWORD 'CHANGE_ME_strong_password';
CREATE DATABASE finace OWNER finace;
GRANT ALL PRIVILEGES ON DATABASE finace TO finace;
SQL
```

Les migrations Flyway s'exécutent automatiquement au démarrage du backend.

---

## 3. Build local et upload

Sur la machine de dev :

```powershell
# Backend
cd backend
mvn -DskipTests package
# -> target/finace-1.0.0.jar

# Frontend
cd ../frontend
npm ci
npm run build
# -> dist/
```

Upload :

```powershell
scp backend/target/finace-1.0.0.jar         root@VPS:/opt/finace/finace.jar
scp -r frontend/dist/*                      root@VPS:/var/www/finace-frontend/
```

Sur le VPS :

```bash
chown finace:finace /opt/finace/finace.jar
chown -R www-data:www-data /var/www/finace-frontend
```

---

## 4. Configuration `/etc/finace/.env`

```bash
cat > /etc/finace/.env <<'ENV'
SPRING_PROFILES_ACTIVE=prod
SERVER_PORT=8080

SPRING_DATASOURCE_URL=jdbc:postgresql://localhost:5432/finace
SPRING_DATASOURCE_USERNAME=finace
SPRING_DATASOURCE_PASSWORD=CHANGE_ME_strong_password

APP_JWT_SECRET=CHANGE_ME_minimum_64_caracteres_aleatoires_pour_HS256
APP_JWT_ACCESS_TTL_MINUTES=30
APP_JWT_REFRESH_TTL_DAYS=14

APP_STORAGE_PATH=/var/lib/finace/storage
APP_PUBLIC_URL=https://finace.exemple.tn

# OAuth Google (optionnel)
APP_OAUTH_GOOGLE_CLIENT_ID=

# Mail (optionnel - sinon laisser vide)
SPRING_MAIL_HOST=smtp.hostinger.com
SPRING_MAIL_PORT=587
SPRING_MAIL_USERNAME=no-reply@exemple.tn
SPRING_MAIL_PASSWORD=APP_PASSWORD
SPRING_MAIL_PROPERTIES_MAIL_SMTP_STARTTLS_ENABLE=true
ENV
chmod 600 /etc/finace/.env
chown finace:finace /etc/finace/.env
```

> **Sécurité** : régénérer `APP_JWT_SECRET` avec
> `openssl rand -base64 64`. Ne JAMAIS commiter ce fichier.

---

## 5. Service systemd `finace.service`

```bash
cat > /etc/systemd/system/finace.service <<'UNIT'
[Unit]
Description=Finace Spring Boot backend
After=network.target postgresql.service
Wants=postgresql.service

[Service]
Type=simple
User=finace
Group=finace
EnvironmentFile=/etc/finace/.env
WorkingDirectory=/opt/finace
ExecStart=/usr/bin/java -Xms256m -Xmx768m -jar /opt/finace/finace.jar
Restart=on-failure
RestartSec=5
StandardOutput=append:/var/log/finace/app.log
StandardError=append:/var/log/finace/app.log

# Hardening
NoNewPrivileges=true
PrivateTmp=true
ProtectSystem=strict
ProtectHome=true
ReadWritePaths=/var/lib/finace /var/log/finace

[Install]
WantedBy=multi-user.target
UNIT

systemctl daemon-reload
systemctl enable --now finace
systemctl status finace --no-pager
journalctl -u finace -f       # voir les logs en direct
```

---

## 6. Nginx (reverse proxy + frontend statique)

```bash
cat > /etc/nginx/sites-available/finace <<'NGX'
server {
    listen 80;
    server_name finace.exemple.tn;

    # Frontend statique
    root /var/www/finace-frontend;
    index index.html;

    # SPA fallback
    location / {
        try_files $uri $uri/ /index.html;
    }

    # API REST
    location /api/ {
        proxy_pass         http://127.0.0.1:8080;
        proxy_http_version 1.1;
        proxy_set_header   Host              $host;
        proxy_set_header   X-Real-IP         $remote_addr;
        proxy_set_header   X-Forwarded-For   $proxy_add_x_forwarded_for;
        proxy_set_header   X-Forwarded-Proto $scheme;
        client_max_body_size 25m;
    }

    # WebSocket STOMP/SockJS
    location /ws {
        proxy_pass         http://127.0.0.1:8080;
        proxy_http_version 1.1;
        proxy_set_header   Upgrade           $http_upgrade;
        proxy_set_header   Connection        "upgrade";
        proxy_set_header   Host              $host;
        proxy_read_timeout 3600s;
    }

    # Fichiers uploadés (logos, factures, etc.)
    location /api/storage/files/ {
        proxy_pass         http://127.0.0.1:8080;
        proxy_http_version 1.1;
        proxy_set_header   Host              $host;
        proxy_set_header   X-Real-IP         $remote_addr;
    }
}
NGX

ln -s /etc/nginx/sites-available/finace /etc/nginx/sites-enabled/finace
rm -f /etc/nginx/sites-enabled/default
nginx -t && systemctl reload nginx
```

---

## 7. TLS (Let's Encrypt)

```bash
certbot --nginx -d finace.exemple.tn --redirect --agree-tos -m admin@exemple.tn
systemctl status certbot.timer    # renouvellement automatique
```

---

## 8. Pré-flight checklist

- [ ] `systemctl is-active finace` → `active`
- [ ] `curl -fsS http://127.0.0.1:8080/actuator/health` → `{"status":"UP"}` (si actuator activé)
- [ ] `curl -fsS https://finace.exemple.tn/api/auth/login -X POST -H 'Content-Type: application/json' -d '{"email":"x","password":"x"}'` → 401 (preuve que le backend répond)
- [ ] `https://finace.exemple.tn/` charge la page d'accueil React
- [ ] WebSocket : ouvrir DevTools → onglet Network → frame `wss` connecté après login
- [ ] Sauvegarde PostgreSQL :
      `pg_dump -U finace finace | gzip > /var/backups/finace-$(date +%F).sql.gz`
      (mettre en cron quotidien)

---

## 9. Mise à jour

```bash
# sur la machine de dev
mvn -DskipTests -f backend/pom.xml package
npm --prefix frontend run build

# upload
scp backend/target/finace-1.0.0.jar   root@VPS:/opt/finace/finace.jar.new
scp -r frontend/dist/*                root@VPS:/var/www/finace-frontend/

# sur le VPS
mv /opt/finace/finace.jar.new /opt/finace/finace.jar
chown finace:finace /opt/finace/finace.jar
systemctl restart finace
```

Les migrations Flyway s'appliquent au redémarrage.

---

## 10. Plan B — Hostinger Cloud Hosting (hébergement mutualisé)

Hostinger **Cloud Hosting** (mutualisé) **n'autorise pas** d'exécuter un JAR Spring Boot
en service permanent : il faut un VPS. Si tu es sur un plan mutualisé, deux options :

1. **Migrer vers le plan VPS Hostinger** (recommandé).
2. **Externaliser** : déployer le backend sur Railway / Render / Fly.io,
   et garder seulement le frontend statique (`frontend/dist/`) sur le mutualisé
   en pointant `VITE_API_URL` vers l'URL publique du backend.

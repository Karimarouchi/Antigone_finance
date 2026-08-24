# Déploiement sur le VPS existant (même machine que le PFE)

IP VPS : **187.127.94.149** (`srv1848338`)  
Domaine : **https://finance.autolifeservices.com**  
PFE déjà en place : `/var/www/pfe/MEDIANET_PFE-` (ports **3080** et **18080**)

Cette app tourne **à côté**, en Docker, sur **3081** / **18081**.  
Nginx hôte (déjà installé) route le sous-domaine, comme `pfe-vulnix`.

Ne **pas** réutiliser les ports 80, 443, 8080, 3080, 18080.

---

## 1. DNS Hostinger

Sur `autolifeservices.com` → **DNS / Nameservers** → **Edit**  
(ne change **pas** les nameservers, l’email continue de marcher) :

| Type | Name     | Points to       | TTL |
|------|----------|-----------------|-----|
| A    | `finance`| `187.127.94.149`| 300 |

Vérifier :

```bash
ping finance.autolifeservices.com
# doit afficher 187.127.94.149
```

---

## 2. Clone + Docker (sur le VPS, en root)

```bash
cd /var/www
git clone https://github.com/Karimarouchi/Antigone_finance.git finance
cd /var/www/finance
```

Si les fichiers Docker ne sont pas encore sur GitHub, ils sont listés plus bas (à créer avec `nano` / heredoc).

---

## 3. `.env` production

```bash
cd /var/www/finance
cp .env.prod.example .env
# ou, si le fichier n'existe pas encore dans le clone :
# nano .env
```

Contenu minimum (remplace les `CHANGE_ME`) :

```env
POSTGRES_DB=finace
POSTGRES_USER=finace
POSTGRES_PASSWORD=CHANGE_ME_STRONG_PASSWORD

FRONTEND_PORT=3081
BACKEND_PORT=18081

JWT_SECRET=COLLE_ICI_openssl_rand_-base64_64
JWT_ACCESS_TTL_MINUTES=30
JWT_REFRESH_TTL_DAYS=14

CORS_ORIGINS=https://finance.autolifeservices.com
APP_BASE_URL=https://finance.autolifeservices.com
FRONTEND_BASE_URL=https://finance.autolifeservices.com

MAIL_HOST=smtp.hostinger.com
MAIL_PORT=587
MAIL_USERNAME=noreply@autolifeservices.com
MAIL_PASSWORD=CHANGE_ME_EMAIL_PASSWORD
MAIL_FROM=Finance Antigone <noreply@autolifeservices.com>

GOOGLE_CLIENT_ID=
GOOGLE_CLIENT_SECRET=

VITE_API_URL=
VITE_WS_URL=https://finance.autolifeservices.com/ws
```

Générer le JWT :

```bash
openssl rand -base64 64
```

```bash
chmod 600 /var/www/finance/.env
```

---

## 4. Nginx hôte (comme `pfe-vulnix`)

```bash
nano /etc/nginx/sites-available/finance
```

```nginx
server {
    listen 80;
    server_name finance.autolifeservices.com;

    client_max_body_size 25m;

    location / {
        proxy_pass http://127.0.0.1:3081;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_read_timeout 3600s;
    }
}
```

```bash
ln -sf /etc/nginx/sites-available/finance /etc/nginx/sites-enabled/finance
nginx -t && systemctl reload nginx
```

---

## 5. Lancer (sans toucher au PFE)

```bash
cd /var/www/finance
docker compose up -d --build
docker compose ps
```

Tu dois voir **3 services Up** : `db`, `backend`, `frontend`.

Tests locaux (ne passent pas par le DNS) :

```bash
curl -s http://127.0.0.1:3081/ | head
curl -s http://127.0.0.1:18081/actuator/health
# PFE toujours OK :
curl -s -o /dev/null -w "%{http_code}\n" http://127.0.0.1:3080
```

Logs si le backend restart :

```bash
docker compose logs backend --tail=80
```

---

## 6. HTTPS

Le DNS A `finance` doit déjà résoudre vers `187.127.94.149`.

```bash
certbot --nginx -d finance.autolifeservices.com --redirect --agree-tos -m admin@autolifeservices.com
```

Ouvre **https://finance.autolifeservices.com**

---

## 7. Premier super_admin

Inscris-toi sur le site, puis :

```bash
cd /var/www/finance
docker compose exec db \
  psql -U finace -d finace \
  -c "UPDATE profiles SET role = 'super_admin' WHERE email = 'ton@email.com';"
```

---

## 8. Mises à jour

```bash
cd /var/www/finance
git pull
docker compose up -d --build
```

Le PFE (`/var/www/pfe/MEDIANET_PFE-`) n’est pas redémarré.

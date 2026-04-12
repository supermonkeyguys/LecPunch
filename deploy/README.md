# LecPunch production deployment

This first-pass deployment is designed for a Tencent Cloud Ubuntu server without a domain.
It uses:

- Docker Compose
- a MongoDB container with a persistent volume
- the API container on the internal Docker network only
- the web container serving the Vite build through nginx and proxying `/api` to the API

## 1. Limitations

- Access is over `http://<server-public-ip>/`, not HTTPS.
- This is acceptable for a short internal test, not for a long-term public deployment.
- Network allowlists must use the client network's public egress IP or CIDR, not a LAN address like `192.168.x.x`.

## 2. Prepare the server

Clone the repository on the server and enter the project directory:

```bash
git clone <your-repo-url>
cd LecPunch
```

Copy the env templates:

```bash
cp deploy/api.env.example deploy/api.env
cp deploy/mongo.env.example deploy/mongo.env
```

Edit both files before the first boot.

## 3. Recommended first boot settings

Use these settings for the first internal test:

- keep `ALLOW_OPEN_REGISTRATION=true` only if you want regular users to self-register
- keep `ALLOW_ANY_NETWORK=true` for the first boot to avoid locking yourself out
- set `AUTH_SECRET` to a long random secret
- keep `TRUST_PROXY=true`

After you confirm the actual client public IP, switch to a stricter network policy from the admin page:

- `http://<server-public-ip>/admin/network-policy`

That admin policy is stored in MongoDB and overrides the environment fallback.

## 4. Build and start

Run:

```bash
docker compose -f docker-compose.prod.yml up -d --build
```

Check logs if needed:

```bash
docker compose -f docker-compose.prod.yml logs -f web
docker compose -f docker-compose.prod.yml logs -f api
```

## 5. Bootstrap the first admin

Open an interactive shell on the server and run the bootstrap command once.
The username is normalized to lowercase, so `LecPunch` becomes `lecpunch`.

```bash
docker compose -f docker-compose.prod.yml exec \
  -e BOOTSTRAP_ADMIN_USERNAME=LecPunch \
  -e BOOTSTRAP_ADMIN_PASSWORD=replace-with-a-strong-password \
  -e BOOTSTRAP_ADMIN_DISPLAY_NAME=admin \
  api node dist/scripts/bootstrap-admin.js
```

Optional values:

- `BOOTSTRAP_ADMIN_REAL_NAME`
- `BOOTSTRAP_ADMIN_STUDENT_ID`
- `BOOTSTRAP_ADMIN_ENROLL_YEAR`
- `BOOTSTRAP_ADMIN_RESET_PASSWORD=true` when promoting an existing user and you also want to reset the password

## 6. Access the app

Open:

```txt
http://<server-public-ip>/
```

Then log in with the bootstrapped admin account and finish the network policy setup.

## 7. Suggested next step after the test

After the small-scale test is stable, move to:

1. a domain name
2. HTTPS
3. an image registry such as Tencent Cloud TCR or GHCR
4. GitHub Actions for automated build and deployment

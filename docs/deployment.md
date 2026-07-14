# Production Deployment Guide

This project runs on Lovable Cloud by default (TanStack Start on Cloudflare
Workers). The artefacts in this repo also support fully self-hosted
deployments behind Docker + NGINX. Pick the path that matches your
compliance requirements — do not mix both.

---

## 1. Deployment Options

| Path                 | Runtime                     | Best for                                    |
|----------------------|-----------------------------|---------------------------------------------|
| **Lovable-managed**  | Cloudflare Workers + Cloud  | Fastest path, autoscaling, zero ops         |
| **Self-hosted**      | Docker + NGINX + Node 22    | On-prem / VPC / regulator-mandated hosting  |

**Frontend vs backend:** frontend changes require clicking *Update* in the
Publish dialog; backend changes (migrations, server functions) deploy
immediately.

---

## 2. Docker & Compose

- `Dockerfile` — multi-stage: `bun` for install/build, distroless-ish
  `node:22-alpine` runtime, non-root user, built-in `HEALTHCHECK` on
  `/api/public/health`.
- `docker-compose.yml` — two `app` replicas behind `nginx`, structured
  JSON logs capped at 10 MB × 5 files per container, resource limits,
  optional `observability` and `backup` profiles.

```bash
cp .env.production.example .env.production   # fill in values
docker compose build
docker compose up -d
docker compose --profile observability up -d   # + Loki/Promtail
docker compose --profile backup up -d          # + pg_dump sidecar
```

---

## 3. NGINX

`deploy/nginx/` is a hardened reverse proxy:
- HTTP → HTTPS redirect, HSTS preload, TLS 1.2/1.3 only.
- Security headers: HSTS, X-Content-Type-Options, X-Frame-Options,
  Referrer-Policy, Permissions-Policy, CSP (tune once third-party origins
  are catalogued).
- Rate limiting: `30 req/s` per IP with burst 60, 100 concurrent
  connections per IP.
- gzip on text/JSON/JS/CSS/SVG/WASM.
- 1-year immutable cache for hashed static assets.
- JSON access log format ready for Loki/CloudWatch.

Drop your TLS material into `deploy/nginx/certs/{fullchain,privkey}.pem`
(Let's Encrypt via `certbot`, ACM, or corporate CA).

---

## 4. CI/CD (GitHub Actions)

| Workflow                    | Purpose                                             |
|-----------------------------|-----------------------------------------------------|
| `.github/workflows/ci.yml`  | Lint, typecheck, unit + integration, build, E2E     |
| `.github/workflows/security.yml` | `bun audit`, CodeQL, Gitleaks (weekly + on PR) |
| `.github/workflows/deploy.yml`   | Build/push OCI image to GHCR, deploy, smoke test |

Environments (`staging`, `production`) map to GitHub Environments with
required reviewers, deploy branches, and per-env secrets. Concurrency
groups prevent overlapping deploys.

---

## 5. Production Checklist

Before flipping DNS to a new release:

**Code & build**
- [ ] `bun run lint` clean
- [ ] `bun run test:all` green (unit, integration, security, E2E)
- [ ] `bun run build` produces `.output/` without warnings
- [ ] Coverage ≥ 90% for regulatory calculators (LCR/NSFR/EL/stress)

**Backend**
- [ ] All migrations reviewed; RLS enabled on every `public.*` table
- [ ] `GRANT`s match RLS policies (see `tests/security/rls-and-input`)
- [ ] Edge/server functions read secrets from env, never hard-coded
- [ ] Backup ran in the last 24h; restore rehearsed in the last quarter

**Security**
- [ ] TLS cert valid > 30 days
- [ ] Security headers present (`curl -I https://…`)
- [ ] Dependency audit: no unpatched high/critical
- [ ] Secrets rotated in the last 90 days (`LOVABLE_API_KEY`,
      Supabase service role, DB password)
- [ ] No `.env*` file with real values committed

**Observability**
- [ ] `/api/public/health` and `/api/public/ready` return 200
- [ ] Logs flowing to Loki / CloudWatch / your sink
- [ ] Uptime monitor pointed at `/api/public/health` (1-min interval)
- [ ] On-call rotation acknowledged

**Data**
- [ ] Backup retention ≥ 14 days (see `deploy/scripts/backup.sh`)
- [ ] Off-site copy (S3 or equivalent) configured
- [ ] Runbook link posted in incident channel

---

## 6. Monitoring & Logging

- **Health endpoints** — `src/routes/api/public/health.ts` (liveness,
  no DB) and `/api/public/ready` (readiness, checks Supabase).
  Wire your uptime monitor to `health`; wire the orchestrator's
  readiness probe to `ready`.
- **App logs** — TanStack Start writes structured logs to stdout;
  Docker captures them via the json-file driver with rotation.
- **Edge logs** — NGINX emits JSON access logs (`log_format json_combined`)
  including request ID for cross-service tracing.
- **Aggregation** — enable the compose `observability` profile to ship
  logs to Loki via Promtail (`deploy/observability/promtail.yaml`).
  Point Grafana at Loki for dashboards and alerts.
- **Metrics** — scrape `/api/public/health` for uptime; export application
  metrics via OpenTelemetry SDK if deeper telemetry is required (not
  wired by default to avoid vendor lock-in).

---

## 7. Backup & Recovery

**Backup**
- Managed (Lovable Cloud): request an export from Cloud → Advanced
  settings → Export data. Automated point-in-time recovery is provided
  by the underlying Postgres.
- Self-hosted: `deploy/scripts/backup.sh` runs `pg_dump` every 6 hours
  via the `backup` compose profile, gzips output, and retains 14 days
  locally. Set `S3_BUCKET` for off-site copies.

**Recovery**
1. Provision an empty Postgres matching the source major version.
2. Set `DATABASE_URL` to the target and run
   `sh deploy/scripts/restore.sh /backups/db-<stamp>.sql.gz`.
3. Redeploy the app pointed at the restored database.
4. Rehearse quarterly; record RTO/RPO achieved in the incident log.

Targets:
- **RPO** ≤ 6h (backup interval) / near-zero on managed Cloud (PITR).
- **RTO** ≤ 1h for self-hosted restore + redeploy.

---

## 8. Scaling

- **Horizontal (app)** — bump `deploy.replicas` in `docker-compose.yml`
  or run under Docker Swarm / Kubernetes. NGINX uses `least_conn` so new
  replicas take traffic automatically.
- **Vertical** — raise `cpus` / `memory` limits when p95 latency creeps
  up or GC pauses appear in logs.
- **Database** — enable a read replica for reporting-heavy workloads
  and route report generation server functions to it. Regulatory
  calculators are pure functions (`src/lib/*.ts`), so CPU scales with
  the app tier, not the DB.
- **Static assets** — put a CDN (Cloudflare, CloudFront) in front of
  NGINX; the `Cache-Control: public, max-age=31536000, immutable`
  headers on hashed assets make this safe.
- **Rate limits** — adjust `limit_req_zone rate=30r/s` in
  `deploy/nginx/nginx.conf` to your capacity plan.

---

## 9. Security Hardening

- **Transport**: TLS 1.2/1.3 only, HSTS preload, no session tickets.
- **Headers**: CSP (tighten per app), X-Frame-Options DENY, no
  `X-Powered-By`, `server_tokens off`.
- **App**: RLS enforced on every `public.*` table; roles stored in
  `user_roles` (never on profiles); `has_role()` is
  `SECURITY DEFINER` with `search_path=public`.
- **Server functions**: protected functions use `requireSupabaseAuth`;
  `service_role` client only inside `.server.ts` modules, never shipped
  to the browser.
- **Container**: non-root user, read-only bind mounts for NGINX config
  and certs, resource limits, healthchecks.
- **Supply chain**: `bun install --frozen-lockfile`, CodeQL + Gitleaks +
  `bun audit` in CI.
- **Secrets**: managed via Lovable secret tools or Docker/K8s secrets;
  never commit `.env.production`. Rotate on any suspected exposure.

---

## 10. Deployment Runbook (self-hosted)

```bash
# 0. one-time
git clone <repo> /srv/risk-platform && cd /srv/risk-platform
cp .env.production.example .env.production && $EDITOR .env.production
mkdir -p deploy/nginx/certs
# drop fullchain.pem + privkey.pem into deploy/nginx/certs/

# 1. release
git fetch --tags && git checkout v1.2.3
docker compose pull app || docker compose build app
docker compose up -d --no-deps --scale app=2 app     # rolling
docker compose exec nginx nginx -s reload            # if config changed

# 2. verify
curl -fsS https://your-host/api/public/health
curl -fsS https://your-host/api/public/ready

# 3. rollback
git checkout v1.2.2
docker compose up -d --no-deps app
```

For Lovable-managed hosting the equivalent is: merge to `main`, click
*Publish → Update*, watch `/api/public/health` on the published URL.

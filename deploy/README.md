Deployment assets for a single-server production setup.

Components:
- `nginx/campus-growth.conf`: serves the built frontend and proxies `/api/` over plain HTTP.
- `nginx/campus-growth-https.conf`: HTTPS-ready Nginx config for a real domain with Let's Encrypt.
- `systemd/campus-growth-api.service`: runs the Express API with the production env file.
- `systemd/minio.service`: legacy local MinIO service, no longer needed once production storage is moved to OSS/COS/S3.

Recommended rollout order:
1. Install Node 22+ or 24+, PostgreSQL, and Nginx.
2. Create `/etc/campus-growth/api.env`.
3. Build and sync the repository to `/opt/campus-growth/current`.
4. Run `node --import tsx scripts/migrate-sqlite-to-postgres.ts --sqlite=server/data/campus-growth.db --postgres-url=...` when migrating an existing SQLite dataset.
5. If migrating an existing object store, run `npm run migrate:storage:s3` with source and target S3 environment variables.
6. Enable `campus-growth-api.service` and `nginx.service`.

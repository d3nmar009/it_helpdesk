# Production deployment (standalone + pm2)

## 1. Build (on this PC)

```bash
npm run build:standalone
```

The finished package is the folder `.next\standalone`. It contains everything needed to run
(`server.js`, `node_modules`, `.next\static`, `public`, `.env`, `ecosystem.config.cjs`).

## 2. Copy to the server

Copy the **contents** of `.next\standalone` into the app folder on the server
(for example `C:\apps\it_helpdesk` or `/var/www/it_helpdesk`).

- Copy **over** the existing folder; do not delete it first. Uploaded attachments live in
  `public\uploads` on the server, and the package ships an empty `uploads` folder so it never
  overwrites them.
- The package includes `.env` from the build PC. If the server uses different database details,
  edit `.env` on the server after copying (and keep a copy so the next deploy doesn't overwrite it).

## 3. Start with pm2 (first time)

Requires Node.js 20+ and pm2 (`npm install -g pm2`) on the server.

```bash
cd <app folder>
pm2 start ecosystem.config.cjs
pm2 save
```

The app listens on port **3000** by default. To use another port, change `PORT` in
`ecosystem.config.cjs`.

## 4. Updating (later deploys)

1. Build again with `npm run build:standalone`.
2. Copy the new `.next\standalone` contents over the server folder (step 2).
3. Restart:

```bash
pm2 restart it-helpdesk --update-env
```

If the database schema changed (`prisma/schema.prisma`), apply the migration to the production
database before restarting.

## Database connections

The app keeps one database connection pool per pm2 process. Optional `.env` settings:

| Variable | Default | Meaning |
| --- | --- | --- |
| `DATABASE_CONNECTION_LIMIT` | `10` | Maximum connections the app may open |
| `DATABASE_MIN_IDLE` | `1` | Connections kept open while idle |
| `DATABASE_IDLE_TIMEOUT` | `60` | Seconds before extra idle connections are closed |

To check the connection and how many connections the app opens (run in the project folder):

```bash
npx -y tsx scripts/db-connection-test.mts
```

## Useful pm2 commands

| Command | Purpose |
| --- | --- |
| `pm2 status` | Is the app running? |
| `pm2 logs it-helpdesk` | View live logs / errors |
| `pm2 restart it-helpdesk` | Restart the app |
| `pm2 stop it-helpdesk` | Stop the app |
| `pm2 startup` then `pm2 save` | Start automatically when the server reboots (Linux). On Windows use `pm2-installer` or `pm2-windows-startup`. |

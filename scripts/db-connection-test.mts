// Checks the database connection and how many connections the app's Prisma pool opens.
// Run: npx -y tsx scripts/db-connection-test.mts   (add --compare to also measure the old pool settings)
import { PrismaMariaDb } from "@prisma/adapter-mariadb";
import mariadb from "mariadb";
import { PrismaClient } from "../generated/prisma/client";

process.loadEnvFile?.(".env");

const { databasePoolConfig } = await import("../lib/prisma");

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
const base = databasePoolConfig();

const monitor = await mariadb.createConnection({
  host: base.host,
  port: base.port,
  user: base.user,
  password: base.password,
  database: base.database,
});

async function appConnections() {
  const rows = await monitor.query(
    "SELECT COUNT(*) AS n FROM information_schema.PROCESSLIST WHERE USER = ? AND ID <> CONNECTION_ID()",
    [base.user],
  );
  return Number(rows[0].n);
}

async function measure(label: string, config: ConstructorParameters<typeof PrismaMariaDb>[0]) {
  const before = await appConnections();
  const prisma = new PrismaClient({ adapter: new PrismaMariaDb(config) });

  const started = Date.now();
  const users = await prisma.users.count();
  console.log(`\n[${label}] connected, users table has ${users} rows (${Date.now() - started} ms)`);

  await sleep(3000);
  console.log(`[${label}] connections after startup (idle): ${(await appConnections()) - before}`);

  await Promise.all(Array.from({ length: 15 }, () => prisma.ticket.count()));
  console.log(`[${label}] connections right after 15 parallel queries: ${(await appConnections()) - before}`);

  await prisma.$disconnect();
  await sleep(1000);
}

try {
  const [{ version }] = await monitor.query("SELECT VERSION() AS version");
  const [{ Value: maxConn }] = await monitor.query("SHOW VARIABLES LIKE 'max_connections'");
  const [{ Value: threads }] = await monitor.query("SHOW STATUS LIKE 'Threads_connected'");
  console.log(`Database ${base.host}:${base.port}/${base.database} as ${base.user}`);
  console.log(`Server version ${version}, max_connections=${maxConn}, currently connected (all clients)=${threads}`);
  console.log(`Existing connections from user "${base.user}" (other apps / pm2 included): ${await appConnections()}`);

  if (process.argv.includes("--compare")) {
    await measure("old settings", {
      host: base.host,
      user: base.user,
      password: base.password,
      database: base.database,
      connectionLimit: 20,
    });
  }

  await measure("new settings", base);
  console.log(
    `\nNew pool: connectionLimit=${base.connectionLimit}, minimumIdle=${base.minimumIdle}, idleTimeout=${base.idleTimeout}s`,
  );
} finally {
  await monitor.end();
}

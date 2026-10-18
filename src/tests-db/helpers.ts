import { Pool, PoolClient } from 'pg';
import fs from 'fs';
import path from 'path';

export interface DbConfig {
  connectionString?: string;
  host?: string;
  port?: number;
  user?: string;
  password?: string;
  database?: string;
}

export interface ProfileOptions {
  userId?: string;
  username?: string;
  email?: string;
  fullName?: string;
  roleCode: string;
  plantCodes?: string[];
  mustChangePassword?: boolean;
}

export interface TestDatabaseHandle {
  dbName: string;
  pool: Pool;
  masterPool: Pool;
  adminClient: PoolClient;
}

const DEFAULT_PORT = 54329;
const DEFAULT_USER = 'postgres';
const DEFAULT_PASS = 'postgrespassword';
const DEFAULT_HOST = 'localhost';

export function getDbConfig(): DbConfig {
  if (process.env.TEST_DATABASE_URL) {
    return { connectionString: process.env.TEST_DATABASE_URL };
  }
  return {
    host: process.env.PGHOST || DEFAULT_HOST,
    port: process.env.PGPORT ? parseInt(process.env.PGPORT, 10) : DEFAULT_PORT,
    user: process.env.PGUSER || DEFAULT_USER,
    password: process.env.PGPASSWORD || DEFAULT_PASS,
    database: process.env.PGDATABASE || 'postgres',
  };
}

export function createMasterPool(): Pool {
  const config = getDbConfig();
  if (config.connectionString) {
    return new Pool({ connectionString: config.connectionString, max: 10 });
  }
  return new Pool({
    host: config.host,
    port: config.port,
    user: config.user,
    password: config.password,
    database: 'postgres',
    max: 10,
  });
}

/**
 * Creates an isolated PostgreSQL database for the test run,
 * applies 00_supabase_stub.sql, and applies every migration in numeric order.
 */
export async function createFreshDatabase(testPrefix = 'gulf_erp_test'): Promise<TestDatabaseHandle> {
  const masterPool = createMasterPool();
  const dbSuffix = `${Date.now()}_${Math.floor(Math.random() * 100000)}`;
  const dbName = `${testPrefix}_${dbSuffix}`;

  // 1. Create fresh database
  await masterPool.query(`CREATE DATABASE "${dbName}" WITH OWNER postgres ENCODING 'UTF8';`);

  // 2. Connect pool to the new database
  const config = getDbConfig();
  const testPoolConfig = config.connectionString
    ? { connectionString: config.connectionString.replace(/\/[^/]+$/, `/${dbName}`) }
    : {
        host: config.host,
        port: config.port,
        user: config.user,
        password: config.password,
        database: dbName,
        max: 20,
      };

  const pool = new Pool(testPoolConfig);
  const adminClient = await pool.connect();

  try {
    // 3. Apply Supabase Stub
    const stubPath = path.resolve(process.cwd(), 'supabase/tests/harness/00_supabase_stub.sql');
    if (fs.existsSync(stubPath)) {
      const stubSql = fs.readFileSync(stubPath, 'utf8');
      await adminClient.query(stubSql);
    }

    // 4. Apply all migrations in numeric order
    const migrationsDir = path.resolve(process.cwd(), 'supabase/migrations');
    const files = fs.readdirSync(migrationsDir)
      .filter((f) => f.endsWith('.sql'))
      .sort((a, b) => a.localeCompare(b, undefined, { numeric: true, sensitivity: 'base' }));

    for (const file of files) {
      const fullPath = path.join(migrationsDir, file);
      const sql = fs.readFileSync(fullPath, 'utf8');
      await adminClient.query(sql);
    }
  } catch (err: unknown) {
    adminClient.release();
    await pool.end();
    await masterPool.query(`DROP DATABASE IF EXISTS "${dbName}" WITH (FORCE);`);
    await masterPool.end();
    throw err;
  }

  return {
    dbName,
    pool,
    masterPool,
    adminClient,
  };
}

/**
 * Destroys the test database after the test suite completes.
 */
export async function destroyDatabase(handle: TestDatabaseHandle): Promise<void> {
  handle.adminClient.release();
  await handle.pool.end();
  await handle.masterPool.query(`DROP DATABASE IF EXISTS "${handle.dbName}" WITH (FORCE);`);
  await handle.masterPool.end();
}

/**
 * Seeds a user in auth.users and public.profiles using admin privileges.
 */
export async function createProfile(
  adminClient: PoolClient,
  optionsOrRole: ProfileOptions | string,
  maybePlants?: string[]
): Promise<string> {
  const options: ProfileOptions =
    typeof optionsOrRole === 'string'
      ? { roleCode: optionsOrRole, plantCodes: maybePlants || [] }
      : optionsOrRole;

  const userId = options.userId || crypto.randomUUID();
  const username = options.username || `usr_${Math.floor(Math.random() * 100000)}`;
  const email = options.email || `${username}@gulfenergy.sa`;
  const fullName = options.fullName || `Test User ${username}`;
  const plantCodes = options.plantCodes || [];
  const mustChangePassword = options.mustChangePassword ?? false;

  await adminClient.query(
    `INSERT INTO auth.users (id, email)
     VALUES ($1, $2)
     ON CONFLICT (id) DO UPDATE SET email = EXCLUDED.email;`,
    [userId, email]
  );

  await adminClient.query(
    `INSERT INTO public.profiles (user_id, username, full_name, role_code, plant_codes, is_active, must_change_password)
     VALUES ($1, $2, $3, $4, $5, true, $6)
     ON CONFLICT (user_id) DO UPDATE SET
       role_code = EXCLUDED.role_code,
       plant_codes = EXCLUDED.plant_codes,
       must_change_password = EXCLUDED.must_change_password;`,
    [userId, username, fullName, options.roleCode, plantCodes, mustChangePassword]
  );

  return userId;
}

/**
 * Executes a callback as an authenticated user inside a dedicated pooled client transaction.
 * Automatically sets LOCAL ROLE authenticated, request.jwt.claim.sub, and request.jwt.claim.role.
 * Supports both asUser(pool, userId, fn) and asUser(pool, userId, roleCode, fn).
 */
export async function asUser<T>(
  pool: Pool,
  userId: string,
  fnOrRole: ((client: PoolClient) => Promise<T>) | string,
  maybeFn?: (client: PoolClient) => Promise<T>
): Promise<T> {
  const fn = typeof fnOrRole === 'function' ? fnOrRole : maybeFn!;
  const roleCode = typeof fnOrRole === 'string' ? fnOrRole : undefined;

  const client = await pool.connect();
  try {
    await client.query('BEGIN;');
    await client.query('SET LOCAL ROLE authenticated;');
    await client.query('SELECT set_config($1, $2, true);', ['request.jwt.claim.sub', userId]);
    await client.query('SELECT set_config($1, $2, true);', ['request.jwt.claim.role', 'authenticated']);
    if (roleCode) {
      await client.query('SELECT set_config($1, $2, true);', [
        'request.jwt.claim.user_metadata',
        JSON.stringify({ role: roleCode }),
      ]);
    }

    const result = await fn(client);
    await client.query('COMMIT;');
    return result;
  } catch (err: unknown) {
    await client.query('ROLLBACK;').catch(() => {});
    throw err;
  } finally {
    client.release();
  }
}

/**
 * Executes a callback as an anonymous (unauthenticated) client.
 */
export async function asAnon<T>(
  pool: Pool,
  fn: (client: PoolClient) => Promise<T>
): Promise<T> {
  const client = await pool.connect();
  try {
    await client.query('BEGIN;');
    await client.query('SET LOCAL ROLE anon;');
    await client.query('SELECT set_config($1, $2, true);', ['request.jwt.claim.sub', '']);
    await client.query('SELECT set_config($1, $2, true);', ['request.jwt.claim.role', 'anon']);

    const result = await fn(client);
    await client.query('COMMIT;');
    return result;
  } catch (err: unknown) {
    await client.query('ROLLBACK;').catch(() => {});
    throw err;
  } finally {
    client.release();
  }
}

import { parentPort, workerData, type MessagePort } from 'node:worker_threads';
import { Client, types } from 'pg';

types.setTypeParser(20, (value) => Number(value));
types.setTypeParser(1700, (value) => Number(value));

type PrimitiveParam = string | number | bigint | Uint8Array | null;
type SqlParams = Record<string, PrimitiveParam>;

interface ExecRequest {
  id: string;
  type: 'exec';
  sql: string;
}

interface QueryRequest {
  id: string;
  type: 'get' | 'all' | 'run';
  sql: string;
  params: SqlParams;
}

type WorkerRequest = ExecRequest | QueryRequest;

interface WorkerSuccessResponse {
  id: string;
  ok: true;
  result: unknown;
}

interface WorkerErrorResponse {
  id: string;
  ok: false;
  error: string;
}

const client = new Client({
  connectionString: workerData.postgresUrl as string,
});

function normalizeInsertOrIgnore(sql: string) {
  if (!/insert\s+or\s+ignore\s+into/i.test(sql)) {
    return sql;
  }

  const normalized = sql.replace(/insert\s+or\s+ignore\s+into/i, 'INSERT INTO').replace(/;\s*$/, '');
  return `${normalized} ON CONFLICT DO NOTHING`;
}

function convertNamedParams(sql: string, params: SqlParams = {}) {
  const positions = new Map<string, number>();
  const values: PrimitiveParam[] = [];
  const normalizedSql = normalizeInsertOrIgnore(sql).replace(/@([a-zA-Z0-9_]+)/g, (_, name: string) => {
    if (!positions.has(name)) {
      positions.set(name, values.length + 1);
      values.push(params[name] ?? null);
    }

    return `$${positions.get(name)}`;
  });

  return {
    text: normalizedSql,
    values,
  };
}

async function handleExec(request: ExecRequest) {
  await client.query(request.sql);
  return null;
}

async function handleQuery(request: QueryRequest) {
  const query = convertNamedParams(request.sql, request.params);
  const result = await client.query(query.text, query.values);

  if (request.type === 'get') {
    return result.rows[0] ?? null;
  }

  if (request.type === 'all') {
    return result.rows;
  }

  return {
    changes: result.rowCount ?? 0,
  };
}

async function handleRequest(request: WorkerRequest) {
  if (request.type === 'exec') {
    return handleExec(request);
  }

  return handleQuery(request);
}

async function main() {
  await client.connect();

  parentPort?.once('message', (port: MessagePort) => {
    port.on('message', async (request: WorkerRequest) => {
      try {
        const result = await handleRequest(request);
        const response: WorkerSuccessResponse = {
          id: request.id,
          ok: true,
          result,
        };
        port.postMessage(response);
      } catch (error) {
        const response: WorkerErrorResponse = {
          id: request.id,
          ok: false,
          error: error instanceof Error ? error.message : 'postgres_worker_failed',
        };
        port.postMessage(response);
      }
    });
    port.start();
  });
}

void main().catch((error) => {
  const message = error instanceof Error ? error.message : 'postgres_worker_boot_failed';
  throw new Error(message);
});

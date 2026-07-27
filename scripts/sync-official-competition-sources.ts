import { createHash, randomUUID } from 'node:crypto';
import { officialCompetitionSources } from './data/official-competition-sources.ts';

const args = new Set(process.argv.slice(2));
const shouldApply = args.has('--apply');
const productionConfirmed = args.has('--confirm-production');
const idArg = process.argv.find((value) => value.startsWith('--id='))?.slice(5) || process.env.npm_config_id;
const limitArg = Number(process.argv.find((value) => value.startsWith('--limit='))?.slice(8) || process.env.npm_config_limit || 30);
const maxBodyBytes = 5 * 1024 * 1024;

function compactText(value: string) {
  return value
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;|&#160;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/\s+/g, ' ')
    .trim();
}

function extractSignals(text: string, expectedKeywords: string[]) {
  const compact = compactText(text);
  const editions = [...new Set(compact.match(/第[一二三四五六七八九十百0-9]{1,8}届|20\d{2}(?:年|届|赛季)/g) || [])].slice(0, 12);
  const dates = [...new Set(compact.match(/20\d{2}[-年/.](?:1[0-2]|0?[1-9])[-月/.](?:3[01]|[12]\d|0?[1-9])日?/g) || [])].slice(0, 30);
  return {
    keywordsMatched: expectedKeywords.filter((keyword) => compact.includes(keyword)),
    editions,
    dates,
    textSample: compact.slice(0, 500),
  };
}

async function fetchSource(source: (typeof officialCompetitionSources)[number]) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 20_000);
  const fetchedAt = new Date().toISOString();
  try {
    const response = await fetch(source.sourceUrl, {
      redirect: 'follow',
      signal: controller.signal,
      headers: { 'User-Agent': 'CampusGrowth-OfficialSourceMonitor/1.0 (+manual-review-only)' },
    });
    const bytes = new Uint8Array(await response.arrayBuffer());
    if (bytes.byteLength > maxBodyBytes) throw new Error(`body_too_large:${bytes.byteLength}`);
    const contentHash = createHash('sha256').update(bytes).digest('hex');
    const contentType = response.headers.get('content-type') || '';
    const text = contentType.includes('pdf') ? '' : new TextDecoder('utf-8').decode(bytes);
    return {
      ...source,
      fetchedAt,
      finalUrl: response.url,
      httpStatus: response.status,
      contentHash,
      contentLength: bytes.byteLength,
      extracted: text ? extractSignals(text, source.expectedKeywords) : { keywordsMatched: [], editions: [], dates: [], textSample: '' },
      errorMessage: response.ok ? '' : `http_${response.status}`,
    };
  } catch (error) {
    return {
      ...source,
      fetchedAt,
      finalUrl: source.sourceUrl,
      httpStatus: 0,
      contentHash: '',
      contentLength: 0,
      extracted: { keywordsMatched: [], editions: [], dates: [], textSample: '' },
      errorMessage: error instanceof Error ? error.message : String(error),
    };
  } finally {
    clearTimeout(timer);
  }
}

const selected = officialCompetitionSources
  .filter((source) => !idArg || source.competitionId === idArg)
  .slice(0, Number.isFinite(limitArg) ? Math.max(1, Math.min(limitArg, 30)) : 30);
const results = [];
for (const source of selected) results.push(await fetchSource(source));

if (shouldApply) {
  const [{ serverConfig }, helpers] = await Promise.all([import('../server/config.ts'), import('../server/helpers.ts')]);
  if (serverConfig.databaseProvider === 'postgres' && !productionConfirmed) throw new Error('production_confirmation_required');
  for (const result of results) {
    const previous = helpers.getOne<{ content_hash: string }>(
      `SELECT content_hash FROM competition_source_snapshots
       WHERE competition_id = @competitionId AND source_url = @sourceUrl AND http_status BETWEEN 200 AND 299
       ORDER BY fetched_at DESC LIMIT 1`,
      { competitionId: result.competitionId, sourceUrl: result.sourceUrl },
    );
    const reviewStatus = result.errorMessage
      ? 'fetch_failed'
      : previous?.content_hash === result.contentHash
        ? 'unchanged'
        : 'pending_review';
    helpers.run(
      `INSERT INTO competition_source_snapshots (
         id, competition_id, source_url, source_kind, fetched_at, http_status, content_hash,
         content_length, extracted_json, previous_hash, review_status, error_message, created_at
       ) VALUES (
         @id, @competitionId, @sourceUrl, @sourceKind, @fetchedAt, @httpStatus, @contentHash,
         @contentLength, @extractedJson, @previousHash, @reviewStatus, @errorMessage, @createdAt
       )`,
      {
        id: `source_${randomUUID().replace(/-/g, '').slice(0, 20)}`,
        competitionId: result.competitionId,
        sourceUrl: result.sourceUrl,
        sourceKind: result.sourceKind,
        fetchedAt: result.fetchedAt,
        httpStatus: result.httpStatus,
        contentHash: result.contentHash,
        contentLength: result.contentLength,
        extractedJson: JSON.stringify({ ...result.extracted, finalUrl: result.finalUrl }),
        previousHash: previous?.content_hash || null,
        reviewStatus,
        errorMessage: result.errorMessage || null,
        createdAt: result.fetchedAt,
      },
    );
  }
}

console.log(JSON.stringify({
  mode: shouldApply ? 'snapshot_written' : 'dry_run',
  sourceCount: results.length,
  ok: results.filter((item) => !item.errorMessage).length,
  failed: results.filter((item) => item.errorMessage).map((item) => ({ id: item.competitionId, error: item.errorMessage })),
  results: results.map((item) => ({
    id: item.competitionId,
    status: item.httpStatus,
    bytes: item.contentLength,
    hash: item.contentHash.slice(0, 12),
    keywordsMatched: item.extracted.keywordsMatched,
    editions: item.extracted.editions.slice(0, 4),
    dates: item.extracted.dates.slice(0, 6),
  })),
}, null, 2));

process.exit(0);

// ============================================================
// エントリーポイント / オーケストレーター
// 全フェーズを順番に実行する
// ============================================================

import 'dotenv/config';
import {
  fetchAllSources,
  filterByDate,
  deduplicateArticles,
  prioritizeArticles,
  markArticlesAsSeen,
} from './fetcher';
import { summarizeArticles, buildExecutiveSummary } from './summarizer';
import { createDailyReport } from './docWriter';
import { getOrCreateDailyFolder } from './driveManager';
import { logExecution } from './logger';
import { CONFIG } from './config';
import { RunStats } from './types';

async function main(): Promise<void> {
  const startTime = Date.now();
  const errors: string[] = [];

  // 日付は JST で取得（GitHub Actions は UTC で動くため明示的に変換）
  const dateStr = new Intl.DateTimeFormat('sv-SE', {
    timeZone: 'Asia/Tokyo',
  }).format(new Date()); // → YYYY-MM-DD

  console.log('='.repeat(60));
  console.log(`Daily Music Digest - ${dateStr}`);
  console.log('='.repeat(60));

  // ---- Phase 1: RSS フェッチ ----
  console.log('\n[Phase 1] Fetching RSS feeds...');
  let rawArticles;
  try {
    rawArticles = await fetchAllSources();
  } catch (e) {
    const msg = `Fatal: RSS fetch failed: ${e}`;
    console.error(msg);
    throw new Error(msg);
  }

  // ---- Phase 2: フィルタ・重複排除・優先度ソート ----
  console.log('\n[Phase 2] Filtering and deduplicating...');
  const recentArticles = filterByDate(rawArticles, CONFIG.hoursLookback);
  const newArticles = deduplicateArticles(recentArticles);
  const topArticles = prioritizeArticles(newArticles, CONFIG.maxArticlesPerRun);

  if (topArticles.length === 0) {
    console.warn('[main] No new articles found after filtering. Skipping report generation.');
    // 空レポートは生成しない（正常終了）
    return;
  }

  console.log(`[main] Processing ${topArticles.length} articles`);

  // ---- Phase 3: LLM 要約 ----
  console.log('\n[Phase 3] Summarizing articles with Claude...');
  let summaries;
  try {
    summaries = await summarizeArticles(topArticles);
  } catch (e) {
    const msg = `Summarization failed: ${e}`;
    console.error(msg);
    errors.push(msg);
    throw new Error(msg);
  }

  let executiveSummary;
  try {
    executiveSummary = await buildExecutiveSummary(summaries);
  } catch (e) {
    const msg = `Executive summary failed: ${e}`;
    console.error(msg);
    errors.push(msg);
    // フォールバック：空のサマリーで続行
    executiveSummary = {
      executive_summary: `${dateStr} の音楽業界レポートです。`,
      top_topics: summaries.slice(0, 5).map((s) => ({
        topic: s.title,
        significance: s.signals,
      })),
      signals_and_insights: [],
    };
  }

  // ---- Phase 4: Google Doc 生成 ----
  console.log('\n[Phase 4] Creating Google Doc...');
  let docUrl = '';
  try {
    const folderId = await getOrCreateDailyFolder(dateStr);
    const result = await createDailyReport(dateStr, folderId, executiveSummary, summaries);
    docUrl = result.docUrl;
    console.log(`[main] Doc URL: ${docUrl}`);
  } catch (e) {
    const msg = `Doc creation failed: ${e}`;
    console.error(msg);
    errors.push(msg);
    throw new Error(msg);
  }

  // ---- Phase 5: 既読 URL を記録 ----
  markArticlesAsSeen(topArticles);

  // ---- Phase 6: 実行ログ ----
  const durationMs = Date.now() - startTime;
  const stats: RunStats = {
    date: dateStr,
    articlesFound: rawArticles.length,
    articlesAfterFilter: topArticles.length,
    articlesSummarized: summaries.length,
    docUrl,
    durationMs,
    errors,
  };

  await logExecution(stats);

  console.log('\n' + '='.repeat(60));
  console.log(`Done! ${(durationMs / 1000).toFixed(1)}s`);
  console.log(`Articles: ${rawArticles.length} fetched → ${topArticles.length} processed → ${summaries.length} summarized`);
  console.log(`Doc: ${docUrl}`);
  if (errors.length > 0) console.warn(`Errors: ${errors.join(', ')}`);
  console.log('='.repeat(60));
}

main().catch((e) => {
  console.error('[main] Fatal error:', e);
  process.exit(1);
});

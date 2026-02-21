import PgBoss from "pg-boss";
import { eq } from "drizzle-orm";
import { db } from "../db/index.js";
import { feeds, syncRecords, connections } from "../db/schema.js";
import { AtomicClient, type CreateAtomParams } from "../services/atomic.js";
import { fetchFeed, formatItemAsMarkdown, type FeedItem } from "../services/rss.js";

export const SYNC_FEED_JOB = "sync-feed";
const SCHEDULE_FEEDS_JOB = "schedule-feeds";

export async function setupWorkers(boss: PgBoss) {
  // Create queues before registering workers/schedules
  await boss.createQueue(SYNC_FEED_JOB);
  await boss.createQueue(SCHEDULE_FEEDS_JOB);

  // Worker: sync a single feed
  await boss.work<{ feedId: string }>(SYNC_FEED_JOB, async (jobs) => {
    for (const job of jobs) {
      await syncFeed(job.data.feedId);
    }
  });

  // Scheduler: runs every minute, enqueues sync jobs for feeds that are due
  await boss.schedule(SCHEDULE_FEEDS_JOB, "* * * * *");
  await boss.work(SCHEDULE_FEEDS_JOB, async () => {
    await scheduleFeeds(boss);
  });
}

async function scheduleFeeds(boss: PgBoss) {
  const dueFeeds = await db
    .select({ id: feeds.id, pollIntervalMinutes: feeds.pollIntervalMinutes, lastSyncedAt: feeds.lastSyncedAt })
    .from(feeds)
    .where(eq(feeds.enabled, true));

  const now = Date.now();

  for (const feed of dueFeeds) {
    const intervalMs = feed.pollIntervalMinutes * 60 * 1000;
    const lastSync = feed.lastSyncedAt ? feed.lastSyncedAt.getTime() : 0;

    if (now - lastSync >= intervalMs) {
      await boss.send(SYNC_FEED_JOB, { feedId: feed.id }, {
        singletonKey: feed.id, // prevent duplicate jobs for the same feed
      });
    }
  }
}

async function syncFeed(feedId: string) {
  // Load feed and its connection
  const [feed] = await db.select().from(feeds).where(eq(feeds.id, feedId));
  if (!feed || !feed.enabled) return;

  const [connection] = await db
    .select()
    .from(connections)
    .where(eq(connections.id, feed.connectionId));
  if (!connection) return;

  const client = new AtomicClient(connection.atomicUrl, connection.accessToken);

  try {
    const parsed = await fetchFeed(feed.url);

    // Update feed title if we didn't have one
    if (!feed.title && parsed.title) {
      await db
        .update(feeds)
        .set({ title: parsed.title })
        .where(eq(feeds.id, feedId));
    }

    // Get already-synced GUIDs for this feed
    const existingRecords = await db
      .select({ guid: syncRecords.guid })
      .from(syncRecords)
      .where(eq(syncRecords.feedId, feedId));

    const existingGuids = new Set(existingRecords.map((r) => r.guid));

    // Filter to new items only
    const newItems = parsed.items.filter((item) => !existingGuids.has(item.guid));

    if (newItems.length === 0) {
      // Nothing new — just update sync timestamp
      await db
        .update(feeds)
        .set({ lastSyncedAt: new Date(), lastError: null, updatedAt: new Date() })
        .where(eq(feeds.id, feedId));
      return;
    }

    // Bulk create atoms — atomic deduplicates by source_url
    const atomParams: CreateAtomParams[] = newItems.map((item) => ({
      content: formatItemAsMarkdown(item),
      sourceUrl: item.link,
      publishedAt: item.pubDate ? new Date(item.pubDate).toISOString() : undefined,
    }));

    const result = await client.createAtomsBulk(atomParams);

    // Record synced items (match created atoms back to items by source_url)
    const createdByUrl = new Map(
      result.atoms.map((a) => [a.source_url, a.id]),
    );

    for (const item of newItems) {
      const atomId = item.link ? createdByUrl.get(item.link) : undefined;
      if (atomId) {
        await db.insert(syncRecords).values({
          feedId,
          guid: item.guid,
          atomId,
          title: item.title,
        });
      }
    }

    // Update feed sync status
    await db
      .update(feeds)
      .set({
        lastSyncedAt: new Date(),
        lastError: null,
        updatedAt: new Date(),
      })
      .where(eq(feeds.id, feedId));
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    await db
      .update(feeds)
      .set({
        lastError: message,
        updatedAt: new Date(),
      })
      .where(eq(feeds.id, feedId));
    throw err; // Let pgboss handle retry
  }
}

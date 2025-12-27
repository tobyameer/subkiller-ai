/**
 * Gmail message fetching module
 * Fetches message IDs using multiple queries for maximum recall
 */

/**
 * Build date query string for Gmail search
 * @param {Date|null} lastScanDate - Last scan date for incremental scanning
 * @param {boolean} isFirstScan - Whether this is the first scan (use 365d window)
 * @returns {string} Date query string
 */
function buildDateQuery(lastScanDate, isFirstScan) {
  if (isFirstScan) {
    // First scan: 365 days
    return "newer_than:365d";
  }
  
  if (lastScanDate) {
    // Incremental: use after: with 1-day overlap
    const afterDate = new Date(lastScanDate);
    afterDate.setDate(afterDate.getDate() - 1); // 1 day overlap
    const afterStr = afterDate.toISOString().split("T")[0].replace(/-/g, "/");
    return `after:${afterStr}`;
  }
  
  // Fallback: last 90 days
  return "newer_than:90d";
}

/**
 * Fetch message IDs from Gmail using multiple queries
 * @param {Object} params
 * @param {Object} params.gmail - Authorized Gmail client
 * @param {number} params.maxMessages - Maximum messages to fetch per query
 * @param {Date|null} params.lastScanDate - Last scan date for incremental scanning
 * @param {string} params.mode - "debug" | "normal" | "fast" | "strict"
 * @returns {Promise<Array>} Array of message objects with id and threadId (deduplicated)
 */
export async function fetchMessageIds({ gmail, maxMessages = 200, lastScanDate = null, mode = "normal" }) {
  const isDebugMode = mode === "debug";
  const isFirstScan = !lastScanDate;
  const dateQuery = buildDateQuery(lastScanDate, isFirstScan);
  
  // eslint-disable-next-line no-console
  console.log("[gmailFetch] Starting multi-query fetch", {
    mode,
    isDebugMode,
    isFirstScan,
    lastScanDate: lastScanDate?.toISOString(),
    dateQuery,
    maxMessages,
  });

  // In debug mode, use no query
  if (isDebugMode) {
    // eslint-disable-next-line no-console
    console.log("[gmailFetch] Debug mode: using empty query");
    return fetchSingleQuery(gmail, "", maxMessages);
  }

  // Build multiple queries for maximum recall
  const queries = [
    // 1) Finance category
    `category:finance ${dateQuery}`,
    
    // 2) General receipt/subscription keywords
    `${dateQuery} (receipt OR invoice OR billed OR charged OR renewal OR subscription OR "Subscription is Confirmed")`,
    
    // 3) Apple subscription emails
    `${dateQuery} from:(no_reply@email.apple.com) (subscription OR confirmed OR receipt)`,
    
    // 4) Google Play subscription emails
    `${dateQuery} from:(googleplay-noreply@google.com) (subscription OR renewal OR receipt)`,
  ];

  // Fetch from all queries in parallel
  const allMessageSets = await Promise.all(
    queries.map((query, idx) => 
      fetchSingleQuery(gmail, query, maxMessages).catch(err => {
        // eslint-disable-next-line no-console
        console.error(`[gmailFetch] Query ${idx + 1} failed`, {
          query,
          error: err.message,
        });
        return []; // Return empty array on error
      })
    )
  );

  // Deduplicate by message ID
  const messageMap = new Map();
  for (const messageSet of allMessageSets) {
    for (const msg of messageSet) {
      if (msg.id && !messageMap.has(msg.id)) {
        messageMap.set(msg.id, msg);
      }
    }
  }

  const allMessages = Array.from(messageMap.values());

  // eslint-disable-next-line no-console
  console.log("[gmailFetch] Multi-query fetch complete", {
    queriesRun: queries.length,
    totalUniqueMessages: allMessages.length,
    messagesPerQuery: allMessageSets.map(set => set.length),
  });

  return allMessages;
}

/**
 * Fetch messages using a single Gmail query
 * @param {Object} gmail - Authorized Gmail client
 * @param {string} query - Gmail search query
 * @param {number} maxMessages - Maximum messages to fetch
 * @returns {Promise<Array>} Array of message objects
 */
async function fetchSingleQuery(gmail, query, maxMessages) {
  let allMessages = [];
  let nextPageToken = null;
  let fetchAttempts = 0;
  const maxFetchAttempts = 10;

  do {
    try {
      const listParams = {
        userId: "me",
        maxResults: Math.min(500, maxMessages - allMessages.length),
        includeSpamTrash: true,
        pageToken: nextPageToken || undefined,
      };

      if (query) {
        listParams.q = query;
      }

      const response = await gmail.users.messages.list(listParams);

      const batchMessages = response.data.messages || [];
      allMessages = allMessages.concat(batchMessages);
      nextPageToken = response.data.nextPageToken || null;
      fetchAttempts++;

      // Stop if we've reached maxMessages or no more pages
      if (allMessages.length >= maxMessages || !nextPageToken) {
        break;
      }
    } catch (err) {
      // eslint-disable-next-line no-console
      console.error("[gmailFetch] messages.list error", {
        query: query || "(empty)",
        error: err.message,
        code: err.code,
        attempt: fetchAttempts + 1,
      });
      throw err;
    }
  } while (
    nextPageToken &&
    allMessages.length < maxMessages &&
    fetchAttempts < maxFetchAttempts
  );

  return allMessages;
}

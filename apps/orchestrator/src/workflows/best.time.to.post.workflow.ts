import { continueAsNew, proxyActivities, sleep, workflowInfo } from '@temporalio/workflow';
import { PostEngagementActivity } from '@gitroom/orchestrator/activities/post.engagement.activity';

// captureEngagementSnapshotBatch processes its candidates sequentially and
// some providers (e.g. LinkedIn - see refreshWait) force a blocking 10s wait
// per token refresh inside checkPostAnalytics, so a full batch (see
// PostEngagementService's batch cap) can legitimately take well over an
// hour. The timeout below is sized for that worst case, not the common case.
const { captureEngagementSnapshotBatch } =
  proxyActivities<PostEngagementActivity>({
    startToCloseTimeout: '2 hours',
    retry: {
      maximumAttempts: 3,
      backoffCoefficient: 1,
      initialInterval: '2 minutes',
    },
  });

// Daily batch job powering "best time to post" suggestions. Each run
// captures at most PostEngagementService's batch cap worth of post
// analytics (bounded, see captureBatch) instead of calling providers live
// per request. New workflow (no running history on main to preserve), so no
// `patched()` compatibility gate is needed like missingPostWorkflow has.
export async function bestTimeToPostWorkflow() {
  let loops = 0;
  await captureEngagementSnapshotBatch();
  while (true) {
    await sleep('24 hours');

    // Keep the history small; continueAsNew runs the batch immediately on
    // restart so the daily cadence is kept.
    if (++loops >= 14 || workflowInfo().historyLength > 1000) {
      return await continueAsNew<typeof bestTimeToPostWorkflow>();
    }

    await captureEngagementSnapshotBatch();
  }
}

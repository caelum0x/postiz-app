import { continueAsNew, proxyActivities, sleep, workflowInfo } from '@temporalio/workflow';
import { EvergreenActivity } from '@gitroom/orchestrator/activities/evergreen.activity';

// recycleDueBatch creates at most BATCH_CAP new posts per call (see
// EvergreenService), each going through the same publish-workflow start as
// a normal create - sized generously, not for the common case.
const { recycleDueBatch } = proxyActivities<EvergreenActivity>({
  startToCloseTimeout: '30 minutes',
  retry: {
    maximumAttempts: 3,
    backoffCoefficient: 1,
    initialInterval: '2 minutes',
  },
});

// Daily batch job powering evergreen content recycling (Organization ->
// EvergreenRecycle). Modeled on bestTimeToPostWorkflow's infinite-loop
// pattern. New workflow (no running history on main to preserve), so no
// `patched()` compatibility gate is needed.
export async function evergreenRecycleWorkflow() {
  let loops = 0;
  await recycleDueBatch();
  while (true) {
    await sleep('24 hours');

    // Keep the history small; continueAsNew runs the batch immediately on
    // restart so the daily cadence is kept.
    if (++loops >= 14 || workflowInfo().historyLength > 1000) {
      return await continueAsNew<typeof evergreenRecycleWorkflow>();
    }

    await recycleDueBatch();
  }
}

'use client';

import React, { useCallback } from 'react';
import { useFetch } from '@gitroom/helpers/utils/custom.fetch';
import useSWR from 'swr';
import { Checkbox } from '@gitroom/react/form/checkbox';
import { useToaster } from '@gitroom/react/toaster/toaster';
import { useT } from '@gitroom/react/translation/get.transation.service.client';

interface ApprovalQueueResponse {
  requireApprovalForQueue: boolean;
}

export const useApprovalQueuePreference = () => {
  const fetch = useFetch();

  const load = useCallback(async () => {
    return (await fetch('/settings/approval-queue')).json();
  }, []);

  return useSWR<ApprovalQueueResponse>('approval-queue-preference', load, {
    revalidateOnFocus: false,
    revalidateOnReconnect: false,
    revalidateIfStale: false,
    revalidateOnMount: true,
    refreshWhenHidden: false,
    refreshWhenOffline: false,
  });
};

// Admin-only toggle for Organization.requireApprovalForQueue: once on, a
// USER-level member's schedule/publish-now save is held as a draft awaiting
// an ADMIN/SUPERADMIN approval instead of going straight to the queue (see
// PostsService#createPost). Rendered only for ADMIN/SUPERADMIN callers by
// TeamsComponent - the backend also enforces this via the ADMIN policy on
// POST /settings/approval-queue, so this is a UX nicety, not the real gate.
const ApprovalQueuePreferenceComponent = () => {
  const t = useT();
  const fetch = useFetch();
  const toaster = useToaster();
  const { data, isLoading, mutate } = useApprovalQueuePreference();

  const toggle = useCallback(async () => {
    const newValue = !data?.requireApprovalForQueue;
    mutate({ requireApprovalForQueue: newValue });

    const response = await fetch('/settings/approval-queue', {
      method: 'POST',
      body: JSON.stringify({ requireApprovalForQueue: newValue }),
    });

    if (!response.ok) {
      mutate({ requireApprovalForQueue: !newValue });
      toaster.show(
        t('could_not_update_setting', 'Could not update this setting'),
        'warning'
      );
      return;
    }

    toaster.show(t('settings_updated', 'Settings updated'), 'success');
  }, [data, fetch, mutate, toaster, t]);

  if (isLoading) {
    return null;
  }

  return (
    <div className="my-[16px] mt-[16px] bg-sixth border-fifth border rounded-[4px] p-[24px] flex flex-col gap-[24px]">
      <div className="flex items-center justify-between gap-[24px]">
        <div className="flex flex-col flex-1">
          <div className="text-[14px]">
            {t('require_approval_for_queue', 'Require approval before posts go live')}
          </div>
          <div className="text-[12px] text-customColor18">
            {t(
              'require_approval_for_queue_description',
              'When on, a schedule or publish-now save by a regular team member is held as a draft until an admin approves it.'
            )}
          </div>
        </div>
        <Checkbox
          name="requireApprovalForQueue"
          disableForm={true}
          checked={!!data?.requireApprovalForQueue}
          onChange={toggle}
        />
      </div>
    </div>
  );
};

export default ApprovalQueuePreferenceComponent;

'use client';

import React, { useCallback } from 'react';
import { useFetch } from '@gitroom/helpers/utils/custom.fetch';
import useSWR from 'swr';
import { Button } from '@gitroom/react/form/button';
import { useToaster } from '@gitroom/react/toaster/toaster';
import { useT } from '@gitroom/react/translation/get.transation.service.client';
import { newDayjs } from '@gitroom/frontend/components/layout/set.timezone';

interface PendingApprovalPost {
  id: string;
  content: string;
  publishDate: string;
  group: string;
  integration: {
    id: string;
    name: string;
    picture: string | null;
    providerIdentifier: string;
  };
  createdBy: { id: string; name: string | null; email: string } | null;
}

// ADMIN/SUPERADMIN-only - every post a USER-level member couldn't queue
// directly because the org has Organization.requireApprovalForQueue on
// (see posts.controller.ts GET /posts/pending-approval). Complements the
// per-post approve/reject actions already on the calendar card itself -
// this is the "don't have to go hunting on the calendar" view.
export const PendingApprovalsComponent = () => {
  const t = useT();
  const fetch = useFetch();
  const toaster = useToaster();

  const load = useCallback(async () => {
    return (await fetch('/posts/pending-approval')).json();
  }, []);

  const { data, mutate, isLoading } = useSWR<PendingApprovalPost[]>(
    'pending-approval-posts',
    load,
    {
      revalidateOnFocus: false,
      revalidateOnReconnect: false,
      revalidateIfStale: false,
    }
  );

  const decide = useCallback(
    (post: PendingApprovalPost, action: 'approve' | 'reject') => async () => {
      const response = await fetch(`/posts/${post.id}/${action}-queue`, {
        method: 'PUT',
      });
      if (!response.ok) {
        toaster.show(
          t(
            'could_not_update_post',
            'Could not update this post - it may have already been handled'
          ),
          'warning'
        );
        mutate();
        return;
      }
      toaster.show(
        action === 'approve'
          ? t('post_approved', 'Post approved and queued')
          : t('post_rejected', 'Post rejected'),
        'success'
      );
      mutate();
    },
    [fetch, mutate, toaster, t]
  );

  if (isLoading || !data?.length) {
    return null;
  }

  return (
    <div className="flex flex-col">
      <h3 className="text-[20px]">
        {t('pending_approvals', 'Pending Approvals')}
      </h3>
      <div className="text-customColor18 mt-[4px]">
        {t(
          'pending_approvals_description',
          'Posts saved by team members while approval is required, waiting for you'
        )}
      </div>
      <div className="my-[16px] mt-[16px] bg-sixth border-fifth border rounded-[4px] p-[24px] flex flex-col gap-[16px]">
        {data.map((post) => (
          <div
            key={post.id}
            className="flex items-center gap-[12px] border-b border-fifth pb-[12px] last:border-0 last:pb-0"
          >
            <div className="flex-1 flex flex-col">
              <div className="text-[12px] text-customColor18">
                {post.createdBy?.name || post.createdBy?.email || t('unknown', 'Unknown')}
                {' · '}
                {newDayjs(post.publishDate).local().format('MMM D, HH:mm')}
                {' · '}
                {post.integration.name}
              </div>
              <div className="text-[14px] line-clamp-2">
                {post.content || t('no_content', 'no content')}
              </div>
            </div>
            <div className="flex gap-[8px]">
              <Button onClick={decide(post, 'approve')}>
                {t('approve', 'Approve')}
              </Button>
              <Button secondary={true} onClick={decide(post, 'reject')}>
                {t('reject', 'Reject')}
              </Button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default PendingApprovalsComponent;

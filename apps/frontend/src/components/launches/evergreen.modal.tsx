import { FC, useCallback, useState } from 'react';
import useSWR from 'swr';
import { useFetch } from '@gitroom/helpers/utils/custom.fetch';
import { useT } from '@gitroom/react/translation/get.transation.service.client';
import { useToaster } from '@gitroom/react/toaster/toaster';
import { Button } from '@gitroom/react/form/button';
import { Input } from '@gitroom/react/form/input';
import { LoadingComponent } from '@gitroom/frontend/components/layout/loading';
import dayjs from 'dayjs';

interface EvergreenRecycle {
  id: string;
  active: boolean;
  intervalDays: number;
  maxRecycles: number | null;
  totalRecycles: number;
  lastRecycledAt: string | null;
  nextRecycleAt: string;
}

// Content recycling for an already-published post (Organization ->
// EvergreenRecycle, see schema.prisma). The actual republishing happens in
// the daily evergreenRecycleWorkflow batch, not from this modal - this is
// just schedule management (create/pause/resume/remove).
export const EvergreenModal: FC<{ postId: string }> = ({ postId }) => {
  const t = useT();
  const fetch = useFetch();
  const toast = useToaster();
  const [intervalDays, setIntervalDays] = useState('30');
  const [maxRecycles, setMaxRecycles] = useState('');
  const [loading, setLoading] = useState(false);

  const load = useCallback(async () => {
    return (await fetch(`/posts/${postId}/evergreen`)).json();
  }, [postId]);

  const { data, isLoading, mutate } = useSWR<EvergreenRecycle[]>(
    `/posts/${postId}/evergreen`,
    load
  );

  const create = useCallback(async () => {
    const days = Number(intervalDays);
    if (!days || days < 1) {
      toast.show(
        t('evergreen_invalid_interval', 'Enter how many days between recycles'),
        'warning'
      );
      return;
    }

    setLoading(true);
    try {
      const response = await fetch(`/posts/${postId}/evergreen`, {
        method: 'POST',
        body: JSON.stringify({
          intervalDays: days,
          ...(maxRecycles ? { maxRecycles: Number(maxRecycles) } : {}),
        }),
      });
      if (!response.ok) {
        const body = await response.json().catch(() => ({}));
        toast.show(
          body?.message ||
            t('evergreen_create_failed', 'Could not enable recycling'),
          'warning'
        );
        return;
      }
      toast.show(
        t('evergreen_created', 'This post will be recycled automatically'),
        'success'
      );
      await mutate();
    } finally {
      setLoading(false);
    }
  }, [intervalDays, maxRecycles, postId, mutate]);

  const toggleActive = useCallback(
    (entry: EvergreenRecycle) => async () => {
      await fetch(`/posts/evergreen/${entry.id}`, {
        method: 'PUT',
        body: JSON.stringify({ active: !entry.active }),
      });
      mutate();
    },
    [mutate]
  );

  const remove = useCallback(
    (entry: EvergreenRecycle) => async () => {
      await fetch(`/posts/evergreen/${entry.id}`, { method: 'DELETE' });
      mutate();
    },
    [mutate]
  );

  return (
    <div className="flex flex-col gap-[16px]">
      <div className="text-[13px] text-textItemBlur">
        {t(
          'evergreen_hint',
          'Automatically republish this post as a brand-new post every N days, so it keeps reaching new followers without touching the original.'
        )}
      </div>
      {isLoading ? (
        <LoadingComponent />
      ) : (
        <>
          {!!data?.length && (
            <div className="flex flex-col gap-[8px]">
              {data.map((entry) => (
                <div
                  key={entry.id}
                  className="flex items-center justify-between gap-[10px] rounded-[8px] border border-tableBorder p-[10px] text-[13px]"
                >
                  <div className="flex flex-col gap-[2px]">
                    <div>
                      {t('evergreen_every_days', 'Every {{days}} days', {
                        days: entry.intervalDays,
                      })}
                      {entry.maxRecycles
                        ? ` · ${t('evergreen_max', 'max {{max}}', {
                            max: entry.maxRecycles,
                          })}`
                        : ''}
                    </div>
                    <div className="text-[11px] text-textItemBlur">
                      {t('evergreen_recycled_count', '{{count}} recycled', {
                        count: entry.totalRecycles,
                      })}
                      {entry.active
                        ? ` · ${t('evergreen_next', 'next')} ${dayjs(
                            entry.nextRecycleAt
                          ).format('MMM D, YYYY')}`
                        : ` · ${t('paused', 'Paused')}`}
                    </div>
                  </div>
                  <div className="flex gap-[10px]">
                    <button
                      type="button"
                      className="text-[12px] hover:underline"
                      onClick={toggleActive(entry)}
                    >
                      {entry.active
                        ? t('pause', 'Pause')
                        : t('resume', 'Resume')}
                    </button>
                    <button
                      type="button"
                      className="text-[12px] hover:underline"
                      onClick={remove(entry)}
                    >
                      {t('remove', 'Remove')}
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
          <div className="flex items-end gap-[10px]">
            <div className="flex-1">
              <Input
                label={t('evergreen_interval_label', 'Days between recycles')}
                name="intervalDays"
                disableForm={true}
                value={intervalDays}
                onChange={(e: { target: { value: string } }) =>
                  setIntervalDays(e.target.value)
                }
              />
            </div>
            <div className="flex-1">
              <Input
                label={t('evergreen_max_label', 'Max recycles (optional)')}
                name="maxRecycles"
                disableForm={true}
                value={maxRecycles}
                onChange={(e: { target: { value: string } }) =>
                  setMaxRecycles(e.target.value)
                }
              />
            </div>
            <Button loading={loading} onClick={create}>
              {t('evergreen_add', 'Add schedule')}
            </Button>
          </div>
        </>
      )}
    </div>
  );
};

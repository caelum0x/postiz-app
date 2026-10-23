'use client';

import React, { FC, useCallback, useState } from 'react';
import useSWR from 'swr';
import { useFetch } from '@gitroom/helpers/utils/custom.fetch';
import { Button } from '@gitroom/react/form/button';
import { useToaster } from '@gitroom/react/toaster/toaster';
import { useT } from '@gitroom/react/translation/get.transation.service.client';

const DELIVERIES_PAGE_SIZE = 25;

interface Delivery {
  id: string;
  event: string;
  postId: string | null;
  url: string;
  statusCode: number | null;
  success: boolean;
  attempts: number;
  error: string | null;
  durationMs: number | null;
  createdAt: string;
}

interface DeliveriesResponse {
  total: number;
  deliveries: Delivery[];
}

const useDeliveries = (webhookId: string, page: number) => {
  const fetch = useFetch();
  const load = useCallback(async () => {
    return (
      await fetch(`/webhooks/${webhookId}/deliveries?page=${page}`)
    ).json();
  }, [webhookId, page]);
  return useSWR<DeliveriesResponse>(
    `webhooks-deliveries-${webhookId}-${page}`,
    load
  );
};

const statusLabel = (
  delivery: Delivery,
  t: (key: string, fallback: string) => string
) => {
  if (delivery.success) {
    return t('delivered', 'Delivered');
  }
  return t('failed', 'Failed');
};

export const WebhookDeliveries: FC<{ webhookId: string; name: string }> = ({
  webhookId,
  name,
}) => {
  const t = useT();
  const toaster = useToaster();
  const [page, setPage] = useState(1);
  const { data, isLoading, mutate } = useDeliveries(webhookId, page);
  const fetch = useFetch();

  const redeliver = useCallback(
    (deliveryId: string) => async () => {
      const result = await (
        await fetch(`/webhooks/deliveries/${deliveryId}/redeliver`, {
          method: 'POST',
        })
      ).json();
      if (result?.success) {
        toaster.show(t('delivery_succeeded', 'Delivery succeeded'), 'success');
      } else {
        toaster.show(
          t('delivery_failed_check_the_log', 'Delivery failed, check the log'),
          'warning'
        );
      }
      mutate();
    },
    [mutate]
  );

  const totalPages = Math.max(
    1,
    Math.ceil((data?.total || 0) / DELIVERIES_PAGE_SIZE)
  );

  return (
    <div className="flex flex-col gap-[12px] min-w-[600px]">
      <div className="text-[14px] opacity-70">
        {t(
          'recent_delivery_attempts_for',
          `Recent delivery attempts for ${name}`,
          { name }
        )}
      </div>
      {!isLoading && !data?.deliveries?.length && (
        <div className="text-customColor18">
          {t('no_deliveries_yet', 'No deliveries yet.')}
        </div>
      )}
      {!!data?.deliveries?.length && (
        <div className="grid grid-cols-[1.2fr,0.8fr,0.6fr,0.6fr,1.6fr,0.8fr] gap-y-[8px] gap-x-[8px] text-[13px]">
          <div className="opacity-60">{t('event', 'Event')}</div>
          <div className="opacity-60">{t('date', 'Date')}</div>
          <div className="opacity-60">{t('status', 'Status')}</div>
          <div className="opacity-60">{t('attempts', 'Attempts')}</div>
          <div className="opacity-60">{t('error', 'Error')}</div>
          <div className="opacity-60">{t('action', 'Action')}</div>
          {data.deliveries.map((delivery) => (
            <React.Fragment key={delivery.id}>
              <div>{delivery.event}</div>
              <div>{new Date(delivery.createdAt).toLocaleString()}</div>
              <div
                className={
                  delivery.success ? 'text-customColor28' : 'text-red-500'
                }
              >
                {statusLabel(delivery, t)}
                {delivery.statusCode ? ` (${delivery.statusCode})` : ''}
              </div>
              <div>{delivery.attempts}</div>
              <div className="break-all opacity-80">
                {delivery.error || '—'}
              </div>
              <div>
                <Button secondary onClick={redeliver(delivery.id)}>
                  {t('redeliver', 'Redeliver')}
                </Button>
              </div>
            </React.Fragment>
          ))}
        </div>
      )}
      <div className="flex items-center justify-between mt-[8px]">
        <div className="text-[13px] opacity-70">
          {t('page_of', `Page ${page} of ${totalPages}`, { page, totalPages })}
        </div>
        <div className="flex gap-[8px]">
          <Button
            secondary
            disabled={page <= 1}
            onClick={() => setPage((p) => Math.max(1, p - 1))}
          >
            {t('previous', 'Previous')}
          </Button>
          <Button
            disabled={page >= totalPages}
            onClick={() => setPage((p) => p + 1)}
          >
            {t('next', 'Next')}
          </Button>
        </div>
      </div>
    </div>
  );
};

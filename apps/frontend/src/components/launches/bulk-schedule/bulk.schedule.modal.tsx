'use client';

import { FC, useCallback, useMemo, useState } from 'react';
import dayjs from 'dayjs';
import clsx from 'clsx';
import useSWR from 'swr';
import { useFetch } from '@gitroom/helpers/utils/custom.fetch';
import { useToaster } from '@gitroom/react/toaster/toaster';
import { useT } from '@gitroom/react/translation/get.transation.service.client';
import { Button } from '@gitroom/react/form/button';
import { Integrations } from '@gitroom/frontend/components/launches/calendar.context';
import { LoadingComponent } from '@gitroom/frontend/components/layout/loading';

// Bulk CSV scheduling only ever had a bare date/content row to work with (no
// media, no per-provider settings), so it only supports the platforms that
// don't need extra settings beyond their identifier. The actual list isn't
// hardcoded here — it's fetched from GET /posts/bulk-schedule/supported-providers,
// which returns the same generic, data-driven simpleTextProviders() the
// backend enforces in bulkSchedule(), so this never drifts out of sync.
const useBulkScheduleSupportedProviders = () => {
  const fetch = useFetch();
  const load = useCallback(async () => {
    return (
      await (await fetch('/posts/bulk-schedule/supported-providers')).json()
    ).providers as string[];
  }, []);
  return useSWR<string[]>('/posts/bulk-schedule/supported-providers', load, {
    revalidateOnFocus: false,
    fallbackData: [],
  });
};

export interface ParsedBulkRow {
  line: number;
  date: string;
  content: string;
  error?: string;
}

// A tiny RFC4180-ish CSV parser: two columns (date, content), quoted fields
// may contain commas/newlines, "" inside a quoted field is a literal quote.
// Good enough for the simple two-column sheet this feature asks for, not a
// general-purpose CSV library.
export const parseBulkScheduleCsv = (csv: string): string[][] => {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = '';
  let inQuotes = false;

  for (let i = 0; i < csv.length; i++) {
    const char = csv[i];
    const next = csv[i + 1];

    if (inQuotes) {
      if (char === '"' && next === '"') {
        field += '"';
        i++;
      } else if (char === '"') {
        inQuotes = false;
      } else {
        field += char;
      }
      continue;
    }

    if (char === '"') {
      inQuotes = true;
    } else if (char === ',') {
      row.push(field);
      field = '';
    } else if (char === '\n' || char === '\r') {
      if (char === '\r' && next === '\n') {
        i++;
      }
      row.push(field);
      field = '';
      rows.push(row);
      row = [];
    } else {
      field += char;
    }
  }

  if (field.length || row.length) {
    row.push(field);
    rows.push(row);
  }

  return rows.filter((r) => r.some((cell) => cell.trim().length));
};

export const rowsToBulkSchedule = (rows: string[][]): ParsedBulkRow[] => {
  const dataRows =
    rows.length &&
    rows[0][0]?.trim().toLowerCase() === 'date' &&
    rows[0][1]?.trim().toLowerCase() === 'content'
      ? rows.slice(1)
      : rows;

  return dataRows.map((cols, index) => {
    const date = (cols[0] || '').trim();
    const content = (cols[1] || '').trim();
    const line = index + 1;

    if (!date || !dayjs(date).isValid()) {
      return { line, date, content, error: 'Invalid or missing date' };
    }
    if (!content) {
      return { line, date, content, error: 'Missing content' };
    }

    return { line, date: dayjs(date).toISOString(), content };
  });
};

interface BulkScheduleResult {
  row: number;
  success: boolean;
  postId?: string;
  error?: string;
}

export const BulkScheduleModal: FC<{
  integrations: Integrations[];
  close: () => void;
  mutate: () => void;
}> = ({ integrations, close, mutate }) => {
  const t = useT();
  const fetch = useFetch();
  const toaster = useToaster();
  const { data: supportedProviders, isLoading: loadingProviders } =
    useBulkScheduleSupportedProviders();
  const [integrationId, setIntegrationId] = useState('');
  const [csvText, setCsvText] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [results, setResults] = useState<BulkScheduleResult[] | null>(null);

  const supportedIntegrations = useMemo(
    () =>
      integrations.filter(
        (integration) =>
          !integration.disabled &&
          (supportedProviders || []).includes(integration.identifier)
      ),
    [integrations, supportedProviders]
  );

  const parsedRows = useMemo(() => {
    if (!csvText.trim()) {
      return [];
    }
    return rowsToBulkSchedule(parseBulkScheduleCsv(csvText));
  }, [csvText]);

  const validRows = useMemo(
    () => parsedRows.filter((row) => !row.error),
    [parsedRows]
  );

  const submit = useCallback(async () => {
    if (!integrationId || !validRows.length) {
      return;
    }

    setSubmitting(true);
    setResults(null);
    try {
      const response = await fetch('/posts/bulk-schedule', {
        method: 'POST',
        body: JSON.stringify({
          integration: { id: integrationId },
          posts: validRows.map((row) => ({
            date: row.date,
            content: row.content,
          })),
        }),
      });

      if (!response.ok) {
        const body = await response.json().catch(() => ({}));
        toaster.show(
          body?.message ||
            t('bulk_schedule_failed', 'Could not schedule these posts'),
          'warning'
        );
        return;
      }

      const data: BulkScheduleResult[] = await response.json();
      setResults(data);
      const succeeded = data.filter((r) => r.success).length;
      if (succeeded) {
        toaster.show(
          t('bulk_schedule_success', '{{count}} posts scheduled', {
            count: succeeded,
          }),
          'success'
        );
        mutate();
      }
    } finally {
      setSubmitting(false);
    }
  }, [integrationId, validRows, mutate]);

  if (loadingProviders) {
    return <LoadingComponent />;
  }

  return (
    <div className="flex flex-col gap-[16px] min-w-[560px] max-w-[640px]">
      <div className="text-[13px] text-textItemBlur">
        {t(
          'bulk_schedule_hint',
          'Paste a CSV with "date" and "content" columns (one post per row) to schedule many posts at once. Only works for channels that don\'t need extra settings: {{providers}}.',
          { providers: (supportedProviders || []).join(', ') }
        )}
      </div>

      <div className="flex flex-col gap-[6px]">
        <div className="text-[13px] font-[600]">
          {t('bulk_schedule_channel', 'Channel')}
        </div>
        {supportedIntegrations.length === 0 ? (
          <div className="text-[13px] text-red-400">
            {t(
              'bulk_schedule_no_channels',
              'Connect one of these channels first: {{providers}}.',
              { providers: (supportedProviders || []).join(', ') }
            )}
          </div>
        ) : (
          <div className="flex flex-col gap-[6px]">
            {supportedIntegrations.map((integration) => (
              <div
                key={integration.id}
                onClick={() => setIntegrationId(integration.id)}
                className={clsx(
                  'flex items-center gap-[10px] p-[10px] rounded-[8px] border cursor-pointer transition-all',
                  integrationId === integration.id
                    ? 'border-forth bg-forth/10'
                    : 'border-tableBorder hover:border-textColor/30'
                )}
              >
                <img
                  src={integration.picture || '/no-picture.jpg'}
                  className="w-[24px] h-[24px] rounded-[6px]"
                  alt={integration.name}
                />
                <div className="text-[13px]">{integration.name}</div>
              </div>
            ))}
          </div>
        )}
      </div>

      <textarea
        className="w-full h-[180px] p-[12px] rounded-[8px] bg-input border border-tableBorder text-textColor font-mono text-[13px] resize-y"
        placeholder={
          'date,content\n2026-11-01 09:00,First post\n2026-11-02 09:00,Second post'
        }
        value={csvText}
        onChange={(e) => setCsvText(e.target.value)}
      />

      {!!parsedRows.length && (
        <div className="flex flex-col gap-[4px] max-h-[160px] overflow-y-auto text-[12px]">
          {parsedRows.map((row) => (
            <div
              key={row.line}
              className={clsx(
                'flex gap-[8px]',
                row.error ? 'text-red-400' : 'text-textItemBlur'
              )}
            >
              <div className="w-[16px]">{row.line}.</div>
              <div className="flex-1 truncate">
                {row.error || `${row.date} — ${row.content}`}
              </div>
            </div>
          ))}
        </div>
      )}

      {!!results && (
        <div className="flex flex-col gap-[4px] max-h-[160px] overflow-y-auto text-[12px]">
          {results.map((r) => (
            <div
              key={r.row}
              className={r.success ? 'text-green-400' : 'text-red-400'}
            >
              {t('row', 'Row')} {r.row + 1}:{' '}
              {r.success
                ? t('scheduled', 'Scheduled')
                : r.error || t('failed', 'Failed')}
            </div>
          ))}
        </div>
      )}

      <div className="flex justify-end gap-[10px]">
        <Button type="button" secondary={true} onClick={close}>
          {t('cancel', 'Cancel')}
        </Button>
        <Button
          onClick={submit}
          loading={submitting}
          disabled={!integrationId || !validRows.length}
        >
          {t('bulk_schedule_submit', 'Schedule {{count}} posts', {
            count: validRows.length,
          })}
        </Button>
      </div>
    </div>
  );
};

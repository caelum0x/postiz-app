'use client';

import React, { FC, useCallback, useMemo, useState } from 'react';
import { Integrations } from '@gitroom/frontend/components/launches/calendar.context';
import dayjs from 'dayjs';
import { deleteDialog } from '@gitroom/react/helpers/delete.dialog';
import { Select } from '@gitroom/react/form/select';
import { Button } from '@gitroom/react/form/button';
import utc from 'dayjs/plugin/utc';
import timezone from 'dayjs/plugin/timezone';
import { useFetch } from '@gitroom/helpers/utils/custom.fetch';
import useSWR from 'swr';
// @ts-ignore
import useKeypress from 'react-use-keypress';
import { useModals } from '@gitroom/frontend/components/layout/new-modal';
import { sortBy } from 'lodash';
import { usePreventWindowUnload } from '@gitroom/react/helpers/use.prevent.window.unload';
import { useT } from '@gitroom/react/translation/get.transation.service.client';
import { newDayjs } from '@gitroom/frontend/components/layout/set.timezone';
import clsx from 'clsx';
import {
  TrashIcon,
  PlusIcon,
  DelayIcon,
} from '@gitroom/frontend/components/ui/icons';

dayjs.extend(utc);
dayjs.extend(timezone);

const hours = [...Array(24).keys()].map((i) => ({
  value: i,
}));

const minutes = [...Array(60).keys()].map((i) => ({
  value: i,
}));

export interface BestTimeSuggestion {
  dayOfWeek: number;
  hourOfDay: number;
  avgEngagement: number;
  sampleSize: number;
}

interface BestTimesResponse {
  hasData: boolean;
  suggestions: BestTimeSuggestion[];
}

// Separate hook per SWR call, per project convention (rules-of-hooks).
// Reads only the pre-aggregated /analytics/best-time endpoint - no live
// provider calls happen on render, the data is populated by a bounded daily
// batch job on the backend.
const useBestTimeSuggestions = (integrationId: string) => {
  const fetch = useFetch();
  const load = useCallback(async () => {
    const response = await fetch(`/analytics/best-time/${integrationId}`);
    return (await response.json()) as BestTimesResponse;
  }, [integrationId]);

  return useSWR<BestTimesResponse>(`best-time-${integrationId}`, load, {
    revalidateOnFocus: false,
    revalidateOnReconnect: false,
    fallbackData: { hasData: false, suggestions: [] },
  });
};

export const TimeTable: FC<{
  integration: Integrations;
  mutate: () => void;
}> = (props) => {
  const t = useT();
  const {
    integration: { time },
    mutate,
  } = props;
  const [currentTimes, setCurrentTimes] = useState([...time]);
  const [hour, setHour] = useState(0);
  const [minute, setMinute] = useState(0);
  const fetch = useFetch();
  const modal = useModals();
  usePreventWindowUnload(true);

  const askClose = useCallback(async () => {
    if (
      !(await deleteDialog(
        t(
          'are_you_sure_you_want_to_close_the_window',
          'Are you sure you want to close the window?'
        ),
        t('yes_close', 'Yes, close')
      ))
    ) {
      return;
    }
    modal.closeAll();
  }, []);

  useKeypress('Escape', askClose);

  const removeSlot = useCallback(
    (index: number) => async () => {
      if (
        !(await deleteDialog(
          t(
            'are_you_sure_you_want_to_delete_this_slot',
            'Are you sure you want to delete this slot?'
          )
        ))
      ) {
        return;
      }
      setCurrentTimes((prev) => prev.filter((_, i) => i !== index));
    },
    []
  );

  const addHour = useCallback(() => {
    const calculateMinutes =
      newDayjs()
        .utc()
        .startOf('day')
        .add(hour, 'hours')
        .add(minute, 'minutes')
        .diff(newDayjs().utc().startOf('day'), 'minutes') -
      dayjs.tz().utcOffset();
    setCurrentTimes((prev) => [
      ...prev,
      {
        time: calculateMinutes,
      },
    ]);
  }, [hour, minute]);

  const times = useMemo(() => {
    return sortBy(
      currentTimes.map(({ time }) => ({
        value: time,
        formatted: dayjs
          .utc()
          .startOf('day')
          .add(time, 'minutes')
          .local()
          .format('HH:mm'),
      })),
      (p) => p.value
    );
  }, [currentTimes]);

  const { data: bestTimes, isLoading: bestTimesLoading } =
    useBestTimeSuggestions(props.integration.id);

  const dayLabels = useMemo(
    () => [
      t('sunday_short', 'Sun'),
      t('monday_short', 'Mon'),
      t('tuesday_short', 'Tue'),
      t('wednesday_short', 'Wed'),
      t('thursday_short', 'Thu'),
      t('friday_short', 'Fri'),
      t('saturday_short', 'Sat'),
    ],
    [t]
  );

  const addSuggestedTime = useCallback(
    (hourOfDay: number) => () => {
      // Suggestions are computed in UTC (see PostEngagementService), and the
      // stored `time` field is already "minutes since UTC midnight" - same
      // unit the display formatter above assumes - so no offset math here.
      const value = hourOfDay * 60;
      setCurrentTimes((prev) =>
        prev.some((p) => p.time === value) ? prev : [...prev, { time: value }]
      );
    },
    []
  );

  const save = useCallback(async () => {
    await fetch(`/integrations/${props.integration.id}/time`, {
      method: 'POST',
      body: JSON.stringify({
        time: currentTimes,
      }),
    });
    mutate();
    modal.closeAll();
  }, [currentTimes]);

  return (
    <div className="relative w-full max-w-[400px] mx-auto">
      {/* Suggested Best Times Section */}
      <div className="bg-newBgColorInner rounded-[12px] p-[20px] border border-newTableBorder mb-[20px]">
        <div className="text-[15px] font-semibold mb-[8px] flex items-center gap-[8px]">
          <DelayIcon size={18} className="text-[#612BD3]" />
          {t('suggested_best_times', 'Suggested Best Times')}
        </div>
        <div className="text-[12px] text-newTextColor/50 mb-[12px]">
          {t(
            'suggested_best_times_description',
            'Based on how your own past posts on this channel performed, grouped by day and hour (UTC).'
          )}
        </div>

        {bestTimesLoading ? (
          <div className="text-center py-[16px] text-newTextColor/40 text-[13px]">
            {t('loading', 'Loading...')}
          </div>
        ) : !bestTimes?.hasData ? (
          <div className="text-center py-[16px] px-[12px] text-newTextColor/40 text-[13px] border border-dashed border-newTableBorder rounded-[8px]">
            {t(
              'not_enough_post_history_yet',
              "Not enough published post history yet. Keep posting - we'll surface your best times once we have enough data."
            )}
          </div>
        ) : (
          <div className="flex flex-col gap-[8px]">
            {bestTimes.suggestions.map((suggestion) => (
              <div
                key={`${suggestion.dayOfWeek}-${suggestion.hourOfDay}`}
                className="flex items-center justify-between h-[44px] px-[14px] rounded-[8px] bg-newBgColorInner border border-newTableBorder"
              >
                <div className="flex items-center gap-[10px]">
                  <div className="w-[8px] h-[8px] rounded-full bg-[#32d583]" />
                  <span className="text-[14px] font-medium">
                    {dayLabels[suggestion.dayOfWeek]}{' '}
                    {suggestion.hourOfDay.toString().padStart(2, '0')}:00 UTC
                  </span>
                  <span className="text-[12px] text-newTextColor/40">
                    {t('based_on_n_posts', 'based on {{count}} posts', {
                      count: suggestion.sampleSize,
                    })}
                  </span>
                </div>
                <button
                  type="button"
                  onClick={addSuggestedTime(suggestion.hourOfDay)}
                  className="h-[32px] px-[12px] bg-[#612BD3]/10 hover:bg-[#612BD3]/20 transition-colors rounded-[6px] flex items-center gap-[6px] text-[#612BD3] text-[13px] font-medium"
                >
                  <PlusIcon size={12} />
                  {t('add', 'Add')}
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Add Time Slot Section */}
      <div className="bg-newBgColorInner rounded-[12px] p-[20px] border border-newTableBorder">
        <div className="text-[15px] font-semibold mb-[16px] flex items-center gap-[8px]">
          <DelayIcon size={18} className="text-[#612BD3]" />
          {t('add_time_slot', 'Add Time Slot')}
        </div>

        <div className="flex gap-[12px] items-end">
          <div className="flex-1">
            <Select
              label={t('hour', 'Hour')}
              name="hour"
              disableForm={true}
              hideErrors={true}
              value={hour}
              onChange={(e) => setHour(Number(e.target.value))}
            >
              {hours.map((h) => (
                <option key={h.value} value={h.value}>
                  {h.value.toString().padStart(2, '0')}
                </option>
              ))}
            </Select>
          </div>
          <div className="flex-1">
            <Select
              label={t('minutes', 'Minutes')}
              name="minutes"
              disableForm={true}
              hideErrors={true}
              value={minute}
              onChange={(e) => setMinute(Number(e.target.value))}
            >
              {minutes.map((m) => (
                <option key={m.value} value={m.value}>
                  {m.value.toString().padStart(2, '0')}
                </option>
              ))}
            </Select>
          </div>
          <button
            type="button"
            onClick={addHour}
            className="h-[42px] px-[16px] bg-[#612BD3] hover:bg-[#7640e0] transition-colors rounded-[8px] flex items-center gap-[6px] text-white text-[14px] font-medium"
          >
            <PlusIcon size={14} />
            {t('add', 'Add')}
          </button>
        </div>
      </div>

      {/* Time Slots List */}
      <div className="mt-[20px]">
        <div className="text-[14px] text-newTextColor/60 mb-[12px]">
          {t('scheduled_times', 'Scheduled Times')} ({times.length})
        </div>

        {times.length === 0 ? (
          <div className="text-center py-[32px] text-newTextColor/40 text-[14px] border border-dashed border-newTableBorder rounded-[12px]">
            {t('no_time_slots', 'No time slots added yet')}
          </div>
        ) : (
          <div className="flex flex-col gap-[8px]">
            {times.map((timeSlot, index) => (
              <div
                key={`${timeSlot.value}-${index}`}
                className={clsx(
                  'group flex items-center justify-between',
                  'h-[48px] px-[16px] rounded-[8px]',
                  'bg-newBgColorInner border border-newTableBorder',
                  'hover:border-[#612BD3]/40 transition-colors'
                )}
              >
                <div className="flex items-center gap-[12px]">
                  <div className="w-[8px] h-[8px] rounded-full bg-[#612BD3]" />
                  <span className="text-[15px] font-medium tabular-nums">
                    {timeSlot.formatted}
                  </span>
                </div>
                <button
                  type="button"
                  onClick={removeSlot(index)}
                  className="opacity-0 group-hover:opacity-100 transition-opacity p-[8px] hover:bg-red-500/10 rounded-[6px] text-red-400 hover:text-red-500"
                >
                  <TrashIcon size={16} />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Save Button */}
      <div className="mt-[24px]">
        <Button type="button" className="w-full rounded-[8px]" onClick={save}>
          {t('save_changes', 'Save Changes')}
        </Button>
      </div>
    </div>
  );
};

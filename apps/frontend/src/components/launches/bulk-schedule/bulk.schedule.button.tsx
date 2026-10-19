'use client';

import { useCallback } from 'react';
import { useModals } from '@gitroom/frontend/components/layout/new-modal';
import { useT } from '@gitroom/react/translation/get.transation.service.client';
import { useCalendar } from '@gitroom/frontend/components/launches/calendar.context';
import { BulkScheduleModal } from '@gitroom/frontend/components/launches/bulk-schedule/bulk.schedule.modal';

export const BulkScheduleButton = () => {
  const t = useT();
  const modal = useModals();
  const { integrations, reloadCalendarView } = useCalendar();

  const open = useCallback(() => {
    modal.openModal({
      title: t('bulk_schedule_title', 'Bulk schedule from CSV'),
      withCloseButton: true,
      classNames: {
        modal: 'text-textColor',
      },
      children: (close: () => void) => (
        <BulkScheduleModal
          integrations={integrations}
          close={close}
          mutate={reloadCalendarView}
        />
      ),
    });
  }, [integrations]);

  return (
    <div
      className="h-[44px] w-[44px] group-[.sidebar]:w-full bg-btnSimple text-btnText justify-center items-center flex rounded-[8px] cursor-pointer"
      onClick={open}
      data-tooltip-id="tooltip"
      data-tooltip-content={t('bulk_schedule_title', 'Bulk schedule from CSV')}
    >
      <svg
        xmlns="http://www.w3.org/2000/svg"
        width="20"
        height="20"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth={1.8}
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
        <path d="M14 2v6h6" />
        <path d="M9 15h6M9 11h6M9 19h3" />
      </svg>
    </div>
  );
};

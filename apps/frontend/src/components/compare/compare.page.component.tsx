import Link from 'next/link';
import type { CompareCompetitor } from '@gitroom/frontend/components/compare/compare.data';

const CheckIcon = () => (
  <svg
    width="16"
    height="16"
    viewBox="0 0 16 16"
    fill="none"
    aria-hidden="true"
    className="shrink-0"
  >
    <path
      d="M13.5 4.5L6 12L2.5 8.5"
      stroke="currentColor"
      strokeWidth="1.75"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </svg>
);

const CrossIcon = () => (
  <svg
    width="16"
    height="16"
    viewBox="0 0 16 16"
    fill="none"
    aria-hidden="true"
    className="shrink-0"
  >
    <path
      d="M3.5 3.5L12.5 12.5M12.5 3.5L3.5 12.5"
      stroke="currentColor"
      strokeWidth="1.75"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </svg>
);

const ChecklistMark = ({ value }: { value: boolean }) => (
  <span
    className={value ? 'text-customColor28' : 'text-customColor18'}
    aria-label={value ? 'Yes' : 'No'}
  >
    {value ? <CheckIcon /> : <CrossIcon />}
  </span>
);

interface CompareLandingPageProps {
  data: CompareCompetitor;
  brandName: string;
}

export const CompareLandingPage = ({ data, brandName }: CompareLandingPageProps) => {
  return (
    <div className="bg-newBgColor min-h-screen text-newTextColor">
      <header className="border-b border-newBorder px-[24px] py-[20px] flex items-center justify-between max-w-[1040px] mx-auto">
        <Link href="/" className="text-[18px] font-semibold tracking-tight">
          {brandName}
        </Link>
        <Link
          href="/auth"
          className="bg-btnPrimary text-btnText px-[18px] h-[38px] rounded-[6px] flex items-center justify-center text-[14px] font-medium"
        >
          Start free
        </Link>
      </header>

      <main className="max-w-[1040px] mx-auto px-[24px] py-[56px] flex flex-col gap-[64px]">
        {/* Hero */}
        <section className="flex flex-col gap-[16px] text-center max-w-[760px] mx-auto">
          <h1 className="text-[40px] leading-[1.1] font-semibold tracking-tight">
            {data.headline}
          </h1>
          <p className="text-[20px] opacity-80">{data.subheadline}</p>
          <p className="text-[15px] opacity-60 leading-[1.6]">{data.summary}</p>
          <div className="flex items-center justify-center gap-[12px] mt-[8px]">
            <Link
              href="/auth"
              className="bg-btnPrimary text-btnText px-[24px] h-[44px] rounded-[6px] flex items-center justify-center text-[15px] font-medium"
            >
              Try Postiz free
            </Link>
            <a
              href={`https://${data.domain}`}
              target="_blank"
              rel="nofollow noopener noreferrer"
              className="bg-btnSimple text-btnText px-[24px] h-[44px] rounded-[6px] flex items-center justify-center text-[15px] font-medium"
            >
              Visit {data.name} ↗
            </a>
          </div>
        </section>

        {/* Structural moat checklist */}
        <section className="flex flex-col gap-[20px]">
          <h2 className="text-[24px] font-semibold text-center">
            What {data.name} structurally can&apos;t match
          </h2>
          <div className="border border-newBorder rounded-[8px] overflow-hidden">
            <div className="grid grid-cols-[1fr,120px,120px] bg-newBgColorInner text-[13px] opacity-60 px-[20px] py-[12px]">
              <div>Capability</div>
              <div className="text-center">Postiz</div>
              <div className="text-center">{data.name}</div>
            </div>
            {data.structuralChecklist.map((row, index) => (
              <div
                key={row.label}
                className={`grid grid-cols-[1fr,120px,120px] px-[20px] py-[14px] text-[14px] ${
                  index % 2 === 1 ? 'bg-newBgColorInner' : ''
                }`}
              >
                <div>{row.label}</div>
                <div className="flex justify-center">
                  <ChecklistMark value={row.postiz} />
                </div>
                <div className="flex justify-center">
                  <ChecklistMark value={row.competitor} />
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* Pricing comparison */}
        <section className="flex flex-col gap-[20px]">
          <h2 className="text-[24px] font-semibold text-center">Pricing, side by side</h2>
          <div className="border border-newBorder rounded-[8px] overflow-hidden">
            <div className="grid grid-cols-[1fr,1fr,1fr] bg-newBgColorInner text-[13px] opacity-60 px-[20px] py-[12px]">
              <div></div>
              <div className="text-center font-medium">Postiz</div>
              <div className="text-center font-medium">{data.name}</div>
            </div>
            {data.pricingRows.map((row, index) => (
              <div
                key={row.label}
                className={`grid grid-cols-[1fr,1fr,1fr] px-[20px] py-[14px] text-[14px] gap-[8px] ${
                  index % 2 === 1 ? 'bg-newBgColorInner' : ''
                }`}
              >
                <div className="opacity-70">{row.label}</div>
                <div className="text-center font-medium">{row.postiz}</div>
                <div className="text-center opacity-80">{row.competitor}</div>
              </div>
            ))}
          </div>
          <p className="text-[12px] opacity-50 text-center">
            Pricing checked against {data.domain} and Postiz&apos;s live pricing config as of{' '}
            {data.asOf}. Competitor pricing may change - verify on their site before purchase.
          </p>
        </section>

        {/* Feature checklist */}
        <section className="flex flex-col gap-[20px]">
          <h2 className="text-[24px] font-semibold text-center">Feature checklist</h2>
          <div className="border border-newBorder rounded-[8px] overflow-hidden">
            {data.featureChecklist.map((row, index) => (
              <div
                key={row.label}
                className={`grid grid-cols-[1fr,120px,120px] px-[20px] py-[14px] text-[14px] ${
                  index % 2 === 1 ? 'bg-newBgColorInner' : ''
                }`}
              >
                <div>{row.label}</div>
                <div className="flex justify-center">
                  <ChecklistMark value={row.postiz} />
                </div>
                <div className="flex justify-center">
                  <ChecklistMark value={row.competitor} />
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* Verdict */}
        <section className="flex flex-col gap-[16px] bg-newBgColorInner border border-newBorder rounded-[8px] p-[32px]">
          <h2 className="text-[20px] font-semibold">The verdict</h2>
          <p className="text-[15px] opacity-80 leading-[1.6]">{data.verdict}</p>
        </section>

        {/* FAQ */}
        <section className="flex flex-col gap-[20px]">
          <h2 className="text-[24px] font-semibold text-center">Frequently asked questions</h2>
          <div className="flex flex-col gap-[16px]">
            {data.faq.map((item) => (
              <div
                key={item.question}
                className="border border-newBorder rounded-[8px] p-[20px]"
              >
                <div className="text-[15px] font-medium mb-[8px]">{item.question}</div>
                <div className="text-[14px] opacity-70 leading-[1.6]">{item.answer}</div>
              </div>
            ))}
          </div>
        </section>

        {/* Bottom CTA */}
        <section className="flex flex-col items-center gap-[16px] text-center">
          <h2 className="text-[24px] font-semibold">
            Switch from {data.name} to {brandName}
          </h2>
          <Link
            href="/auth"
            className="bg-btnPrimary text-btnText px-[28px] h-[46px] rounded-[6px] flex items-center justify-center text-[15px] font-medium"
          >
            Start free, no credit card
          </Link>
        </section>
      </main>
    </div>
  );
};

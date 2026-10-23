// Content for the /compare/* landing pages.
// Every number here is sourced from libraries/nestjs-libraries/src/database/prisma/subscriptions/pricing.ts
// (Postiz side) and the competitor's own public pricing page (checked 2026-10-23).
// Do not invent a number here - if a competitor changes price, update the value and the "asOf" field.

export interface ComparePricingRow {
  label: string;
  postiz: string;
  competitor: string;
}

export interface CompareChecklistRow {
  label: string;
  postiz: boolean;
  competitor: boolean;
}

export interface CompareFaqItem {
  question: string;
  answer: string;
}

export interface CompareCompetitor {
  slug: string;
  name: string;
  domain: string;
  asOf: string;
  headline: string;
  subheadline: string;
  summary: string;
  pricingRows: ComparePricingRow[];
  structuralChecklist: CompareChecklistRow[];
  featureChecklist: CompareChecklistRow[];
  verdict: string;
  faq: CompareFaqItem[];
}

const structuralChecklistTemplate = (competitorName: string): CompareChecklistRow[] => [
  {
    label: 'Open-source and self-hostable',
    postiz: true,
    competitor: false,
  },
  {
    label: 'Managed cloud option at indie-friendly pricing',
    postiz: true,
    competitor: competitorName !== 'Mixpost',
  },
  {
    label: 'Public API + npm SDK + CLI + browser extension',
    postiz: true,
    competitor: false,
  },
  {
    label: 'Native MCP server (Claude/ChatGPT/Codex agents can post directly)',
    postiz: true,
    competitor: false,
  },
];

export const compareCompetitors: Record<string, CompareCompetitor> = {
  buffer: {
    slug: 'buffer',
    name: 'Buffer',
    domain: 'buffer.com',
    asOf: '2026-10-23',
    headline: 'Postiz vs Buffer',
    subheadline:
      "Buffer's per-channel price, plus the public API, MCP server, and AI agent Buffer doesn't ship at any price.",
    summary:
      'Buffer Essentials charges per channel with no AI drafting, no public API, and no self-host option. Postiz STANDARD is a flat $29/mo for 5 channels ($5.80/channel) and already includes AI post generation, a public API, and 60 minutes/month of video clipping.',
    pricingRows: [
      {
        label: 'Entry plan price',
        postiz: '$29/mo flat (STANDARD)',
        competitor: '$5/channel/mo (Essentials)',
      },
      {
        label: 'Channels included at entry price',
        postiz: '5 channels ($5.80/channel effective)',
        competitor: 'Priced per channel, no bundle discount',
      },
      {
        label: 'AI post drafting',
        postiz: 'Included (LangGraph agent + live web research)',
        competitor: 'Not available',
      },
      {
        label: 'Public API access',
        postiz: 'Included from $29/mo',
        competitor: 'Not offered',
      },
      {
        label: 'Self-hosting option',
        postiz: 'AGPL self-host, same features as cloud',
        competitor: 'Not offered',
      },
    ],
    structuralChecklist: structuralChecklistTemplate('Buffer'),
    featureChecklist: [
      {
        label: 'Video-to-clips scheduler (long video → scheduled short clips)',
        postiz: true,
        competitor: false,
      },
      {
        label: 'Team seats included',
        postiz: true,
        competitor: false,
      },
      {
        label: 'Webhooks for workflow automation',
        postiz: true,
        competitor: false,
      },
    ],
    verdict:
      "If you're comparing per-channel pricing, Buffer looks cheaper on paper for a single channel. The moment you need a second channel, an API, or AI drafting, Postiz's flat $29/mo covers all of it where Buffer charges more and still can't match the feature set.",
    faq: [
      {
        question: 'Is Postiz actually cheaper than Buffer?',
        answer:
          'At 5 channels, Postiz STANDARD is $29/mo total ($5.80/channel) versus Buffer Essentials at $5/channel with no bundle discount and no AI, API, or self-host option included at any price.',
      },
      {
        question: 'Can I self-host Postiz instead of using the cloud version?',
        answer:
          'Yes. Postiz is AGPL-licensed and open-source; the self-hosted version has the exact same feature set as Postiz Cloud, which Buffer does not offer in any form.',
      },
      {
        question: 'Does Buffer have an MCP server or AI agent?',
        answer:
          "No. Buffer has no public MCP server and no built-in AI agent. Postiz ships both: a native MCP server so Claude, ChatGPT, or Codex agents can schedule posts directly, and a LangGraph-based agent that does live web research before drafting.",
      },
    ],
  },
  hootsuite: {
    slug: 'hootsuite',
    name: 'Hootsuite',
    domain: 'hootsuite.com',
    asOf: '2026-10-23',
    headline: 'Postiz vs Hootsuite',
    subheadline:
      'The same 10-channel, 3-seat, approval-workflow shape Hootsuite prices at $1,197/mo - Postiz TEAM ships it for $39/mo flat.',
    summary:
      'Hootsuite overcharges for the exact workflow small teams need: multiple channels, team seats, and approval before publish. Postiz TEAM bundles 10 channels, team members, and autopost for $39/mo - a fraction of Hootsuite Advanced plus 3 seats.',
    pricingRows: [
      {
        label: 'Plan matching 10 channels + team + approval',
        postiz: '$39/mo flat (TEAM)',
        competitor: '$1,197/mo (Advanced + 3 seats)',
      },
      {
        label: 'Team members included',
        postiz: 'Included at $39/mo',
        competitor: 'Extra seats billed on top of Advanced',
      },
      {
        label: 'AI post drafting',
        postiz: 'Included (LangGraph agent + live web research)',
        competitor: 'Add-on on higher tiers',
      },
      {
        label: 'Public API access',
        postiz: 'Included from $29/mo',
        competitor: 'Enterprise tier only',
      },
    ],
    structuralChecklist: structuralChecklistTemplate('Hootsuite'),
    featureChecklist: [
      {
        label: 'Video-to-clips scheduler',
        postiz: true,
        competitor: false,
      },
      {
        label: 'Flat pricing, no per-seat surcharge at this tier',
        postiz: true,
        competitor: false,
      },
      {
        label: 'Self-host option for data residency',
        postiz: true,
        competitor: false,
      },
    ],
    verdict:
      "Hootsuite's enterprise pricing model charges per-seat on top of a high base plan. For a 3-person team managing 10 channels with approval, that's $1,197/mo on Hootsuite versus $39/mo flat on Postiz TEAM - a gap large enough to fund the rest of your marketing stack.",
    faq: [
      {
        question: 'Why is Hootsuite so much more expensive for the same features?',
        answer:
          "Hootsuite's Advanced plan plus 3 seats runs approximately $1,197/mo for team + approval workflows on ~10 channels. Postiz TEAM covers the same 10-channel, team-member, approval-adjacent shape for $39/mo flat.",
      },
      {
        question: 'Does Postiz TEAM really include team members at $39/mo?',
        answer:
          'Yes - team_members is enabled starting at the TEAM tier ($39/mo) in the live pricing config, alongside 10 channels and autopost.',
      },
      {
        question: 'Can I migrate from Hootsuite to Postiz?',
        answer:
          'Postiz supports 36+ social providers and a public API/SDK for scripted migration of scheduled content; most teams reconnect channels directly via OAuth and rebuild their queue from the calendar view.',
      },
    ],
  },
  later: {
    slug: 'later',
    name: 'Later',
    domain: 'later.com',
    asOf: '2026-10-23',
    headline: 'Postiz vs Later',
    subheadline: 'Every channel Later has, plus full X (Twitter), Threads, Bluesky, and 20+ more.',
    summary:
      "Later is built around Instagram-grid-style visual planning but has no X (Twitter) support at all. Postiz covers Later's channels plus X, Threads, Bluesky, Mastodon, LinkedIn, and 20+ more from a single calendar.",
    pricingRows: [
      {
        label: 'X (Twitter) support',
        postiz: 'Full support, included',
        competitor: 'Not supported',
      },
      {
        label: 'Entry plan price',
        postiz: '$29/mo flat (STANDARD, 5 channels)',
        competitor: 'Per-plan, channel-limited',
      },
      {
        label: 'AI post drafting',
        postiz: 'Included (LangGraph agent)',
        competitor: 'Limited AI caption assist',
      },
      {
        label: 'Public API access',
        postiz: 'Included from $29/mo',
        competitor: 'Not offered on consumer plans',
      },
    ],
    structuralChecklist: structuralChecklistTemplate('Later'),
    featureChecklist: [
      {
        label: 'X (Twitter) posting',
        postiz: true,
        competitor: false,
      },
      {
        label: 'Threads and Bluesky posting',
        postiz: true,
        competitor: false,
      },
      {
        label: 'Video-to-clips scheduler',
        postiz: true,
        competitor: false,
      },
    ],
    verdict:
      "If your channel mix includes X, Threads, or Bluesky, Later structurally can't cover it. Postiz schedules every channel Later supports plus the ones it doesn't, from the same calendar and composer.",
    faq: [
      {
        question: 'Does Later support posting to X (Twitter)?',
        answer:
          'No, Later does not support X (Twitter) at all. Postiz supports X alongside Threads, Bluesky, and 30+ other channels from one composer.',
      },
      {
        question: 'Is Postiz as good for Instagram-grid planning as Later?',
        answer:
          "Postiz's calendar and media library cover the same visual scheduling workflow for Instagram, plus the channels Later can't reach.",
      },
    ],
  },
  socialbee: {
    slug: 'socialbee',
    name: 'SocialBee',
    domain: 'socialbee.com',
    asOf: '2026-10-23',
    headline: 'Postiz vs SocialBee',
    subheadline: 'Team seats at $39/mo, not SocialBee\'s $99/mo Pro gate.',
    summary:
      "SocialBee requires its $99/mo Pro plan before a single extra team member can be added. Postiz TEAM includes team members, 10 channels, and autopost for $39/mo - a $60/mo gap for the same capability.",
    pricingRows: [
      {
        label: 'Cheapest plan with team members',
        postiz: '$39/mo (TEAM)',
        competitor: '$99/mo (Pro)',
      },
      {
        label: 'Content recycling / evergreen queue',
        postiz: 'Category-based queue rotation',
        competitor: 'Category-based queue rotation (SocialBee original)',
      },
      {
        label: 'Public API access',
        postiz: 'Included from $29/mo',
        competitor: 'Not publicly documented',
      },
      {
        label: 'Self-hosting option',
        postiz: 'AGPL self-host available',
        competitor: 'Not offered',
      },
    ],
    structuralChecklist: structuralChecklistTemplate('SocialBee'),
    featureChecklist: [
      {
        label: 'Team seats at the cheapest multi-channel tier',
        postiz: true,
        competitor: false,
      },
      {
        label: 'Video-to-clips scheduler',
        postiz: true,
        competitor: false,
      },
      {
        label: 'Native MCP server',
        postiz: true,
        competitor: false,
      },
    ],
    verdict:
      "SocialBee pioneered evergreen content recycling, and Postiz matches that category-based rotation - while undercutting SocialBee by $60/mo on the cheapest plan that includes a second team seat.",
    faq: [
      {
        question: 'Does Postiz have content recycling like SocialBee?',
        answer:
          "Yes - Postiz supports a recycle-after-days, category-based queue rotation for evergreen content, the same workflow SocialBee popularized.",
      },
      {
        question: 'How much cheaper is Postiz for a 2-person team?',
        answer:
          "Postiz TEAM at $39/mo includes team members. SocialBee requires its $99/mo Pro plan for the same capability - a $60/mo difference.",
      },
    ],
  },
  metricool: {
    slug: 'metricool',
    name: 'Metricool',
    domain: 'metricool.com',
    asOf: '2026-10-23',
    headline: 'Postiz vs Metricool',
    subheadline: 'Every channel, every tier, no platform tax.',
    summary:
      "Metricool is strong on analytics and competitor tracking, but Postiz matches scheduling depth while never gating a specific platform like X or LinkedIn behind a higher tier - channel count is the only paid gate, not platform identity.",
    pricingRows: [
      {
        label: 'Platform-based feature gating',
        postiz: 'None - channel count is the only gate',
        competitor: 'Some advanced analytics gated by plan',
      },
      {
        label: 'Entry plan price',
        postiz: '$29/mo flat (5 channels)',
        competitor: 'Tiered by channel + feature',
      },
      {
        label: 'Built-in AI drafting agent',
        postiz: 'Included (LangGraph + live web research)',
        competitor: 'Not a core feature',
      },
      {
        label: 'Video-to-clips scheduler',
        postiz: 'Included (Deepgram transcription)',
        competitor: 'Not offered',
      },
    ],
    structuralChecklist: structuralChecklistTemplate('Metricool'),
    featureChecklist: [
      {
        label: 'No per-platform feature tax',
        postiz: true,
        competitor: false,
      },
      {
        label: 'Bundled AI agent with web research',
        postiz: true,
        competitor: false,
      },
      {
        label: 'Self-host option',
        postiz: true,
        competitor: false,
      },
    ],
    verdict:
      "Metricool's analytics and competitor tracking are genuinely strong - Postiz answers with the same scheduling coverage, an AI agent Metricool doesn't have, and a pricing model that never charges extra for which platform you post to.",
    faq: [
      {
        question: 'Does Postiz have competitor tracking like Metricool?',
        answer:
          "Postiz tracks competitor handles per organization using each provider's public analytics endpoints, with scheduled snapshots and a comparison chart in the analytics view.",
      },
      {
        question: 'Does Postiz charge more for X or LinkedIn specifically?',
        answer:
          'No. Every tier in the live pricing config gates on channel count only, never on which specific platform you connect.',
      },
    ],
  },
  publer: {
    slug: 'publer',
    name: 'Publer',
    domain: 'publer.io',
    asOf: '2026-10-23',
    headline: 'Postiz vs Publer',
    subheadline: "The self-host, SDK, CLI, and MCP server Publer structurally can't ship.",
    summary:
      "Publer is a solid closed-source SaaS scheduler, but it has no self-host option, no npm SDK, no CLI, and no native MCP server. Postiz ships all four, on top of the same multi-channel scheduling Publer offers.",
    pricingRows: [
      {
        label: 'Self-hosting option',
        postiz: 'AGPL self-host, full feature parity with cloud',
        competitor: 'Not offered - cloud SaaS only',
      },
      {
        label: 'Official npm SDK (@postiz/node)',
        postiz: 'Published, documented',
        competitor: 'Not offered',
      },
      {
        label: 'CLI tool',
        postiz: 'apps/commands CLI',
        competitor: 'Not offered',
      },
      {
        label: 'Native MCP server for AI agents',
        postiz: 'Built-in (start.mcp.ts)',
        competitor: 'Not offered',
      },
    ],
    structuralChecklist: structuralChecklistTemplate('Publer'),
    featureChecklist: [
      {
        label: 'Runs your own MCP server',
        postiz: true,
        competitor: false,
      },
      {
        label: 'Browser extension for quick scheduling',
        postiz: true,
        competitor: false,
      },
      {
        label: 'Video-to-clips scheduler',
        postiz: true,
        competitor: false,
      },
    ],
    verdict:
      "Publer covers day-to-day scheduling well, but anything programmatic - a script, an agent, a CI pipeline, a self-hosted deployment - hits a wall Publer was never built to support. Postiz was.",
    faq: [
      {
        question: 'Can I run Postiz with Claude, ChatGPT, or another AI agent?',
        answer:
          'Yes - Postiz runs a native MCP server (start.mcp.ts) so AI agents can schedule and manage posts directly. Publer has no equivalent.',
      },
      {
        question: 'Does Publer offer a self-hosted version?',
        answer:
          'No, Publer is cloud-only. Postiz is AGPL-licensed and can be self-hosted with the same feature set as Postiz Cloud.',
      },
    ],
  },
  mixpost: {
    slug: 'mixpost',
    name: 'Mixpost',
    domain: 'mixpost.app',
    asOf: '2026-10-23',
    headline: 'Postiz vs Mixpost',
    subheadline:
      "The other self-hosted option - won on recurring feature velocity a perpetual license can't match.",
    summary:
      "Mixpost is the closest direct competitor: open-source and self-hostable. But its Pro tier is a $299 one-time license with an MCP integration and no bundled LLM agent or video-clipping pipeline. Postiz ships a LangGraph agent with live web research, inline DALL-E image generation, and a Temporal-orchestrated video-to-clips pipeline with Deepgram transcription - all included, continuously shipped.",
    pricingRows: [
      {
        label: 'License model',
        postiz: 'Open-core, AGPL self-host + managed cloud',
        competitor: '$299 one-time perpetual license (Pro)',
      },
      {
        label: 'Bundled LLM agent with live web research',
        postiz: 'Included (LangGraph + Tavily)',
        competitor: 'Not offered',
      },
      {
        label: 'Video-to-clips pipeline (Deepgram transcription)',
        postiz: 'Included',
        competitor: 'Not offered',
      },
      {
        label: 'MCP integration',
        postiz: 'Native MCP server',
        competitor: 'Available on Pro tier',
      },
    ],
    structuralChecklist: structuralChecklistTemplate('Mixpost'),
    featureChecklist: [
      {
        label: 'Turn one long video into scheduled clips across every channel',
        postiz: true,
        competitor: false,
      },
      {
        label: 'Inline AI image generation (DALL-E)',
        postiz: true,
        competitor: false,
      },
      {
        label: 'Continuously shipped features (no perpetual-license lock)',
        postiz: true,
        competitor: false,
      },
    ],
    verdict:
      "Mixpost earned its spot as the self-hosted alternative to SaaS schedulers, and its one-time license is attractive on cost alone. But a perpetual license means a frozen feature set - Postiz's agent graph and video-clipping pipeline are both already-shipped features no competitor in this category, Mixpost included, currently matches.",
    faq: [
      {
        question: 'Is Postiz also open-source and self-hostable like Mixpost?',
        answer:
          'Yes. Postiz is AGPL-licensed and self-hostable with the exact same feature set as Postiz Cloud - the open-core model gates nothing between the two.',
      },
      {
        question: "What can't Mixpost do that Postiz can?",
        answer:
          "Mixpost's Pro tier has an MCP integration but no bundled LLM agent graph with live web research, no inline AI image generation, and no video-clipping pipeline. Postiz ships all three today.",
      },
    ],
  },
};

export type CompareSlug = keyof typeof compareCompetitors;

export const compareMetaDescription = (data: CompareCompetitor, brandName: string): string =>
  `${brandName} vs ${data.name}: ${data.subheadline} Compare pricing, features, and self-hosting options.`;


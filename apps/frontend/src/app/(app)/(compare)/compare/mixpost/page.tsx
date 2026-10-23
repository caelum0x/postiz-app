import { Metadata } from 'next';
import { isGeneralServerSide } from '@gitroom/helpers/utils/is.general.server.side';
import { CompareLandingPage } from '@gitroom/frontend/components/compare/compare.page.component';
import {
  compareCompetitors,
  compareMetaDescription,
} from '@gitroom/frontend/components/compare/compare.data';

const brandName = isGeneralServerSide() ? 'Postiz' : 'Gitroom';
const data = compareCompetitors.mixpost;

export const metadata: Metadata = {
  title: `${data.headline} | ${brandName}`,
  description: compareMetaDescription(data, brandName),
  alternates: {
    canonical: '/compare/mixpost',
  },
};

export default function CompareMixpostPage() {
  return <CompareLandingPage data={data} brandName={brandName} />;
}

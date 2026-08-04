import { ConsultExperience } from '@/components/consult/consult-experience';
import { EditorialEntry } from '@/components/editorial/editorial-entry';
import { editorialAsset } from '@/data/editorial';
import { publicSocialMetadata, staticSocialCard } from '@/lib/og/social-card';

export const metadata = publicSocialMetadata(staticSocialCard('consult'), '/consult');

const storyAsset = editorialAsset('consult-self-check-story');

export default function ConsultPage() {
  return <main className="consult-page">
    <EditorialEntry asset={storyAsset} layout="split" priority>
      <header className="consult-heading"><p className="eyebrow">Ask JeloCare</p><h1>What do you notice<br/>about your skin?</h1><p>Describe it in your own words.</p></header>
    </EditorialEntry>
    <ConsultExperience/>
  </main>;
}

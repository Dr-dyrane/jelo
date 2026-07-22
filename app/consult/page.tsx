import { ConsultExperience } from '@/components/consult/consult-experience';

export const metadata = { title: 'Consult' };

export default function ConsultPage() {
  return <main className="consult-page"><header className="consult-heading"><p className="eyebrow">Ask JeloCare</p><h1>What do you notice<br/>about your skin?</h1><p>Describe it in your own words.</p></header><ConsultExperience/></main>;
}

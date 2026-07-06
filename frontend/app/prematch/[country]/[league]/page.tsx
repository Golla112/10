import PrematchSportsbook from '../../../../components/PrematchSportsbook';

export default function PrematchLeaguePage({ params }: { params: { country: string; league: string } }) {
  return <PrematchSportsbook forceNationSlug={params.country} forceLeagueSlug={params.league} />;
}

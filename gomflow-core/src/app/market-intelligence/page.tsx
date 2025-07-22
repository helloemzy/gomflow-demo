import { MarketIntelligence } from '../../components/market/MarketIntelligence';

export default function MarketIntelligencePage() {
  return (
    <div className="container mx-auto px-4 py-8">
      <MarketIntelligence />
    </div>
  );
}

export const metadata = {
  title: 'Market Intelligence - GOMFLOW',
  description: 'Real-time market insights, competitive analysis, and business opportunities for group order managers',
};
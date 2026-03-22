import { useState, useEffect } from "react";
import { Helmet } from "react-helmet";
import PinProtection from "@/components/PinProtection";
import { PredictHeader } from "@/components/predictions/PredictHeader";
import { FilterBar } from "@/components/predictions/FilterBar";
import { MarketCard } from "@/components/predictions/MarketCard";
import { MarketDetailView } from "@/components/predictions/MarketDetailView";
import { PredictLeaderboard } from "@/components/predictions/PredictLeaderboard";
import { PredictEmptyStates } from "@/components/predictions/PredictEmptyStates";
import { Badge } from "@/components/ui/badge";
import { AlertTriangle } from "lucide-react";

export interface Market {
  id: string;
  title: string;
  category: "Crypto" | "Politics" | "Economics" | "Sports" | "Culture" | "Tech";
  status: "Live" | "Resolved" | "Upcoming";
  description: string;
  probability: number;
  volume: number;
  startDate: string;
  endDate: string;
  outcomes: {
    name: string;
    probability: number;
    yesPrice: number;
    noPrice: number;
  }[];
  probabilityHistory: { date: string; value: number }[];
}

const mockMarkets: Market[] = [
  {
    id: "1",
    title: "Will Bitcoin be above $200k by 2027?",
    category: "Crypto",
    status: "Live",
    description: "This market resolves to Yes if Bitcoin trades above $200,000 USD on any major exchange before December 31, 2027.",
    probability: 34,
    volume: 2450000,
    startDate: "2024-01-15",
    endDate: "2027-12-31",
    outcomes: [
      { name: "Yes - Above $200k", probability: 34, yesPrice: 0.34, noPrice: 0.66 },
      { name: "No - Below $200k", probability: 66, yesPrice: 0.66, noPrice: 0.34 }
    ],
    probabilityHistory: [
      { date: "Sep 21", value: 28 },
      { date: "Oct 05", value: 32 },
      { date: "Oct 19", value: 29 },
      { date: "Nov 02", value: 35 },
      { date: "Nov 16", value: 31 },
      { date: "Nov 30", value: 34 }
    ]
  },
  {
    id: "2",
    title: "Will the Fed cut rates in Jan 2026?",
    category: "Economics",
    status: "Live",
    description: "This market resolves to Yes if the Federal Reserve announces a rate cut at their January 2026 FOMC meeting.",
    probability: 14,
    volume: 890000,
    startDate: "2025-06-01",
    endDate: "2026-01-31",
    outcomes: [
      { name: "Fed cuts rate", probability: 14, yesPrice: 0.14, noPrice: 0.86 },
      { name: "Fed maintains rate", probability: 86, yesPrice: 0.86, noPrice: 0.14 }
    ],
    probabilityHistory: [
      { date: "Sep 21", value: 22 },
      { date: "Oct 05", value: 18 },
      { date: "Oct 19", value: 15 },
      { date: "Nov 02", value: 12 },
      { date: "Nov 16", value: 16 },
      { date: "Nov 30", value: 14 }
    ]
  },
  {
    id: "3",
    title: "Will Ethereum flip Bitcoin by 2030?",
    category: "Crypto",
    status: "Live",
    description: "This market resolves to Yes if Ethereum's market cap exceeds Bitcoin's market cap at any point before December 31, 2030.",
    probability: 18,
    volume: 1230000,
    startDate: "2024-03-01",
    endDate: "2030-12-31",
    outcomes: [
      { name: "ETH flips BTC", probability: 18, yesPrice: 0.18, noPrice: 0.82 },
      { name: "BTC stays on top", probability: 82, yesPrice: 0.82, noPrice: 0.18 }
    ],
    probabilityHistory: [
      { date: "Sep 21", value: 24 },
      { date: "Oct 05", value: 21 },
      { date: "Oct 19", value: 19 },
      { date: "Nov 02", value: 17 },
      { date: "Nov 16", value: 20 },
      { date: "Nov 30", value: 18 }
    ]
  },
  {
    id: "4",
    title: "2028 US Presidential Election Winner?",
    category: "Politics",
    status: "Upcoming",
    description: "This market resolves based on the certified winner of the 2028 United States Presidential Election.",
    probability: 0,
    volume: 5670000,
    startDate: "2027-01-01",
    endDate: "2028-11-15",
    outcomes: [
      { name: "Democratic Party", probability: 48, yesPrice: 0.48, noPrice: 0.52 },
      { name: "Republican Party", probability: 47, yesPrice: 0.47, noPrice: 0.53 },
      { name: "Other", probability: 5, yesPrice: 0.05, noPrice: 0.95 }
    ],
    probabilityHistory: []
  },
  {
    id: "5",
    title: "Will Solana reach $500 by end of 2025?",
    category: "Crypto",
    status: "Live",
    description: "This market resolves to Yes if Solana (SOL) trades above $500 USD on any major exchange before December 31, 2025.",
    probability: 42,
    volume: 3120000,
    startDate: "2024-06-01",
    endDate: "2025-12-31",
    outcomes: [
      { name: "Yes - Above $500", probability: 42, yesPrice: 0.42, noPrice: 0.58 },
      { name: "No - Below $500", probability: 58, yesPrice: 0.58, noPrice: 0.42 }
    ],
    probabilityHistory: [
      { date: "Sep 21", value: 35 },
      { date: "Oct 05", value: 38 },
      { date: "Oct 19", value: 41 },
      { date: "Nov 02", value: 45 },
      { date: "Nov 16", value: 40 },
      { date: "Nov 30", value: 42 }
    ]
  },
  {
    id: "6",
    title: "Will AI pass medical licensing exam by 2026?",
    category: "Tech",
    status: "Live",
    description: "This market resolves to Yes if any AI system scores in the top 10% on the USMLE Step 1 exam before December 31, 2026.",
    probability: 78,
    volume: 450000,
    startDate: "2024-09-01",
    endDate: "2026-12-31",
    outcomes: [
      { name: "Yes - AI passes", probability: 78, yesPrice: 0.78, noPrice: 0.22 },
      { name: "No - AI fails", probability: 22, yesPrice: 0.22, noPrice: 0.78 }
    ],
    probabilityHistory: [
      { date: "Sep 21", value: 65 },
      { date: "Oct 05", value: 70 },
      { date: "Oct 19", value: 72 },
      { date: "Nov 02", value: 75 },
      { date: "Nov 16", value: 76 },
      { date: "Nov 30", value: 78 }
    ]
  },
  {
    id: "7",
    title: "Champions League Winner 2025?",
    category: "Sports",
    status: "Live",
    description: "This market resolves based on the winner of the 2024-25 UEFA Champions League final.",
    probability: 0,
    volume: 2890000,
    startDate: "2024-09-15",
    endDate: "2025-06-01",
    outcomes: [
      { name: "Real Madrid", probability: 28, yesPrice: 0.28, noPrice: 0.72 },
      { name: "Manchester City", probability: 24, yesPrice: 0.24, noPrice: 0.76 },
      { name: "Bayern Munich", probability: 18, yesPrice: 0.18, noPrice: 0.82 },
      { name: "Other", probability: 30, yesPrice: 0.30, noPrice: 0.70 }
    ],
    probabilityHistory: [
      { date: "Sep 21", value: 25 },
      { date: "Oct 05", value: 27 },
      { date: "Oct 19", value: 26 },
      { date: "Nov 02", value: 28 },
      { date: "Nov 16", value: 29 },
      { date: "Nov 30", value: 28 }
    ]
  },
  {
    id: "8",
    title: "Will a major streaming service shut down in 2025?",
    category: "Culture",
    status: "Live",
    description: "This market resolves to Yes if Netflix, Disney+, HBO Max, Paramount+, or Peacock announces shutdown or major consolidation in 2025.",
    probability: 23,
    volume: 340000,
    startDate: "2025-01-01",
    endDate: "2025-12-31",
    outcomes: [
      { name: "Yes - Service shuts down", probability: 23, yesPrice: 0.23, noPrice: 0.77 },
      { name: "No - All remain active", probability: 77, yesPrice: 0.77, noPrice: 0.23 }
    ],
    probabilityHistory: [
      { date: "Sep 21", value: 18 },
      { date: "Oct 05", value: 20 },
      { date: "Oct 19", value: 22 },
      { date: "Nov 02", value: 25 },
      { date: "Nov 16", value: 24 },
      { date: "Nov 30", value: 23 }
    ]
  }
];

type Tab = "browse" | "categories" | "my-predictions" | "leaderboard";
type SortOption = "volume" | "newest" | "ending-soon";

const PredictionMarkets = () => {
  const [activeTab, setActiveTab] = useState<Tab>("browse");
  const [selectedCategory, setSelectedCategory] = useState<string>("All");
  const [searchQuery, setSearchQuery] = useState("");
  const [sortBy, setSortBy] = useState<SortOption>("volume");
  const [selectedMarket, setSelectedMarket] = useState<Market | null>(null);
  const [isWalletConnected, setIsWalletConnected] = useState(false);

  // Filter and sort markets
  const filteredMarkets = mockMarkets
    .filter((market) => {
      const matchesCategory = selectedCategory === "All" || market.category === selectedCategory;
      const matchesSearch = market.title.toLowerCase().includes(searchQuery.toLowerCase());
      return matchesCategory && matchesSearch;
    })
    .sort((a, b) => {
      switch (sortBy) {
        case "volume":
          return b.volume - a.volume;
        case "newest":
          return new Date(b.startDate).getTime() - new Date(a.startDate).getTime();
        case "ending-soon":
          return new Date(a.endDate).getTime() - new Date(b.endDate).getTime();
        default:
          return 0;
      }
    });

  const handleMarketClick = (market: Market) => {
    setSelectedMarket(market);
  };

  const handleBackToBrowse = () => {
    setSelectedMarket(null);
  };

  return (
    <PinProtection>
      <Helmet>
        <meta name="robots" content="noindex, nofollow" />
        <title>Prediction Markets | KindSwap - Internal Preview</title>
      </Helmet>

      <div className="min-h-screen bg-background relative overflow-hidden">
        {/* Background Effects */}
        <div className="fixed inset-0 overflow-hidden pointer-events-none">
          <div className="absolute top-0 left-1/4 w-96 h-96 bg-ocean-cyan/5 rounded-full blur-3xl" />
          <div className="absolute bottom-1/4 right-1/4 w-80 h-80 bg-ocean-seafoam/5 rounded-full blur-3xl" />
        </div>

        {/* Internal Preview Badge */}
        <div className="fixed top-4 right-4 z-50">
          <Badge variant="outline" className="bg-background/80 backdrop-blur-sm border-ocean-cyan/30 text-ocean-cyan">
            <AlertTriangle className="w-3 h-3 mr-1" />
            Internal Preview
          </Badge>
        </div>

        <div className="relative z-10">
          {/* Header */}
          <PredictHeader 
            activeTab={activeTab} 
            onTabChange={setActiveTab}
            isWalletConnected={isWalletConnected}
            onWalletConnect={() => setIsWalletConnected(!isWalletConnected)}
          />

          <main className="container mx-auto px-4 py-6 pb-24">
            {activeTab === "browse" && !selectedMarket && (
              <>
                <FilterBar
                  selectedCategory={selectedCategory}
                  onCategoryChange={setSelectedCategory}
                  searchQuery={searchQuery}
                  onSearchChange={setSearchQuery}
                  sortBy={sortBy}
                  onSortChange={setSortBy}
                />

                {filteredMarkets.length === 0 ? (
                  <PredictEmptyStates type="no-markets" />
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mt-6">
                    {filteredMarkets.map((market) => (
                      <MarketCard
                        key={market.id}
                        market={market}
                        onClick={() => handleMarketClick(market)}
                      />
                    ))}
                  </div>
                )}
              </>
            )}

            {activeTab === "browse" && selectedMarket && (
              <MarketDetailView
                market={selectedMarket}
                onBack={handleBackToBrowse}
                isWalletConnected={isWalletConnected}
                onWalletConnect={() => setIsWalletConnected(true)}
              />
            )}

            {activeTab === "categories" && (
              <div className="mt-6">
                <h2 className="text-xl font-semibold mb-4">Browse by Category</h2>
                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
                  {["Crypto", "Politics", "Economics", "Sports", "Culture", "Tech"].map((cat) => (
                    <button
                      key={cat}
                      onClick={() => {
                        setSelectedCategory(cat);
                        setActiveTab("browse");
                      }}
                      className="glass-card p-6 rounded-xl text-center hover:border-ocean-cyan/50 transition-colors group"
                    >
                      <span className="text-lg font-medium group-hover:text-ocean-cyan transition-colors">{cat}</span>
                      <p className="text-sm text-muted-foreground mt-1">
                        {mockMarkets.filter((m) => m.category === cat).length} markets
                      </p>
                    </button>
                  ))}
                </div>
              </div>
            )}

            {activeTab === "my-predictions" && (
              <div className="mt-6">
                {isWalletConnected ? (
                  <PredictEmptyStates type="no-positions" />
                ) : (
                  <PredictEmptyStates type="not-connected" onConnect={() => setIsWalletConnected(true)} />
                )}
              </div>
            )}

            {activeTab === "leaderboard" && (
              <PredictLeaderboard />
            )}
          </main>

          {/* Footer Disclaimer */}
          <footer className="fixed bottom-0 left-0 right-0 bg-background/80 backdrop-blur-sm border-t border-border/50 py-3 z-40">
            <p className="text-center text-xs text-muted-foreground">
              Prediction markets involve uncertainty. Participation does not guarantee outcomes.
            </p>
          </footer>
        </div>
      </div>
    </PinProtection>
  );
};

export default PredictionMarkets;

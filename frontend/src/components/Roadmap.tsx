import { Badge } from "@/components/ui/badge";
import { useState } from "react";
import { Pause, Play } from "lucide-react";
import {
  Rocket,
  Link,
  Wallet,
  BarChart3,
  Shield,
  ClipboardList,
  TrendingUp,
  Gift,
  MessageCircle,
  HelpCircle,
  LineChart,
  Zap,
  Coins,
  Smartphone,
  Target,
  Wrench,
  Vote,
  ArrowLeftRight,
  Puzzle,
  Globe,
  Building2,
  Landmark,
  ShieldCheck,
  LucideIcon,
} from "lucide-react";

interface Milestone {
  text: string;
  icon: LucideIcon;
}

interface RoadmapQuarter {
  quarter: string;
  title: string;
  gradient: string;
  iconGradient: string;
  milestones: Milestone[];
  isCurrentPhase?: boolean;
}

const roadmapData: RoadmapQuarter[] = [
  {
    quarter: "Q4 2026",
    title: "Launch Phase",
    gradient: "from-ocean-cyan to-ocean-seafoam",
    iconGradient: "text-ocean-cyan",
    isCurrentPhase: true,
    milestones: [
      { text: "Launch custom swap aggregator", icon: Rocket },
      { text: "Integrate major Solana DEXs", icon: Link },
      { text: "Multi-wallet support", icon: Wallet },
      { text: "Smart contract audit", icon: Shield },
    ],
  },
  {
    quarter: "Q1 2027",
    title: "Feature Expansion",
    gradient: "from-ocean-light to-ocean-cyan",
    iconGradient: "text-ocean-light",
    milestones: [
      { text: "Limit orders & recurring swaps", icon: ClipboardList },
      { text: "Portfolio tracker", icon: TrendingUp },
      { text: "Community launch (Discord, Telegram)", icon: MessageCircle },
    ],
  },
  {
    quarter: "Q2-Q3 2027",
    title: "Pro & Innovation",
    gradient: "from-ocean-seafoam to-emerald-400",
    iconGradient: "text-ocean-seafoam",
    milestones: [
      { text: "Perpetuals trading", icon: Zap },
      { text: "Lending & yield pools", icon: Coins },
      { text: "Prediction markets", icon: Target },
      { text: "Mobile app beta", icon: Smartphone },
    ],
  },
];

const RoadmapCard = ({ data }: { data: RoadmapQuarter }) => {
  return (
    <div
      className={`relative flex-shrink-0 w-[300px] md:w-[320px] group ${
        data.isCurrentPhase ? "scale-[1.02]" : ""
      }`}
    >
      {/* Card */}
      <div
        className={`relative h-full backdrop-blur-xl bg-card/40 border border-border/50 rounded-2xl p-6 transition-all duration-300 hover:bg-card/60 hover:border-primary/30 ${
          data.isCurrentPhase ? "ring-2 ring-primary/40 shadow-[0_0_30px_hsl(185_80%_55%/0.2)]" : ""
        }`}
      >
        {/* Gradient accent bar */}
        <div
          className={`absolute top-0 left-6 right-6 h-1 rounded-b-full bg-gradient-to-r ${data.gradient}`}
        />

        {/* Quarter label */}
        <div className="mb-4 pt-2">
          <Badge
            variant="outline"
            className={`bg-gradient-to-r ${data.gradient} bg-clip-text text-transparent border-border/50 font-bold text-sm`}
          >
            {data.quarter}
          </Badge>
          {data.isCurrentPhase && (
            <Badge className="ml-2 bg-primary/20 text-primary border-primary/30 text-xs">
              Upcoming
            </Badge>
          )}
        </div>

        {/* Title */}
        <h3
          className={`text-lg font-bold mb-4 bg-gradient-to-r ${data.gradient} bg-clip-text text-transparent`}
        >
          {data.title}
        </h3>

        {/* Milestones */}
        <ul className="space-y-3">
          {data.milestones.map((milestone, index) => {
            const IconComponent = milestone.icon;
            return (
              <li
                key={index}
                className="flex items-start gap-3 text-sm text-muted-foreground group-hover:text-foreground/80 transition-colors"
              >
                <IconComponent
                  className={`w-4 h-4 mt-0.5 flex-shrink-0 ${data.iconGradient}`}
                />
                <span>{milestone.text}</span>
              </li>
            );
          })}
        </ul>
      </div>
    </div>
  );
};

const Roadmap = () => {
  const [isPaused, setIsPaused] = useState(false);

  return (
    <section id="roadmap" className="py-20 md:py-32 relative overflow-hidden">
      {/* Background elements */}
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute top-1/4 left-0 w-96 h-96 bg-ocean-cyan/5 rounded-full blur-[120px]" />
        <div className="absolute bottom-1/4 right-0 w-96 h-96 bg-ocean-seafoam/5 rounded-full blur-[120px]" />
      </div>

      <div className="container mx-auto px-4 relative z-10">
        {/* Section Header */}
        <div className="text-center mb-16">
          <Badge
            variant="outline"
            className="mb-4 text-primary border-primary/30"
          >
            Our Vision
          </Badge>
          <h2 className="text-3xl md:text-5xl font-bold mb-4">
            <span className="bg-gradient-to-r from-ocean-cyan via-ocean-light to-ocean-seafoam bg-clip-text text-transparent">
              Roadmap
            </span>
          </h2>
          <p className="text-muted-foreground max-w-2xl mx-auto text-lg">
            Our journey to revolutionize decentralized trading while making a
            real-world impact
          </p>
        </div>

        {/* Cards - Continuous scroll on all screen sizes */}
        <div className="relative">
          <div 
            className={`pb-6 -mx-4 px-4 ${isPaused ? 'overflow-x-auto scrollbar-hide' : 'overflow-hidden'}`}
          >
            <div 
              className={`flex gap-4 ${isPaused ? '' : 'animate-scroll-slow'}`}
              style={{ width: 'max-content' }}
            >
              {/* Original cards */}
              {roadmapData.map((quarter, index) => (
                <RoadmapCard key={index} data={quarter} />
              ))}
              {/* Duplicate cards for seamless loop (only when animating) */}
              {!isPaused && roadmapData.map((quarter, index) => (
                <RoadmapCard key={`dup-${index}`} data={quarter} />
              ))}
            </div>
          </div>
          
          {/* Pause/Play toggle button - always visible */}
          <button
            onClick={() => setIsPaused(!isPaused)}
            className="absolute bottom-8 right-4 z-20 flex items-center gap-2 px-3 py-2 rounded-full backdrop-blur-xl bg-card/60 border border-border/50 text-muted-foreground hover:text-foreground hover:bg-card/80 transition-all duration-300"
            aria-label={isPaused ? "Resume auto-scroll" : "Pause to scroll manually"}
          >
            {isPaused ? (
              <>
                <Play className="w-4 h-4" />
                <span className="text-xs">Resume</span>
              </>
            ) : (
              <>
                <Pause className="w-4 h-4" />
                <span className="text-xs">Pause</span>
              </>
            )}
          </button>
        </div>

      </div>
    </section>
  );
};

export default Roadmap;

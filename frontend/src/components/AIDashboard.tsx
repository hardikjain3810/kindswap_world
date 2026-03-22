import { Badge } from "@/components/ui/badge";
import { Brain, TrendingUp, Share2, Target, Sparkles } from "lucide-react";

const features = [
  {
    icon: TrendingUp,
    title: "Personal Impact Tracking",
    description: "Monitor your trading volume and see exactly how much your activity contributes to donations in real-time.",
  },
  {
    icon: Target,
    title: "Choose Your Causes",
    description: "Allocate your contribution to causes you care about—from fighting hunger to supporting education.",
  },
  {
    icon: Share2,
    title: "Shareable Impact Cards",
    description: "Generate beautiful branded screenshots of your monthly impact to share on social media.",
  },
  {
    icon: Brain,
    title: "AI-Powered Insights",
    description: "Get personalized recommendations and see predictive analytics on your future charitable impact.",
  },
];

const AIDashboard = () => {
  return (
    <section id="ai-dashboard" className="py-24 md:py-32 relative overflow-hidden">
      {/* Background Glow */}
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[800px] rounded-full bg-ocean-deep/20 blur-[150px]" />

      <div className="container mx-auto px-4 relative z-10">
        <div className="grid lg:grid-cols-2 gap-12 items-center">
          {/* Content */}
          <div>
            <Badge variant="glass" className="mb-4">
              <Brain className="w-3 h-3 mr-1" />
              AI-Powered
            </Badge>
            <h2 className="text-3xl md:text-5xl font-bold mb-6">
              Track Your <span className="gradient-text">Impact</span> With AI
            </h2>
            <p className="text-muted-foreground text-lg mb-8">
              Our intelligent dashboard gives you complete visibility into how your trading activity 
              translates to real-world change. Every swap, every trade—quantified and visualized.
            </p>

            {/* Feature List */}
            <div className="space-y-6">
              {features.map((feature, index) => (
                <div key={index} className="flex gap-4 group">
                  <div className="w-12 h-12 rounded-xl bg-muted flex items-center justify-center flex-shrink-0 group-hover:bg-primary/10 transition-colors duration-300">
                    <feature.icon className="w-6 h-6 text-primary" />
                  </div>
                  <div>
                    <h4 className="font-semibold text-foreground mb-1">{feature.title}</h4>
                    <p className="text-sm text-muted-foreground">{feature.description}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Dashboard Preview */}
          <div className="relative">
            {/* Main Card */}
            <div className="glass-card p-6 relative overflow-hidden">
              {/* Header */}
              <div className="flex items-center justify-between mb-6">
                <div>
                  <p className="text-sm text-muted-foreground">Total Impact</p>
                  <p className="text-3xl font-bold gradient-text">$X,XXX.XX</p>
                </div>
                <Badge variant="glass" className="text-xs">
                  Example Preview
                </Badge>
              </div>

              {/* Chart Mockup */}
              <div className="h-40 mb-6 relative">
                <svg className="w-full h-full" viewBox="0 0 400 120" preserveAspectRatio="none">
                  <defs>
                    <linearGradient id="chartGradient" x1="0%" y1="0%" x2="100%" y2="0%">
                      <stop offset="0%" stopColor="hsl(185, 80%, 55%)" />
                      <stop offset="50%" stopColor="hsl(195, 90%, 60%)" />
                      <stop offset="100%" stopColor="hsl(165, 70%, 45%)" />
                    </linearGradient>
                    <linearGradient id="areaGradient" x1="0%" y1="0%" x2="0%" y2="100%">
                      <stop offset="0%" stopColor="hsl(185, 80%, 55%)" stopOpacity="0.3" />
                      <stop offset="100%" stopColor="hsl(185, 80%, 55%)" stopOpacity="0" />
                    </linearGradient>
                  </defs>
                  <path
                    d="M0,100 Q50,80 100,85 T200,60 T300,40 T400,20"
                    fill="none"
                    stroke="url(#chartGradient)"
                    strokeWidth="3"
                  />
                  <path
                    d="M0,100 Q50,80 100,85 T200,60 T300,40 T400,20 L400,120 L0,120 Z"
                    fill="url(#areaGradient)"
                  />
                </svg>
              </div>

              {/* Cause Allocation */}
              <div className="space-y-3">
                <p className="text-sm font-medium text-foreground">Your Cause Allocation</p>
                {[
                  { name: "Food Security", percent: 25, color: "bg-gradient-to-r from-orange-500 to-amber-500" },
                  { name: "Education", percent: 20, color: "bg-gradient-to-r from-ocean-light to-ocean-cyan" },
                  { name: "Homelessness", percent: 18, color: "bg-gradient-to-r from-ocean-cyan to-ocean-seafoam" },
                  { name: "Healthcare", percent: 15, color: "bg-gradient-to-r from-ocean-seafoam to-emerald-400" },
                  { name: "Environment", percent: 12, color: "bg-gradient-to-r from-emerald-500 to-ocean-seafoam" },
                  { name: "Community Care", percent: 10, color: "bg-gradient-to-r from-rose-500 to-pink-400" },
                ].map((cause, index) => (
                  <div key={index}>
                    <div className="flex justify-between text-sm mb-1">
                      <span className="text-muted-foreground">{cause.name}</span>
                      <span className="text-foreground">{cause.percent}%</span>
                    </div>
                    <div className="h-2 bg-muted rounded-full overflow-hidden">
                      <div 
                        className={`h-full ${cause.color} rounded-full transition-all duration-1000`}
                        style={{ width: `${cause.percent}%` }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};

export default AIDashboard;
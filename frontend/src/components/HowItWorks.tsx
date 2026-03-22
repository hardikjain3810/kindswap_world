import { ArrowRight, Repeat, Wallet, Heart, BarChart3 } from "lucide-react";

const steps = [
  {
    icon: Wallet,
    title: "Connect & Trade",
    description: "Swap tokens or trade perps on our lightning-fast Solana DEX with minimal fees.",
    color: "from-ocean-cyan to-ocean-seafoam",
  },
  {
    icon: Repeat,
    title: "Fees Pool Together",
    description: "Trading fees automatically accumulate in our transparent donation pool.",
    color: "from-ocean-cyan to-ocean-light",
  },
  {
    icon: Heart,
    title: "Choose Your Cause",
    description: "Select which vetted charities receive your contribution—homelessness, hunger, education, and more.",
    color: "from-ocean-light to-ocean-deep",
  },
  {
    icon: BarChart3,
    title: "Track Your Impact",
    description: "Use our AI dashboard to see exactly how your trading activity creates real-world change.",
    color: "from-ocean-seafoam to-ocean-cyan",
  },
];

const HowItWorks = () => {
  return (
    <section id="how-it-works" className="py-24 md:py-32 relative">
      {/* Background Elements */}
      <div className="absolute inset-0 overflow-hidden">
        <div className="absolute top-0 left-0 w-full h-px bg-gradient-to-r from-transparent via-border to-transparent" />
        <div className="absolute bottom-0 left-0 w-full h-px bg-gradient-to-r from-transparent via-border to-transparent" />
      </div>

      <div className="container mx-auto px-4 relative z-10">
        {/* Section Header */}
        <div className="text-center mb-16">
          <h2 className="text-3xl md:text-5xl font-bold mb-4">
            <span className="gradient-text">How It Works</span>
          </h2>
          <p className="text-muted-foreground text-lg max-w-2xl mx-auto">
            Transform every trade into an act of kindness. It's simple, transparent, and impactful.
          </p>
        </div>

        {/* Steps */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {steps.map((step, index) => (
            <div
              key={index}
              className="group relative"
              style={{ animationDelay: `${index * 0.1}s` }}
            >
              {/* Card */}
              <div className="glass-card p-6 h-full relative overflow-hidden transition-all duration-500 hover:border-primary/30 hover:shadow-[0_0_40px_hsl(185_80%_55%/0.1)]">
                {/* Step Number */}
                <div className="absolute top-4 right-4 text-6xl font-bold text-muted/30">
                  {index + 1}
                </div>

                {/* Icon */}
                <div className={`w-14 h-14 rounded-xl bg-gradient-to-br ${step.color} flex items-center justify-center mb-4 group-hover:scale-110 transition-transform duration-300`}>
                  <step.icon className="w-7 h-7 text-background" />
                </div>

                {/* Content */}
                <h3 className="text-xl font-semibold mb-2 text-foreground">{step.title}</h3>
                <p className="text-muted-foreground text-sm leading-relaxed">{step.description}</p>

                {/* Hover Glow */}
                <div className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-500 pointer-events-none">
                  <div className={`absolute inset-0 bg-gradient-to-br ${step.color} opacity-5`} />
                </div>
              </div>

              {/* Arrow (not on last item) */}
              {index < steps.length - 1 && (
                <div className="hidden lg:flex absolute -right-3 top-1/2 -translate-y-1/2 z-20">
                  <ArrowRight className="w-6 h-6 text-muted-foreground/30" />
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
    </section>
  );
};

export default HowItWorks;
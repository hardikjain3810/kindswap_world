import { Badge } from "@/components/ui/badge";
import { Sparkles } from "lucide-react";
const HeroSection = () => {
  return <section className="relative min-h-screen flex items-center justify-center overflow-hidden pt-20">
      {/* Animated Background */}
      <div className="absolute inset-0 overflow-hidden">
        {/* Gradient Orbs */}
        <div className="absolute top-1/4 left-1/4 w-[600px] h-[600px] rounded-full bg-ocean-cyan/20 blur-[120px] animate-float" />
        <div className="absolute bottom-1/4 right-1/4 w-[500px] h-[500px] rounded-full bg-ocean-seafoam/20 blur-[100px] animate-float" style={{
        animationDelay: "-3s"
      }} />
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[800px] rounded-full bg-ocean-deep/30 blur-[150px]" />
        
        {/* Grid Pattern */}
        <div className="absolute inset-0 opacity-[0.03]" style={{
        backgroundImage: `linear-gradient(hsl(var(--foreground)) 1px, transparent 1px), linear-gradient(90deg, hsl(var(--foreground)) 1px, transparent 1px)`,
        backgroundSize: '60px 60px'
      }} />
      </div>

      <div className="container mx-auto px-4 relative z-10">
        <div className="max-w-4xl mx-auto text-center">
          {/* Badge */}
          <Badge variant="gradient" className="mb-6 animate-fade-in" style={{
          animationDelay: "0.1s"
        }}>
            <Sparkles className="w-3 h-3 mr-1" />
            Coming Soon — Q4 2026
          </Badge>

          {/* Main Heading */}
          <h1 className="text-4xl md:text-6xl lg:text-7xl font-bold mb-6 leading-tight animate-fade-in" style={{
          animationDelay: "0.2s"
        }}>
            <span className="text-foreground">Swap. Trade. Give.</span>
            <br />
            <span className="gradient-text">Change the World.</span>
          </h1>

          {/* Subheading */}
          <p className="text-lg md:text-xl text-muted-foreground max-w-2xl mx-auto mb-8 animate-fade-in" style={{
          animationDelay: "0.3s"
        }}>The first Solana-based DEX Aggregator where every trade powers real-world impact. Fees from swaps and perps go directly to charitable causes.</p>


        </div>
      </div>

    </section>;
};
export default HeroSection;
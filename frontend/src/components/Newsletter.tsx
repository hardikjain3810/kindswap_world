import { Badge } from "@/components/ui/badge";
import { Sparkles, Rocket } from "lucide-react";
import KindSwapLogo from "./KindSwapLogo";

const Newsletter = () => {
  return (
    <section className="py-24 md:py-32 relative overflow-hidden">
      {/* Background */}
      <div className="absolute inset-0">
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[1000px] h-[600px] rounded-full bg-gradient-to-r from-ocean-cyan/10 via-ocean-light/10 to-ocean-seafoam/10 blur-[100px]" />
      </div>

      <div className="container mx-auto px-4 relative z-10">
        <div className="max-w-2xl mx-auto text-center">
          <Badge variant="gradient" className="mb-6">
            <Rocket className="w-3 h-3 mr-1" />
            Launching Soon
          </Badge>

          <h2 className="text-3xl md:text-5xl font-bold mb-4">
            Coming <span className="gradient-text">Q4 2026</span>
          </h2>

          <p className="text-muted-foreground text-lg mb-8">
            We're building the future of charitable trading. KindSwap will transform 
            every trade into real-world impact.
          </p>

          <div className="glass-card p-6 max-w-md mx-auto">
            <div className="flex items-center justify-center gap-3">
              <div className="w-12 h-12 rounded-full bg-primary/20 flex items-center justify-center">
                <Sparkles className="w-6 h-6 text-primary" />
              </div>
              <div className="text-left">
                <p className="font-semibold text-foreground">Stay Tuned</p>
                <p className="text-sm text-muted-foreground">Something amazing is coming.</p>
              </div>
            </div>
          </div>

          <div className="flex items-center justify-center gap-3 mt-8">
            <KindSwapLogo className="w-16 h-16" />
            <span className="text-2xl font-bold text-foreground">KindSwap</span>
          </div>
          <p className="text-xs text-muted-foreground mt-4">
            © 2025 KindSwap. All rights reserved.
          </p>
        </div>
      </div>
    </section>
  );
};

export default Newsletter;
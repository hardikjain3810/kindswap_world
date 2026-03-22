import { useState } from 'react';
import { AlertTriangle, TrendingUp, TrendingDown, Droplet, Info } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Slider } from '@/components/ui/slider';

const RiskEducation = () => {
  const [positionSize, setPositionSize] = useState(25);

  const leverages = [2, 4, 5];
  const maxLeverage = 5;

  return (
    <section className="mt-16">
      <div className="text-center mb-8">
        <Badge variant="outline" className="mb-4 bg-yellow-500/10 text-yellow-500 border-yellow-500/30">
          <AlertTriangle className="w-3 h-3 mr-1" />
          Risk Education
        </Badge>
        <h2 className="text-2xl lg:text-3xl font-bold gradient-text mb-3">
          Understanding Risk
        </h2>
        <p className="text-muted-foreground max-w-xl mx-auto">
          Trade responsibly with full awareness of leverage mechanics
        </p>
      </div>

      <div className="max-w-4xl mx-auto space-y-8">
        {/* Leverage Visualization */}
        <div className="glass-card rounded-xl p-6">
          <div className="flex items-center gap-2 mb-6">
            <Info className="w-5 h-5 text-ocean-cyan" />
            <h3 className="font-semibold text-foreground">Leverage Visualization</h3>
          </div>

          {/* Position Size Slider */}
          <div className="mb-6">
            <div className="flex justify-between mb-2">
              <span className="text-sm text-muted-foreground">Your Position Size</span>
              <span className="text-sm font-semibold text-foreground">${positionSize}</span>
            </div>
            <Slider
              value={[positionSize]}
              onValueChange={(value) => setPositionSize(value[0])}
              min={5}
              max={100}
              step={5}
              className="w-full"
            />
            <div className="flex justify-between text-xs text-muted-foreground mt-1">
              <span>$5</span>
              <span>$100</span>
            </div>
          </div>

          {/* Exposure Bars */}
          <div className="space-y-4">
            {leverages.map((leverage) => {
              const exposure = positionSize * leverage;
              const percentage = (exposure / (positionSize * maxLeverage)) * 100;
              
              return (
                <div key={leverage} className="space-y-1">
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">{leverage}× Exposure</span>
                    <span className="font-semibold text-foreground">${exposure}</span>
                  </div>
                  <div className="h-4 bg-muted/30 rounded-full overflow-hidden">
                    <div
                      className={`h-full rounded-full transition-all duration-500 ${
                        leverage === 2 
                          ? 'bg-green-500' 
                          : leverage === 4 
                            ? 'bg-yellow-500' 
                            : 'bg-orange-500'
                      }`}
                      style={{ width: `${percentage}%` }}
                    />
                  </div>
                </div>
              );
            })}
          </div>

          <p className="text-xs text-muted-foreground mt-4 text-center">
            Drag the slider to see how your position size affects market exposure
          </p>
        </div>

        {/* Risk Cards */}
        <div className="grid md:grid-cols-3 gap-4">
          <div className="glass-card rounded-xl p-5 text-center hover:border-green-500/30 transition-colors">
            <div className="w-12 h-12 rounded-xl bg-green-500/20 flex items-center justify-center mx-auto mb-3">
              <TrendingUp className="w-6 h-6 text-green-500" />
            </div>
            <h4 className="font-semibold text-foreground mb-2">Amplified Gains</h4>
            <p className="text-sm text-muted-foreground">
              5× leverage = 5× gains if price moves in your favor. A 2% move becomes 10%.
            </p>
          </div>

          <div className="glass-card rounded-xl p-5 text-center hover:border-red-500/30 transition-colors">
            <div className="w-12 h-12 rounded-xl bg-red-500/20 flex items-center justify-center mx-auto mb-3">
              <TrendingDown className="w-6 h-6 text-red-500" />
            </div>
            <h4 className="font-semibold text-foreground mb-2">Amplified Losses</h4>
            <p className="text-sm text-muted-foreground">
              5× leverage = 5× losses if price moves against you. A 2% move against becomes -10%.
            </p>
          </div>

          <div className="glass-card rounded-xl p-5 text-center hover:border-yellow-500/30 transition-colors">
            <div className="w-12 h-12 rounded-xl bg-yellow-500/20 flex items-center justify-center mx-auto mb-3">
              <Droplet className="w-6 h-6 text-yellow-500" />
            </div>
            <h4 className="font-semibold text-foreground mb-2">Liquidation Risk</h4>
            <p className="text-sm text-muted-foreground">
              If price moves too far against you, your position may be automatically closed (liquidated).
            </p>
          </div>
        </div>

        {/* Warning Banner */}
        <div className="glass-card rounded-xl p-5 border-2 border-yellow-500/30 bg-yellow-500/5">
          <div className="flex items-start gap-3">
            <AlertTriangle className="w-5 h-5 text-yellow-500 flex-shrink-0 mt-0.5" />
            <div>
              <h4 className="font-semibold text-foreground mb-1">Important Risk Disclosure</h4>
              <p className="text-sm text-muted-foreground">
                Perpetual trading involves significant risk and is not suitable for all investors. 
                Never trade more than you can afford to lose. Past performance does not guarantee future results. 
                Always understand the risks before trading with leverage.
              </p>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};

export default RiskEducation;

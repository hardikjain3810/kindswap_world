import { useEffect, useState } from 'react';
import { TrendingUp, Activity, DollarSign, Target } from 'lucide-react';
import { Badge } from '@/components/ui/badge';

interface StatItem {
  icon: React.ElementType;
  label: string;
  value: number;
  prefix?: string;
  suffix?: string;
  change: string;
  isPositive: boolean;
}

const stats: StatItem[] = [
  {
    icon: DollarSign,
    label: '24h Volume',
    value: 12400000,
    prefix: '$',
    suffix: '',
    change: '+23.5%',
    isPositive: true,
  },
  {
    icon: Activity,
    label: 'Trades',
    value: 8432,
    change: '+12.1%',
    isPositive: true,
  },
  {
    icon: TrendingUp,
    label: 'Avg Size',
    value: 156,
    prefix: '$',
    change: '+8.3%',
    isPositive: true,
  },
  {
    icon: Target,
    label: 'Win Rate',
    value: 67.2,
    suffix: '%',
    change: '+2.1%',
    isPositive: true,
  },
];

const assetVolumes = [
  { name: 'SOL', percentage: 45, color: 'from-ocean-cyan to-ocean-seafoam' },
  { name: 'BTC', percentage: 32, color: 'from-orange-400 to-orange-500' },
  { name: 'ETH', percentage: 23, color: 'from-purple-400 to-purple-500' },
];

const formatNumber = (num: number, prefix = '', suffix = '') => {
  if (num >= 1000000) {
    return `${prefix}${(num / 1000000).toFixed(1)}M${suffix}`;
  }
  if (num >= 1000) {
    return `${prefix}${(num / 1000).toFixed(1)}K${suffix}`;
  }
  return `${prefix}${num.toLocaleString()}${suffix}`;
};

const TradingStats = () => {
  const [animatedValues, setAnimatedValues] = useState<number[]>(stats.map(() => 0));
  const [hasAnimated, setHasAnimated] = useState(false);

  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting && !hasAnimated) {
          setHasAnimated(true);
          // Animate each stat
          stats.forEach((stat, index) => {
            const duration = 1500;
            const steps = 60;
            const increment = stat.value / steps;
            let current = 0;
            const timer = setInterval(() => {
              current += increment;
              if (current >= stat.value) {
                current = stat.value;
                clearInterval(timer);
              }
              setAnimatedValues((prev) => {
                const newValues = [...prev];
                newValues[index] = current;
                return newValues;
              });
            }, duration / steps);
          });
        }
      },
      { threshold: 0.3 }
    );

    const element = document.getElementById('trading-stats-section');
    if (element) observer.observe(element);

    return () => observer.disconnect();
  }, [hasAnimated]);

  return (
    <section id="trading-stats-section" className="mt-16">
      <div className="text-center mb-8">
        <Badge variant="outline" className="mb-4 bg-ocean-cyan/10 text-ocean-cyan border-ocean-cyan/30">
          Demo Data
        </Badge>
        <h2 className="text-2xl lg:text-3xl font-bold gradient-text mb-3">
          Platform Statistics
        </h2>
        <p className="text-muted-foreground max-w-xl mx-auto">
          Real-time trading activity across KindSwap Perps
        </p>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        {stats.map((stat, index) => (
          <div 
            key={stat.label} 
            className="glass-card rounded-xl p-5 text-center hover:border-ocean-cyan/30 transition-colors"
          >
            <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-ocean-cyan/20 to-ocean-seafoam/20 flex items-center justify-center mx-auto mb-3">
              <stat.icon className="w-5 h-5 text-ocean-cyan" />
            </div>
            <p className="text-2xl lg:text-3xl font-bold text-foreground">
              {formatNumber(animatedValues[index], stat.prefix, stat.suffix)}
            </p>
            <p className="text-sm text-muted-foreground mt-1">{stat.label}</p>
            <p className={`text-xs mt-2 ${stat.isPositive ? 'text-green-500' : 'text-red-500'}`}>
              {stat.change}
            </p>
          </div>
        ))}
      </div>

      {/* Most Traded Assets */}
      <div className="glass-card rounded-xl p-6 max-w-2xl mx-auto">
        <h3 className="text-sm font-semibold text-foreground mb-4">Most Traded Assets</h3>
        <div className="space-y-3">
          {assetVolumes.map((asset) => (
            <div key={asset.name} className="flex items-center gap-4">
              <span className="text-sm font-medium text-foreground w-10">{asset.name}</span>
              <div className="flex-1 h-3 bg-muted/30 rounded-full overflow-hidden">
                <div
                  className={`h-full bg-gradient-to-r ${asset.color} rounded-full transition-all duration-1000`}
                  style={{ width: hasAnimated ? `${asset.percentage}%` : '0%' }}
                />
              </div>
              <span className="text-sm text-muted-foreground w-12 text-right">{asset.percentage}%</span>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
};

export default TradingStats;

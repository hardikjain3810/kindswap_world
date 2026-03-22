import React from 'react';

const SolanaLogo = ({ className = "w-6 h-6" }: { className?: string }) => (
  <div className={`${className} rounded-full bg-gradient-to-br from-ocean-cyan to-ocean-seafoam p-0.5`}>
    <div className="w-full h-full rounded-full bg-background flex items-center justify-center">
      <svg viewBox="0 0 128 128" className="w-3/4 h-3/4">
        <defs>
          <linearGradient id="solana-grad" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="hsl(var(--ocean-cyan))" />
            <stop offset="100%" stopColor="hsl(var(--ocean-seafoam))" />
          </linearGradient>
        </defs>
        <path fill="url(#solana-grad)" d="M93.5 42.1c-.8-.8-1.8-1.2-2.9-1.2H25.9c-1.8 0-2.7 2.2-1.4 3.5l14.7 14.7c.8.8 1.8 1.2 2.9 1.2h64.7c1.8 0 2.7-2.2 1.4-3.5L93.5 42.1z"/>
        <path fill="url(#solana-grad)" d="M93.5 85.4c-.8-.8-1.8-1.2-2.9-1.2H25.9c-1.8 0-2.7 2.2-1.4 3.5l14.7 14.7c.8.8 1.8 1.2 2.9 1.2h64.7c1.8 0 2.7-2.2 1.4-3.5L93.5 85.4z"/>
        <path fill="url(#solana-grad)" d="M39.2 70.5c.8.8 1.8 1.2 2.9 1.2h64.7c1.8 0 2.7-2.2 1.4-3.5L93.5 53.5c-.8-.8-1.8-1.2-2.9-1.2H25.9c-1.8 0-2.7 2.2-1.4 3.5l14.7 14.7z"/>
      </svg>
    </div>
  </div>
);

const PriceBadge = ({ price }: { price: string }) => (
  <div className="flex items-center gap-2 bg-background/80 backdrop-blur-sm rounded-lg px-3 py-1.5 border border-ocean-cyan/30">
    <SolanaLogo className="w-5 h-5" />
    <span className="text-xs font-medium text-ocean-cyan">SOL-PERP</span>
    <span className="text-sm font-bold text-foreground">{price}</span>
  </div>
);

const WalletBadge = ({ balance }: { balance: string }) => (
  <div className="flex items-center gap-1.5 bg-background/80 backdrop-blur-sm rounded-lg px-2.5 py-1 border border-border/50">
    <div className="w-2 h-2 rounded-full bg-ocean-seafoam animate-pulse" />
    <span className="text-xs font-medium text-muted-foreground">{balance}</span>
  </div>
);

const BetBlock = ({ amount, multiplier, isWinning = false }: { amount: string; multiplier: string; isWinning?: boolean }) => (
  <div className={`
    relative flex flex-col items-center justify-center rounded-lg p-2 min-w-[48px]
    ${isWinning 
      ? 'bg-gradient-to-br from-amber-400 to-amber-500 shadow-lg shadow-amber-400/40' 
      : 'bg-gradient-to-br from-ocean-seafoam to-ocean-cyan/80 shadow-lg shadow-ocean-cyan/30'
    }
    border border-white/20
  `}>
    <span className="text-[10px] font-bold text-background">{multiplier}</span>
    <span className="text-xs font-bold text-background">{amount}</span>
    {isWinning && (
      <div className="absolute -top-1 -right-1 w-3 h-3 bg-amber-300 rounded-full animate-ping" />
    )}
  </div>
);

const WinIndicator = ({ amount }: { amount: string }) => (
  <div className="absolute flex items-center gap-1 bg-ocean-seafoam/90 backdrop-blur-sm rounded-full px-2 py-0.5 animate-bounce">
    <span className="text-xs font-bold text-background">+{amount}</span>
  </div>
);

const ToastNotification = ({ message, className = "" }: { message: string; className?: string }) => (
  <div className={`flex items-center gap-2 bg-background/95 backdrop-blur-sm rounded-lg px-3 py-2 border border-ocean-seafoam/50 shadow-lg ${className}`}>
    <div className="w-4 h-4 rounded-full bg-ocean-seafoam flex items-center justify-center">
      <svg className="w-2.5 h-2.5 text-background" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
      </svg>
    </div>
    <span className="text-xs font-medium text-foreground">{message}</span>
  </div>
);

// Mockup 1: Block Placement State
const MockupBlockPlacement = () => (
  <div className="relative aspect-video bg-gradient-to-br from-background via-background to-ocean-cyan/5 rounded-xl border border-border/50 overflow-hidden">
    {/* Grid Background */}
    <div className="absolute inset-0" style={{
      backgroundImage: `
        linear-gradient(to right, hsl(var(--ocean-cyan) / 0.1) 1px, transparent 1px),
        linear-gradient(to bottom, hsl(var(--ocean-cyan) / 0.1) 1px, transparent 1px)
      `,
      backgroundSize: '40px 30px'
    }} />
    
    {/* Header */}
    <div className="absolute top-3 left-3 right-3 flex items-center justify-between">
      <PriceBadge price="$178.45" />
      <div className="text-[10px] text-muted-foreground/60 font-medium">LIVE</div>
    </div>
    
    {/* Price Scale */}
    <div className="absolute right-3 top-12 bottom-12 flex flex-col justify-between text-[9px] text-muted-foreground/60">
      <span>$185</span>
      <span>$180</span>
      <span>$175</span>
      <span>$170</span>
    </div>
    
    {/* Grid Multipliers */}
    <div className="absolute left-16 top-14 grid grid-cols-4 gap-8">
      {['3.47X', '2.45X', '1.84X', '2.51X'].map((m, i) => (
        <span key={i} className="text-[10px] text-ocean-cyan/40 font-medium">{m}</span>
      ))}
    </div>
    
    {/* Bet Blocks Column */}
    <div className="absolute left-1/3 top-1/4 flex flex-col gap-2">
      <BetBlock amount="$5" multiplier="3.47X" />
      <BetBlock amount="$5" multiplier="2.45X" />
      <BetBlock amount="$5" multiplier="1.84X" />
      <BetBlock amount="$5" multiplier="2.51X" />
    </div>
    
    {/* Animated Price Line */}
    <svg className="absolute inset-0 w-full h-full" preserveAspectRatio="none">
      <defs>
        <filter id="glow1">
          <feGaussianBlur stdDeviation="2" result="coloredBlur"/>
          <feMerge>
            <feMergeNode in="coloredBlur"/>
            <feMergeNode in="SourceGraphic"/>
          </feMerge>
        </filter>
      </defs>
      <path 
        d="M 20 120 Q 80 100, 140 110 T 260 90 T 380 70" 
        fill="none" 
        stroke="hsl(var(--ocean-cyan))" 
        strokeWidth="2"
        filter="url(#glow1)"
        strokeDasharray="500"
        className="animate-price-line-draw animate-price-line-glow"
      />
    </svg>
    
    {/* Wallet Balance */}
    <div className="absolute bottom-3 left-3">
      <WalletBadge balance="$48.82" />
    </div>
    
    {/* Time Markers */}
    <div className="absolute bottom-3 left-1/4 right-12 flex justify-between text-[9px] text-muted-foreground/40">
      <span>12:00</span>
      <span>12:15</span>
      <span>12:30</span>
      <span>12:45</span>
    </div>
  </div>
);

// Mockup 2: Win Celebration State
const MockupWinState = () => (
  <div className="relative aspect-video bg-gradient-to-br from-background via-background to-ocean-seafoam/5 rounded-xl border border-border/50 overflow-hidden">
    {/* Grid Background */}
    <div className="absolute inset-0" style={{
      backgroundImage: `
        linear-gradient(to right, hsl(var(--ocean-cyan) / 0.1) 1px, transparent 1px),
        linear-gradient(to bottom, hsl(var(--ocean-cyan) / 0.1) 1px, transparent 1px)
      `,
      backgroundSize: '40px 30px'
    }} />
    
    {/* Toast Notification */}
    <div className="absolute top-3 right-3">
      <ToastNotification message="You won $12.55" />
    </div>
    
    {/* Header */}
    <div className="absolute top-3 left-3">
      <PriceBadge price="$179.82" />
    </div>
    
    {/* Bet Blocks with Winner */}
    <div className="absolute left-1/3 top-1/4 flex flex-col gap-2">
      <BetBlock amount="$5" multiplier="3.47X" />
      <BetBlock amount="$5" multiplier="2.45X" isWinning />
      <BetBlock amount="$5" multiplier="1.84X" />
      <BetBlock amount="$5" multiplier="2.51X" />
    </div>
    
    {/* Win Indicator */}
    <div className="absolute left-[45%] top-[35%]">
      <WinIndicator amount="$12.5" />
    </div>
    
    {/* Animated Price Line through winning block */}
    <svg className="absolute inset-0 w-full h-full" preserveAspectRatio="none">
      <defs>
        <filter id="glow2">
          <feGaussianBlur stdDeviation="2.5" result="coloredBlur"/>
          <feMerge>
            <feMergeNode in="coloredBlur"/>
            <feMergeNode in="SourceGraphic"/>
          </feMerge>
        </filter>
      </defs>
      <path 
        d="M 20 130 Q 100 100, 180 85 T 300 75 T 400 60" 
        fill="none" 
        stroke="hsl(var(--ocean-cyan))" 
        strokeWidth="2.5"
        filter="url(#glow2)"
        strokeDasharray="500"
        className="animate-price-line-draw animate-price-line-glow"
        style={{ animationDelay: '0.5s' }}
      />
    </svg>
    
    {/* Wallet Balance - Updated */}
    <div className="absolute bottom-3 left-3">
      <WalletBadge balance="$61.37" />
    </div>
    
    {/* Celebration Particles */}
    <div className="absolute left-[38%] top-[32%] w-20 h-20">
      {[...Array(6)].map((_, i) => (
        <div
          key={i}
          className="absolute w-1.5 h-1.5 rounded-full bg-ocean-seafoam animate-ping"
          style={{
            left: `${Math.random() * 100}%`,
            top: `${Math.random() * 100}%`,
            animationDelay: `${i * 0.15}s`,
            animationDuration: '1.5s'
          }}
        />
      ))}
    </div>
  </div>
);

// Mockup 3: Multiple Wins State
const MockupMultipleWins = () => (
  <div className="relative aspect-video bg-gradient-to-br from-background via-background to-amber-500/5 rounded-xl border border-border/50 overflow-hidden">
    {/* Grid Background */}
    <div className="absolute inset-0" style={{
      backgroundImage: `
        linear-gradient(to right, hsl(var(--ocean-cyan) / 0.1) 1px, transparent 1px),
        linear-gradient(to bottom, hsl(var(--ocean-cyan) / 0.1) 1px, transparent 1px)
      `,
      backgroundSize: '40px 30px'
    }} />
    
    {/* Stacked Toast Notifications */}
    <div className="absolute top-3 right-3 flex flex-col gap-1.5">
      <ToastNotification message="You won $12.30" />
      <ToastNotification message="You won $12.55" />
    </div>
    
    {/* Header */}
    <div className="absolute top-3 left-3">
      <PriceBadge price="$181.20" />
    </div>
    
    {/* Bet Blocks with Multiple Winners */}
    <div className="absolute left-1/4 top-1/4 flex flex-col gap-2">
      <BetBlock amount="$5" multiplier="3.47X" isWinning />
      <BetBlock amount="$5" multiplier="2.45X" isWinning />
      <BetBlock amount="$5" multiplier="1.84X" />
      <BetBlock amount="$5" multiplier="2.51X" />
    </div>
    
    {/* Win Indicator */}
    <div className="absolute left-[40%] top-[25%]">
      <WinIndicator amount="$12.3" />
    </div>
    
    {/* Animated Extended Price Line */}
    <svg className="absolute inset-0 w-full h-full" preserveAspectRatio="none">
      <defs>
        <filter id="glow3">
          <feGaussianBlur stdDeviation="2.5" result="coloredBlur"/>
          <feMerge>
            <feMergeNode in="coloredBlur"/>
            <feMergeNode in="SourceGraphic"/>
          </feMerge>
        </filter>
      </defs>
      <path 
        d="M 20 140 Q 80 120, 140 100 T 240 70 T 340 50 T 420 35" 
        fill="none" 
        stroke="hsl(var(--ocean-cyan))" 
        strokeWidth="2.5"
        filter="url(#glow3)"
        strokeDasharray="600"
        className="animate-price-line-draw animate-price-line-glow"
        style={{ animationDelay: '1s' }}
      />
    </svg>
    
    {/* Wallet Balance - Higher */}
    <div className="absolute bottom-3 left-3">
      <WalletBadge balance="$73.67" />
    </div>
    
    {/* Stats Badge */}
    <div className="absolute bottom-3 right-3 bg-background/80 backdrop-blur-sm rounded-lg px-2.5 py-1 border border-ocean-cyan/30">
      <span className="text-[10px] text-ocean-seafoam font-medium">2 Wins Streak 🔥</span>
    </div>
  </div>
);

// Mockup 4: Mobile Portrait View
const MockupMobileView = () => (
  <div className="relative aspect-[9/16] max-w-[200px] mx-auto bg-gradient-to-br from-background via-background to-ocean-cyan/5 rounded-2xl border border-border/50 overflow-hidden">
    {/* Status Bar */}
    <div className="absolute top-2 left-3 right-3 flex items-center justify-between">
      <span className="text-[8px] text-muted-foreground/60">9:41</span>
      <div className="flex items-center gap-1">
        <div className="w-3 h-1.5 rounded-sm border border-muted-foreground/40" />
      </div>
    </div>
    
    {/* Header */}
    <div className="absolute top-6 left-2 right-2 flex items-center justify-between">
      <div className="flex items-center gap-1.5 bg-background/80 backdrop-blur-sm rounded-lg px-2 py-1 border border-ocean-cyan/30">
        <SolanaLogo className="w-4 h-4" />
        <span className="text-[8px] font-medium text-foreground">$178.45</span>
      </div>
      <div className="w-6 h-6 rounded-full bg-ocean-cyan/20 flex items-center justify-center">
        <div className="w-3 h-3 rounded-full bg-ocean-cyan/60" />
      </div>
    </div>
    
    {/* Grid Area with Bet Blocks */}
    <div className="absolute top-16 left-2 right-2 bottom-24">
      {/* Grid Background */}
      <div className="absolute inset-0" style={{
        backgroundImage: `
          linear-gradient(to right, hsl(var(--ocean-cyan) / 0.15) 1px, transparent 1px),
          linear-gradient(to bottom, hsl(var(--ocean-cyan) / 0.15) 1px, transparent 1px)
        `,
        backgroundSize: '28px 24px'
      }} />
      
      {/* 3x2 Grid of Bet Blocks */}
      <div className="absolute top-1/4 left-1/4 grid grid-cols-2 gap-1.5">
        <BetBlock amount="$5" multiplier="2.1X" />
        <BetBlock amount="$5" multiplier="2.8X" />
        <BetBlock amount="$5" multiplier="1.9X" />
        <BetBlock amount="$5" multiplier="3.2X" />
        <BetBlock amount="$5" multiplier="2.4X" />
        <BetBlock amount="$5" multiplier="1.7X" />
      </div>
      
      {/* Animated Mini Price Line */}
      <svg className="absolute inset-0 w-full h-full" preserveAspectRatio="none">
        <defs>
          <filter id="glow4">
            <feGaussianBlur stdDeviation="1.5" result="coloredBlur"/>
            <feMerge>
              <feMergeNode in="coloredBlur"/>
              <feMergeNode in="SourceGraphic"/>
            </feMerge>
          </filter>
        </defs>
        <path 
          d="M 10 100 Q 40 85, 70 90 T 130 70 T 180 55" 
          fill="none" 
          stroke="hsl(var(--ocean-cyan))" 
          strokeWidth="1.5"
          filter="url(#glow4)"
          strokeDasharray="300"
          className="animate-price-line-draw animate-price-line-glow"
          style={{ animationDelay: '1.5s' }}
        />
      </svg>
      
      {/* Drag Handle */}
      <div className="absolute right-2 top-1/2 -translate-y-1/2 w-5 h-5 rounded-full bg-ocean-cyan/20 border border-ocean-cyan/40 flex items-center justify-center">
        <svg className="w-3 h-3 text-ocean-cyan" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 8h16M4 16h16" />
        </svg>
      </div>
    </div>
    
    {/* Bottom Controls */}
    <div className="absolute bottom-12 left-2 right-2 flex items-center justify-between">
      <WalletBadge balance="$48.00" />
      <div className="flex items-center gap-1 bg-ocean-seafoam/90 rounded-lg px-2 py-1">
        <span className="text-[10px] font-bold text-background">$5</span>
      </div>
    </div>
    
    {/* Mini Chart Preview */}
    <div className="absolute bottom-14 right-2 w-12 h-8 rounded bg-background/60 border border-border/40 overflow-hidden">
      <svg className="w-full h-full" preserveAspectRatio="none">
        <path 
          d="M 2 20 L 12 15 L 24 18 L 36 10 L 48 12" 
          fill="none" 
          stroke="hsl(var(--ocean-cyan))" 
          strokeWidth="1"
        />
      </svg>
    </div>
    
    {/* Bottom Navigation */}
    <div className="absolute bottom-0 left-0 right-0 h-10 bg-background/80 backdrop-blur-sm border-t border-border/50 flex items-center justify-around px-4">
      <svg className="w-4 h-4 text-ocean-cyan" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 12l3-3 3 3 4-4M8 21l4-4 4 4M3 4h18M4 4h16v12a1 1 0 01-1 1H5a1 1 0 01-1-1V4z" />
      </svg>
      <svg className="w-4 h-4 text-muted-foreground/60" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z" />
      </svg>
      <svg className="w-4 h-4 text-muted-foreground/60" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
      </svg>
    </div>
  </div>
);

const TapTradingShowcase = () => {
  return (
    <section className="py-16 px-4">
      <div className="max-w-6xl mx-auto">
        {/* Section Header */}
        <div className="text-center mb-12">
          <h2 className="text-3xl md:text-4xl font-bold mb-4">
            <span className="gradient-text">Experience Tap Trading</span>
          </h2>
          <p className="text-muted-foreground text-lg max-w-2xl mx-auto">
            See how the grid-based prediction system works. Place your bets, watch the price move, and celebrate your wins.
          </p>
        </div>
        
        {/* Mockups Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Mockup 1 */}
          <div className="glass-card p-4 rounded-2xl">
            <MockupBlockPlacement />
            <p className="text-center text-sm text-muted-foreground mt-3">Place bet blocks on price levels</p>
          </div>
          
          {/* Mockup 2 */}
          <div className="glass-card p-4 rounded-2xl">
            <MockupWinState />
            <p className="text-center text-sm text-muted-foreground mt-3">Win when price crosses your block</p>
          </div>
          
          {/* Mockup 3 */}
          <div className="glass-card p-4 rounded-2xl">
            <MockupMultipleWins />
            <p className="text-center text-sm text-muted-foreground mt-3">Stack wins for bigger rewards</p>
          </div>
          
          {/* Mockup 4 - Portrait */}
          <div className="glass-card p-4 rounded-2xl flex flex-col items-center justify-center">
            <MockupMobileView />
            <p className="text-center text-sm text-muted-foreground mt-3">Trade anywhere on mobile</p>
          </div>
        </div>
      </div>
    </section>
  );
};

export default TapTradingShowcase;

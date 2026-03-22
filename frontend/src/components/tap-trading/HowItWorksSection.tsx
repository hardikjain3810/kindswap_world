import React, { useState, useRef, useEffect } from 'react';
import { Play, Pause, Zap, ArrowUpDown, DollarSign, MousePointer, Shield, Eye, Clock, Volume2, VolumeX, Maximize } from 'lucide-react';
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion';

const steps = [
  {
    number: 1,
    icon: Zap,
    title: 'Select Leverage',
    description: 'Choose your exposure multiplier: 2×, 4×, or 5×. Higher leverage means more exposure to price movements.',
  },
  {
    number: 2,
    icon: ArrowUpDown,
    title: 'Choose Direction',
    description: 'Tap Long if you think the price will rise. Tap Short if you think it will fall.',
  },
  {
    number: 3,
    icon: DollarSign,
    title: 'Set Position Size',
    description: 'Pick from preset amounts ($5, $10, $25) or enter a custom value.',
  },
  {
    number: 4,
    icon: MousePointer,
    title: 'Tap to Trade',
    description: 'Review the confirmation modal showing all details, then confirm to execute.',
  },
];

const features = [
  {
    icon: Zap,
    title: 'One-Tap Execution',
    description: 'Simplified trading in just a few taps. No complex order forms.',
  },
  {
    icon: Shield,
    title: 'Risk-First Approach',
    description: 'Mandatory confirmation modal before every trade. No accidental executions.',
  },
  {
    icon: Eye,
    title: 'Clear Information',
    description: 'Max exposure always visible. Know your risk before you trade.',
  },
  {
    icon: Clock,
    title: 'Real-Time Updates',
    description: 'Live price charts and position tracking. Stay informed always.',
  },
];

const faqs = [
  {
    question: 'What is Tap Trading?',
    answer: "Tap Trading is KindSwap's simplified approach to perpetual futures. Instead of complex order forms, you simply tap to select your leverage, choose your direction, and confirm your trade.",
  },
  {
    question: 'How does leverage work?',
    answer: 'Leverage multiplies your exposure to price movements. With 5× leverage on a $25 position, you have $125 of market exposure. This means gains and losses are amplified proportionally.',
  },
  {
    question: 'What are the risks?',
    answer: 'Perpetual trading involves significant risk. Leverage amplifies both gains and losses. You could lose your entire position if the price moves against you beyond your liquidation price.',
  },
  {
    question: 'How do I close a position?',
    answer: "Once you have an active position, you'll see a position card with Close 25%, Close 50%, and Close 100% buttons. Tap any of these to partially or fully close your position.",
  },
  {
    question: 'Are there any fees?',
    answer: 'KindSwap charges competitive trading fees. A portion of all fees goes to charitable causes through our impact model. See our fee schedule for details.',
  },
];

const HowItWorksSection = () => {
  const [isPlaying, setIsPlaying] = useState(false);
  const [isMuted, setIsMuted] = useState(true);
  const [progress, setProgress] = useState(0);
  const [showControls, setShowControls] = useState(true);
  const videoRef = useRef<HTMLVideoElement>(null);

  const togglePlay = () => {
    if (videoRef.current) {
      if (isPlaying) {
        videoRef.current.pause();
      } else {
        videoRef.current.play();
      }
      setIsPlaying(!isPlaying);
    }
  };

  const toggleMute = () => {
    if (videoRef.current) {
      videoRef.current.muted = !isMuted;
      setIsMuted(!isMuted);
    }
  };

  const handleFullscreen = () => {
    if (videoRef.current) {
      if (videoRef.current.requestFullscreen) {
        videoRef.current.requestFullscreen();
      }
    }
  };

  const handleTimeUpdate = () => {
    if (videoRef.current) {
      const percentage = (videoRef.current.currentTime / videoRef.current.duration) * 100;
      setProgress(percentage);
    }
  };

  const handleVideoEnd = () => {
    setIsPlaying(false);
    setProgress(0);
    if (videoRef.current) {
      videoRef.current.currentTime = 0;
    }
  };

  const handleProgressClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (videoRef.current) {
      const rect = e.currentTarget.getBoundingClientRect();
      const clickPosition = (e.clientX - rect.left) / rect.width;
      videoRef.current.currentTime = clickPosition * videoRef.current.duration;
    }
  };

  useEffect(() => {
    let timeout: NodeJS.Timeout;
    if (isPlaying) {
      timeout = setTimeout(() => setShowControls(false), 3000);
    } else {
      setShowControls(true);
    }
    return () => clearTimeout(timeout);
  }, [isPlaying]);

  return (
    <section className="mt-16 space-y-12">
      {/* Section Header */}
      <div className="text-center">
        <h2 className="text-2xl lg:text-3xl font-bold gradient-text mb-3">
          How Tap Trading Works
        </h2>
        <p className="text-muted-foreground max-w-xl mx-auto">
          Experience simplified perpetuals trading with our intuitive tap-to-trade interface
        </p>
      </div>

      {/* Video + Steps Grid */}
      <div className="grid lg:grid-cols-2 gap-8">
        {/* Video Player */}
        <div 
          className="glass-card rounded-2xl overflow-hidden relative group"
          onMouseEnter={() => setShowControls(true)}
          onMouseMove={() => setShowControls(true)}
        >
          <video
            ref={videoRef}
            className="w-full aspect-video object-cover"
            muted={isMuted}
            playsInline
            onTimeUpdate={handleTimeUpdate}
            onEnded={handleVideoEnd}
          >
            <source src="/videos/tap-trading-preview.mp4" type="video/mp4" />
            Your browser does not support the video tag.
          </video>

          {/* Play/Pause Overlay */}
          <div 
            className={`absolute inset-0 flex items-center justify-center transition-all cursor-pointer ${
              isPlaying && !showControls ? 'bg-transparent' : 'bg-black/30 hover:bg-black/40'
            }`}
            onClick={togglePlay}
          >
            {(!isPlaying || showControls) && (
              <div className="w-16 h-16 lg:w-20 lg:h-20 rounded-full bg-gradient-to-br from-ocean-cyan to-ocean-seafoam flex items-center justify-center shadow-[0_0_40px_hsl(var(--ocean-cyan)/0.4)] hover:scale-110 transition-transform">
                {isPlaying ? (
                  <Pause className="w-6 h-6 lg:w-8 lg:h-8 text-background" />
                ) : (
                  <Play className="w-6 h-6 lg:w-8 lg:h-8 text-background ml-1" />
                )}
              </div>
            )}
          </div>

          {/* Bottom Controls */}
          <div className={`absolute bottom-0 left-0 right-0 transition-opacity ${showControls || !isPlaying ? 'opacity-100' : 'opacity-0'}`}>
            {/* Progress Bar */}
            <div 
              className="h-1 bg-border/30 cursor-pointer"
              onClick={handleProgressClick}
            >
              <div 
                className="h-full bg-gradient-to-r from-ocean-cyan to-ocean-seafoam transition-all"
                style={{ width: `${progress}%` }}
              />
            </div>

            {/* Control Buttons */}
            <div className="flex items-center justify-between px-4 py-2 bg-background/80 backdrop-blur-sm">
              <button
                onClick={(e) => { e.stopPropagation(); togglePlay(); }}
                className="p-1 hover:text-ocean-cyan transition-colors"
              >
                {isPlaying ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4" />}
              </button>
              
              <div className="flex items-center gap-2">
                <button
                  onClick={(e) => { e.stopPropagation(); toggleMute(); }}
                  className="p-1 hover:text-ocean-cyan transition-colors"
                >
                  {isMuted ? <VolumeX className="w-4 h-4" /> : <Volume2 className="w-4 h-4" />}
                </button>
                <button
                  onClick={(e) => { e.stopPropagation(); handleFullscreen(); }}
                  className="p-1 hover:text-ocean-cyan transition-colors"
                >
                  <Maximize className="w-4 h-4" />
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Step-by-Step Guide */}
        <div className="space-y-4">
          <h3 className="text-lg font-semibold text-foreground mb-4">Step-by-Step Guide</h3>
          {steps.map((step) => (
            <div key={step.number} className="glass-card rounded-xl p-4 flex items-start gap-4 hover:border-ocean-cyan/30 transition-colors">
              <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-ocean-cyan to-ocean-seafoam flex items-center justify-center flex-shrink-0">
                <span className="text-background font-bold text-sm">{step.number}</span>
              </div>
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-1">
                  <step.icon className="w-4 h-4 text-ocean-cyan" />
                  <h4 className="font-semibold text-foreground">{step.title}</h4>
                </div>
                <p className="text-sm text-muted-foreground">{step.description}</p>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Key Features Grid */}
      <div>
        <h3 className="text-lg font-semibold text-foreground text-center mb-6">Key Features</h3>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {features.map((feature) => (
            <div key={feature.title} className="glass-card rounded-xl p-5 text-center hover:border-ocean-cyan/30 transition-colors group">
              <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-ocean-cyan/20 to-ocean-seafoam/20 flex items-center justify-center mx-auto mb-3 group-hover:from-ocean-cyan/30 group-hover:to-ocean-seafoam/30 transition-colors">
                <feature.icon className="w-6 h-6 text-ocean-cyan" />
              </div>
              <h4 className="font-semibold text-foreground mb-1 text-sm">{feature.title}</h4>
              <p className="text-xs text-muted-foreground">{feature.description}</p>
            </div>
          ))}
        </div>
      </div>

      {/* FAQ Accordion */}
      <div className="max-w-2xl mx-auto">
        <h3 className="text-lg font-semibold text-foreground text-center mb-6">Frequently Asked Questions</h3>
        <Accordion type="single" collapsible className="space-y-2">
          {faqs.map((faq, index) => (
            <AccordionItem 
              key={index} 
              value={`item-${index}`}
              className="glass-card rounded-xl border-none px-4"
            >
              <AccordionTrigger className="text-left text-foreground hover:text-ocean-cyan hover:no-underline py-4">
                {faq.question}
              </AccordionTrigger>
              <AccordionContent className="text-muted-foreground pb-4">
                {faq.answer}
              </AccordionContent>
            </AccordionItem>
          ))}
        </Accordion>
      </div>
    </section>
  );
};

export default HowItWorksSection;

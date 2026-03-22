import React, { useState, useEffect } from "react";
import { InputOTP, InputOTPGroup, InputOTPSlot } from "@/components/ui/input-otp";
import { Button } from "@/components/ui/button";
import KindSwapLogo from "@/components/KindSwapLogo";
import { Lock, ShieldAlert } from "lucide-react";

interface PinProtectionProps {
  children: React.ReactNode;
  correctPin?: string;
}

const PinProtection = ({ children, correctPin = "9125" }: PinProtectionProps) => {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [pin, setPin] = useState("");
  const [error, setError] = useState(false);
  const [isChecking, setIsChecking] = useState(true);

  // Check sessionStorage on mount
  useEffect(() => {
    const stored = sessionStorage.getItem("dev-spec-auth");
    if (stored === "true") {
      setIsAuthenticated(true);
    }
    setIsChecking(false);
  }, []);

  // Auto-verify when PIN is complete
  useEffect(() => {
    if (pin.length === 4) {
      handleVerify();
    }
  }, [pin]);

  const handleVerify = () => {
    if (pin === correctPin) {
      sessionStorage.setItem("dev-spec-auth", "true");
      setIsAuthenticated(true);
      setError(false);
    } else {
      setError(true);
      setPin("");
    }
  };

  // Show nothing while checking auth status
  if (isChecking) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="animate-pulse">
          <KindSwapLogo className="h-12 w-auto opacity-50" />
        </div>
      </div>
    );
  }

  // If authenticated, show the protected content
  if (isAuthenticated) {
    return <>{children}</>;
  }

  // PIN entry screen
  return (
    <div className="min-h-screen bg-background relative overflow-hidden flex items-center justify-center">
      {/* Background effects */}
      <div className="absolute inset-0 bg-gradient-to-br from-ocean-cyan/5 via-transparent to-purple-500/5" />
      <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-ocean-cyan/10 rounded-full blur-3xl" />
      <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-purple-500/10 rounded-full blur-3xl" />
      
      {/* PIN Entry Card */}
      <div className="relative z-10 glass-card border border-white/10 rounded-2xl p-8 max-w-md w-full mx-4 text-center">
        {/* Logo */}
        <div className="flex justify-center mb-6">
          <KindSwapLogo className="h-10 w-auto" />
        </div>
        
        {/* Lock Icon */}
        <div className="flex justify-center mb-4">
          <div className="w-16 h-16 rounded-full bg-ocean-cyan/10 border border-ocean-cyan/30 flex items-center justify-center">
            <Lock className="w-8 h-8 text-ocean-cyan" />
          </div>
        </div>
        
        {/* Title */}
        <h1 className="text-2xl font-bold mb-2 gradient-text">
          Internal Access Required
        </h1>
        <p className="text-muted-foreground text-sm mb-8">
          Enter the 4-digit PIN to access this page
        </p>
        
        {/* PIN Input */}
        <div className="flex justify-center mb-6">
          <InputOTP
            value={pin}
            onChange={setPin}
            maxLength={4}
          >
            <InputOTPGroup className="gap-3">
              <InputOTPSlot 
                index={0} 
                className={`w-14 h-14 text-xl font-bold bg-white/5 border-white/20 rounded-lg ${
                  error ? "border-destructive ring-2 ring-destructive/50" : "focus-within:ring-2 focus-within:ring-ocean-cyan focus-within:border-ocean-cyan"
                }`}
              />
              <InputOTPSlot 
                index={1} 
                className={`w-14 h-14 text-xl font-bold bg-white/5 border-white/20 rounded-lg ${
                  error ? "border-destructive ring-2 ring-destructive/50" : "focus-within:ring-2 focus-within:ring-ocean-cyan focus-within:border-ocean-cyan"
                }`}
              />
              <InputOTPSlot 
                index={2} 
                className={`w-14 h-14 text-xl font-bold bg-white/5 border-white/20 rounded-lg ${
                  error ? "border-destructive ring-2 ring-destructive/50" : "focus-within:ring-2 focus-within:ring-ocean-cyan focus-within:border-ocean-cyan"
                }`}
              />
              <InputOTPSlot 
                index={3} 
                className={`w-14 h-14 text-xl font-bold bg-white/5 border-white/20 rounded-lg ${
                  error ? "border-destructive ring-2 ring-destructive/50" : "focus-within:ring-2 focus-within:ring-ocean-cyan focus-within:border-ocean-cyan"
                }`}
              />
            </InputOTPGroup>
          </InputOTP>
        </div>
        
        {/* Error Message */}
        {error && (
          <div className="flex items-center justify-center gap-2 text-destructive mb-4 animate-pulse">
            <ShieldAlert className="w-4 h-4" />
            <span className="text-sm font-medium">Incorrect PIN. Try again.</span>
          </div>
        )}
        
        {/* Unlock Button */}
        <Button
          onClick={handleVerify}
          disabled={pin.length !== 4}
          className="w-full bg-gradient-to-r from-ocean-cyan to-ocean-cyan/80 hover:from-ocean-cyan/90 hover:to-ocean-cyan/70 text-background font-semibold"
        >
          <Lock className="w-4 h-4 mr-2" />
          Unlock Access
        </Button>
        
        {/* Footer Note */}
        <p className="text-xs text-muted-foreground mt-6">
          This page is for internal development use only.
        </p>
      </div>
    </div>
  );
};

export default PinProtection;

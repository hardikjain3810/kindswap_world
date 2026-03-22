import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { PhantomProvider, darkTheme, AddressType } from "@phantom/react-sdk";
import { WalletContextProvider } from "./contexts/WalletContextProvider";
import WhatToExpect from "./pages/WhatToExpect";
import SwapSpec from "./pages/SwapSpec";
import DevSpec from "./pages/DevSpec";
import ImpactDashboard from "./pages/ImpactDashboard";
import Portfolio from "./pages/Portfolio";
import TapTrading from "./pages/TapTrading";
import PredictionMarkets from "./pages/PredictionMarkets";
import Leaderboard from "./pages/Leaderboard";
import StakingStats from "./pages/StakingStats";
import NotFound from "./pages/NotFound";
import AppLayout from "./components/layout/AppLayout";
import Swap from "./pages/swap";
import JupiterSwapTest from "./components/JupiterSwapTest";
import { PhantomMobileCallbackHandler } from "./components/PhantomMobileCallbackHandler";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <PhantomProvider
      config={{
        providers: ["google", "apple", "injected"],
        appId: "175a507c-52cd-4643-9dfc-534b9d1ce7d5",
        addressTypes: [AddressType.solana],
        // authOptions: {
        //   redirectUrl: import.meta.env.PROD
        //     ? "https://kindswap.world/auth/callback"
        //     : "http://localhost:5173/auth/callback",
        // },
      }}
      theme={darkTheme}
      appIcon="https://kindswap.world/logo.png"
      appName="KindSwap"
    >
      <WalletContextProvider>
        <PhantomMobileCallbackHandler />
        <TooltipProvider>
          <Toaster />
          <Sonner />
          <BrowserRouter>
            <Routes>
              <Route element={<AppLayout />}>
                <Route path="/" element={<Navigate to="/swap" replace />} />
                <Route path="/swap" element={<Swap />} />
                <Route path="/what-to-expect" element={<WhatToExpect />} />
                <Route path="/swap-spec" element={<SwapSpec />} />
                {/* <Route path="/swap-test" element={<JupiterSwapTest />} /> */}
                <Route path="/dev-spec" element={<DevSpec />} />
                <Route path="/impact-dashboard" element={<ImpactDashboard />} />
                <Route path="/portfolio" element={<Portfolio />} />
                <Route path="/perps" element={<TapTrading />} />
                <Route path="/predict" element={<PredictionMarkets />} />
                <Route path="/leaderboard" element={<Leaderboard />} />
                <Route path="/staking" element={<StakingStats />} />
              {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
                <Route path="*" element={<NotFound />} />
              </Route>
            </Routes>
          </BrowserRouter>
        </TooltipProvider>
      </WalletContextProvider>
    </PhantomProvider>
  </QueryClientProvider>
);

export default App;

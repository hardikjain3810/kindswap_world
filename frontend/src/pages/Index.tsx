import Header from "@/components/Header";
import HeroSection from "@/components/HeroSection";
import HowItWorks from "@/components/HowItWorks";
import AIDashboard from "@/components/AIDashboard";
import Causes from "@/components/Causes";
import SolanaSection from "@/components/SolanaSection";
import Roadmap from "@/components/Roadmap";
import Newsletter from "@/components/Newsletter";
const Index = () => {
  return <main className="min-h-screen bg-background text-foreground overflow-x-hidden">
      {/* <Header /> */}
      <HeroSection />
      <AIDashboard />
      <HowItWorks />
      <Causes />
      
      <Roadmap />
      <Newsletter />
    </main>;
};
export default Index;
// import { Badge } from "../components/ui/badge";
// import { Button } from "../components/ui/button";
// import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogDescription } from "../components/ui/dialog";
// import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "../components/ui/table";
// import { Zap, Trophy, Users, Coins, Wallet, ExternalLink, Clock, CheckCircle2, XCircle, Send, Award, TrendingUp, Star, Crown, Medal } from "lucide-react";
// import KindSwapLogo from "../components/KindSwapLogo";
// import { useState, useEffect } from "react";
// import PinProtection from "../components/PinProtection";

// // Mock leaderboard data
// const leaderboardData = [
//   { rank: 1, wallet: "7xKp...3mNq", total: 125430, swap: 85200, community: 15230, kns: 25000 },
//   { rank: 2, wallet: "9aRt...7bXz", total: 98750, swap: 72500, community: 8250, kns: 18000 },
//   { rank: 3, wallet: "4mLs...2kPw", total: 87320, swap: 65000, community: 12320, kns: 10000 },
//   { rank: 4, wallet: "2nVf...8jHy", total: 76540, swap: 58000, community: 6540, kns: 12000 },
//   { rank: 5, wallet: "5pQr...1cDe", total: 65890, swap: 48000, community: 9890, kns: 8000 },
//   { rank: 6, wallet: "8wTs...4gBn", total: 54320, swap: 42000, community: 4320, kns: 8000 },
//   { rank: 7, wallet: "3yUv...6fAm", total: 43210, swap: 35000, community: 3210, kns: 5000 },
//   { rank: 8, wallet: "6zXc...9eKl", total: 32100, swap: 28000, community: 2100, kns: 2000 },
//   { rank: 9, wallet: "1aBd...5hJi", total: 21050, swap: 18000, community: 1050, kns: 2000 },
//   { rank: 10, wallet: "0cEf...3gLo", total: 15000, swap: 12000, community: 1000, kns: 2000 },
// ];

// // Points system data
// const swapPointsRules = [
//   { rule: "1 Point per $1 USD swapped", note: "Based on swap value at time of transaction" },
//   { rule: "Minimum swap: $5 USD", note: "Swaps below $5 earn 0 points" },
//   { rule: "Daily cap: 10,000 points", note: "Prevents gaming via circular trades" },
// ];

// const communityPointsTable = [
//   { category: "Twitter Post", points: "10-50", criteria: "Quality mention, retweet potential" },
//   { category: "Twitter Thread", points: "50-200", criteria: "Educational content, engagement" },
//   { category: "YouTube Video", points: "100-500", criteria: "Quality, views, subscriber count" },
//   { category: "Blog Article", points: "50-300", criteria: "Depth, SEO value, platform reach" },
//   { category: "Translation", points: "100-400", criteria: "Language, content length, accuracy" },
// ];

// const knsHoldingTiers = [
//   { balance: "< 5,000 KNS", dailyPoints: "0", multiplier: "—" },
//   { balance: "5,000 – 24,999 KNS", dailyPoints: "10", multiplier: "1x" },
//   { balance: "25,000 – 99,999 KNS", dailyPoints: "30", multiplier: "1.5x" },
//   { balance: "100,000 – 499,999 KNS", dailyPoints: "75", multiplier: "2x" },
//   { balance: "≥ 500,000 KNS", dailyPoints: "200", multiplier: "3x" },
// ];

// // Fee discount tiers
// const feeDiscountTiers = [
//   { tier: "No Tier", balance: "< 5,000 KNS", discount: "0%", fee: "0.10%" },
//   { tier: "Tier 1", balance: "≥ 5,000 KNS", discount: "5%", fee: "0.095%" },
//   { tier: "Tier 2", balance: "≥ 25,000 KNS", discount: "10%", fee: "0.09%" },
//   { tier: "Tier 3", balance: "≥ 100,000 KNS", discount: "15%", fee: "0.085%" },
//   { tier: "Tier 4", balance: "≥ 500,000 KNS", discount: "20%", fee: "0.08%" },
// ];

// const DevSpec = () => {
//   const [timeFilter, setTimeFilter] = useState<"today" | "week" | "all">("all");
//   const [isConnected, setIsConnected] = useState(true);
//   const [submissionStatus, setSubmissionStatus] = useState<"idle" | "pending" | "approved" | "rejected">("idle");

//   // Add noindex meta tag to prevent search engine indexing
//   useEffect(() => {
//     const metaRobots = document.createElement('meta');
//     metaRobots.name = 'robots';
//     metaRobots.content = 'noindex, nofollow';
//     document.head.appendChild(metaRobots);
    
//     return () => {
//       document.head.removeChild(metaRobots);
//     };
//   }, []);

//   return (
//     <PinProtection>
//       <div className="min-h-screen bg-background relative overflow-hidden">
//       {/* Background Effects */}
//       <div className="absolute inset-0 overflow-hidden pointer-events-none">
//         <div className="absolute top-1/4 left-1/4 w-[600px] h-[600px] rounded-full bg-ocean-cyan/10 blur-[120px]" />
//         <div className="absolute bottom-1/4 right-1/4 w-[500px] h-[500px] rounded-full bg-ocean-seafoam/10 blur-[100px]" />
//         <div className="absolute inset-0 opacity-[0.02]" style={{
//           backgroundImage: `linear-gradient(hsl(var(--foreground)) 1px, transparent 1px), linear-gradient(90deg, hsl(var(--foreground)) 1px, transparent 1px)`,
//           backgroundSize: "60px 60px"
//         }} />
//       </div>

//       {/* Internal Label - Top Right */}
//       {/* <div className="absolute top-4 right-4 z-50">
//         <Badge variant="outline" className="bg-destructive/10 text-destructive border-destructive/30 text-xs">
//           Internal Dev Spec – Not Public
//         </Badge>
//       </div> */}

//       <div className="container mx-auto px-4 py-28 relative z-10">
//         {/* Hero Section */}
//         <div className="text-center mb-16">
//           <div className="flex items-center justify-center gap-3 mb-6">
//             <KindSwapLogo className="w-10 h-10" />
//             {/* <Badge variant="gradient" className="mb-0">
//               <Trophy className="w-3 h-3 mr-1" />
//               Phase 1 Features
//             </Badge> */}
//           </div>

//           <h1 className="text-4xl md:text-5xl font-bold leading-tight mb-4">
//             <span className="text-foreground">Leaderboard & Points</span>
//             <br />
//             <span className="gradient-text">UI Specification</span>
//           </h1>

//           <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
//             Reference implementation for the KindSwap Leaderboard, Points System, and KNS Fee Discount features. 
//             Developers should replicate these layouts and states exactly.
//           </p>
//         </div>

//         {/* Wallet Connection Toggle (Dev Tool) */}
//         <div className="glass-card p-4 border border-ocean-cyan/20 max-w-md mx-auto mb-12">
//           <p className="text-sm text-muted-foreground mb-3">
//             <span className="text-ocean-cyan font-semibold">Dev Toggle:</span> Simulate wallet states
//           </p>
//           <div className="flex gap-2">
//             <Button 
//               variant={isConnected ? "default" : "outline"} 
//               size="sm"
//               onClick={() => setIsConnected(true)}
//               className={isConnected ? "bg-ocean-cyan text-background hover:bg-ocean-cyan/90" : ""}
//             >
//               <Wallet className="w-4 h-4 mr-2" />
//               Connected
//             </Button>
//             <Button 
//               variant={!isConnected ? "default" : "outline"} 
//               size="sm"
//               onClick={() => setIsConnected(false)}
//               className={!isConnected ? "bg-muted text-foreground" : ""}
//             >
//               Disconnected
//             </Button>
//           </div>
//         </div>

//         {/* ==================== LEADERBOARD SECTION ==================== */}
//         <section className="mb-20">
//           <h2 className="text-2xl font-bold mb-2 gradient-text flex items-center gap-2">
//             <Trophy className="w-6 h-6" />
//             Leaderboard UI
//           </h2>
//           <p className="text-muted-foreground mb-8">Top 100 wallets ranked by total points. Updates in real-time.</p>

//           {/* Time Filters */}
//           <div className="flex gap-2 mb-6">
//             {[
//               { key: "today", label: "Today" },
//               { key: "week", label: "Last 7 Days" },
//               { key: "all", label: "All-Time" },
//             ].map((filter) => (
//               <button
//                 key={filter.key}
//                 onClick={() => setTimeFilter(filter.key as typeof timeFilter)}
//                 className={`px-4 py-2 rounded-full text-sm font-medium transition-all ${
//                   timeFilter === filter.key
//                     ? "bg-ocean-cyan/20 text-ocean-cyan border border-ocean-cyan/30"
//                     : "bg-muted/50 text-muted-foreground hover:bg-muted"
//                 }`}
//               >
//                 {filter.label}
//               </button>
//             ))}
//           </div>

//           <div className="grid lg:grid-cols-3 gap-6">
//             {/* Leaderboard Table */}
//             <div className="lg:col-span-2 glass-card p-6 border border-border/50">
//               <Table>
//                 <TableHeader>
//                   <TableRow className="border-border/50 hover:bg-transparent">
//                     <TableHead className="text-muted-foreground">Rank</TableHead>
//                     <TableHead className="text-muted-foreground">Wallet</TableHead>
//                     <TableHead className="text-muted-foreground text-right">Total</TableHead>
//                     <TableHead className="text-muted-foreground text-right hidden md:table-cell">Swap</TableHead>
//                     <TableHead className="text-muted-foreground text-right hidden md:table-cell">Community</TableHead>
//                     <TableHead className="text-muted-foreground text-right hidden lg:table-cell">KNS</TableHead>
//                   </TableRow>
//                 </TableHeader>
//                 <TableBody>
//                   {leaderboardData.map((entry) => (
//                     <TableRow 
//                       key={entry.rank} 
//                       className={`border-border/30 hover:bg-muted/20 ${
//                         entry.rank <= 3 ? "bg-ocean-cyan/5" : ""
//                       }`}
//                     >
//                       <TableCell className="font-medium">
//                         <div className="flex items-center gap-2">
//                           {entry.rank === 1 && <Crown className="w-4 h-4 text-yellow-500" />}
//                           {entry.rank === 2 && <Medal className="w-4 h-4 text-gray-400" />}
//                           {entry.rank === 3 && <Medal className="w-4 h-4 text-amber-600" />}
//                           <span className={entry.rank <= 3 ? "text-ocean-cyan font-bold" : ""}>
//                             #{entry.rank}
//                           </span>
//                         </div>
//                       </TableCell>
//                       <TableCell className="font-mono text-sm">{entry.wallet}</TableCell>
//                       <TableCell className="text-right font-bold text-ocean-cyan">
//                         {entry.total.toLocaleString()}
//                       </TableCell>
//                       <TableCell className="text-right hidden md:table-cell">
//                         {entry.swap.toLocaleString()}
//                       </TableCell>
//                       <TableCell className="text-right hidden md:table-cell">
//                         {entry.community.toLocaleString()}
//                       </TableCell>
//                       <TableCell className="text-right hidden lg:table-cell">
//                         {entry.kns.toLocaleString()}
//                       </TableCell>
//                     </TableRow>
//                   ))}
//                 </TableBody>
//               </Table>
//             </div>

//             {/* Your Points Card */}
//             <div className="glass-card p-6 border border-border/50">
//               <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
//                 <Star className="w-5 h-5 text-ocean-cyan" />
//                 Your Points
//               </h3>

//               {isConnected ? (
//                 <div className="space-y-4">
//                   <div className="flex items-center gap-2 text-sm text-muted-foreground mb-4">
//                     <Wallet className="w-4 h-4" />
//                     <span className="font-mono">7xKp...3mNq</span>
//                     <Badge variant="outline" className="bg-ocean-cyan/10 text-ocean-cyan border-ocean-cyan/30 text-xs ml-auto">
//                       Rank #1
//                     </Badge>
//                   </div>

//                   <div className="space-y-3">
//                     <div className="flex justify-between items-center p-3 bg-muted/30 rounded-lg">
//                       <span className="text-muted-foreground">Total Points</span>
//                       <span className="font-bold text-xl gradient-text">125,430</span>
//                     </div>
//                     <div className="flex justify-between items-center p-3 bg-muted/20 rounded-lg">
//                       <span className="text-muted-foreground text-sm">Swap Points</span>
//                       <span className="font-medium">85,200</span>
//                     </div>
//                     <div className="flex justify-between items-center p-3 bg-muted/20 rounded-lg">
//                       <span className="text-muted-foreground text-sm">Community Points</span>
//                       <span className="font-medium">15,230</span>
//                     </div>
//                     <div className="flex justify-between items-center p-3 bg-muted/20 rounded-lg">
//                       <span className="text-muted-foreground text-sm">KNS Holding Points</span>
//                       <span className="font-medium">25,000</span>
//                     </div>
//                   </div>
//                 </div>
//               ) : (
//                 /* Disconnected State */
//                 <div className="text-center py-8">
//                   <Wallet className="w-12 h-12 text-muted-foreground mx-auto mb-4 opacity-50" />
//                   <p className="text-muted-foreground mb-4">Connect your wallet to view your points</p>
//                   <Button variant="outline" className="border-ocean-cyan/30 text-ocean-cyan hover:bg-ocean-cyan/10">
//                     <Wallet className="w-4 h-4 mr-2" />
//                     Connect Wallet
//                   </Button>
//                 </div>
//               )}
//             </div>
//           </div>

//           {/* Zero Points State */}
//           <div className="mt-8 glass-card p-6 border border-border/50 max-w-md">
//             <h4 className="text-sm font-semibold mb-4 text-muted-foreground">Empty State: Zero Points</h4>
//             <div className="text-center py-6 bg-muted/20 rounded-lg">
//               <TrendingUp className="w-10 h-10 text-muted-foreground mx-auto mb-3 opacity-50" />
//               <p className="text-muted-foreground text-sm mb-2">No points earned yet</p>
//               <p className="text-xs text-muted-foreground/70">Start swapping or contribute to earn points!</p>
//             </div>
//           </div>
//         </section>

//         {/* ==================== POINTS SYSTEM SECTION ==================== */}
//         <section className="mb-20">
//           <h2 className="text-2xl font-bold mb-2 gradient-text flex items-center gap-2">
//             <Award className="w-6 h-6" />
//             Points System
//           </h2>
//           <p className="text-muted-foreground mb-8">How users earn points across different activities.</p>

//           <div className="grid md:grid-cols-3 gap-6">
//             {/* Swap Usage Points */}
//             <div className="glass-card p-6 border border-border/50">
//               <div className="flex items-center gap-3 mb-4">
//                 <div className="w-10 h-10 rounded-full bg-ocean-cyan/20 flex items-center justify-center">
//                   <Zap className="w-5 h-5 text-ocean-cyan" />
//                 </div>
//                 <h3 className="font-semibold">Swap Usage Points</h3>
//               </div>
//               <ul className="space-y-3">
//                 {swapPointsRules.map((rule, idx) => (
//                   <li key={idx} className="text-sm">
//                     <p className="text-foreground font-medium">{rule.rule}</p>
//                     <p className="text-muted-foreground text-xs mt-0.5">{rule.note}</p>
//                   </li>
//                 ))}
//               </ul>
//             </div>

//             {/* Community Contribution Points */}
//             <div className="glass-card p-6 border border-border/50">
//               <div className="flex items-center gap-3 mb-4">
//                 <div className="w-10 h-10 rounded-full bg-ocean-seafoam/20 flex items-center justify-center">
//                   <Users className="w-5 h-5 text-ocean-seafoam" />
//                 </div>
//                 <h3 className="font-semibold">Community Points</h3>
//               </div>
//               <div className="space-y-2">
//                 {communityPointsTable.map((item, idx) => (
//                   <div key={idx} className="flex justify-between items-center text-sm py-1.5 border-b border-border/30 last:border-0">
//                     <span className="text-muted-foreground">{item.category}</span>
//                     <span className="text-ocean-seafoam font-medium">{item.points} pts</span>
//                   </div>
//                 ))}
//               </div>
//             </div>

//             {/* KNS Holding Points */}
//             <div className="glass-card p-6 border border-border/50">
//               <div className="flex items-center gap-3 mb-4">
//                 <div className="w-10 h-10 rounded-full bg-ocean-light/20 flex items-center justify-center">
//                   <Coins className="w-5 h-5 text-ocean-light" />
//                 </div>
//                 <h3 className="font-semibold">KNS Holding Points</h3>
//               </div>
//               <p className="text-xs text-muted-foreground mb-3">Daily accrual based on wallet balance:</p>
//               <div className="space-y-2">
//                 {knsHoldingTiers.map((tier, idx) => (
//                   <div key={idx} className="flex justify-between items-center text-sm py-1.5 border-b border-border/30 last:border-0">
//                     <span className="text-muted-foreground text-xs">{tier.balance}</span>
//                     <span className="text-ocean-light font-medium">{tier.dailyPoints}/day</span>
//                   </div>
//                 ))}
//               </div>
//             </div>
//           </div>
//         </section>

//         {/* ==================== COMMUNITY SUBMISSION MODAL ==================== */}
//         <section className="mb-20">
//           <h2 className="text-2xl font-bold mb-2 gradient-text flex items-center gap-2">
//             <Send className="w-6 h-6" />
//             Community Submission Modal
//           </h2>
//           <p className="text-muted-foreground mb-8">Modal for submitting community contributions for point rewards.</p>

//           <div className="flex flex-wrap gap-4 mb-6">
//             {/* Submission Status Toggles */}
//             <div className="glass-card p-4 border border-border/50">
//               <p className="text-xs text-muted-foreground mb-2">Dev Toggle: Submission Status</p>
//               <div className="flex gap-2">
//                 {["idle", "pending", "approved", "rejected"].map((status) => (
//                   <button
//                     key={status}
//                     onClick={() => setSubmissionStatus(status as typeof submissionStatus)}
//                     className={`px-3 py-1.5 rounded-full text-xs font-medium transition-all capitalize ${
//                       submissionStatus === status
//                         ? "bg-ocean-cyan/20 text-ocean-cyan border border-ocean-cyan/30"
//                         : "bg-muted/50 text-muted-foreground hover:bg-muted"
//                     }`}
//                   >
//                     {status}
//                   </button>
//                 ))}
//               </div>
//             </div>
//           </div>

//           <Dialog>
//             <DialogTrigger asChild>
//               <Button variant="default" className="bg-ocean-cyan text-background hover:bg-ocean-cyan/90">
//                 <Send className="w-4 h-4 mr-2" />
//                 Submit Contribution
//               </Button>
//             </DialogTrigger>
//             <DialogContent className="glass-card border-border/50 max-w-md">
//               <DialogHeader>
//                 <DialogTitle className="gradient-text">Submit Community Contribution</DialogTitle>
//                 <DialogDescription className="text-muted-foreground">
//                   Share your content to earn community points. Submissions are reviewed by the team.
//                 </DialogDescription>
//               </DialogHeader>

//               <div className="space-y-4 mt-4">
//                 {/* Content Link */}
//                 <div>
//                   <label className="text-sm text-muted-foreground mb-1.5 block">Content Link</label>
//                   <input 
//                     type="url" 
//                     placeholder="https://twitter.com/..." 
//                     className="w-full px-4 py-2.5 bg-muted/50 border border-border/50 rounded-lg text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-ocean-cyan/50"
//                   />
//                 </div>

//                 {/* Category */}
//                 <div>
//                   <label className="text-sm text-muted-foreground mb-1.5 block">Category</label>
//                   <select className="w-full px-4 py-2.5 bg-muted/50 border border-border/50 rounded-lg text-foreground focus:outline-none focus:border-ocean-cyan/50">
//                     <option value="">Select category...</option>
//                     <option value="twitter">Twitter Post</option>
//                     <option value="thread">Twitter Thread</option>
//                     <option value="youtube">YouTube Video</option>
//                     <option value="blog">Blog Article</option>
//                     <option value="translation">Translation</option>
//                   </select>
//                 </div>

//                 {/* Description */}
//                 <div>
//                   <label className="text-sm text-muted-foreground mb-1.5 block">Short Description</label>
//                   <textarea 
//                     placeholder="Briefly describe your contribution..."
//                     rows={3}
//                     className="w-full px-4 py-2.5 bg-muted/50 border border-border/50 rounded-lg text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-ocean-cyan/50 resize-none"
//                   />
//                 </div>

//                 {/* Status Indicator */}
//                 {submissionStatus !== "idle" && (
//                   <div className={`flex items-center gap-2 p-3 rounded-lg ${
//                     submissionStatus === "pending" ? "bg-yellow-500/10 text-yellow-500" :
//                     submissionStatus === "approved" ? "bg-green-500/10 text-green-500" :
//                     "bg-destructive/10 text-destructive"
//                   }`}>
//                     {submissionStatus === "pending" && <Clock className="w-4 h-4" />}
//                     {submissionStatus === "approved" && <CheckCircle2 className="w-4 h-4" />}
//                     {submissionStatus === "rejected" && <XCircle className="w-4 h-4" />}
//                     <span className="text-sm font-medium capitalize">{submissionStatus}</span>
//                     {submissionStatus === "approved" && <span className="text-xs ml-auto">+150 pts</span>}
//                   </div>
//                 )}

//                 <Button className="w-full bg-ocean-cyan text-background hover:bg-ocean-cyan/90">
//                   Submit for Review
//                 </Button>
//               </div>
//             </DialogContent>
//           </Dialog>
//         </section>

//         {/* ==================== FEE DISCOUNT TIER MODAL ==================== */}
//         <section className="mb-20">
//           <h2 className="text-2xl font-bold mb-2 gradient-text flex items-center gap-2">
//             <Coins className="w-6 h-6" />
//             Fee Discount Tier Modal
//           </h2>
//           <p className="text-muted-foreground mb-8">Modal showing KNS balance-based fee discounts with current tier highlighting.</p>

//           <Dialog>
//             <DialogTrigger asChild>
//               <Button variant="outline" className="border-ocean-cyan/30 text-ocean-cyan hover:bg-ocean-cyan/10">
//                 <Coins className="w-4 h-4 mr-2" />
//                 View Fee Tiers
//               </Button>
//             </DialogTrigger>
//             <DialogContent className="glass-card border-border/50 max-w-lg">
//               <DialogHeader>
//                 <DialogTitle className="gradient-text">KNS Fee Discount Tiers</DialogTitle>
//                 <DialogDescription className="text-muted-foreground">
//                   Hold KNS tokens to reduce your swap fees. Discounts apply automatically based on wallet balance.
//                 </DialogDescription>
//               </DialogHeader>

//               <div className="mt-4">
//                 {/* Current Tier Highlight */}
//                 {isConnected && (
//                   <div className="flex items-center gap-3 p-4 bg-ocean-cyan/10 border border-ocean-cyan/30 rounded-lg mb-4">
//                     <div className="w-10 h-10 rounded-full bg-ocean-cyan/20 flex items-center justify-center">
//                       <Award className="w-5 h-5 text-ocean-cyan" />
//                     </div>
//                     <div>
//                       <p className="font-semibold text-ocean-cyan">Your Current Tier: Tier 4</p>
//                       <p className="text-xs text-muted-foreground">Holding 520,000 KNS • 20% discount</p>
//                     </div>
//                   </div>
//                 )}

//                 {/* Tier Table */}
//                 <Table>
//                   <TableHeader>
//                     <TableRow className="border-border/50 hover:bg-transparent">
//                       <TableHead className="text-muted-foreground">Tier</TableHead>
//                       <TableHead className="text-muted-foreground">KNS Balance</TableHead>
//                       <TableHead className="text-muted-foreground text-right">Discount</TableHead>
//                       <TableHead className="text-muted-foreground text-right">Effective Fee</TableHead>
//                     </TableRow>
//                   </TableHeader>
//                   <TableBody>
//                     {feeDiscountTiers.map((tier, idx) => (
//                       <TableRow 
//                         key={idx} 
//                         className={`border-border/30 hover:bg-muted/20 ${
//                           isConnected && tier.tier === "Tier 4" ? "bg-ocean-cyan/10" : ""
//                         }`}
//                       >
//                         <TableCell className="font-medium">
//                           {isConnected && tier.tier === "Tier 4" && (
//                             <CheckCircle2 className="w-4 h-4 text-ocean-cyan inline mr-2" />
//                           )}
//                           {tier.tier}
//                         </TableCell>
//                         <TableCell className="text-muted-foreground text-sm">{tier.balance}</TableCell>
//                         <TableCell className="text-right font-medium text-ocean-seafoam">{tier.discount}</TableCell>
//                         <TableCell className="text-right font-mono">{tier.fee}</TableCell>
//                       </TableRow>
//                     ))}
//                   </TableBody>
//                 </Table>

//                 <p className="text-xs text-muted-foreground mt-4">
//                   <span className="text-ocean-cyan">Note:</span> Balance is checked at time of swap. Staked KNS also counts toward tier calculation.
//                 </p>
//               </div>
//             </DialogContent>
//           </Dialog>
//         </section>

//         {/* ==================== WALLET CONNECTION STATES ==================== */}
//         <section className="mb-20">
//           <h2 className="text-2xl font-bold mb-2 gradient-text flex items-center gap-2">
//             <Wallet className="w-6 h-6" />
//             Wallet Connection States
//           </h2>
//           <p className="text-muted-foreground mb-8">Different UI states for wallet connection.</p>

//           <div className="grid md:grid-cols-2 gap-6">
//             {/* Disconnected State */}
//             <div className="glass-card p-6 border border-border/50">
//               <h4 className="text-sm font-semibold mb-4 text-muted-foreground">Disconnected</h4>
//               <div className="flex items-center justify-between p-4 bg-muted/30 rounded-lg">
//                 <span className="text-muted-foreground">No wallet connected</span>
//                 <Button variant="outline" className="border-ocean-cyan/30 text-ocean-cyan hover:bg-ocean-cyan/10">
//                   <Wallet className="w-4 h-4 mr-2" />
//                   Connect Wallet
//                 </Button>
//               </div>
//             </div>

//             {/* Connected State */}
//             <div className="glass-card p-6 border border-border/50">
//               <h4 className="text-sm font-semibold mb-4 text-muted-foreground">Connected</h4>
//               <div className="flex items-center justify-between p-4 bg-ocean-cyan/10 border border-ocean-cyan/30 rounded-lg">
//                 <div className="flex items-center gap-3">
//                   <div className="w-8 h-8 rounded-full bg-ocean-cyan/20 flex items-center justify-center">
//                     <Wallet className="w-4 h-4 text-ocean-cyan" />
//                   </div>
//                   <div>
//                     <p className="font-mono text-sm">7xKp...3mNq</p>
//                     <p className="text-xs text-muted-foreground">520,000 KNS</p>
//                   </div>
//                 </div>
//                 <Button variant="ghost" size="sm" className="text-muted-foreground hover:text-foreground">
//                   <ExternalLink className="w-4 h-4" />
//                 </Button>
//               </div>
//             </div>
//           </div>
//         </section>

//         {/* Developer Notes */}
//         <section className="glass-card p-6 border border-ocean-cyan/20">
//           <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
//             <Zap className="w-5 h-5 text-ocean-cyan" />
//             Developer Notes
//           </h3>
//           <ul className="space-y-2 text-sm text-muted-foreground">
//             <li>• Leaderboard should paginate after 100 entries with "Load More" button</li>
//             <li>• Points update in real-time via websocket or polling (every 30s)</li>
//             <li>• Community submissions go through manual review process (1-3 day turnaround)</li>
//             <li>• KNS balance checks happen on-chain at swap execution time</li>
//             <li>• Time filters (Today/Week/All) should reset pagination</li>
//             <li>• Mobile: Collapse table columns, show Total only with expandable row</li>
//             <li>• Wallet addresses should link to Solana explorer</li>
//           </ul>
//         </section>
//       </div>
//     </div>
//     </PinProtection>
//   );
// };

// export default DevSpec;

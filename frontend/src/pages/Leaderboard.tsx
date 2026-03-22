import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { useWallet } from "@solana/wallet-adapter-react";
import { useWalletModal } from "@solana/wallet-adapter-react-ui";
import * as Sentry from "@sentry/react";
import MobileBottomNav from "@/components/MobileBottomNav";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { TrendingUp, Trophy, Zap, Users, Coins, Wallet, Star, Crown, Medal, Award, Send, ExternalLink, ChevronDown, ChevronUp, ChevronLeft, ChevronRight, Loader2 } from "lucide-react";
import Header from "@/components/Header";
import KindSwapLogo from "@/components/KindSwapLogo";
import { API_BASE_URL, API_ENDPOINTS } from "@/config/api";
import { useToast } from "@/hooks/use-toast";
import { fetchWithRetry, isTransientNetworkError } from "@/lib/utils/retry";

// Types matching the real backend API schema
interface LeaderboardEntry {
  rank: number;
  wallet: string;
  totalPoints: number;
  swapPoints: number;
  communityPoints: number;
  knsPoints: number;
}

interface UserPointsResponse {
  wallet: string;
  totalPoints: number;
  swapPoints: number;
  communityPoints: number;
  knsPoints: number;
  currentRank?: number;
  totalSwapVolumeUSD?: string;
  totalSwapsCount?: number;
}

interface LeaderboardApiResponse {
  timeframe: string;
  top100: LeaderboardEntry[];
  totalUsers: number;
  limit?: number;
  offset?: number;
}

type TimeframeFilter = "today" | "week" | "allTime";

// Contribution types (must match backend enum)
type ContributionCategory = "twitter_post" | "twitter_thread" | "video" | "blog" | "translation";
type ContributionStatus = "pending" | "approved" | "rejected";

interface Contribution {
  id: string;
  category: ContributionCategory;
  contentLink: string;
  description: string | null;
  status: ContributionStatus;
  adminNote?: string;
  pointsAwarded?: number | null;
  rejectionReason?: string | null;
  reviewedBy?: string | null;
  reviewedAt?: string | null;
  createdAt: string;
  updatedAt?: string;
}

const CONTRIBUTION_CATEGORIES: { value: ContributionCategory; label: string }[] = [
  { value: "twitter_post", label: "X (Twitter) Post" },
  { value: "twitter_thread", label: "X Educational Thread" },
  { value: "video", label: "YouTube / TikTok Video" },
  { value: "blog", label: "Blog / Guide" },
  { value: "translation", label: "Translation / Docs" },
];

// Points system data
const swapPointsRules = [
  { rule: "1 Point per $1 USD swapped", note: "Based on swap value at time of transaction" },
  { rule: "Minimum swap: $5 USD", note: "Swaps below $5 earn 0 points" },
  { rule: "Daily cap: 10,000 points", note: "Prevents gaming via circular trades" },
];

const communityPointsTable = [
  { category: "X (Twitter) Post", points: "10-50" },
  { category: "X Educational Thread", points: "50-200" },
  { category: "YouTube / TikTok Video", points: "100-500" },
  { category: "Blog / Guide", points: "50-300" },
  { category: "Translation / Docs", points: "100-400" },
];

const knsHoldingTiers = [
  { balance: "< 10,000 KNS", dailyPoints: "0" },
  { balance: "10,000 - 49,999 KNS", dailyPoints: "50" },
  { balance: "50,000 - 99,999 KNS", dailyPoints: "150" },
  { balance: "100,000 - 249,999 KNS", dailyPoints: "300" },
  { balance: ">= 250,000 KNS", dailyPoints: "500 (Max)" },
];

// Utility function to truncate links
function truncateLink(link: string, maxLength: number = 30): string {
  try {
    const url = new URL(link);
    const path = url.pathname.length > 1 ? url.pathname : "";
    const display = url.hostname + path;
    return display.length > maxLength ? display.slice(0, maxLength - 3) + "..." : display;
  } catch {
    return link.length > maxLength ? link.slice(0, maxLength - 3) + "..." : link;
  }
}

// Fetch leaderboard from real backend with pagination
async function fetchLeaderboard(
  timeframe: TimeframeFilter,
  limit: number = 20,
  offset: number = 0,
  signal?: AbortSignal
): Promise<LeaderboardApiResponse> {
  const url = `${API_BASE_URL}${API_ENDPOINTS.LEADERBOARD}?timeframe=${timeframe}&limit=${limit}&offset=${offset}`;

  const response = await fetchWithRetry(
    url,
    {
      method: 'GET',
      headers: { 'Accept': 'application/json' },
    },
    {
      signal,
      maxRetries: 2,
      initialDelay: 1000,
      onRetry: (attempt, error, delay) => {
        console.warn(`[Leaderboard] Retry attempt ${attempt} after ${delay}ms:`, error.message);
      },
    }
  );

  return response.json();
}

// Fetch user points from real backend
async function fetchUserPoints(
  wallet: string,
  signal?: AbortSignal
): Promise<UserPointsResponse & { rank: number | null }> {
  const url = `${API_BASE_URL}${API_ENDPOINTS.USER_POINTS(wallet)}`;

  try {
    const response = await fetchWithRetry(
      url,
      {
        method: 'GET',
        headers: { 'Accept': 'application/json' },
      },
      {
        signal,
        maxRetries: 2,
        initialDelay: 1000,
        onRetry: (attempt, error, delay) => {
          console.warn(`[UserPoints] Retry attempt ${attempt} after ${delay}ms:`, error.message);
        },
      }
    );

    const data = await response.json();
    return {
      ...data,
      rank: data.currentRank || null,
    };
  } catch (error) {
    // Return default values if user not found (404) or bad request (400)
    if (error instanceof Error && (error.message.includes('HTTP 404') || error.message.includes('HTTP 400'))) {
      return {
        wallet,
        totalPoints: 0,
        swapPoints: 0,
        communityPoints: 0,
        knsPoints: 0,
        rank: null,
      };
    }
    throw error;
  }
}

// Fetch user's contributions from backend
const CONTRIBUTIONS_PAGE_SIZE = 10;

async function fetchMyContributions(
  wallet: string,
  limit: number = CONTRIBUTIONS_PAGE_SIZE,
  offset: number = 0,
  signal?: AbortSignal
): Promise<{ submissions: Contribution[]; total: number }> {
  const url = `${API_BASE_URL}${API_ENDPOINTS.MY_CONTRIBUTIONS(wallet)}?limit=${limit}&offset=${offset}`;

  try {
    const response = await fetchWithRetry(
      url,
      {
        method: 'GET',
        headers: { 'Accept': 'application/json' },
      },
      {
        signal,
        maxRetries: 2,
        initialDelay: 1000,
        onRetry: (attempt, error, delay) => {
          console.warn(`[Contributions] Retry attempt ${attempt} after ${delay}ms:`, error.message);
        },
      }
    );

    const data = await response.json();

    // Backend returns { submissions, total, limit, offset }
    if (data && Array.isArray(data.submissions)) {
      return { submissions: data.submissions, total: data.total || data.submissions.length };
    }
    // Fallback formats
    if (Array.isArray(data)) {
      return { submissions: data, total: data.length };
    }
    if (data && Array.isArray(data.contributions)) {
      return { submissions: data.contributions, total: data.total || data.contributions.length };
    }
    if (data && Array.isArray(data.data)) {
      return { submissions: data.data, total: data.total || data.data.length };
    }

    console.warn('Unexpected contributions response format:', data);
    return { submissions: [], total: 0 };
  } catch (error) {
    // Return empty if not found (404) or bad request (400)
    if (error instanceof Error && (error.message.includes('HTTP 404') || error.message.includes('HTTP 400'))) {
      return { submissions: [], total: 0 };
    }
    throw error;
  }
}

// Submit a new contribution
async function submitContribution(
  wallet: string,
  category: ContributionCategory,
  contentLink: string,
  description: string
): Promise<{ success: boolean; message: string }> {
  const url = `${API_BASE_URL}${API_ENDPOINTS.SUBMIT_CONTRIBUTION}`;

  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Accept': 'application/json',
    },
    body: JSON.stringify({
      wallet,
      category,
      contentLink,
      description,
    }),
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData.message || `Failed to submit: HTTP ${response.status}`);
  }

  return response.json();
}

/**
 * Validates if a string is a valid URL
 */
function isValidUrl(urlString: string): boolean {
  try {
    const url = new URL(urlString);
    return url.protocol === 'http:' || url.protocol === 'https:';
  } catch {
    return false;
  }
}

export default function Leaderboard() {
  const { connected, publicKey } = useWallet();
  const { setVisible: setWalletModalVisible } = useWalletModal();
  const { toast } = useToast();

  // State
  const [timeframe, setTimeframe] = useState<TimeframeFilter>("allTime");
  const [leaderboardData, setLeaderboardData] = useState<LeaderboardEntry[]>([]);
  const [userPoints, setUserPoints] = useState<(UserPointsResponse & { rank: number | null }) | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Pagination state
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize] = useState(10); // 10 entries per page
  const [totalEntries, setTotalEntries] = useState(0);

  // Contribution state
  const [contributions, setContributions] = useState<Contribution[]>([]);
  const [contributionsLoading, setContributionsLoading] = useState(false);
  const [contributionsLoadingMore, setContributionsLoadingMore] = useState(false);
  const [contributionTotal, setContributionTotal] = useState(0);
  const [expandedContribution, setExpandedContribution] = useState<string | null>(null);
  const [isSubmitModalOpen, setIsSubmitModalOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [formData, setFormData] = useState({
    category: "" as ContributionCategory | "",
    contentLink: "",
    description: "",
  });

  // Reset to page 1 when timeframe changes
  useEffect(() => {
    setCurrentPage(1);
  }, [timeframe]);

  // Fetch leaderboard on mount and when wallet/timeframe/page changes
  useEffect(() => {
    let consecutiveFailures = 0;
    let currentInterval = 30000; // Base interval: 30 seconds
    let timeoutId: NodeJS.Timeout | null = null;
    let abortController: AbortController | null = null;

    const fetchData = async () => {
      // Cancel previous request if still pending
      if (abortController) {
        abortController.abort();
      }
      abortController = new AbortController();

      setLoading(true);
      setError(null);

      try {
        // Fetch leaderboard (always, even if not connected) with pagination
        const offset = (currentPage - 1) * pageSize;
        const leaderboard = await fetchLeaderboard(timeframe, pageSize, offset, abortController.signal);
        setLeaderboardData(leaderboard.top100);
        setTotalEntries(leaderboard.totalUsers);

        // Fetch user points if connected
        if (connected && publicKey) {
          const walletStr = publicKey.toString();
          const points = await fetchUserPoints(walletStr, abortController.signal);

          // Calculate rank dynamically from leaderboard data
          const userInLeaderboard = leaderboard.top100.find(
            (entry) => entry.wallet === walletStr
          );

          const dynamicRank = userInLeaderboard?.rank ?? points.rank;

          setUserPoints({
            ...points,
            rank: dynamicRank,
          });
        } else {
          setUserPoints(null);
        }

        // Success - reset failure count and interval
        consecutiveFailures = 0;
        currentInterval = 30000;

        // Add delay for better UX (2 seconds)
        await new Promise(resolve => setTimeout(resolve, 200));
      } catch (err) {
        // Don't handle aborted requests
        if (err instanceof Error && err.name === 'AbortError') {
          return;
        }

        const errorMsg = err instanceof Error ? err.message : "Failed to load leaderboard";
        setError(errorMsg);

        // Check if it's a transient network error
        const isTransient = err instanceof Error && isTransientNetworkError(err);

        if (isTransient) {
          // Backoff on repeated failures
          consecutiveFailures++;
          currentInterval = Math.min(30000 * Math.pow(2, consecutiveFailures), 300000); // Max 5 minutes
          console.warn(`[Leaderboard] Network error, backing off to ${currentInterval}ms. Failures: ${consecutiveFailures}`);
        } else {
          // Non-transient error - log to Sentry
          console.error("Leaderboard fetch error:", err);
          Sentry.captureException(err, {
            tags: { feature: 'leaderboard', action: 'fetch' },
            level: 'error',
          });
        }
      } finally {
        setLoading(false);
      }

      // Schedule next fetch with adaptive interval
      timeoutId = setTimeout(fetchData, currentInterval);
    };

    // Start first fetch
    fetchData();

    // Cleanup function
    return () => {
      if (timeoutId) {
        clearTimeout(timeoutId);
      }
      if (abortController) {
        abortController.abort();
      }
    };
  }, [connected, publicKey, timeframe, currentPage, pageSize]);

  // Fetch contributions when wallet connects + auto-refresh every 60s
  useEffect(() => {
    let consecutiveFailures = 0;
    let currentInterval = 60000; // Base interval: 60 seconds
    let timeoutId: NodeJS.Timeout | null = null;
    let abortController: AbortController | null = null;

    const fetchContributions = async () => {
      if (!connected || !publicKey) {
        setContributions([]);
        setContributionTotal(0);
        return;
      }

      // Cancel previous request if still pending
      if (abortController) {
        abortController.abort();
      }
      abortController = new AbortController();

      setContributionsLoading(true);
      try {
        const { submissions, total } = await fetchMyContributions(
          publicKey.toString(),
          CONTRIBUTIONS_PAGE_SIZE,
          0,
          abortController.signal
        );
        setContributions(submissions);
        setContributionTotal(total);

        // Success - reset failure count and interval
        consecutiveFailures = 0;
        currentInterval = 60000;
      } catch (err) {
        // Don't handle aborted requests
        if (err instanceof Error && err.name === 'AbortError') {
          return;
        }

        // Check if it's a transient network error
        const isTransient = err instanceof Error && isTransientNetworkError(err);

        if (isTransient) {
          // Backoff on repeated failures
          consecutiveFailures++;
          currentInterval = Math.min(60000 * Math.pow(2, consecutiveFailures), 300000); // Max 5 minutes
          console.warn(`[Contributions] Network error, backing off to ${currentInterval}ms. Failures: ${consecutiveFailures}`);
        } else {
          // Non-transient error - log to Sentry
          console.error("Failed to fetch contributions:", err);
          Sentry.captureException(err, {
            tags: { feature: 'contributions', action: 'fetch' },
            level: 'error',
          });
        }
      } finally {
        setContributionsLoading(false);
      }

      // Schedule next fetch with adaptive interval
      timeoutId = setTimeout(fetchContributions, currentInterval);
    };

    // Start first fetch
    fetchContributions();

    // Cleanup function
    return () => {
      if (timeoutId) {
        clearTimeout(timeoutId);
      }
      if (abortController) {
        abortController.abort();
      }
    };
  }, [connected, publicKey]);

  // Load more contributions (append next page)
  const handleLoadMoreContributions = async () => {
    if (!connected || !publicKey) return;
    setContributionsLoadingMore(true);
    try {
      const { submissions, total } = await fetchMyContributions(
        publicKey.toString(),
        CONTRIBUTIONS_PAGE_SIZE,
        contributions.length
      );
      setContributions(prev => [...prev, ...submissions]);
      setContributionTotal(total);
    } catch (err) {
      console.error("Failed to load more contributions:", err);
      Sentry.captureException(err, {
        tags: { feature: 'contributions', action: 'load-more' },
        level: 'error',
      });
    } finally {
      setContributionsLoadingMore(false);
    }
  };

  // Handle contribution submission
  const handleSubmitContribution = async () => {
    if (!connected || !publicKey) {
      toast({
        title: "Wallet Not Connected",
        description: "Please Connect Your Wallet To Submit Contributions.",
        variant: "destructive",
      });
      return;
    }

    if (!formData.category || !formData.contentLink || !formData.description) {
      toast({
        title: "Missing Fields",
        description: "Please Fill In All Required Fields.",
        variant: "destructive",
      });
      return;
    }

    // Validation 3: Check if contentLink is a valid URL
    if (!isValidUrl(formData.contentLink)) {
      toast({
        title: "Invalid URL",
        description: "Please Enter A Valid URL (e.g., https://example.com)",
        variant: "destructive",
      });
      return;
    }

    setSubmitting(true);
    try {
      await submitContribution(
        publicKey.toString(),
        formData.category as ContributionCategory,
        formData.contentLink,
        formData.description
      );

      toast({
        title: "Contribution Submitted!",
        description: "Your Contribution Has Been Submitted For Review.",
      });

      // Reset form and close modal
      setFormData({ category: "", contentLink: "", description: "" });
      setIsSubmitModalOpen(false);

      // Refresh contributions list
      const { submissions, total } = await fetchMyContributions(publicKey.toString(), CONTRIBUTIONS_PAGE_SIZE, 0);
      setContributions(submissions);
      setContributionTotal(total);
    } catch (err) {
      console.error("Failed to submit contribution:", err);
      const errMsg = err instanceof Error ? err.message : String(err);
      // Don't report expected backend validation errors (400s) to Sentry
      const isExpectedValidation =
        errMsg.includes("Weekly limit") ||
        errMsg.includes("Invalid wallet") ||
        errMsg.includes("already submitted");
      if (!isExpectedValidation) {
        Sentry.captureException(err, {
          tags: { feature: 'contributions', action: 'submit' },
          level: 'error',
          extra: { category: formData.category, contentLink: formData.contentLink },
        });
      }
      toast({
        title: "Submission Failed",
        description: errMsg || "Failed To Submit Contribution.",
        variant: "destructive",
      });
    } finally {
      setSubmitting(false);
    }
  };

  // Format date for display
  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  };

  // Get status badge color
  const getStatusBadge = (status: ContributionStatus) => {
    switch (status) {
      case "approved":
        return <Badge className="bg-green-500/20 text-green-400 border-green-500/30 hover:bg-green-500/30 hover:border-green-500/50 transition-all cursor-pointer">Approved</Badge>;
      case "rejected":
        return <Badge className="bg-red-500/20 text-red-400 border-red-500/30 hover:bg-red-500/30 hover:border-red-500/50 transition-all cursor-pointer">Rejected</Badge>;
      default:
        return <Badge className="bg-yellow-500/20 text-yellow-400 border-yellow-500/30 hover:bg-yellow-500/30 hover:border-yellow-500/50 transition-all cursor-pointer">Pending</Badge>;
    }
  };

  // Get category display label
  const getCategoryLabel = (category: ContributionCategory) => {
    return CONTRIBUTION_CATEGORIES.find((c) => c.value === category)?.label || category;
  };

  return (
    <div className="min-h-screen bg-background relative overflow-hidden">
      <Header />

      {/* Background Effects */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-1/4 left-1/4 w-[600px] h-[600px] rounded-full bg-ocean-cyan/10 blur-[120px]" />
        <div className="absolute bottom-1/4 right-1/4 w-[500px] h-[500px] rounded-full bg-ocean-seafoam/10 blur-[100px]" />
        <div className="absolute inset-0 opacity-[0.02]" style={{
          backgroundImage: `linear-gradient(hsl(var(--foreground)) 1px, transparent 1px), linear-gradient(90deg, hsl(var(--foreground)) 1px, transparent 1px)`,
          backgroundSize: "60px 60px"
        }} />
      </div>

      <div className="container mx-auto pb-12 px-4 py-28 relative z-10">
        {/* Hero Section */}
        <div className="text-center mb-16">
          <div className="flex items-center justify-center gap-3 mb-6">
            <KindSwapLogo className="w-10 h-10" />
          </div>

          <h1 className="text-4xl md:text-5xl font-bold leading-tight mb-4">
            <span className="text-foreground">KindSwap</span>
            <br />
            <span className="gradient-text">Leaderboard</span>
          </h1>

          <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
            Top 100 wallets ranked by total points. Earn points by swapping tokens,
            contributing to the community, and holding KNS.
          </p>
        </div>

        {/* ==================== YOUR POINTS - MOBILE ONLY ==================== */}
        <div className="lg:hidden glass-card p-6 border border-border/50 mb-8">
          <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
            <Star className="w-5 h-5 text-ocean-cyan" />
            Your Points
          </h3>

          {connected && publicKey && userPoints ? (
            userPoints.totalPoints === 0 ? (
              /* Zero Points Empty State */
              <div className="text-center py-8">
                <div className="flex items-center gap-2 text-sm text-muted-foreground mb-6 justify-center">
                  <Wallet className="w-4 h-4" />
                  <span className="font-mono">{publicKey.toString().substring(0, 4)}...{publicKey.toString().slice(-4)}</span>
                </div>
                <Star className="w-12 h-12 text-muted-foreground mx-auto mb-4 opacity-30" />
                <p className="text-lg font-medium text-muted-foreground mb-2">No Points Yet</p>
                <p className="text-sm text-muted-foreground/70 mb-4 max-w-[250px] mx-auto">
                  Start earning by swapping tokens, contributing to the community, or holding KNS.
                </p>
              </div>
            ) : (
              /* Points Display */
              <div className="space-y-4">
                <div className="flex items-center gap-2 text-sm text-muted-foreground mb-4">
                  <Wallet className="w-4 h-4" />
                  <span className="font-mono">{publicKey.toString().substring(0, 4)}...{publicKey.toString().slice(-4)}</span>
                  {userPoints.rank && userPoints.rank <= 100 ? (
                    <Badge variant="outline" className="bg-ocean-cyan/10 text-ocean-cyan border-ocean-cyan/30 text-xs ml-auto">
                      Rank #{userPoints.rank}
                    </Badge>
                  ) : (
                    <Badge variant="outline" className="border-muted/50 text-xs ml-auto">
                      Outside Top 100
                    </Badge>
                  )}
                </div>

                <div className="space-y-3">
                  <div className="flex justify-between items-center p-3 bg-muted/30 rounded-lg">
                    <span className="text-muted-foreground">Total Points</span>
                    <span className="font-bold text-xl gradient-text">{userPoints.totalPoints.toLocaleString()}</span>
                  </div>
                  <div className="flex justify-between items-center p-3 bg-muted/20 rounded-lg">
                    <span className="text-muted-foreground text-sm">Swap Points</span>
                    <span className="font-medium">{userPoints.swapPoints.toLocaleString()}</span>
                  </div>
                  <div className="flex justify-between items-center p-3 bg-muted/20 rounded-lg">
                    <span className="text-muted-foreground text-sm">Community Points</span>
                    <span className="font-medium">{userPoints.communityPoints.toLocaleString()}</span>
                  </div>
                  <div className="flex justify-between items-center p-3 bg-muted/20 rounded-lg">
                    <span className="text-muted-foreground text-sm">KNS Holding Points</span>
                    <span className="font-medium">{userPoints.knsPoints.toLocaleString()}</span>
                  </div>
                </div>
              </div>
            )
          ) : (
            /* Disconnected State */
            <div className="text-center py-8">
              <Wallet className="w-12 h-12 text-muted-foreground mx-auto mb-4 opacity-50" />
              <p className="text-muted-foreground mb-4">Connect your wallet to view your points</p>
              <Button variant="outline" className="border-ocean-cyan/30 text-ocean-cyan hover:bg-ocean-cyan/10" onClick={() => setWalletModalVisible(true)}>
                <Wallet className="w-4 h-4 mr-2" />
                Connect Wallet
              </Button>
            </div>
          )}
        </div>

        {/* ==================== LEADERBOARD SECTION ==================== */}
        <section className="mb-20">
          <h2 className="text-2xl font-bold mb-2 gradient-text flex items-center gap-2">
            <Trophy className="w-6 h-6" />
            Leaderboard
          </h2>
          <p className="text-muted-foreground mb-8">Top 100 wallets ranked by total points. Updates in real-time.</p>

          {/* Time Filters */}
          <div className="flex gap-2 mb-6">
            {[
              { key: "today" as const, label: "Today" },
              { key: "week" as const, label: "Last 7 Days" },
              { key: "allTime" as const, label: "All-Time" },
            ].map((filter) => (
              <button
                key={filter.key}
                onClick={() => setTimeframe(filter.key)}
                className={`px-4 py-2 rounded-full text-sm font-medium transition-all ${
                  timeframe === filter.key
                    ? "bg-ocean-cyan/20 text-ocean-cyan border border-ocean-cyan/30"
                    : "bg-muted/50 text-muted-foreground hover:bg-muted"
                }`}
              >
                {filter.label}
              </button>
            ))}
          </div>

          <div className="grid lg:grid-cols-3 gap-6">
            {/* Leaderboard Table */}
            <div className="lg:col-span-2 glass-card p-4 sm:p-6 border border-border/50 overflow-hidden" style={{ minHeight: '705px' }}>
              {/* Loading State */}
              {loading && (
                <div className="text-center py-12">
                  <div className="inline-block">
                    <div className="w-8 h-8 border-4 border-ocean-cyan/20 border-t-ocean-cyan rounded-full animate-spin" />
                  </div>
                  <p className="text-muted-foreground mt-4">Loading leaderboard...</p>
                </div>
              )}

              {/* Error State */}
              {error && !loading && (
                <div className="p-6 border border-destructive/30 bg-destructive/5 rounded-lg">
                  <p className="text-destructive">{error}</p>
                </div>
              )}

              {/* Empty State */}
              {!loading && !error && leaderboardData.length === 0 && (
                <div className="text-center py-12">
                  <TrendingUp className="w-12 h-12 text-muted-foreground/50 mx-auto mb-4" />
                  <p className="text-muted-foreground">No leaderboard data yet</p>
                  <p className="text-sm text-muted-foreground mt-2">
                    Start swapping or contributing to appear on the leaderboard
                  </p>
                </div>
              )}

              {/* Leaderboard Table */}
              {!loading && !error && leaderboardData.length > 0 && (
                <div className="-mx-4 sm:mx-0 overflow-x-auto">
                  <table className="w-full caption-bottom text-sm" style={{ minWidth: '600px' }}>
                    <thead>
                      <tr className="border-b border-border/50">
                        <th className="h-12 px-4 text-left align-middle font-medium text-muted-foreground">Rank</th>
                        <th className="h-12 px-4 text-left align-middle font-medium text-muted-foreground">Wallet</th>
                        <th className="h-12 px-4 text-right align-middle font-medium text-muted-foreground">Total</th>
                        <th className="h-12 px-4 text-right align-middle font-medium text-muted-foreground">Swap</th>
                        <th className="h-12 px-4 text-right align-middle font-medium text-muted-foreground">Community</th>
                        <th className="h-12 px-4 text-right align-middle font-medium text-muted-foreground">KNS</th>
                      </tr>
                    </thead>
                    <tbody>
                      {leaderboardData.map((entry) => {
                        const isUserRow = connected && publicKey && entry.wallet === publicKey.toString();
                        const isMedal = entry.rank <= 3;

                        return (
                          <tr
                            key={entry.wallet}
                            className={`border-b border-border/30 transition-colors hover:bg-muted/20 ${
                              isUserRow ? "bg-ocean-cyan/10" : isMedal ? "bg-ocean-cyan/5" : ""
                            }`}
                          >
                            <td className="p-4 align-middle font-medium">
                              <div className="flex items-center gap-2">
                                {entry.rank === 1 && <Crown className="w-4 h-4 text-yellow-500" />}
                                {entry.rank === 2 && <Medal className="w-4 h-4 text-gray-400" />}
                                {entry.rank === 3 && <Medal className="w-4 h-4 text-amber-600" />}
                                <span className={isMedal ? "text-ocean-cyan font-bold" : ""}>
                                  #{entry.rank}
                                </span>
                              </div>
                            </td>
                            <td className="p-4 align-middle font-mono text-sm">
                              <div className="flex items-center gap-2">
                                {connected ? (
                                  <>
                                    <span>{entry.wallet.substring(0, 4)}...{entry.wallet.slice(-4)}</span>
                                    {isUserRow && (
                                      <Badge variant="outline" className="text-xs py-0 px-2 h-5 border-ocean-cyan/50 text-ocean-cyan bg-ocean-cyan/10">
                                        You
                                      </Badge>
                                    )}
                                  </>
                                ) : (
                                  <span className="text-muted-foreground">--------------------</span>
                                )}
                              </div>
                            </td>
                            <td className="p-4 align-middle text-right font-bold text-ocean-cyan">
                              {connected ? entry.totalPoints.toLocaleString() : <span className="text-muted-foreground font-normal">----------</span>}
                            </td>
                            <td className="p-4 align-middle text-right">
                              {connected ? entry.swapPoints.toLocaleString() : <span className="text-muted-foreground">----------</span>}
                            </td>
                            <td className="p-4 align-middle text-right">
                              {connected ? entry.communityPoints.toLocaleString() : <span className="text-muted-foreground">--------------------</span>}
                            </td>
                            <td className="p-4 align-middle text-right">
                              {connected ? entry.knsPoints.toLocaleString() : <span className="text-muted-foreground">--------------------</span>}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}

              {/* Pagination Controls */}
              {!loading && !error && leaderboardData.length > 0 && (() => {
                const totalPages = Math.ceil(totalEntries / pageSize);

                // Generate page numbers with ellipsis
                const getPageNumbers = () => {
                  const pages: (number | string)[] = [];
                  const showEllipsisStart = currentPage > 3;
                  const showEllipsisEnd = currentPage < totalPages - 2;

                  if (totalPages <= 7) {
                    // Show all pages if 7 or fewer
                    for (let i = 1; i <= totalPages; i++) {
                      pages.push(i);
                    }
                  } else {
                    // Always show first page
                    pages.push(1);

                    // Show ellipsis or pages before current
                    if (showEllipsisStart) {
                      pages.push('...');
                      // Show 2 pages before current
                      for (let i = currentPage - 2; i < currentPage; i++) {
                        if (i > 1) pages.push(i);
                      }
                    } else {
                      // Show pages 2 to current
                      for (let i = 2; i < currentPage; i++) {
                        pages.push(i);
                      }
                    }

                    // Show current page if not first or last
                    if (currentPage !== 1 && currentPage !== totalPages) {
                      pages.push(currentPage);
                    }

                    // Show ellipsis or pages after current
                    if (showEllipsisEnd) {
                      // Show 2 pages after current
                      for (let i = currentPage + 1; i <= Math.min(currentPage + 2, totalPages - 1); i++) {
                        pages.push(i);
                      }
                      pages.push('...');
                    } else {
                      // Show pages from current+1 to second-to-last
                      for (let i = currentPage + 1; i < totalPages; i++) {
                        pages.push(i);
                      }
                    }

                    // Always show last page
                    pages.push(totalPages);
                  }

                  return pages;
                };

                const pages = getPageNumbers();

                return (
                  <div className="mt-6 flex items-center justify-end gap-2 border-t border-border/50 pt-4">
                    {/* Previous Button */}
                    <button
                      onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                      disabled={currentPage === 1 || loading}
                      className="w-8 h-8 flex items-center justify-center rounded-2xl disabled:opacity-30 disabled:cursor-not-allowed transition-colors hover:text-muted-foreground"
                    >
                      <ChevronLeft className="w-4 h-4 text-muted-foreground" />
                    </button>

                    {/* Page Numbers */}
                    <div className="flex items-center gap-1.5">
                      {pages.map((page, index) => {
                        if (page === '...') {
                          return (
                            <span
                              key={`ellipsis-${index}`}
                              className="px-2 text-sm text-muted-foreground"
                            >
                              ...
                            </span>
                          );
                        }

                        const pageNum = page as number;
                        const isActive = pageNum === currentPage;

                        return (
                          <button
                            key={pageNum}
                            onClick={() => setCurrentPage(pageNum)}
                            disabled={loading}
                            className={`w-8 h-8 flex items-center justify-center rounded-xl text-xs font-semibold transition-all ${
                              isActive
                                ? "bg-ocean-cyan text-background shadow-lg shadow-ocean-cyan/20"
                                : "text-muted-foreground hover:text-foreground"
                            }`}
                          >
                            {pageNum}
                          </button>
                        );
                      })}
                    </div>

                    {/* Next Button */}
                    <button
                      onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
                      disabled={currentPage >= totalPages || loading}
                      className="w-8 h-8 flex items-center justify-center rounded-2xl disabled:opacity-30 disabled:cursor-not-allowed transition-colors hover:text-muted-foreground"
                    >
                      <ChevronRight className="w-4 h-4 text-muted-foreground" />
                    </button>
                  </div>
                );
              })()}
            </div>

            {/* Your Points Card - Desktop Only */}
            <div className="hidden lg:block glass-card p-6 border border-border/50">
              <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
                <Star className="w-5 h-5 text-ocean-cyan" />
                Your Points
              </h3>

              {connected && publicKey && userPoints ? (
                userPoints.totalPoints === 0 ? (
                  /* Zero Points Empty State */
                  <div className="text-center py-8">
                    <div className="flex items-center gap-2 text-sm text-muted-foreground mb-6 justify-center">
                      <Wallet className="w-4 h-4" />
                      <span className="font-mono">{publicKey.toString().substring(0, 4)}...{publicKey.toString().slice(-4)}</span>
                    </div>
                    <Star className="w-12 h-12 text-muted-foreground mx-auto mb-4 opacity-30" />
                    <p className="text-lg font-medium text-muted-foreground mb-2">No Points Yet</p>
                    <p className="text-sm text-muted-foreground/70 mb-4 max-w-[250px] mx-auto">
                      Start earning by swapping tokens, contributing to the community, or holding KNS.
                    </p>
                  </div>
                ) : (
                  /* Points Display */
                  <div className="space-y-4">
                    <div className="flex items-center gap-2 text-sm text-muted-foreground mb-4">
                      <Wallet className="w-4 h-4" />
                      <span className="font-mono">{publicKey.toString().substring(0, 4)}...{publicKey.toString().slice(-4)}</span>
                      {userPoints.rank && userPoints.rank <= 100 ? (
                        <Badge variant="outline" className="bg-ocean-cyan/10 text-ocean-cyan border-ocean-cyan/30 text-xs ml-auto">
                          Rank #{userPoints.rank}
                        </Badge>
                      ) : (
                        <Badge variant="outline" className="border-muted/50 text-xs ml-auto">
                          Outside Top 100
                        </Badge>
                      )}
                    </div>

                    <div className="space-y-3">
                      <div className="flex justify-between items-center p-3 bg-muted/30 rounded-lg">
                        <span className="text-muted-foreground">Total Points</span>
                        <span className="font-bold text-xl gradient-text">{userPoints.totalPoints.toLocaleString()}</span>
                      </div>
                      <div className="flex justify-between items-center p-3 bg-muted/20 rounded-lg">
                        <span className="text-muted-foreground text-sm">Swap Points</span>
                        <span className="font-medium">{userPoints.swapPoints.toLocaleString()}</span>
                      </div>
                      <div className="flex justify-between items-center p-3 bg-muted/20 rounded-lg">
                        <span className="text-muted-foreground text-sm">Community Points</span>
                        <span className="font-medium">{userPoints.communityPoints.toLocaleString()}</span>
                      </div>
                      <div className="flex justify-between items-center p-3 bg-muted/20 rounded-lg">
                        <span className="text-muted-foreground text-sm">KNS Holding Points</span>
                        <span className="font-medium">{userPoints.knsPoints.toLocaleString()}</span>
                      </div>
                    </div>
                  </div>
                )
              ) : (
                /* Disconnected State */
                <div className="text-center py-8">
                  <Wallet className="w-12 h-12 text-muted-foreground mx-auto mb-4 opacity-50" />
                  <p className="text-muted-foreground mb-4">Connect your wallet to view your points</p>
                  <Button variant="outline" className="border-ocean-cyan/30 text-ocean-cyan hover:bg-ocean-cyan/10" onClick={() => setWalletModalVisible(true)}>
                    <Wallet className="w-4 h-4 mr-2" />
                    Connect Wallet
                  </Button>
                </div>
              )}
            </div>
          </div>
        </section>

        {/* ==================== CONTRIBUTIONS SECTION (Only visible when connected) ==================== */}
        {connected && (
        <section className="mb-20">
          {/* It should be Mobile responsive and with the matched UI */}
          <div className="flex justify-between mb-8 flex-col sm:flex-row gap-4 items-start sm:items-center">
            <div>
              <h2 className="text-2xl font-bold mb-2 gradient-text flex items-center gap-2">
                <Send className="w-6 h-6" />
                Community Submission
              </h2>
              <p className="text-muted-foreground">
                Submit your content contributions to earn community points.
              </p>
            </div>

            {connected && publicKey && (
              <Dialog open={isSubmitModalOpen} onOpenChange={setIsSubmitModalOpen}>
                <DialogTrigger asChild>
                  <Button className="bg-ocean-cyan hover:bg-ocean-cyan/90">
                    <Send className="w-4 h-4 mr-2" />
                    Submit New Contribution
                  </Button>
                </DialogTrigger>
                <DialogContent className="glass-card border-border/50 max-w-md">
                  <DialogHeader>
                    <DialogTitle className="gradient-text">Submit Community Contribution</DialogTitle>
                    <DialogDescription className="text-muted-foreground">
                      Share your content to earn community points. Submissions are reviewed by the team.
                    </DialogDescription>
                  </DialogHeader>

                  <div className="space-y-4 py-4">
                    <div className="space-y-2">
                      <Label htmlFor="category">Category *</Label>
                      <Select
                        value={formData.category}
                        onValueChange={(value) => setFormData({ ...formData, category: value as ContributionCategory })}
                      >
                        <SelectTrigger className="bg-muted/50 border border-border/50 focus:outline-none focus:border-ocean-cyan/50 ring-0 ring-offset-0 focus:ring-0 focus:ring-offset-0 focus-visible:ring-0 focus-visible:ring-offset-0">
                          <SelectValue placeholder="Select category" />
                        </SelectTrigger>
                        <SelectContent>
                          {CONTRIBUTION_CATEGORIES.map((cat) => (
                            <SelectItem key={cat.value} value={cat.value}>
                              {cat.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="contentLink">Content Link *</Label>
                      <Input
                        id="contentLink"
                        placeholder="https://..."
                        value={formData.contentLink}
                        onChange={(e) => setFormData({ ...formData, contentLink: e.target.value })}
                        className="bg-muted/50 border border-border/50 focus:outline-none focus:border-ocean-cyan/50 focus:ring-0 focus-visible:ring-0 focus-visible:ring-offset-0"
                      />
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="description">Description *</Label>
                      <Textarea
                        id="description"
                        placeholder="Describe your contribution..."
                        value={formData.description}
                        onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                        className="bg-muted/50 border border-border/50 min-h-[100px] focus:outline-none focus:border-ocean-cyan/50 focus:ring-0 focus-visible:ring-0 focus-visible:ring-offset-0 resize-none"
                      />
                    </div>

                    <Button
                      onClick={handleSubmitContribution}
                      disabled={submitting || !formData.category || !formData.contentLink || !formData.description}
                      className="w-full bg-ocean-cyan text-background hover:bg-ocean-cyan/90"
                    >
                      {submitting ? "Submitting..." : "Submit for Review"}
                    </Button>
                  </div>
                </DialogContent>
              </Dialog>
            )}
          </div>

          {/* Contributions List */}
          <div className="glass-card border border-border/50 rounded-2xl overflow-hidden">
            {!connected || !publicKey ? (
              <div className="text-center py-12 px-6">
                <Wallet className="w-12 h-12 text-muted-foreground mx-auto mb-4 opacity-50" />
                <p className="text-muted-foreground mb-4">Connect your wallet to view and submit contributions</p>
                <Button variant="outline" className="border-ocean-cyan/30 text-ocean-cyan hover:bg-ocean-cyan/10" onClick={() => setWalletModalVisible(true)}>
                  <Wallet className="w-4 h-4 mr-2" />
                  Connect Wallet
                </Button>
              </div>
            ) : contributionsLoading ? (
              <div className="text-center py-12 px-6">
                <div className="inline-block">
                  <div className="w-8 h-8 border-4 border-ocean-cyan/20 border-t-ocean-cyan rounded-full animate-spin" />
                </div>
                <p className="text-muted-foreground mt-4">Loading contributions...</p>
              </div>
            ) : contributions.length === 0 ? (
              <div className="text-center py-12 px-6">
                <Send className="w-12 h-12 text-muted-foreground/50 mx-auto mb-4" />
                <p className="text-muted-foreground">No contributions yet</p>
                <p className="text-sm text-muted-foreground mt-2 mb-4">
                  Share your content to earn community points
                </p>
                <Button
                  onClick={() => setIsSubmitModalOpen(true)}
                  className="bg-ocean-cyan hover:bg-ocean-cyan/90"
                >
                  <Send className="w-4 h-4 mr-2" />
                  Submit your first contribution
                </Button>
              </div>
            ) : (
              <>
                {/* Desktop Table (hidden on mobile) */}
                <div className="hidden sm:block overflow-x-auto scrollbar-visible min-w-full pb-2">
                  <Table className="min-w-[800px]">
                    <TableHeader>
                      <TableRow className="border-border/50 hover:bg-transparent">
                        <TableHead className="text-muted-foreground min-w-[100px] pl-4 md:pl-6">Date</TableHead>
                        <TableHead className="text-muted-foreground min-w-[160px]">Category</TableHead>
                        <TableHead className="text-muted-foreground min-w-[220px]">Content Link</TableHead>
                        <TableHead className="text-muted-foreground min-w-[100px]">Status</TableHead>
                        <TableHead className="text-muted-foreground text-right min-w-[100px]">Points</TableHead>
                        <TableHead className="text-muted-foreground w-12 pr-4 md:pr-6"></TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {contributions.map((contribution) => (
                        <>
                          <TableRow
                            key={contribution.id}
                            className="border-border/30 hover:bg-ocean-cyan/5 cursor-pointer transition-colors h-16"
                            onClick={() => setExpandedContribution(
                              expandedContribution === contribution.id ? null : contribution.id
                            )}
                          >
                            <TableCell className="text-muted-foreground text-sm whitespace-nowrap pl-4 md:pl-6">
                              {formatDate(contribution.createdAt)}
                            </TableCell>
                            <TableCell className="whitespace-nowrap">
                              <Badge className="bg-ocean-cyan/15 text-ocean-cyan border-ocean-cyan/30 hover:bg-ocean-cyan/25 hover:border-ocean-cyan/50 transition-all cursor-pointer">
                                {getCategoryLabel(contribution.category)}
                              </Badge>
                            </TableCell>
                            <TableCell>
                              <a
                                href={contribution.contentLink}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="inline-flex items-center gap-1.5 text-ocean-cyan text-sm max-w-[220px] px-2 py-1 rounded-md hover:bg-ocean-cyan/10 hover:text-ocean-cyan transition-all"
                                onClick={(e) => e.stopPropagation()}
                              >
                                <ExternalLink className="w-3.5 h-3.5 flex-shrink-0" />
                                <span className="truncate">{truncateLink(contribution.contentLink, 35)}</span>
                              </a>
                            </TableCell>
                            <TableCell>{getStatusBadge(contribution.status)}</TableCell>
                            <TableCell className="text-right font-medium">
                              {contribution.status === "approved" && contribution.pointsAwarded ? (
                                <span className="text-ocean-cyan">+{contribution.pointsAwarded}</span>
                              ) : (
                                <span className="text-muted-foreground">No Points</span>
                              )}
                            </TableCell>
                            <TableCell className="w-12 pr-4 md:pr-6">
                              {expandedContribution === contribution.id ? (
                                <ChevronUp className="w-4 h-4 text-muted-foreground" />
                              ) : (
                                <ChevronDown className="w-4 h-4 text-muted-foreground" />
                              )}
                            </TableCell>
                          </TableRow>
                          {expandedContribution === contribution.id && (
                            <TableRow key={`${contribution.id}-details`} className="border-border/30 bg-muted/10">
                              <TableCell colSpan={6} className="py-4 pl-4 md:pl-6 pr-4 md:pr-6">
                                <div className="space-y-2 text-sm">
                                  {contribution.description && (
                                    <div>
                                      <span className="text-muted-foreground font-medium">Description: </span>
                                      <span className="text-foreground">{contribution.description}</span>
                                    </div>
                                  )}
                                  {contribution.status === "rejected" && contribution.rejectionReason && (
                                    <div>
                                      <span className="text-red-400 font-medium">Rejection Reason: </span>
                                      <span className="text-red-300">{contribution.rejectionReason}</span>
                                    </div>
                                  )}
                                  {contribution.status === "approved" && contribution.reviewedAt && (
                                    <div>
                                      <span className="text-muted-foreground font-medium">Reviewed: </span>
                                      <span className="text-foreground">{formatDate(contribution.reviewedAt)}</span>
                                    </div>
                                  )}
                                  {contribution.adminNote && (
                                    <div>
                                      <span className="text-muted-foreground font-medium">Admin Note: </span>
                                      <span className="text-foreground">{contribution.adminNote}</span>
                                    </div>
                                  )}
                                </div>
                              </TableCell>
                            </TableRow>
                          )}
                        </>
                      ))}
                    </TableBody>
                  </Table>
                </div>

                {/* Mobile Cards (hidden on desktop) */}
                <div className="sm:hidden space-y-3 p-4">
                  {contributions.map((contribution) => (
                    <div
                      key={contribution.id}
                      className="border border-border/30 rounded-lg p-4 hover:bg-ocean-cyan/5 hover:border-ocean-cyan/30 transition-all"
                    >
                      <div
                        className="cursor-pointer"
                        onClick={() => setExpandedContribution(
                          expandedContribution === contribution.id ? null : contribution.id
                        )}
                      >
                        {/* Top row: date + status */}
                        <div className="flex items-center justify-between mb-2">
                          <span className="text-xs text-muted-foreground">
                            {formatDate(contribution.createdAt)}
                          </span>
                          {getStatusBadge(contribution.status)}
                        </div>

                        {/* Category badge */}
                        <div className="mb-2">
                          <Badge className="bg-ocean-cyan/15 text-ocean-cyan border-ocean-cyan/30 text-xs hover:bg-ocean-cyan/25 hover:border-ocean-cyan/50 transition-all cursor-pointer">
                            {getCategoryLabel(contribution.category)}
                          </Badge>
                        </div>

                        {/* Content link */}
                        <a
                          href={contribution.contentLink}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1.5 text-ocean-cyan text-sm mb-2 md:px-2 py-1 rounded-md hover:bg-ocean-cyan/10 transition-all"
                          onClick={(e) => e.stopPropagation()}
                        >
                          <ExternalLink className="w-3 h-3 flex-shrink-0" />
                          <span className="truncate">{truncateLink(contribution.contentLink, 30)}</span>
                        </a>

                        {/* Points + expand indicator */}
                        <div className="flex items-center justify-between">
                          <span className="text-sm font-medium">
                            {contribution.status === "approved" && contribution.pointsAwarded ? (
                              <span className="text-ocean-cyan">+{contribution.pointsAwarded} pts</span>
                            ) : (
                              <span className="text-muted-foreground">No Points</span>
                            )}
                          </span>
                          {expandedContribution === contribution.id ? (
                            <ChevronUp className="w-4 h-4 text-muted-foreground" />
                          ) : (
                            <ChevronDown className="w-4 h-4 text-muted-foreground" />
                          )}
                        </div>
                      </div>

                      {/* Expanded details */}
                      {expandedContribution === contribution.id && (
                        <div className="mt-3 pt-3 border-t border-border/30 space-y-2 text-sm">
                          {contribution.description && (
                            <div>
                              <span className="text-muted-foreground font-medium">Description: </span>
                              <span className="text-foreground">{contribution.description}</span>
                            </div>
                          )}
                          {contribution.status === "rejected" && contribution.rejectionReason && (
                            <div>
                              <span className="text-red-400 font-medium">Rejection Reason: </span>
                              <span className="text-red-300">{contribution.rejectionReason}</span>
                            </div>
                          )}
                          {contribution.status === "approved" && contribution.reviewedAt && (
                            <div>
                              <span className="text-muted-foreground font-medium">Reviewed: </span>
                              <span className="text-foreground">{formatDate(contribution.reviewedAt)}</span>
                            </div>
                          )}
                          {contribution.adminNote && (
                            <div>
                              <span className="text-muted-foreground font-medium">Admin Note: </span>
                              <span className="text-foreground">{contribution.adminNote}</span>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  ))}
                </div>

                {/* Load More / Pagination */}
                {contributions.length < contributionTotal && (
                  <div className="text-center py-6 px-4 border-t border-border/30">
                    <Button
                      variant="outline"
                      onClick={handleLoadMoreContributions}
                      disabled={contributionsLoadingMore}
                      className="border-ocean-cyan/30 text-ocean-cyan hover:bg-ocean-cyan/10"
                    >
                      {contributionsLoadingMore ? (
                        <>
                          <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                          Loading...
                        </>
                      ) : (
                        <>Load More ({contributions.length} of {contributionTotal})</>
                      )}
                    </Button>
                  </div>
                )}
              </>
            )}
          </div>
        </section>
        )}

        {/* ==================== POINTS SYSTEM SECTION ==================== */}
        <section className="mb-20">
          <h2 className="text-2xl font-bold mb-2 gradient-text flex items-center gap-2">
            <Award className="w-6 h-6" />
            Points System
          </h2>
          <p className="text-muted-foreground mb-8">How users earn points across different activities.</p>

          <div className="grid md:grid-cols-3 gap-6">
            {/* Swap Usage Points */}
            <div className="glass-card p-6 border border-border/50">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-10 h-10 rounded-full bg-ocean-cyan/20 flex items-center justify-center">
                  <Zap className="w-5 h-5 text-ocean-cyan" />
                </div>
                <h3 className="font-semibold">Swap Usage Points</h3>
              </div>
              <ul className="space-y-3">
                {swapPointsRules.map((rule, idx) => (
                  <li key={idx} className="text-sm">
                    <p className="text-foreground font-medium">{rule.rule}</p>
                    <p className="text-muted-foreground text-xs mt-0.5">{rule.note}</p>
                  </li>
                ))}
              </ul>
            </div>

            {/* Community Contribution Points */}
            <div className="glass-card p-6 border border-border/50">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-10 h-10 rounded-full bg-ocean-seafoam/20 flex items-center justify-center">
                  <Users className="w-5 h-5 text-ocean-seafoam" />
                </div>
                <h3 className="font-semibold">Community Points</h3>
              </div>
              <div className="space-y-2">
                {communityPointsTable.map((item, idx) => (
                  <div key={idx} className="flex justify-between items-center text-sm py-1.5 border-b border-border/30 last:border-0">
                    <span className="text-muted-foreground">{item.category}</span>
                    <span className="text-ocean-seafoam font-medium">{item.points} pts</span>
                  </div>
                ))}
              </div>
            </div>

            {/* KNS Holding Points */}
            <div className="glass-card p-6 border border-border/50">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-10 h-10 rounded-full bg-ocean-light/20 flex items-center justify-center">
                  <Coins className="w-5 h-5 text-ocean-light" />
                </div>
                <h3 className="font-semibold">KNS Holding Points</h3>
              </div>
              <p className="text-xs text-muted-foreground mb-3">Daily accrual based on wallet balance:</p>
              <div className="space-y-2">
                {knsHoldingTiers.map((tier, idx) => (
                  <div key={idx} className="flex justify-between items-center text-sm py-1.5 border-b border-border/30 last:border-0">
                    <span className="text-muted-foreground text-xs">{tier.balance}</span>
                    <span className="text-ocean-light font-medium">{tier.dailyPoints}/day</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </section>
      </div>

      {/* Mobile Bottom Navigation */}
      <MobileBottomNav />
    </div>
  );
}

import { useState, useEffect, useCallback, useMemo } from "react";
import { useWallet } from "@solana/wallet-adapter-react";
import { useWalletModal } from "@solana/wallet-adapter-react-ui";
import { toast } from "sonner";
import { ExternalLink, Copy, ArrowUpDown, Settings, TrendingUp, Heart, Info, Shield, Loader2, FileX2, X, Check, ChevronDown } from "lucide-react";
import * as Sentry from "@sentry/react";
import PinProtection from ".././components/PinProtection";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "../components/ui/tooltip";
import { API_ENDPOINTS, buildApiUrl } from "../config/api";
import { useScrollLock } from "../hooks/useScrollLock";
import AdminManagement from "../pages/Admin/AdminManagement";

// ============================================
// Types
// ============================================

interface FeeConfig {
  id: string;
  baseFeeBps: number;
  charityPortion: number;
  kindswapPortion: number;
  platformWallet: string;
  charityWallet: string;
  isActive: boolean;
  version: number;
}

interface Submission {
  id: string;
  wallet: string;
  contentLink: string;
  category: string;
  description: string | null;
  status: "pending" | "approved" | "rejected";
  pointsAwarded: number | null;
  rejectionReason: string | null;
  reviewedBy: string | null;
  reviewedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

// Points ranges per category (must match backend ADMIN_POINTS_RANGES)
const POINTS_RANGES: Record<string, { min: number; max: number }> = {
  twitter_post: { min: 10, max: 50 },
  twitter_thread: { min: 50, max: 200 },
  video: { min: 100, max: 500 }, // Backend sends 'video' for YouTube/TikTok
  youtube_video: { min: 100, max: 500 }, // Legacy support
  tiktok: { min: 100, max: 500 }, // Legacy support
  blog: { min: 50, max: 300 }, // Backend sends 'blog'
  blog_article: { min: 50, max: 300 }, // Legacy support
  translation: { min: 100, max: 400 },
  instagram: { min: 10, max: 50 },
  facebook: { min: 10, max: 50 },
  other: { min: 10, max: 300 },
};

// ============================================
// Helpers
// ============================================

function truncateWallet(wallet: string): string {
  if (wallet.length <= 12) return wallet;
  return `${wallet.slice(0, 4)}....${wallet.slice(-5)}`;
}

function truncateLink(link: string): string {
  try {
    const url = new URL(link);
    const path = url.pathname.length > 1 ? url.pathname : "";
    const display = url.hostname + path;
    return display.length > 30 ? display.slice(0, 27) + "..." : display;
  } catch {
    return link.length > 30 ? link.slice(0, 27) + "..." : link;
  }
}

function truncateDescription(desc: string | null, maxLength: number = 25): string {
  if (!desc) return "—";
  if (desc.length <= maxLength) return desc;
  return desc.slice(0, maxLength) + "...";
}

function formatCategory(cat: string): string {
  return cat
    .split("_")
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ");
}

// ============================================
// Admin Page Component
// ============================================

const Admin = () => {
  const { publicKey, connected } = useWallet();
  const { setVisible } = useWalletModal();

  // Admin verification state
  const [isVerifiedAdmin, setIsVerifiedAdmin] = useState(false);
  const [isSuperAdmin, setIsSuperAdmin] = useState(true);
  const [adminPermissions, setAdminPermissions] = useState<string[]>([]);
  const [adminVerifying, setAdminVerifying] = useState(false);

  // Fee config state
  const [feeConfig, setFeeConfig] = useState<FeeConfig | null>(null);
  const [feeLoading, setFeeLoading] = useState(true);

  // Wallet addresses state (loaded from API)
  const [platformWallet, setPlatformWallet] = useState("");
  const [charityWallet, setCharityWallet] = useState("kNSBmzPU33zmNAbJeKp986iqDii8aa4mnJnAZkZ1TED");

  // Submissions state
  const [activeTab, setActiveTab] = useState<"pending" | "approved" | "rejected">("pending");
  const [submissions, setSubmissions] = useState<Submission[]>([]);
  const [submissionsLoading, setSubmissionsLoading] = useState(false);
  const [, setTotalSubmissions] = useState(0);

  // Pagination state
  const ITEMS_PER_PAGE = 10;
  const [displayCount, setDisplayCount] = useState(ITEMS_PER_PAGE);

  // Sorting state
  const [categorySortDirection, setCategorySortDirection] = useState<"asc" | "desc" | null>(null);

  // Mobile dropdown state
  const [mobileDropdownOpen, setMobileDropdownOpen] = useState(false);

  // Dialog state
  const [approveDialog, setApproveDialog] = useState<{ open: boolean; submission: Submission | null }>({ open: false, submission: null });
  const [rejectDialog, setRejectDialog] = useState<{ open: boolean; submission: Submission | null }>({ open: false, submission: null });
  const [approvePoints, setApprovePoints] = useState("");
  const [rejectReason, setRejectReason] = useState("");
  const [actionLoading, setActionLoading] = useState(false);

  // Fee edit dialog state
  const [feeEditOpen, setFeeEditOpen] = useState(false);
  const [newPlatformFee, setNewPlatformFee] = useState("");
  const [newCharityShare, setNewCharityShare] = useState("");
  const [feeUpdateLoading, setFeeUpdateLoading] = useState(false);
  const [feeConfirmOpen, setFeeConfirmOpen] = useState(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const adminWallet = publicKey?.toBase58() || "";

  // Lock scroll when any dialog is open
  useScrollLock(approveDialog.open || rejectDialog.open || feeEditOpen || feeConfirmOpen);

  // ============================================
  // Data Fetching
  // ============================================

  // Verify admin status when wallet connects
  useEffect(() => {
    async function verifyAdminStatus() {
      if (!connected || !adminWallet) {
        setIsVerifiedAdmin(false);
        setIsSuperAdmin(false);
        return;
      }

      setAdminVerifying(true);
      try {
        const res = await fetch(buildApiUrl(API_ENDPOINTS.ADMIN_VERIFY), {
          headers: { "X-Admin-Wallet": adminWallet },
        });

        if (res.ok) {
          setIsVerifiedAdmin(true);

          // Check if Super Admin and get permissions
          try {
            const superAdminRes = await fetch(buildApiUrl(API_ENDPOINTS.ADMIN_CHECK_SUPER), {
              headers: { "X-Admin-Wallet": adminWallet },
            });

            if (superAdminRes.ok) {
              const data = await superAdminRes.json();
              setIsSuperAdmin(data.isSuperAdmin || false);
              setAdminPermissions(data.permissions || []);
            } else {
              setIsSuperAdmin(false);
              setAdminPermissions([]);
            }
          } catch (err) {
            console.error("Failed to check super admin status:", err);
            Sentry.captureException(err, {
              tags: { feature: 'admin-auth', action: 'check-super-admin' },
              level: 'error',
            });
            setIsSuperAdmin(false);
            setAdminPermissions([]);
          }
        } else {
          setIsVerifiedAdmin(false);
          setIsSuperAdmin(false);
          setAdminPermissions([]);
          if (res.status === 403) {
            toast.error("Your Wallet Is Not Authorized As Admin");
          }
        }
      } catch (err) {
        console.error("Failed to verify admin status:", err);
        Sentry.captureException(err, {
          tags: { feature: 'admin-auth', action: 'verify-admin' },
          level: 'error',
        });
        setIsVerifiedAdmin(false);
        setIsSuperAdmin(false);
      } finally {
        setAdminVerifying(false);
      }
    }
    verifyAdminStatus();
  }, [connected, adminWallet]);

  // Fetch fee config - reusable function
  const fetchFeeConfig = useCallback(async () => {
    try {
      const res = await fetch(buildApiUrl(API_ENDPOINTS.FEE_CONFIG));
      if (res.ok) {
        const data = await res.json();
        setFeeConfig(data);
      }
    } catch (err) {
      console.error("Failed to fetch fee config:", err);
      Sentry.captureException(err, {
        tags: { feature: 'admin-fee-config', action: 'fetch' },
        level: 'error',
      });
    } finally {
      setFeeLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchFeeConfig();
  }, [fetchFeeConfig]);

  // Load wallet addresses from fee config
  useEffect(() => {
    if (feeConfig?.platformWallet) {
      setPlatformWallet(feeConfig.platformWallet);
    }
    if (feeConfig?.charityWallet) {
      setCharityWallet(feeConfig.charityWallet);
    }
  }, [feeConfig]);

  const fetchSubmissions = useCallback(async () => {
    if (!connected || !adminWallet) return;

    setSubmissionsLoading(true);
    try {
      // Select endpoint based on active tab
      let endpoint: string;
      if (activeTab === "approved") {
        endpoint = API_ENDPOINTS.ADMIN_APPROVED_CONTRIBUTIONS;
      } else if (activeTab === "rejected") {
        endpoint = API_ENDPOINTS.ADMIN_REJECTED_CONTRIBUTIONS;
      } else {
        endpoint = API_ENDPOINTS.ADMIN_PENDING_CONTRIBUTIONS;
      }

      const url = buildApiUrl(endpoint, { limit: 100, offset: 0 });
      const res = await fetch(url, {
        headers: { "X-Admin-Wallet": adminWallet },
      });

      if (res.ok) {
        const data = await res.json();
        setSubmissions(data.submissions || []);
        setTotalSubmissions(data.total || 0);
      } else if (res.status === 403) {
        toast.error("Access Denied. Your Wallet Is Not An Admin Wallet.");
        setSubmissions([]);
      } else {
        toast.error("Failed To Fetch Submissions");
        setSubmissions([]);
      }
    } catch (err) {
      console.error("Failed to fetch submissions:", err);
      Sentry.captureException(err, {
        tags: { feature: 'admin-submissions', action: 'fetch', tab: activeTab },
        level: 'error',
      });
      toast.error("Failed To Fetch Submissions");
    } finally {
      setSubmissionsLoading(false);
    }
  }, [connected, adminWallet, activeTab]);

  useEffect(() => {
    fetchSubmissions();
  }, [fetchSubmissions, activeTab]);

  // Reset display count when tab changes
  useEffect(() => {
    setDisplayCount(ITEMS_PER_PAGE);
  }, [activeTab]);

  // ============================================
  // Actions
  // ============================================

  const handleApprove = async () => {
    if (!approveDialog.submission || !approvePoints) return;

    const points = parseInt(approvePoints);
    if (isNaN(points) || points <= 0) {
      toast.error("Please Enter A Valid Points Amount");
      return;
    }

    const range = POINTS_RANGES[approveDialog.submission.category] || { min: 10, max: 500 };
    if (points < range.min || points > range.max) {
      toast.error(`Points Must Be Between ${range.min} And ${range.max} For ${formatCategory(approveDialog.submission.category)}`);
      return;
    }

    setActionLoading(true);
    try {
      const url = buildApiUrl(API_ENDPOINTS.ADMIN_APPROVE_CONTRIBUTION(approveDialog.submission.id));
      const res = await fetch(url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Admin-Wallet": adminWallet,
        },
        body: JSON.stringify({ pointsAwarded: points }),
      });

      if (res.ok) {
        toast.success(`Approved! Awarded ${points} Points`);
        setApproveDialog({ open: false, submission: null });
        setApprovePoints("");
        fetchSubmissions();
      } else {
        const err = await res.json();
        toast.error(err.message || "Failed To Approve");
      }
    } catch (err) {
      console.error("Failed to approve submission:", err);
      Sentry.captureException(err, {
        tags: { feature: 'admin-submissions', action: 'approve' },
        level: 'error',
      });
      toast.error("Failed To Approve Submission");
    } finally {
      setActionLoading(false);
    }
  };

  const handleReject = async () => {
    if (!rejectDialog.submission || !rejectReason) return;

    if (rejectReason.length < 10) {
      toast.error("Rejection Reason Must Be At Least 10 Characters");
      return;
    }

    setActionLoading(true);
    try {
      const url = buildApiUrl(API_ENDPOINTS.ADMIN_REJECT_CONTRIBUTION(rejectDialog.submission.id));
      const res = await fetch(url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Admin-Wallet": adminWallet,
        },
        body: JSON.stringify({ reason: rejectReason }),
      });

      if (res.ok) {
        toast.success("Submission Rejected");
        setRejectDialog({ open: false, submission: null });
        setRejectReason("");
        fetchSubmissions();
      } else {
        const err = await res.json();
        toast.error(err.message || "Failed To Reject");
      }
    } catch (err) {
      console.error("Failed to reject submission:", err);
      Sentry.captureException(err, {
        tags: { feature: 'admin-submissions', action: 'reject' },
        level: 'error',
      });
      toast.error("Failed To Reject Submission");
    } finally {
      setActionLoading(false);
    }
  };

  const openFeeEditDialog = () => {
    if (feeConfig) {
      setNewPlatformFee((feeConfig.baseFeeBps / 100).toFixed(2));
      setNewCharityShare((feeConfig.charityPortion * 100).toFixed(2));
    }
    setFeeEditOpen(true);
  };

  // Solana address validation helper
  const isValidSolanaAddress = (address: string): boolean => {
    const base58Alphabet = '123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz';
    if (address.length < 32 || address.length > 44) return false;
    return address.split('').every(char => base58Alphabet.includes(char));
  };

  const handleFeeUpdate = async () => {
    const platformFeeVal = parseFloat(newPlatformFee);
    const charityShareVal = parseFloat(newCharityShare);

    if (isNaN(platformFeeVal) || platformFeeVal < 0 || platformFeeVal > 100) {
      toast.error("Platform Fee Must Be Between 0 And 100");
      return;
    }
    if (isNaN(charityShareVal) || charityShareVal < 0 || charityShareVal > 100) {
      toast.error("Charity Share Must Be Between 0 And 100");
      return;
    }

    // Validate platform wallet address
    if (!isValidSolanaAddress(platformWallet)) {
      toast.error("Invalid Platform Wallet Address");
      return;
    }

    // Validate charity wallet address
    if (!isValidSolanaAddress(charityWallet)) {
      toast.error("Invalid Charity Wallet Address");
      return;
    }

    setFeeUpdateLoading(true);
    try {
      const res = await fetch(buildApiUrl(API_ENDPOINTS.ADMIN_FEE_CONFIG_UPDATE), {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          "X-Admin-Wallet": adminWallet,
        },
        body: JSON.stringify({
          baseFeeBps: platformFeeVal * 100,
          charityPortion: charityShareVal / 100,
          kindswapPortion: (100 - charityShareVal) / 100,
          platformWallet: platformWallet,
          charityWallet: charityWallet,
        }),
      });

      if (res.ok) {
        // Re-fetch fee config to get the updated values
        await fetchFeeConfig();
        toast.success("Fee Configuration Updated Successfully");
        setFeeEditOpen(false);
      } else {
        const err = await res.json();
        toast.error(err.message || "Failed To Update Fee Configuration");
      }
    } catch {
      toast.error("Failed To Update Fee Configuration");
    } finally {
      setFeeUpdateLoading(false);
    }
  };

  const copyToClipboard = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    toast.success("Copied To Clipboard");
    setTimeout(() => setCopiedId(null), 2000);
  };

  // ============================================
  // Permission Checks
  // ============================================

  // Super Admins have access to everything
  const hasFeeConfigPermission = isSuperAdmin || adminPermissions.includes("FEE_CONFIG");
  const hasContributionsPermission = isSuperAdmin || adminPermissions.includes("CONTRIBUTIONS");

  // ============================================
  // Derived values
  // ============================================

  const platformFee = feeConfig ? (feeConfig.baseFeeBps / 100).toFixed(2) : "0.10";
  const charityShare = feeConfig ? (feeConfig.charityPortion * 100).toFixed(2) : "25.00";
  const effectiveCharityFee = feeConfig
    ? ((feeConfig.baseFeeBps * feeConfig.charityPortion) / 100).toFixed(3)
    : "0.025";
  const platformRetained = feeConfig
    ? ((feeConfig.baseFeeBps * feeConfig.kindswapPortion) / 100).toFixed(3)
    : "0.075";

  // Sort submissions by category and apply display limit
  const displayedSubmissions = useMemo(() => {
    let filtered = [...submissions];

    // Apply sorting if active
    if (categorySortDirection !== null) {
      filtered.sort((a, b) => {
        const comparison = a.category.localeCompare(b.category);
        return categorySortDirection === "asc" ? comparison : -comparison;
      });
    }

    // Return only items up to displayCount
    return filtered.slice(0, displayCount);
  }, [submissions, displayCount, categorySortDirection]);

  // Toggle category sort direction
  const toggleCategorySort = () => {
    setCategorySortDirection((prev) => {
      if (prev === null) return "asc";
      if (prev === "asc") return "desc";
      return null;
    });
  };

  // Handle Load More
  const handleLoadMore = () => {
    setDisplayCount(prev => prev + ITEMS_PER_PAGE);
  };



  // ============================================
  // Render
  // ============================================

  return (
    <PinProtection>
      <div className="min-h-[90vh] bg-background relative overflow-hidden">
        {/* Background decorative elements */}
        <div className="absolute inset-0 overflow-hidden pointer-events-none">
          <div className="absolute top-1/4 left-1/4 w-[600px] h-[600px] rounded-full bg-ocean-cyan/10 blur-[120px]" />
          <div className="absolute bottom-1/4 right-1/4 w-[500px] h-[500px] rounded-full bg-ocean-seafoam/10 blur-[100px]" />
          <div
            className="absolute inset-0 opacity-[0.02]"
            style={{
              backgroundImage: `linear-gradient(hsl(var(--foreground)) 1px, transparent 1px), linear-gradient(90deg, hsl(var(--foreground)) 1px, transparent 1px)`,
              backgroundSize: "60px 60px",
            }}
          />
        </div>

        {!connected ? (
        <div className="container mx-auto px-4 py-28 relative z-10">
          <div className="flex flex-col items-center justify-center min-h-[60vh] gap-6">
            <div className="glass-card border border-border/50 rounded-2xl p-10 text-center max-w-md">
              <Shield className="w-12 h-12 text-muted-foreground/50 mx-auto mb-4" />
              <h2 className="text-xl font-bold text-foreground mb-2">Access Restricted</h2>
              <p className="text-muted-foreground text-sm mb-6">
                Please connect an admin wallet to access the administration panel.
              </p>
              <button
                onClick={() => setVisible(true)}
                className="bg-gradient-to-r from-ocean-cyan via-ocean-light to-ocean-seafoam text-background font-bold rounded-xl px-6 py-3 hover:opacity-90 hover:shadow-[0_0_40px_hsl(185_80%_55%/0.5)] transition-all"
              >
                Connect Wallet
              </button>
            </div>
          </div>
        </div>
        ) : adminVerifying ? (
        <div className="container mx-auto px-4 py-28 relative z-10">
          <div className="flex flex-col items-center justify-center min-h-[60vh] gap-6">
            <div className="glass-card border border-border/50 rounded-2xl p-10 text-center max-w-md">
              <Loader2 className="w-12 h-12 text-ocean-cyan mx-auto mb-4 animate-spin" />
              <h2 className="text-xl font-bold text-foreground mb-2">Verifying Access</h2>
              <p className="text-muted-foreground text-sm">
                Checking admin authorization...
              </p>
            </div>
          </div>
        </div>
        ) : !isVerifiedAdmin ? (
        <div className="container mx-auto px-4 py-28 relative z-10">
          <div className="flex flex-col items-center justify-center min-h-[60vh] gap-6">
            <div className="glass-card border border-destructive/30 rounded-2xl p-10 text-center max-w-md">
              <Shield className="w-12 h-12 text-destructive/50 mx-auto mb-4" />
              <h2 className="text-xl font-bold text-foreground mb-2">Not Authorized</h2>
              <p className="text-muted-foreground text-sm mb-2">
                Your wallet is not authorized to access the admin panel.
              </p>
              <p className="text-muted-foreground/70 text-xs mb-6">
                Connected: {adminWallet.slice(0, 4)}...{adminWallet.slice(-4)}
              </p>
              <button
                onClick={() => setVisible(true)}
                className="bg-gradient-to-r from-ocean-cyan via-ocean-light to-ocean-seafoam text-background font-bold rounded-xl px-6 py-3 hover:opacity-90 hover:shadow-[0_0_40px_hsl(185_80%_55%/0.5)] transition-all"
              >
                Switch Wallet
              </button>
            </div>
          </div>
        </div>
        ) : (
        <>
        <div className="container mx-auto px-4 py-28 relative z-10">
          {/* Page Header */}
          {/* <div className="text-center mb-16">
            <div className="flex justify-center mb-6">
              <div className="flex items-center gap-2 glass-card border border-ocean-cyan/30 rounded-full px-4 py-2">
                <Shield className="w-4 h-4 text-ocean-cyan" />
                <span className="text-ocean-cyan text-sm font-medium">Admin Panel</span>
              </div>
            </div>
            <h1 className="text-4xl md:text-5xl font-bold leading-tight mb-4">
              <span className="text-foreground">KindSwap</span>
              <br />
              <span className="gradient-text">Administration</span>
            </h1>
            <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
              Manage platform fee configuration and review community contributions.
            </p> */}
            {/* Internal badge */}
            {/* <div className="mt-4 inline-block">
              <span className="text-xs text-destructive bg-destructive/10 border border-destructive/30 rounded px-2 py-1">
                Internal Dev Spec – Not Public
              </span>
            </div>
          </div> */}

          {/* ============================================ */}
          {/* SECTION 0: Admin Access Management (Super Admin Only) */}
          {/* ============================================ */}
          <AdminManagement isSuperAdmin={isSuperAdmin} />

          {/* ============================================ */}
          {/* SECTION 1: Fee Configuration */}
          {/* ============================================ */}
          {hasFeeConfigPermission && (
          <div className="mb-16">
            <div className="flex justify-between items-start md:items-center mb-8 gap-4 flex-col md:flex-row md:gap-3">
              <div>
                <h2 className="text-2xl font-bold mb-2 gradient-text flex items-center gap-2">
                  <Settings className="w-6 h-6" />
                  Fee Configuration
                </h2>
                <p className="text-muted-foreground max-w-2xl">
                  Fine-tune the revenue split between the platform and charity partners. Changes take effect immediately on all new transactions.
                </p>
              </div>
              <button
                onClick={openFeeEditDialog}
                className="flex items-center gap-2.5 bg-gradient-to-r from-ocean-cyan via-ocean-light to-ocean-seafoam text-background font-bold rounded-xl px-5 py-3 hover:opacity-90 hover:shadow-[0_0_40px_hsl(185_80%_55%/0.5)] transition-all"
              >
                <Settings className="w-5 h-5" />
                <span className="text-base whitespace-nowrap">Edit Configuration</span>
              </button>
            </div>

            {/* Fee Cards */}
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-6">
              {/* Platform Fee */}
              <div className="glass-card p-6 border border-border/50 h-48 flex flex-col justify-between">
                <div className="flex justify-between items-start">
                  <span className="text-foreground text-lg font-semibold">Platform Fee</span>
                  <Settings className="w-6 h-6 text-ocean-cyan" />
                </div>
                <span className="text-ocean-cyan text-3xl font-bold">
                  {feeLoading ? "..." : `${platformFee}%`}
                </span>
                <span className="inline-block w-fit bg-ocean-cyan/10 border border-ocean-cyan/30 rounded-full px-3 py-1 text-ocean-cyan text-sm">
                  Base Charge
                </span>
              </div>

              {/* Charity Share */}
              <div className="glass-card p-6 border border-border/50 h-48 flex flex-col justify-between">
                <div className="flex justify-between items-start">
                  <span className="text-foreground text-lg font-semibold">Charity Share</span>
                  <Heart className="w-6 h-6 text-ocean-cyan" />
                </div>
                <span className="text-ocean-cyan text-3xl font-bold">
                  {feeLoading ? "..." : `${charityShare}%`}
                </span>
                <span className="inline-block w-fit bg-ocean-cyan/10 border border-ocean-cyan/30 rounded-full px-3 py-1 text-ocean-cyan text-sm">
                  Split Ratio
                </span>
              </div>

              {/* Effective Charity Fee */}
              <div className="glass-card p-6 border border-border/50 h-48 flex flex-col justify-between">
                <div className="flex justify-between items-start">
                  <span className="text-foreground text-lg font-semibold">Effective Charity Fee</span>
                  <Info className="w-6 h-6 text-ocean-cyan" />
                </div>
                <span className="text-ocean-cyan text-3xl font-bold">
                  {feeLoading ? "..." : `${effectiveCharityFee}%`}
                </span>
                <span className="inline-block w-fit bg-ocean-cyan/10 border border-ocean-cyan/30 rounded-full px-3 py-1 text-ocean-cyan text-sm">
                  Charity Impact
                </span>
              </div>

              {/* Platform Retained */}
              <div className="glass-card p-6 border border-border/50 h-48 flex flex-col justify-between">
                <div className="flex justify-between items-start">
                  <span className="text-foreground text-lg font-semibold">Platform Retained</span>
                  <TrendingUp className="w-6 h-6 text-ocean-cyan" />
                </div>
                <span className="text-ocean-cyan text-3xl font-bold">
                  {feeLoading ? "..." : `${platformRetained}%`}
                </span>
                <span className="inline-block w-fit bg-ocean-cyan/10 border border-ocean-cyan/30 rounded-full px-3 py-1 text-ocean-cyan text-sm">
                  Optimized Margin
                </span>
              </div>
            </div>

            {/* Wallet Addresses Section (Super Admin Only) */}
            {isSuperAdmin && (
              <div className="mt-8 grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* Platform Wallet */}
                <div className="glass-card p-5 border border-border/50 rounded-lg relative group/wallet-card hover:z-[100] transition-all">
                  <div className="flex items-center gap-2 mb-3">
                    <Info className="w-5 h-5 text-ocean-cyan" />
                    <h3 className="text-sm font-semibold text-foreground">Platform Fee Wallet</h3>
                  </div>
                  <div className="flex items-center justify-between gap-3">
                    <span className="text-muted-foreground text-sm font-mono truncate">{platformWallet}</span>
                    <div className="relative group">
                      <button
                        onClick={() => copyToClipboard(platformWallet, 'platform-wallet')}
                        className="p-1.5 hover:bg-ocean-cyan/10 rounded transition-colors flex-shrink-0"
                      >
                        {copiedId === 'platform-wallet' ? (
                          <Check className="w-4 h-4 text-green-400" />
                        ) : (
                          <Copy className="w-4 h-4 text-ocean-cyan" />
                        )}
                      </button>
                      <div className="absolute left-1/2 top-full mt-2 -translate-x-1/2 whitespace-nowrap rounded-md bg-black px-2 py-1 text-xs text-white opacity-0 group-hover:opacity-100 pointer-events-none transition-opacity duration-200 z-[9999]">
                        Copy platform wallet
                      </div>
                    </div>
                  </div>
                </div>

                {/* Charity Wallet */}
                <div className="glass-card p-5 border border-border/50 rounded-lg relative hover:z-[100] transition-all">
                  <div className="flex items-center gap-2 mb-3">
                    <Heart className="w-5 h-5 text-ocean-cyan" />
                    <h3 className="text-sm font-semibold text-foreground">Charity Fee Wallet</h3>
                  </div>
                  <div className="flex items-center justify-between gap-3">
                    <span className="text-muted-foreground text-sm font-mono truncate">{charityWallet}</span>
                    <div className="relative group">
                      <button
                        onClick={() => copyToClipboard(charityWallet, 'charity-wallet')}
                        className="p-1.5 hover:bg-ocean-cyan/10 rounded transition-colors flex-shrink-0"
                      >
                        {copiedId === 'charity-wallet' ? (
                          <Check className="w-4 h-4 text-green-400" />
                        ) : (
                          <Copy className="w-4 h-4 text-ocean-cyan" />
                        )}
                      </button>
                      <div className="absolute left-1/2 top-full mt-2 -translate-x-1/2 whitespace-nowrap rounded-md bg-black px-2 py-1 text-xs text-white opacity-0 group-hover:opacity-100 pointer-events-none transition-opacity duration-200 z-[9999]">
                        Copy charity wallet
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
          )}

          {/* ============================================ */}
          {/* SECTION 2: Community Submissions */}
          {/* ============================================ */}
          {hasContributionsPermission && (
          <div>
            <div className="flex justify-between items-center mb-8">
              <div>
                <h2 className="text-2xl font-bold mb-2 gradient-text flex items-center gap-2">
                  <Settings className="w-6 h-6" />
                  Community Submissions
                </h2>
                <p className="text-muted-foreground">
                  Review and manage community contribution submissions.
                </p>
              </div>

              {!connected ? (
                <button
                  onClick={() => setVisible(true)}
                  className="bg-gradient-to-r from-ocean-cyan via-ocean-light to-ocean-seafoam text-background font-bold rounded-xl px-6 py-2.5 hover:opacity-90 hover:shadow-[0_0_40px_hsl(185_80%_55%/0.5)] transition-all"
                >
                  Connect Wallet
                </button>
              ) : (
                <span className="text-sm text-muted-foreground">
                  Admin: {truncateWallet(adminWallet)}
                </span>
              )}
            </div>

            {/* Tabs - Desktop */}
            <div className="hidden md:flex gap-3 mb-6">
              {(["pending", "approved", "rejected"] as const).map((tab) => (
                <button
                  key={tab}
                  onClick={() => setActiveTab(tab)}
                  className={`px-5 py-2 rounded-full border text-sm font-medium transition-all ${
                    activeTab === tab
                      ? "bg-ocean-cyan/20 border-ocean-cyan/50 text-ocean-cyan shadow-[0_0_20px_hsl(185_80%_55%/0.15)]"
                      : "bg-muted/30 border-border/50 text-muted-foreground hover:border-ocean-cyan/30 hover:text-foreground"
                  }`}
                >
                  {tab === "pending" ? "Submission" : tab.charAt(0).toUpperCase() + tab.slice(1)}
                </button>
              ))}
            </div>

            {/* Dropdown - Mobile */}
            <div className="md:hidden mb-6 relative">
              {/* Dropdown Trigger */}
              <button
                onClick={() => setMobileDropdownOpen(!mobileDropdownOpen)}
                className="w-full glass-card border border-ocean-cyan/30 rounded-xl px-4 py-3.5 flex items-center justify-between text-sm font-medium text-ocean-cyan bg-ocean-cyan/5 hover:bg-ocean-cyan/10 focus:outline-none focus:border-ocean-cyan/50 focus:ring-2 focus:ring-ocean-cyan/20 focus:shadow-[0_0_20px_hsl(185_80%_55%/0.15)] transition-all"
              >
                <span className="flex items-center gap-2">
                  {activeTab === "pending" && <span className="w-2 h-2 rounded-full bg-yellow-400" />}
                  {activeTab === "approved" && <span className="w-2 h-2 rounded-full bg-green-400" />}
                  {activeTab === "rejected" && <span className="w-2 h-2 rounded-full bg-red-400" />}
                  {activeTab === "pending" ? "Submission" : activeTab.charAt(0).toUpperCase() + activeTab.slice(1)}
                </span>
                <ChevronDown className={`w-5 h-5 text-ocean-cyan transition-transform duration-200 ${mobileDropdownOpen ? "rotate-180" : ""}`} />
              </button>

              {/* Dropdown Menu */}
              {mobileDropdownOpen && (
                <>
                  {/* Backdrop */}
                  <div
                    className="fixed inset-0 z-40"
                    onClick={() => setMobileDropdownOpen(false)}
                  />
                  {/* Menu */}
                  <div className="absolute top-full left-0 right-0 mt-2 z-50 glass-card border border-ocean-cyan/30 rounded-xl overflow-hidden shadow-lg shadow-ocean-cyan/10 animate-in fade-in slide-in-from-top-2 duration-200">
                    {(["pending", "approved", "rejected"] as const).map((tab) => (
                      <button
                        key={tab}
                        onClick={() => {
                          setActiveTab(tab);
                          setMobileDropdownOpen(false);
                        }}
                        className={`w-full px-4 py-3.5 flex items-center gap-3 text-sm font-medium transition-all ${
                          activeTab === tab
                            ? "bg-ocean-cyan/20 text-ocean-cyan"
                            : "text-foreground hover:bg-ocean-cyan/10"
                        }`}
                      >
                        {tab === "pending" && <span className="w-2 h-2 rounded-full bg-yellow-400" />}
                        {tab === "approved" && <span className="w-2 h-2 rounded-full bg-green-400" />}
                        {tab === "rejected" && <span className="w-2 h-2 rounded-full bg-red-400" />}
                        <span>{tab === "pending" ? "Submission" : tab.charAt(0).toUpperCase() + tab.slice(1)}</span>
                        {activeTab === tab && <Check className="w-4 h-4 ml-auto text-ocean-cyan" />}
                      </button>
                    ))}
                  </div>
                </>
              )}
            </div>

            {/* Table */}
            <div className="glass-card border border-border/50 rounded-2xl overflow-hidden">
              <div className="overflow-x-auto overflow-y-hidden  scrollbar-visible min-w-full pb-2">
                {/* Table Header */}
                <div className="h-14 flex items-center px-4 md:px-6 border-b border-border/50 gap-2 min-w-[700px] md:min-w-[800px]">
                  <div className="w-[200px] md:w-[280px] flex-shrink-0 text-muted-foreground text-sm font-medium">Content Link</div>
                  <button
                    onClick={toggleCategorySort}
                    className="w-[120px] md:w-[160px] flex-shrink-0 flex items-center gap-1 text-muted-foreground text-sm font-medium hover:text-foreground transition-colors cursor-pointer"
                  >
                    Category
                    <ArrowUpDown
                      className={`w-4 h-4 transition-colors ${
                        categorySortDirection !== null ? "text-ocean-cyan" : "text-muted-foreground/50 hover:text-ocean-cyan"
                      }`}
                    />
                  </button>
                  <div className="w-[160px] md:w-[200px] flex-shrink-0 text-muted-foreground text-sm font-medium hidden sm:block">Description</div>
                  <div className="w-[140px] md:w-[160px] flex-shrink-0 text-muted-foreground text-sm font-medium">Wallet</div>
                  <div className="w-[140px] md:flex-1 flex-shrink-0 text-center text-muted-foreground text-sm font-medium">Action</div>
                </div>

              {/* Table Body */}
              {!connected ? (
                <div className="h-40 flex flex-col items-center justify-center gap-3">
                  <Shield className="w-10 h-10 text-muted-foreground/50" />
                  <span className="text-muted-foreground text-center px-4">Connect your admin wallet to view submissions</span>
                </div>
              ) : submissionsLoading ? (
                <div className="h-40 flex flex-col items-center justify-center gap-3">
                  <Loader2 className="w-8 h-8 text-ocean-cyan animate-spin" />
                  <span className="text-muted-foreground">Loading submissions...</span>
                </div>
              ) : displayedSubmissions.length === 0 ? (
                <div className="h-40 flex flex-col items-center justify-center gap-3">
                  <FileX2 className="w-10 h-10 text-muted-foreground/50" />
                  <span className="text-muted-foreground">
                    No {activeTab} submissions found
                  </span>
                </div>
              ) : (
                displayedSubmissions.map((sub) => (
                  <div
                    key={sub.id}
                    className="h-16 flex items-center px-4 md:px-6 border-b border-border/30 last:border-b-0 hover:bg-ocean-cyan/5 transition-colors gap-2 min-w-[700px] md:min-w-[800px]"
                  >
                    {/* Content Link */}
                    <div className="w-[200px] md:w-[280px] flex-shrink-0 flex items-center gap-2">
                      <div className="relative group">
                        <a
                          href={sub.contentLink}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="p-1 rounded-md hover:bg-ocean-cyan/10 transition-all block"
                        >
                          <ExternalLink className="w-4 h-4 text-ocean-cyan flex-shrink-0" />
                        </a>
                        <div className="absolute left-1/2 top-full mt-2 -translate-x-1/2 whitespace-nowrap rounded-md bg-black px-2 py-1 text-xs text-white opacity-0 group-hover:opacity-100 pointer-events-none transition-opacity duration-200 z-[9999]">
                          View content
                        </div>
                      </div>
                      <span className="text-foreground text-sm truncate">
                        {truncateLink(sub.contentLink)}
                      </span>
                    </div>

                    {/* Category */}
                    <div className="w-[120px] md:w-[160px] flex-shrink-0 text-foreground text-sm">
                      {formatCategory(sub.category)}
                    </div>

                    {/* Description */}
                    <div className="w-[160px] md:w-[200px] flex-shrink-0 hidden sm:block">
                      {sub.description ? (
                        <TooltipProvider delayDuration={200}>
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <span className="text-muted-foreground text-sm cursor-pointer hover:text-foreground transition-colors">
                                {truncateDescription(sub.description)}
                              </span>
                            </TooltipTrigger>
                            <TooltipContent
                              side="top"
                              align="start"
                              className="max-w-[350px] z-[100] bg-popover border border-border/50 shadow-lg p-3"
                              sideOffset={8}
                            >
                              <p className="text-[10px] text-muted-foreground uppercase tracking-wide mb-1.5 font-medium">Full Description</p>
                              <p className="text-xs text-foreground whitespace-pre-wrap break-words leading-relaxed">
                                {sub.description}
                              </p>
                            </TooltipContent>
                          </Tooltip>
                        </TooltipProvider>
                      ) : (
                        <span className="text-muted-foreground text-sm">—</span>
                      )}
                    </div>

                    {/* Wallet */}
                    <div className="w-[140px] md:w-[160px] flex-shrink-0 flex items-center gap-2">
                      <span className="text-foreground text-sm">
                        {truncateWallet(sub.wallet)}
                      </span>
                      <div className="relative group">
                        <button onClick={() => copyToClipboard(sub.wallet, sub.id)} className="p-1 rounded-md hover:bg-ocean-cyan/10 transition-all">
                          {copiedId === sub.id ? (
                            <Check className="w-4 h-4 text-green-400" />
                          ) : (
                            <Copy className="w-4 h-4 text-ocean-cyan" />
                          )}
                        </button>
                        <div className="absolute left-1/2 top-full mt-2 -translate-x-1/2 whitespace-nowrap rounded-md bg-black px-2 py-1 text-xs text-white opacity-0 group-hover:opacity-100 pointer-events-none transition-opacity duration-200 z-[9999]">
                          Copy wallet address
                        </div>
                      </div>
                    </div>

                    {/* Action */}
                    <div className="w-[140px] md:flex-1 flex-shrink-0 flex items-center justify-center gap-2 md:gap-3">
                      {activeTab === "pending" ? (
                        <>
                          <button
                            onClick={() => {
                              setApproveDialog({ open: true, submission: sub });
                              const range = POINTS_RANGES[sub.category] || { min: 10, max: 500 };
                              setApprovePoints(String(range.min));
                            }}
                            className="px-3 md:px-4 py-1.5 rounded-full border border-ocean-cyan/50 text-ocean-cyan text-xs md:text-sm hover:bg-ocean-cyan/10 hover:border-ocean-cyan hover:shadow-[0_0_20px_hsl(185_80%_55%/0.2)] transition-all"
                          >
                            Approve
                          </button>
                          <button
                            onClick={() => setRejectDialog({ open: true, submission: sub })}
                            className="px-3 md:px-4 py-1.5 rounded-full border border-destructive/50 text-destructive text-xs md:text-sm hover:bg-destructive/10 hover:border-destructive transition-all"
                          >
                            Reject
                          </button>
                        </>
                      ) : sub.status === "approved" ? (
                        <span className="text-ocean-seafoam text-sm font-medium whitespace-nowrap">
                          +{sub.pointsAwarded} pts
                        </span>
                      ) : (
                        <span className="text-destructive text-sm truncate max-w-[150px] md:max-w-[200px]" title={sub.rejectionReason || ""}>
                          {sub.rejectionReason || "Rejected"}
                        </span>
                      )}
                    </div>
                  </div>
                ))
              )}

              {/* Load More Button */}
              {!submissionsLoading && displayCount < submissions.length && (
                <div className="text-center py-6 px-4 border-t border-border/30">
                  <button
                    onClick={handleLoadMore}
                    className="flex items-center gap-2 mx-auto px-6 py-3 bg-ocean-cyan/20 border border-ocean-cyan/50 text-ocean-cyan rounded-lg hover:bg-ocean-cyan/30 hover:border-ocean-cyan hover:shadow-[0_0_20px_hsl(185_80%_55%/0.2)] transition-all"
                  >
                    Load More ({displayCount} of {submissions.length})
                  </button>
                </div>
              )}
              </div>
            </div>
          </div>
          )}
        </div>

        {/* ============================================ */}
        {/* Approve Dialog */}
        {/* ============================================ */}
        {approveDialog.open && approveDialog.submission && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-in fade-in">
            <div className="w-full max-w-md glass-card rounded-lg shadow-[0px_4px_4px_0px_rgba(34,203,142,0.20)] border border-ocean-cyan/30 overflow-hidden animate-in zoom-in-95">
              {/* Header */}
              <div className="flex items-center justify-between p-4 border-b border-border/30">
                <span className="text-foreground text-sm font-semibold">Approve Submission</span>
                <button
                  onClick={() => {
                    setApproveDialog({ open: false, submission: null });
                    setApprovePoints("");
                  }}
                  className="p-1 hover:bg-background/80 rounded-lg transition-colors"
                >
                  <X className="w-5 h-5 text-foreground" />
                </button>
              </div>

              {/* Submission Details Card */}
              <div className="mx-4 mt-4 p-4 bg-muted/30 rounded-lg space-y-3">
                <div className="flex justify-between">
                  <span className="text-muted-foreground text-sm">Wallet Address</span>
                  <span className="text-foreground text-sm">{truncateWallet(approveDialog.submission.wallet)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground text-sm">Content Link</span>
                  <a
                    href={approveDialog.submission.contentLink}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-ocean-cyan text-sm hover:underline"
                  >
                    {truncateLink(approveDialog.submission.contentLink)}
                  </a>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground text-sm">Description</span>
                  <span className="text-foreground text-sm truncate max-w-[200px]">
                    {approveDialog.submission.description || "—"}
                  </span>
                </div>
              </div>

              {/* KNS Points Input */}
              {(() => {
                const range = POINTS_RANGES[approveDialog.submission!.category] || { min: 10, max: 500 };
                return (
                  <div className="px-4 mt-4">
                    <label className="text-muted-foreground text-sm block mb-2">
                      KNS Points ({range.min} – {range.max})
                    </label>
                    <input
                      type="number"
                      min={range.min}
                      max={range.max}
                      value={approvePoints}
                      onChange={(e) => setApprovePoints(e.target.value)}
                      onWheel={(e) => e.currentTarget.blur()}
                      className="w-full h-10 bg-ocean-cyan/20 border border-ocean-cyan rounded-lg px-3 text-ocean-cyan text-sm focus:outline-none focus:ring-0 transition-colors"
                    />
                  </div>
                );
              })()}

              {/* Action Buttons */}
              <div className="flex gap-3 p-4 mt-4 border-t border-border/30">
                <button
                  onClick={() => {
                    setApproveDialog({ open: false, submission: null });
                    setApprovePoints("");
                  }}
                  className="flex-1 h-10 rounded-lg bg-ocean-cyan/30 text-foreground text-sm hover:bg-ocean-cyan/40 transition-all"
                >
                  Cancel
                </button>
                <button
                  onClick={handleApprove}
                  disabled={actionLoading}
                  className="flex-1 h-10 rounded-lg bg-ocean-cyan text-background text-sm font-semibold hover:bg-ocean-cyan/90 hover:shadow-[0_0_20px_hsl(185_80%_55%/0.3)] disabled:opacity-50 transition-all"
                >
                  {actionLoading ? "Approving..." : "Approve Submission"}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* ============================================ */}
        {/* Edit Fee Configuration Dialog */}
        {/* ============================================ */}
        {feeEditOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-in fade-in">
            <div className="w-full max-w-md glass-card rounded-lg shadow-[0px_4px_4px_0px_rgba(34,203,142,0.20)] border border-ocean-cyan/30 overflow-hidden animate-in zoom-in-95 max-h-[70vh] overflow-y-auto md:max-h-[90vh]">
              {/* Header */}
              <div className="p-4 border-b border-border/30">
                <div className="flex items-center justify-between">
                  <span className="text-foreground text-sm font-semibold">Edit Fee Configuration</span>
                  <button
                    onClick={() => setFeeEditOpen(false)}
                    className="p-1 hover:bg-background/80 rounded-lg transition-colors"
                  >
                    <X className="w-5 h-5 text-foreground" />
                  </button>
                </div>
                <p className="text-muted-foreground text-xs mt-1">
                  Adjust revenue distribution and compare impact with current rates
                </p>
              </div>

              <div className="p-4 space-y-4">
                {/* Column Headers */}
                <div className="flex gap-3">
                  <div className="flex-1">
                    <span className="text-muted-foreground text-sm">Current Values</span>
                  </div>
                  <div className="flex-1">
                    <span className="text-ocean-cyan text-sm">New Value</span>
                  </div>
                </div>

                {/* Platform Fee Row */}
                <div>
                  <div className="flex gap-3 mb-1.5">
                    <div className="flex-1">
                      <span className="text-foreground text-xs">Platform Fee %</span>
                    </div>
                    <div className="flex-1">
                      <span className="text-foreground text-xs">New Value</span>
                    </div>
                  </div>
                  <div className="flex gap-3">
                    <div className="flex-1 h-10 bg-ocean-cyan/20 rounded-lg flex items-center px-3">
                      <span className="text-muted-foreground text-sm">{platformFee}%</span>
                    </div>
                    <div className="flex-1 h-10 bg-muted/30 rounded-lg border border-ocean-cyan flex items-center px-3">
                      <input
                        type="number"
                        step="1"
                        value={newPlatformFee}
                        onChange={(e) => setNewPlatformFee(e.target.value)}
                        onWheel={(e) => e.currentTarget.blur()}
                        className="w-full bg-transparent text-foreground text-sm focus:outline-none [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                      />
                      <span className="text-muted-foreground text-sm ml-1">%</span>
                    </div>
                  </div>
                </div>

                {/* Charity Share Row */}
                <div>
                  <div className="flex gap-3 mb-1.5">
                    <div className="flex-1">
                      <span className="text-foreground text-xs">Charity Share (%)</span>
                    </div>
                    <div className="flex-1">
                      <span className="text-foreground text-xs">New Value (%)</span>
                    </div>
                  </div>
                  <div className="flex gap-3">
                    <div className="flex-1 h-10 bg-ocean-cyan/20 rounded-lg flex items-center px-3">
                      <span className="text-muted-foreground text-sm">{charityShare}%</span>
                    </div>
                    <div className="flex-1 h-10 bg-muted/30 rounded-lg border border-ocean-cyan flex items-center px-3">
                      <input
                        type="number"
                        step="1"
                        value={newCharityShare}
                        onChange={(e) => setNewCharityShare(e.target.value)}
                        onWheel={(e) => e.currentTarget.blur()}
                        className="w-full bg-transparent text-foreground text-sm focus:outline-none [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                      />
                      <span className="text-muted-foreground text-sm ml-1">%</span>
                    </div>
                  </div>
                </div>
                
                {/* Wallet Addresses Section (Super Admin Only) */}
                {isSuperAdmin && (
                  <>
                    {/* Divider */}
                    <div className="border-t border-border/30 my-4"></div>

                    {/* Platform Wallet */}
                    <div>
                      <label className="text-foreground text-xs block mb-2">Platform Fee Wallet Address</label>
                      <input
                        type="text"
                        value={platformWallet}
                        onChange={(e) => setPlatformWallet(e.target.value)}
                        placeholder="Enter Solana wallet address"
                        className="w-full h-10 bg-muted/30 rounded-lg border border-ocean-cyan/50 px-3 text-foreground text-sm focus:outline-none focus:border-ocean-cyan font-mono"
                      />
                      <span className="text-muted-foreground text-xs mt-1 block">All platform fees will be sent here</span>
                    </div>

                    {/* Charity Wallet */}
                    <div>
                      <label className="text-foreground text-xs block mb-2">Charity Fee Wallet Address</label>
                      <input
                        type="text"
                        value={charityWallet}
                        onChange={(e) => setCharityWallet(e.target.value)}
                        placeholder="Enter Solana wallet address"
                        className="w-full h-10 bg-muted/30 rounded-lg border border-ocean-cyan/50 px-3 text-foreground text-sm focus:outline-none focus:border-ocean-cyan font-mono"
                      />
                      <span className="text-muted-foreground text-xs mt-1 block">All charity portions will be sent here</span>
                    </div>
                  </>
                )}

                {/* Calculation Preview */}
                <div className="p-3 bg-ocean-cyan/10 rounded-lg border border-ocean-cyan/20">
                  <span className="text-ocean-cyan text-xs font-semibold">Calculation Preview (Before Vs. After)</span>
                  <div className="flex mt-3">
                    <div className="flex-1">
                      <span className="text-foreground text-xs block mb-1">Effective Charity Fee</span>
                      <div className="flex items-center gap-3">
                        <div>
                          <span className="text-muted-foreground text-xs block">Before</span>
                          <span className="text-muted-foreground text-sm">{effectiveCharityFee}%</span>
                        </div>
                        <span className="text-muted-foreground text-sm">&rarr;</span>
                        <div>
                          <span className="text-ocean-cyan text-xs block">After</span>
                          <span className="text-ocean-cyan text-sm font-semibold">
                            {(() => {
                              const fee = parseFloat(newPlatformFee) || 0;
                              const charity = parseFloat(newCharityShare) || 0;
                              return ((fee * charity) / 100).toFixed(2);
                            })()}%
                          </span>
                        </div>
                      </div>
                    </div>
                    <div className="flex-1">
                      <span className="text-foreground text-xs block mb-1">Platform Retained</span>
                      <div className="flex items-center gap-3">
                        <div>
                          <span className="text-muted-foreground text-xs block">Before</span>
                          <span className="text-muted-foreground text-sm">{platformRetained}%</span>
                        </div>
                        <span className="text-muted-foreground text-sm">&rarr;</span>
                        <div>
                          <span className="text-ocean-cyan text-xs block">After</span>
                          <span className="text-ocean-cyan text-sm font-semibold">
                            {(() => {
                              const fee = parseFloat(newPlatformFee) || 0;
                              const charity = parseFloat(newCharityShare) || 0;
                              return ((fee * (100 - charity)) / 100).toFixed(2);
                            })()}%
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Info Banner */}
                <div className="p-3 bg-sky-900/40 rounded-lg flex gap-2.5 items-start">
                  <Info className="w-4 h-4 text-ocean-cyan flex-shrink-0 mt-0.5" />
                  <span className="text-foreground text-xs leading-relaxed">
                    Changes will apply to all future transactions. Currently pending transactions will remain under the {platformFee}% structure. Updating this configuration will trigger an audit log entry.
                  </span>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex gap-3 p-4 border-t border-border/30">
                <button
                  onClick={() => setFeeEditOpen(false)}
                  className="flex-1 h-10 rounded-lg bg-ocean-cyan/30 text-foreground text-sm hover:bg-ocean-cyan/40 transition-all"
                >
                  Cancel
                </button>
                <button
                  onClick={() => setFeeConfirmOpen(true)}
                  className="flex-1 h-10 rounded-lg bg-ocean-cyan text-background text-sm font-semibold hover:bg-ocean-cyan/90 hover:shadow-[0_0_20px_hsl(185_80%_55%/0.3)] transition-all flex items-center justify-center gap-2"
                >
                  Update Configuration
                </button>
              </div>
            </div>
          </div>
        )}

        {/* ============================================ */}
        {/* Fee Update Confirmation Dialog */}
        {/* ============================================ */}
        {feeConfirmOpen && (
          <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in">
            <div className="w-full max-w-xs glass-card rounded-xl shadow-[0px_4px_4px_0px_rgba(34,203,142,0.20)] border border-ocean-cyan/30 overflow-hidden animate-in zoom-in-95 text-center">
              <div className="p-6">
                <div className="w-12 h-12 rounded-full bg-ocean-cyan/10 border border-ocean-cyan/30 flex items-center justify-center mx-auto mb-4">
                  <Shield className="w-6 h-6 text-ocean-cyan" />
                </div>
                <h3 className="text-foreground text-sm font-semibold mb-1">Apply Changes?</h3>
                <p className="text-muted-foreground text-xs">
                  Platform Fee → <span className="text-ocean-cyan font-semibold">{newPlatformFee}%</span> · Charity Share → <span className="text-ocean-cyan font-semibold">{newCharityShare}%</span>
                </p>
              </div>
              <div className="flex border-t border-border/30">
                <button
                  onClick={() => setFeeConfirmOpen(false)}
                  className="flex-1 h-11 text-ocean-cyan text-sm font-semibold hover:bg-ocean-cyan/10 transition-colors border-r border-border/30"
                >
                  Cancel
                </button>
                <button
                  onClick={() => {
                    setFeeConfirmOpen(false);
                    handleFeeUpdate();
                  }}
                  disabled={feeUpdateLoading}
                  className="flex-1 h-11 text-ocean-cyan text-sm font-semibold hover:bg-ocean-cyan/10 disabled:opacity-50 transition-colors"
                >
                  {feeUpdateLoading ? "Updating..." : "Confirm"}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* ============================================ */}
        {/* Reject Dialog */}
        {/* ============================================ */}
        {rejectDialog.open && rejectDialog.submission && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-in fade-in">
            <div className="w-full max-w-md glass-card rounded-lg shadow-[0px_4px_4px_0px_rgba(220,38,38,0.20)] border border-destructive/30 overflow-hidden animate-in zoom-in-95">
              {/* Header */}
              <div className="flex items-center justify-between p-4 border-b border-border/30">
                <span className="text-foreground text-sm font-semibold">Reject Submission</span>
                <button
                  onClick={() => {
                    setRejectDialog({ open: false, submission: null });
                    setRejectReason("");
                  }}
                  className="p-1 hover:bg-background/80 rounded-lg transition-colors"
                >
                  <X className="w-5 h-5 text-foreground" />
                </button>
              </div>

              {/* Submission Details Card */}
              <div className="mx-4 mt-4 p-4 bg-muted/30 rounded-lg space-y-3">
                <div className="flex justify-between">
                  <span className="text-muted-foreground text-sm">Wallet Address</span>
                  <span className="text-foreground text-sm">{truncateWallet(rejectDialog.submission.wallet)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground text-sm">Content Link</span>
                  <a
                    href={rejectDialog.submission.contentLink}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-ocean-cyan text-sm hover:underline"
                  >
                    {truncateLink(rejectDialog.submission.contentLink)}
                  </a>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground text-sm">Category</span>
                  <span className="text-foreground text-sm">{formatCategory(rejectDialog.submission.category)}</span>
                </div>
              </div>

              {/* Rejection Reason Input */}
              <div className="px-4 mt-4">
                <label className="text-muted-foreground text-sm block mb-2">
                  Rejection Reason (min 10 characters)
                </label>
                <textarea
                  value={rejectReason}
                  onChange={(e) => setRejectReason(e.target.value)}
                  rows={3}
                  placeholder="Explain why this contribution is being rejected..."
                  className="w-full bg-destructive/10 border border-destructive/50 rounded-lg px-3 py-2.5 text-foreground text-sm focus:border-destructive focus:outline-none focus:ring-0 resize-none transition-colors placeholder:text-muted-foreground/50"
                />
                <span className="text-xs text-muted-foreground mt-1.5 block">
                  {rejectReason.length}/10 minimum characters
                </span>
              </div>

              {/* Action Buttons */}
              <div className="flex gap-3 p-4 mt-2 border-t border-border/30">
                <button
                  onClick={() => {
                    setRejectDialog({ open: false, submission: null });
                    setRejectReason("");
                  }}
                  className="flex-1 h-10 rounded-lg bg-muted/50 text-foreground text-sm hover:bg-muted transition-all"
                >
                  Cancel
                </button>
                <button
                  onClick={handleReject}
                  disabled={actionLoading || rejectReason.length < 10}
                  className="flex-1 h-10 rounded-lg bg-destructive text-foreground text-sm font-semibold hover:bg-destructive/90 disabled:opacity-50 transition-all"
                >
                  {actionLoading ? "Rejecting..." : "Reject Submission"}
                </button>
              </div>
            </div>
          </div>
        )}
        </>
        )}
      </div>
    </PinProtection>
  );
};

export default Admin;

import { useEffect, useState } from "react";
import { Helmet } from "react-helmet";
import { useWallet } from "@solana/wallet-adapter-react";
import { useWalletModal } from "@solana/wallet-adapter-react-ui";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Coins, PieChart, Lock, Loader2, Users, Code, ArrowDownUp, Star, Check, X, ExternalLink, ChevronDown, ChevronLeft, ChevronRight, AlertTriangle, Wallet, TrendingUp, Clock } from "lucide-react";
import { fetchStakingStats, fetchUserStake, fetchAllStakers, fetchKnsBalance, fetchUserRewards, fetchStakingHistory, fetchUserRewardDistributionHistory, fetchUserClaimHistory, buildStakeTransaction, buildWithdrawTransaction, buildClaimTransaction, StakingStats, UserStakeInfo, UserRewards, StakingHistoryEntry, RewardDistributionHistoryEntry, ClaimHistoryEntry, LockTierKey, STAKING_RPC_ENDPOINT } from "@/contexts/staking";
import { Connection, PublicKey } from "@solana/web3.js";
import PinProtection from "@/components/PinProtection";

// Stake transaction status enum
enum StakeStatus {
  IDLE = "IDLE",
  AWAITING_SIGNATURE = "AWAITING_SIGNATURE",
  CONFIRMING = "CONFIRMING",
  CONFIRMED = "CONFIRMED",
  FAILED = "FAILED",
}

// Transaction State Card Component
const TransactionStateCard = ({
  type,
  title,
  subtitle,
  txSignature,
  onRetry,
}: {
  type: "pending" | "success" | "failed";
  title: string;
  subtitle: string;
  txSignature?: string;
  onRetry?: () => void;
}) => {
  const configs = {
    pending: {
      icon: <Loader2 className="w-8 h-8 text-ocean-cyan animate-spin" />,
      borderColor: "border-ocean-cyan/30",
      bg: "bg-ocean-cyan/5",
    },
    success: {
      icon: <Check className="w-8 h-8 text-ocean-seafoam" />,
      borderColor: "border-ocean-seafoam/30",
      bg: "bg-ocean-seafoam/5",
    },
    failed: {
      icon: <X className="w-8 h-8 text-destructive" />,
      borderColor: "border-destructive/30",
      bg: "bg-destructive/5",
    },
  };
  const config = configs[type];

  const explorerUrl = txSignature
    ? `https://solscan.io/tx/${txSignature}?cluster=devnet`
    : null;

  return (
    <div className={`glass-card p-6 text-center space-y-4 border w-[320px] h-[200px] flex flex-col items-center justify-center ${config.borderColor} ${config.bg}`}>
      <div className="w-16 h-16 rounded-full bg-background/50 flex items-center justify-center">
        {config.icon}
      </div>
      <div className="h-[52px] flex flex-col items-center justify-center">
        <h4 className="font-bold text-foreground">{title}</h4>
        {type === "success" && explorerUrl ? (
          <a
            href={explorerUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="text-sm text-ocean-cyan hover:text-ocean-light flex items-center gap-1 mt-1 transition-colors justify-center"
          >
            {subtitle}
            <ExternalLink className="w-3 h-3" />
          </a>
        ) : type === "failed" ? (
          <Button variant="outline" size="sm" className="mt-2" onClick={onRetry}>
            {subtitle}
          </Button>
        ) : (
          <p className="text-sm text-muted-foreground mt-1">{subtitle}</p>
        )}
      </div>
    </div>
  );
};

// Transaction Modal Component
interface TransactionModalProps {
  isOpen: boolean;
  status: StakeStatus;
  txSignature?: string;
  onClose: () => void;
  onRetry?: () => void;
  transactionType?: "stake" | "unstake" | "claim";
}

const TransactionModal = ({
  isOpen,
  status,
  txSignature,
  onClose,
  onRetry,
  transactionType = "stake",
}: TransactionModalProps) => {
  if (!isOpen) return null;

  const getStateConfig = () => {
    switch (status) {
      case StakeStatus.AWAITING_SIGNATURE:
        return {
          type: "pending" as const,
          title: "Awaiting Signature",
          subtitle: "Please confirm the transaction in your wallet",
        };
      case StakeStatus.CONFIRMING:
        return {
          type: "pending" as const,
          title: "Confirming Transaction",
          subtitle: "Waiting for blockchain confirmation...",
        };
      case StakeStatus.CONFIRMED:
        return {
          type: "success" as const,
          title: transactionType === "unstake" ? "Unstake Successful!" : transactionType === "claim" ? "Claim Successful!" : "Stake Successful!",
          subtitle: "View on Solscan",
        };
      case StakeStatus.FAILED:
        return {
          type: "failed" as const,
          title: "Transaction Failed",
          subtitle: "Try Again",
        };
      default:
        return null;
    }
  };

  const stateConfig = getStateConfig();
  if (!stateConfig) return null;

  const canClose = status === StakeStatus.CONFIRMED || status === StakeStatus.FAILED;

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[9998]"
        onClick={canClose ? onClose : undefined}
      />

      {/* Modal */}
      <div className="fixed inset-0 flex items-center justify-center z-[9999] p-4 pointer-events-none">
        <div className="pointer-events-auto relative">
          {/* Close button for success/failed states */}
          {canClose && (
            <button
              onClick={onClose}
              className="absolute -top-2 -right-2 z-10 p-1.5 rounded-full bg-background border border-border/50 hover:bg-background/80 transition-colors shadow-lg"
            >
              <X className="w-4 h-4 text-foreground" />
            </button>
          )}
          <TransactionStateCard
            type={stateConfig.type}
            title={stateConfig.title}
            subtitle={stateConfig.subtitle}
            txSignature={txSignature}
            onRetry={onRetry}
          />
        </div>
      </div>
    </>
  );
};

// Stake Warning Modal Component
interface StakeWarningModalProps {
  isOpen: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

const StakeWarningModal = ({ isOpen, onConfirm, onCancel }: StakeWarningModalProps) => {
  if (!isOpen) return null;

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[9998]"
        onClick={onCancel}
      />

      {/* Modal */}
      <div className="fixed inset-0 flex items-center justify-center z-[9999] p-4 pointer-events-none">
        <div className="pointer-events-auto w-96 max-w-96 p-8 bg-zinc-900 rounded-3xl shadow-[0px_20px_50px_0px_rgba(0,0,0,0.50)] outline outline-1 outline-offset-[-1px] outline-white/10 flex flex-col items-center">
          {/* Warning Icon */}
          <div className="pb-5">
            <div className="w-14 h-14 bg-amber-500/10 rounded-full outline outline-1 outline-offset-[-1px] outline-amber-500/30 flex justify-center items-center">
              <AlertTriangle className="w-7 h-6 text-amber-500" />
            </div>
          </div>

          {/* Title */}
          <div className="pb-6">
            <h3 className="text-xl font-bold text-white text-center">Immutable Lock Warning</h3>
          </div>

          {/* Warning Box */}
          <div className="w-full pb-8">
            <div className="w-full px-5 py-5 bg-red-950 rounded-xl shadow-[inset_0px_2px_8px_1px_rgba(0,0,0,0.40)] outline outline-1 outline-offset-[-1px] outline-red-900/40">
              <p className="text-center text-sm leading-6">
                <span className="text-slate-300">Lock period is </span>
                <span className="text-white font-medium">immutable</span>
                <span className="text-slate-300"> once selected.</span>
                <br />
                <span className="text-slate-300">Early unstaking is </span>
                <span className="text-red-500 font-bold">completely blocked</span>
                <span className="text-slate-300">.</span>
              </p>
            </div>
          </div>

          {/* Buttons */}
          <div className="w-full flex flex-col items-center">
            <button
              onClick={onConfirm}
              className="w-full py-3.5 bg-emerald-400 hover:bg-emerald-500 rounded-xl transition-colors"
            >
              <span className="text-neutral-900 text-base font-bold">I Understand, Confirm Stake</span>
            </button>
            <button
              onClick={onCancel}
              className="pt-4 py-1"
            >
              <span className="text-slate-500 text-sm font-medium hover:text-slate-400 transition-colors">Cancel</span>
            </button>
          </div>

          {/* Footer */}
          <div className="pt-8">
            <span className="text-slate-600 text-[9px] font-bold uppercase tracking-widest">Fixed Staking Protocol Active</span>
          </div>
        </div>
      </div>
    </>
  );
};

// Lock tiers configuration
const lockTiers = [
  { key: "Flexible" as LockTierKey, multiplier: "1x", value: 1, color: "gray", label: "Flex" },
  { key: "M3" as LockTierKey, multiplier: "1x", value: 1, color: "blue", label: "3 Mo" },
  { key: "M6" as LockTierKey, multiplier: "1.5x", value: 1.5, color: "orange", label: "6 Mo" },
  { key: "M9" as LockTierKey, multiplier: "2x", value: 2, color: "purple", label: "9 Mo" },
  { key: "M12" as LockTierKey, multiplier: "3x", value: 3, best: true, color: "cyan", label: "12 Mo" },
];

const StakingStatsPage = () => {
  const { connected, publicKey, sendTransaction } = useWallet();
  const { setVisible: setWalletModalVisible } = useWalletModal();
  const [isLoading, setIsLoading] = useState(true);
  const [stakingStats, setStakingStats] = useState<StakingStats | null>(null);
  const [userStake, setUserStake] = useState<UserStakeInfo | null>(null);
  const [userRewards, setUserRewards] = useState<UserRewards | null>(null);
  const [allStakers, setAllStakers] = useState<UserStakeInfo[]>([]);
  const [allStakersRewards, setAllStakersRewards] = useState<Map<string, UserRewards>>(new Map());
  const [stakingHistory, setStakingHistory] = useState<StakingHistoryEntry[]>([]);
  const [isHistoryLoading, setIsHistoryLoading] = useState(false);
  const [historyCurrentPage, setHistoryCurrentPage] = useState(1);
  const historyItemsPerPage = 5;
  const [rewardDistributionHistory, setRewardDistributionHistory] = useState<RewardDistributionHistoryEntry[]>([]);
  const [isRewardHistoryLoading, setIsRewardHistoryLoading] = useState(false);
  const [rewardHistoryCurrentPage, setRewardHistoryCurrentPage] = useState(1);
  const rewardHistoryItemsPerPage = 5;
  const [claimHistory, setClaimHistory] = useState<ClaimHistoryEntry[]>([]);
  const [isClaimHistoryLoading, setIsClaimHistoryLoading] = useState(false);
  const [claimHistoryCurrentPage, setClaimHistoryCurrentPage] = useState(1);
  const claimHistoryItemsPerPage = 5;

  // Stake form state
  const [stakeAmount, setStakeAmount] = useState("");
  const [selectedLockTier, setSelectedLockTier] = useState<LockTierKey>("M6");
  const [knsBalance, setKnsBalance] = useState(0);
  const [isStaking, setIsStaking] = useState(false);

  // Transaction modal state
  const [showTransactionModal, setShowTransactionModal] = useState(false);
  const [stakeStatus, setStakeStatus] = useState<StakeStatus>(StakeStatus.IDLE);
  const [txSignature, setTxSignature] = useState<string | null>(null);

  // Stake warning modal state
  const [showStakeWarning, setShowStakeWarning] = useState(false);

  // Unstake section state
  const [isUnstakeExpanded, setIsUnstakeExpanded] = useState(false);
  const [lockCountdown, setLockCountdown] = useState<string | null>(null);
  const [isUnstaking, setIsUnstaking] = useState(false);
  const [isClaiming, setIsClaiming] = useState(false);
  const [transactionType, setTransactionType] = useState<"stake" | "unstake" | "claim">("stake");

  // Claim form state
  const [claimAmount, setClaimAmount] = useState("");

  // Convert publicKey to string for reliable dependency tracking
  const walletAddress = publicKey?.toBase58() ?? null;

  // Fetch global staking data on mount
  useEffect(() => {
    const loadGlobalData = async () => {
      setIsLoading(true);
      try {
        const [stats, stakers] = await Promise.all([
          fetchStakingStats(),
          fetchAllStakers(),
        ]);
        setStakingStats(stats);
        setAllStakers(stakers);

        // Fetch rewards for all stakers in parallel
        const rewardsMap = new Map<string, UserRewards>();
        const rewardsPromises = stakers.map(async (staker) => {
          try {
            if (!staker.owner || typeof staker.owner !== 'string') {
              console.error('Invalid staker owner:', staker);
              return;
            }

            // Validate and create PublicKey
            let stakerPubkey: PublicKey;
            try {
              stakerPubkey = new PublicKey(staker.owner);
            } catch (pubkeyError) {
              console.error(`Invalid public key for ${staker.owner.slice(0, 8)}:`, pubkeyError);
              return;
            }

            const rewards = await fetchUserRewards(stakerPubkey);
            rewardsMap.set(staker.owner, rewards);
          } catch (err) {
            const ownerPreview = staker.owner?.slice?.(0, 8) || 'unknown';
            console.error(`Failed to fetch rewards for ${ownerPreview}:`, err);
          }
        });
        await Promise.all(rewardsPromises);
        setAllStakersRewards(rewardsMap);
      } catch (err) {
        console.error("Failed to fetch staking data:", err);
      } finally {
        setIsLoading(false);
      }
    };

    loadGlobalData();
  }, []);

  // Fetch user-specific data when wallet changes
  useEffect(() => {
    const loadUserData = async () => {
      if (connected && publicKey) {
        try {
          const [userInfo, balance, rewards] = await Promise.all([
            fetchUserStake(publicKey),
            fetchKnsBalance(publicKey),
            fetchUserRewards(publicKey),
          ]);
          setUserStake(userInfo);
          setKnsBalance(balance);
          setUserRewards(rewards);
        } catch (err) {
          console.error("Failed to fetch user staking data:", err);
        }
      } else {
        // Clear user data when wallet disconnects or changes
        setUserStake(null);
        setKnsBalance(0);
        setUserRewards(null);
      }
    };

    loadUserData();
  }, [connected, walletAddress]);

  // Fetch staking history when wallet changes
  useEffect(() => {
    const loadStakingHistory = async () => {
      if (connected && publicKey) {
        setIsHistoryLoading(true);
        try {
          const history = await fetchStakingHistory(publicKey);
          setStakingHistory(history);
        } catch (err) {
          console.error("Failed to fetch staking history:", err);
          setStakingHistory([]);
        } finally {
          setIsHistoryLoading(false);
        }
      } else {
        setStakingHistory([]);
      }
    };

    loadStakingHistory();
  }, [connected, walletAddress]);

  // Fetch reward distribution history when wallet changes
  useEffect(() => {
    const loadRewardHistory = async () => {
      if (connected && publicKey) {
        setIsRewardHistoryLoading(true);
        try {
          const history = await fetchUserRewardDistributionHistory(publicKey);
          setRewardDistributionHistory(history);
        } catch (err) {
          setRewardDistributionHistory([]);
        } finally {
          setIsRewardHistoryLoading(false);
        }
      } else {
        setRewardDistributionHistory([]);
      }
    };

    loadRewardHistory();
  }, [connected, walletAddress]);

  // Fetch claim history when wallet changes
  useEffect(() => {
    const loadClaimHistory = async () => {
      if (connected && publicKey) {
        setIsClaimHistoryLoading(true);
        try {
          const history = await fetchUserClaimHistory(publicKey);
          setClaimHistory(history);
        } catch (err) {
          setClaimHistory([]);
        } finally {
          setIsClaimHistoryLoading(false);
        }
      } else {
        setClaimHistory([]);
      }
    };

    loadClaimHistory();
  }, [connected, walletAddress]);

  // Countdown timer for lock expiry
  useEffect(() => {
    if (!userStake?.active || !userStake?.lockEndTime) {
      setLockCountdown(null);
      return;
    }

    const calculateCountdown = () => {
      const now = new Date();
      const lockEnd = userStake.lockEndTime;
      const diff = lockEnd.getTime() - now.getTime();

      if (diff <= 0) {
        setLockCountdown(null);
        return;
      }

      const days = Math.floor(diff / (1000 * 60 * 60 * 24));
      const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
      const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));

      if (days > 0) {
        setLockCountdown(`${days}d ${hours}h ${minutes}m`);
      } else if (hours > 0) {
        setLockCountdown(`${hours}h ${minutes}m`);
      } else {
        setLockCountdown(`${minutes}m`);
      }
    };

    // Calculate immediately
    calculateCountdown();

    // Update every minute
    const interval = setInterval(calculateCountdown, 60000);

    return () => clearInterval(interval);
  }, [userStake?.active, userStake?.lockEndTime]);

  const formatNumber = (num: number, decimals: number = 2): string => {
    return num.toLocaleString(undefined, {
      minimumFractionDigits: decimals,
      maximumFractionDigits: decimals,
    });
  };

  const formatDate = (date: Date | null): string => {
    if (!date) return "N/A";
    return date.toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  };

  const displayData = {
    totalStaked: stakingStats ? formatNumber(stakingStats.totalKnsStaked, 2) : "--",
    yourStaked: userStake ? formatNumber(userStake.stakedAmount, 2) : "0",
    yourStakedRaw: userStake?.stakedAmount || 0,
    avgMultiplier: stakingStats ? stakingStats.avgMultiplier.toFixed(2) : "--",
    yourWeightage: userStake ? userStake.poolSharePercent.toFixed(2) : "0.00",
    lockEndDate: userStake ? formatDate(userStake.lockEndTime) : "--",
    isActive: userStake?.active || false,
    isUnlocked: userStake ? userStake.lockEndTime <= new Date() : false,
    availableBalance: formatNumber(knsBalance, 6),
    // Earnings data
    unclaimedUsdc: userRewards ? formatNumber(userRewards.unclaimedUsdc, 2) : "0.00",
    unclaimedUsdcRaw: userRewards?.unclaimedUsdc ?? 0,
    totalRevenue: userRewards ? formatNumber(userRewards.totalRevenue, 2) : "0.00",
    totalClaimed: userRewards ? formatNumber(userRewards.totalClaimed, 2) : "0.00",
    nextPayoutDays: userRewards?.nextPayoutDays ?? 0,
    canClaim: userRewards ? userRewards.unclaimedUsdc > 0 && userRewards.nextPayoutDays === 0 : false,
  };

  // Claim validation
  const claimAmountNum = parseFloat(claimAmount) || 0;
  const isClaimAmountValid = claimAmountNum >= 1 && claimAmountNum <= displayData.unclaimedUsdcRaw;
  const claimButtonDisabled = !connected || !displayData.canClaim || !isClaimAmountValid;

  // History pagination
  const historyTotalPages = Math.ceil(stakingHistory.length / historyItemsPerPage);
  const paginatedHistory = stakingHistory.slice(
    (historyCurrentPage - 1) * historyItemsPerPage,
    historyCurrentPage * historyItemsPerPage
  );

  // Reward distribution history pagination
  const rewardHistoryTotalPages = Math.ceil(rewardDistributionHistory.length / rewardHistoryItemsPerPage);
  const paginatedRewardHistory = rewardDistributionHistory.slice(
    (rewardHistoryCurrentPage - 1) * rewardHistoryItemsPerPage,
    rewardHistoryCurrentPage * rewardHistoryItemsPerPage
  );

  // Claim history pagination
  const claimHistoryTotalPages = Math.ceil(claimHistory.length / claimHistoryItemsPerPage);
  const paginatedClaimHistory = claimHistory.slice(
    (claimHistoryCurrentPage - 1) * claimHistoryItemsPerPage,
    claimHistoryCurrentPage * claimHistoryItemsPerPage
  );

  // Handle stake button click - show warning first
  const handleStakeClick = () => {
    if (!connected || !publicKey || !sendTransaction) {
      setWalletModalVisible(true);
      return;
    }

    const amount = parseFloat(stakeAmount);
    if (isNaN(amount) || amount <= 0) {
      console.error("Invalid stake amount");
      return;
    }

    if (amount > knsBalance) {
      console.error("Insufficient KNS balance");
      return;
    }

    // Show warning modal before proceeding
    setShowStakeWarning(true);
  };

  // Handle stake warning cancel
  const handleStakeWarningCancel = () => {
    setShowStakeWarning(false);
  };

  // Handle stake warning confirm - proceed with actual staking
  const handleStakeWarningConfirm = () => {
    setShowStakeWarning(false);
    handleStake();
  };

  // Handle stake submission (called after warning confirmation)
  const handleStake = async () => {
    if (!connected || !publicKey || !sendTransaction) {
      return;
    }

    const amount = parseFloat(stakeAmount);

    // Reset state and show modal immediately
    setIsStaking(true);
    setTxSignature(null);
    setTransactionType("stake");
    setStakeStatus(StakeStatus.AWAITING_SIGNATURE);
    setShowTransactionModal(true);

    try {
      // Build the stake transaction
      const transaction = await buildStakeTransaction(publicKey, amount, selectedLockTier);

      // Create connection for sending and confirming
      const { Connection } = await import("@solana/web3.js");
      const connection = new Connection("https://api.devnet.solana.com", "confirmed");

      // Log transaction details for debugging
      console.log("Transaction details:", {
        recentBlockhash: transaction.recentBlockhash,
        feePayer: transaction.feePayer?.toBase58(),
        instructions: transaction.instructions.map(ix => ({
          programId: ix.programId.toBase58(),
          keys: ix.keys.map(k => ({
            pubkey: k.pubkey.toBase58(),
            isSigner: k.isSigner,
            isWritable: k.isWritable,
          })),
          dataLength: ix.data.length,
          dataHex: Buffer.from(ix.data).toString('hex'),
        })),
      });

      // Pre-flight simulation to catch errors before wallet popup
      console.log("Simulating transaction...");
      try {
        const simulation = await connection.simulateTransaction(transaction);
        console.log("Simulation result:", simulation);
        if (simulation.value.err) {
          console.error("Simulation failed:", simulation.value.err);
          console.error("Simulation logs:", simulation.value.logs);
          throw new Error(`Transaction simulation failed: ${JSON.stringify(simulation.value.err)}`);
        }
        console.log("Simulation successful, logs:", simulation.value.logs);
      } catch (simError) {
        console.error("Simulation error:", simError);
        throw simError;
      }

      // Send transaction through wallet adapter (Phantom uses signAndSendTransaction).
      const signature = await sendTransaction(transaction, connection, {
        skipPreflight: true, // We already simulated successfully
        preflightCommitment: "confirmed",
      });
      console.log("Stake transaction sent:", signature);
      setTxSignature(signature);
      setStakeStatus(StakeStatus.CONFIRMING);

      // Wait for transaction confirmation using latest blockhash
      const latestBlockhash = await connection.getLatestBlockhash("confirmed");
      const confirmation = await connection.confirmTransaction({
        signature,
        blockhash: latestBlockhash.blockhash,
        lastValidBlockHeight: latestBlockhash.lastValidBlockHeight,
      }, "confirmed");

      if (confirmation.value.err) {
        throw new Error("Transaction failed on chain");
      }

      console.log("Stake transaction confirmed:", signature);
      setStakeStatus(StakeStatus.CONFIRMED);

      // Refresh user data after confirmed stake
      const [userInfo, balance, rewards] = await Promise.all([
        fetchUserStake(publicKey),
        fetchKnsBalance(publicKey),
        fetchUserRewards(publicKey),
      ]);
      setUserStake(userInfo);
      setKnsBalance(balance);
      setUserRewards(rewards);
      setStakeAmount("");

      // Refresh global stats
      const [stats, stakers] = await Promise.all([
        fetchStakingStats(),
        fetchAllStakers(),
      ]);
      setStakingStats(stats);
      setAllStakers(stakers);
    } catch (err: unknown) {
      // Log detailed error info for debugging
      console.error("Stake transaction failed:", err);
      if (err && typeof err === 'object') {
        const errorObj = err as Record<string, unknown>;
        if ('message' in errorObj) console.error("Error message:", errorObj.message);
        if ('logs' in errorObj) console.error("Program logs:", errorObj.logs);
        if ('error' in errorObj) console.error("Inner error:", errorObj.error);
        // Check for simulation error details
        if ('simulationResponse' in errorObj) {
          console.error("Simulation response:", errorObj.simulationResponse);
        }
      }
      setStakeStatus(StakeStatus.FAILED);
    } finally {
      setIsStaking(false);
    }
  };

  // Close transaction modal and reset state
  const handleCloseTransactionModal = () => {
    setShowTransactionModal(false);
    setStakeStatus(StakeStatus.IDLE);
  };

  // Retry handler - closes modal first, waits for wallet to reset, then retries
  const handleRetry = async () => {
    // Close modal and reset state first
    setShowTransactionModal(false);
    setStakeStatus(StakeStatus.IDLE);
    setTxSignature(null);

    // Small delay to let wallet adapter reset its state after rejection
    await new Promise(resolve => setTimeout(resolve, 300));

    // Now initiate a fresh attempt based on transaction type
    if (transactionType === "unstake") {
      handleUnstake();
    } else if (transactionType === "claim") {
      handleClaim();
    } else {
      handleStake();
    }
  };

  // Handle unstake submission
  const handleUnstake = async () => {
    if (!connected || !publicKey || !sendTransaction) {
      setWalletModalVisible(true);
      return;
    }

    // Validate lock expiry client-side
    if (userStake && userStake.lockEndTime > new Date()) {
      console.error("Stake is still locked");
      return;
    }

    // Reset state and show modal immediately
    setIsUnstaking(true);
    setTxSignature(null);
    setTransactionType("unstake");
    setStakeStatus(StakeStatus.AWAITING_SIGNATURE);
    setShowTransactionModal(true);

    try {
      // Build the withdraw transaction
      const transaction = await buildWithdrawTransaction(publicKey);

      // Create connection for sending and confirming
      const connection = new Connection(STAKING_RPC_ENDPOINT, "confirmed");

      // Log transaction details for debugging
      console.log("Withdraw transaction details:", {
        recentBlockhash: transaction.recentBlockhash,
        feePayer: transaction.feePayer?.toBase58(),
        instructions: transaction.instructions.map(ix => ({
          programId: ix.programId.toBase58(),
          keys: ix.keys.map(k => ({
            pubkey: k.pubkey.toBase58(),
            isSigner: k.isSigner,
            isWritable: k.isWritable,
          })),
          dataLength: ix.data.length,
        })),
      });

      // Send transaction through wallet adapter (Phantom uses signAndSendTransaction).
      const signature = await sendTransaction(transaction, connection, {
        skipPreflight: false,
        preflightCommitment: "confirmed",
      });
      console.log("Withdraw transaction sent:", signature);
      setTxSignature(signature);
      setStakeStatus(StakeStatus.CONFIRMING);

      // Wait for transaction confirmation
      const latestBlockhash = await connection.getLatestBlockhash("confirmed");
      const confirmation = await connection.confirmTransaction({
        signature,
        blockhash: latestBlockhash.blockhash,
        lastValidBlockHeight: latestBlockhash.lastValidBlockHeight,
      }, "confirmed");

      if (confirmation.value.err) {
        throw new Error("Transaction failed on chain");
      }

      console.log("Withdraw transaction confirmed:", signature);
      setStakeStatus(StakeStatus.CONFIRMED);

      // Refresh user data after confirmed withdrawal
      const [userInfo, balance, rewards] = await Promise.all([
        fetchUserStake(publicKey),
        fetchKnsBalance(publicKey),
        fetchUserRewards(publicKey),
      ]);
      setUserStake(userInfo);
      setKnsBalance(balance);
      setUserRewards(rewards);

      // Refresh global stats
      const [stats, stakers] = await Promise.all([
        fetchStakingStats(),
        fetchAllStakers(),
      ]);
      setStakingStats(stats);
      setAllStakers(stakers);
    } catch (err: unknown) {
      // Log detailed error info for debugging
      console.error("Withdraw transaction failed:", err);
      if (err && typeof err === 'object') {
        const errorObj = err as Record<string, unknown>;
        if ('message' in errorObj) console.error("Error message:", errorObj.message);
        if ('logs' in errorObj) console.error("Program logs:", errorObj.logs);

        // Parse specific error codes
        const errorMessage = String(errorObj.message || '');
        if (errorMessage.includes("6006") || errorMessage.includes("StillLocked")) {
          console.error("Stake is still locked - cannot withdraw yet");
        } else if (errorMessage.includes("6012") || errorMessage.includes("ClaimFirst")) {
          console.error("Must claim rewards before withdrawing");
        } else if (errorMessage.includes("6004") || errorMessage.includes("NoActiveStake")) {
          console.error("No active stake found");
        }
      }
      setStakeStatus(StakeStatus.FAILED);
    } finally {
      setIsUnstaking(false);
    }
  };

  // Handle claim submission
  const handleClaim = async () => {
    console.log("handleClaim called");
    console.log("Claim state:", {
      connected,
      publicKey: publicKey?.toBase58(),
      sendTransaction: !!sendTransaction,
      claimAmount,
      unclaimedUsdcRaw: displayData.unclaimedUsdcRaw,
      canClaim: displayData.canClaim,
    });

    if (!connected || !publicKey || !sendTransaction) {
      console.log("Wallet not connected, showing modal");
      setWalletModalVisible(true);
      return;
    }

    // Validate claim amount
    const amount = parseFloat(claimAmount);
    console.log("Parsed claim amount:", amount);
    if (isNaN(amount) || amount < 1 || amount > displayData.unclaimedUsdcRaw) {
      console.error("Invalid claim amount:", { amount, min: 1, max: displayData.unclaimedUsdcRaw });
      return;
    }

    // Reset state and show modal immediately
    setIsClaiming(true);
    setTxSignature(null);
    setTransactionType("claim");
    setStakeStatus(StakeStatus.AWAITING_SIGNATURE);
    setShowTransactionModal(true);

    try {
      // Build the claim transaction
      const transaction = await buildClaimTransaction(publicKey);

      // Create connection for sending and confirming
      const connection = new Connection(STAKING_RPC_ENDPOINT, "confirmed");

      // Log transaction details for debugging
      console.log("Claim transaction details:", {
        recentBlockhash: transaction.recentBlockhash,
        feePayer: transaction.feePayer?.toBase58(),
        instructions: transaction.instructions.map(ix => ({
          programId: ix.programId.toBase58(),
          keys: ix.keys.map(k => ({
            pubkey: k.pubkey.toBase58(),
            isSigner: k.isSigner,
            isWritable: k.isWritable,
          })),
          dataLength: ix.data.length,
        })),
      });

      // Pre-simulate transaction to catch errors before wallet popup
      console.log("Simulating claim transaction...");
      try {
        const simulation = await connection.simulateTransaction(transaction);
        console.log("Simulation result:", simulation);
        if (simulation.value.err) {
          console.error("Simulation failed:", simulation.value.err);
          console.error("Simulation logs:", simulation.value.logs);
          throw new Error(`Transaction simulation failed: ${JSON.stringify(simulation.value.err)}`);
        }
        console.log("Simulation successful, logs:", simulation.value.logs);
      } catch (simError) {
        console.error("Simulation error:", simError);
        throw simError;
      }

      // Send transaction through wallet adapter (Phantom uses signAndSendTransaction).
      const signature = await sendTransaction(transaction, connection, {
        skipPreflight: false,
        preflightCommitment: "confirmed",
      });
      console.log("Claim transaction sent:", signature);
      setTxSignature(signature);
      setStakeStatus(StakeStatus.CONFIRMING);

      // Wait for transaction confirmation
      const latestBlockhash = await connection.getLatestBlockhash("confirmed");
      const confirmation = await connection.confirmTransaction({
        signature,
        blockhash: latestBlockhash.blockhash,
        lastValidBlockHeight: latestBlockhash.lastValidBlockHeight,
      }, "confirmed");

      if (confirmation.value.err) {
        throw new Error("Transaction failed on chain");
      }

      console.log("Claim transaction confirmed:", signature);
      setStakeStatus(StakeStatus.CONFIRMED);

      // Refresh user data after confirmed claim
      const [userInfo, balance, rewards] = await Promise.all([
        fetchUserStake(publicKey),
        fetchKnsBalance(publicKey),
        fetchUserRewards(publicKey),
      ]);
      setUserStake(userInfo);
      setKnsBalance(balance);
      setUserRewards(rewards);
      setClaimAmount("");

      // Refresh global stats
      const [stats, stakers] = await Promise.all([
        fetchStakingStats(),
        fetchAllStakers(),
      ]);
      setStakingStats(stats);
      setAllStakers(stakers);
    } catch (err: unknown) {
      // Log detailed error info for debugging
      console.error("Claim transaction failed:", err);
      if (err && typeof err === 'object') {
        const errorObj = err as Record<string, unknown>;
        if ('message' in errorObj) console.error("Error message:", errorObj.message);
        if ('logs' in errorObj) console.error("Program logs:", errorObj.logs);

        // Parse specific error codes
        const errorMessage = String(errorObj.message || '');
        if (errorMessage.includes("6010") || errorMessage.includes("NothingToClaim")) {
          console.error("No rewards to claim");
        } else if (errorMessage.includes("6004") || errorMessage.includes("NoActiveStake")) {
          console.error("No active stake found");
        }
      }
      setStakeStatus(StakeStatus.FAILED);
    } finally {
      setIsClaiming(false);
    }
  };

  return (
    <PinProtection correctPin="9125">
    <>
      <Helmet>
        <title>KNS Staking | KindSwap</title>
        <meta name="robots" content="noindex, nofollow" />
      </Helmet>

      <div className="min-h-[90vh] bg-background relative overflow-hidden">
        {/* Background Effects */}
        <div className="absolute inset-0 bg-gradient-to-br from-ocean-cyan/5 via-transparent to-ocean-seafoam/5" />
        <div className="absolute top-20 left-1/2 -translate-x-1/2 w-96 h-96 bg-ocean-cyan/10 rounded-full blur-3xl animate-float" />
        <div
          className="absolute bottom-40 left-1/2 -translate-x-1/2 w-80 h-80 bg-ocean-seafoam/10 rounded-full blur-3xl animate-float"
          style={{ animationDelay: "2s" }}
        />
        <div className="absolute inset-0 bg-[linear-gradient(rgba(29,211,211,0.03)_1px,transparent_1px),linear-gradient(90deg,rgba(29,211,211,0.03)_1px,transparent_1px)] bg-[size:60px_60px]" />

        <div className="relative z-10 container mx-auto px-4 py-24 max-w-6xl">
          {/* Page Header */}
          <header className="text-center mb-8 md:mb-12">
            <div className="flex items-center justify-center gap-2 md:gap-3 mb-3 md:mb-4">
              <Coins className="w-8 h-8 md:w-10 md:h-10 text-ocean-cyan" />
              <h1 className="text-3xl md:text-4xl lg:text-5xl font-bold gradient-text">
                KNS Staking & Revenue Sharing.
              </h1>
            </div>
            <p className="text-sm md:text-lg text-muted-foreground max-w-2xl mx-auto">
              Earn a share of KindSwap protocol fees by staking KNS.
            </p>
          </header>

          {/* Staking Overview Card */}
          <Card className="border-primary/20 bg-primary/5 rounded-2xl mb-6 md:mb-8">
            <div className="flex flex-col space-y-1.5 p-4 md:p-6 pb-3 md:pb-4">
              <h3 className="flex items-center gap-2 text-base md:text-lg font-semibold leading-none tracking-tight">
                <PieChart className="w-4 h-4 md:w-5 md:h-5 text-primary" />
                Staking Overview
                {isLoading && <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" />}
              </h3>
            </div>
            <div className="p-4 md:p-6 pt-0">
              <div className="grid grid-cols-2 md:grid-cols-2 lg:grid-cols-4 gap-2 md:gap-4">
                <div className="text-center p-3 md:p-5 rounded-xl bg-white/[0.03] border border-white/10 hover:border-primary/30 transition-colors">
                  <p className="text-xs md:text-sm font-semibold text-muted-foreground/80 mb-1 md:mb-2 drop-shadow-[0_0_8px_rgba(255,255,255,0.3)]">
                    Total KNS Staked
                  </p>
                  <p className="text-xl md:text-2xl lg:text-3xl font-bold text-foreground">
                    {displayData.totalStaked}
                  </p>
                </div>
                <div className="text-center p-3 md:p-5 rounded-xl bg-white/[0.03] border border-white/10 hover:border-primary/30 transition-colors">
                  <p className="text-xs md:text-sm font-semibold text-muted-foreground/80 mb-1 md:mb-2 drop-shadow-[0_0_8px_rgba(255,255,255,0.3)]">
                    Your Staked
                  </p>
                  <p className="text-xl md:text-2xl lg:text-3xl font-bold gradient-text">
                    {displayData.yourStaked}
                  </p>
                  {displayData.isActive && (
                    <div className="flex items-center justify-center gap-1 mt-1 md:mt-2">
                      <Lock className="w-2.5 h-2.5 md:w-3 md:h-3 text-pink-300/80 drop-shadow-[0_0_12px_rgba(255,182,193,0.8)]" />
                      <p className="text-[10px] md:text-xs font-bold text-pink-300/80 drop-shadow-[0_0_12px_rgba(255,182,193,0.8)]">
                        {displayData.isUnlocked ? "Unlocked" : `Locked until ${displayData.lockEndDate}`}
                      </p>
                    </div>
                  )}
                </div>
                <div className="text-center p-3 md:p-5 rounded-xl bg-white/[0.03] border border-white/10 hover:border-primary/30 transition-colors">
                  <p className="text-xs md:text-sm font-semibold text-muted-foreground/80 mb-1 md:mb-2 drop-shadow-[0_0_8px_rgba(255,255,255,0.3)]">
                    Avg. Multiplier
                  </p>
                  <p className="text-xl md:text-2xl lg:text-3xl font-bold text-orange-400">
                    {displayData.avgMultiplier}x
                  </p>
                  <p className="text-[10px] md:text-xs font-bold text-muted-foreground/60 mt-1">
                    Platform average
                  </p>
                </div>
                <div className="text-center p-3 md:p-5 rounded-xl bg-white/[0.03] border border-white/10 hover:border-primary/30 transition-colors">
                  <p className="text-xs md:text-sm font-semibold text-muted-foreground/80 mb-1 md:mb-2 drop-shadow-[0_0_8px_rgba(255,255,255,0.3)]">
                    Your Weightage
                  </p>
                  <p className="text-xl md:text-2xl lg:text-3xl font-bold text-purple-400">
                    {displayData.yourWeightage}%
                  </p>
                  <p className="text-[10px] md:text-xs font-bold text-muted-foreground/60 mt-1">
                    Weighted pool share
                  </p>
                </div>
              </div>
            </div>
          </Card>

          {/* Main Action Cards Grid - Stake KNS and Your Earnings */}
          <div className="grid md:grid-cols-2 gap-4 md:gap-6 mb-6 md:mb-8">
          {/* Stake KNS Card */}
          <Card className="border-primary/20 bg-primary/5 rounded-2xl hover:border-primary/40 transition-colors">
            <div className="flex flex-col space-y-1 md:space-y-1.5 p-4 md:p-6 pb-3 md:pb-4">
              <h3 className="flex items-center gap-2 text-base md:text-lg font-semibold leading-none tracking-tight">
                <ArrowDownUp className="w-4 h-4 md:w-5 md:h-5 text-primary" />
                Stake KNS
              </h3>
              <p className="text-xs md:text-sm text-muted-foreground/80">
                Lock your KNS tokens to earn protocol revenue
              </p>
            </div>
            <div className="p-4 md:p-6 pt-0 space-y-4 md:space-y-5">
              {/* Token Display */}
              <div className="flex items-center gap-2 md:gap-3 p-2 md:p-3 rounded-xl bg-gradient-to-br from-white/[0.03] to-white/[0.01] border border-white/[0.04] shadow-inner shadow-black/5">
                <div className="w-8 h-8 md:w-10 md:h-10 rounded-full bg-gradient-to-br from-primary to-secondary flex items-center justify-center">
                  <span className="text-background font-bold text-xs md:text-sm">KNS</span>
                </div>
                <div className="flex-1">
                  <p className="font-semibold text-xs md:text-sm">KindSoul</p>
                  <p className="text-[10px] md:text-xs text-muted-foreground/70">KNS Token</p>
                </div>
                <div className="text-right">
                  <p className="text-[10px] md:text-xs text-muted-foreground/70">Staked</p>
                  <p className="text-base md:text-lg font-bold text-primary">{displayData.yourStaked}</p>
                </div>
              </div>

              {/* Amount Input */}
              <div className="space-y-2">
                <div className="flex justify-between text-[10px] md:text-xs">
                  <span className="text-muted-foreground/80">Amount to Stake</span>
                  <span className="text-muted-foreground/80">Available: {displayData.availableBalance} KNS</span>
                </div>
                <div className="flex gap-2">
                  <Input
                    type="number"
                    placeholder="0.00"
                    value={stakeAmount}
                    onChange={(e) => setStakeAmount(e.target.value)}
                    className="bg-white/[0.03] border-white/5 text-base md:text-lg focus:border-primary/30"
                    disabled={!connected || displayData.isActive}
                  />
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setStakeAmount(knsBalance.toString())}
                    className="border-primary/30 text-primary hover:bg-primary/10 text-xs md:text-sm"
                    disabled={!connected || displayData.isActive}
                  >
                    Max
                  </Button>
                </div>
              </div>

              {/* Lock Duration Tier Selector */}
              <div className="space-y-2 md:space-y-3">
                <div className="flex items-center gap-2">
                  <Lock className="w-3.5 h-3.5 md:w-4 md:h-4 text-muted-foreground" />
                  <span className="text-[10px] md:text-xs text-muted-foreground/80">Select Lock Duration</span>
                </div>
                <div className="grid grid-cols-5 gap-1 md:gap-2">
                  {lockTiers.map((tier) => {
                    const isSelected = selectedLockTier === tier.key;
                    const colorClasses: Record<string, { text: string; border: string; bg: string }> = {
                      gray: {
                        text: "text-gray-400",
                        border: "border-gray-500/40",
                        bg: "bg-gray-500/10",
                      },
                      blue: {
                        text: "text-blue-400",
                        border: "border-blue-500/40",
                        bg: "bg-blue-500/10",
                      },
                      orange: {
                        text: "text-orange-400",
                        border: "border-orange-500/40",
                        bg: "bg-orange-500/10",
                      },
                      purple: {
                        text: "text-purple-400",
                        border: "border-purple-500/40",
                        bg: "bg-purple-500/10",
                      },
                      cyan: {
                        text: "text-primary",
                        border: "border-primary/50",
                        bg: "bg-gradient-to-br from-primary/20 to-secondary/20",
                      },
                    };
                    const colors = colorClasses[tier.color];
                    return (
                      <button
                        key={tier.key}
                        onClick={() => setSelectedLockTier(tier.key)}
                        disabled={displayData.isActive}
                        className={`relative p-2 md:p-3 rounded-xl border transition-all duration-300 ${
                          isSelected
                            ? `${colors.bg} ${colors.border} ${"best" in tier && tier.best ? "shadow-[0_0_20px_hsl(185_80%_55%/0.2)]" : ""}`
                            : "bg-white/[0.02] border-white/5 hover:border-white/10"
                        } ${displayData.isActive ? "opacity-50 cursor-not-allowed" : ""}`}
                      >
                        {"best" in tier && tier.best && (
                          <div className="absolute -top-2 left-1/2 -translate-x-1/2">
                            <Badge className="bg-primary/20 text-primary border-primary/30 text-[8px] md:text-[10px] px-1 md:px-1.5 py-0">
                              <Star className="w-2 h-2 md:w-2.5 md:h-2.5 mr-0.5" />
                              Best
                            </Badge>
                          </div>
                        )}
                        <p
                          className={`text-xs md:text-sm font-medium ${isSelected ? "text-foreground" : "text-muted-foreground"}`}
                        >
                          {tier.label}
                        </p>
                        <p
                          className={`text-base md:text-lg font-bold mt-1 ${
                            isSelected ? colors.text : "text-muted-foreground/70"
                          }`}
                        >
                          {tier.multiplier}
                        </p>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Stake Button */}
              <Button
                className="w-full bg-gradient-to-r from-primary to-secondary hover:opacity-90 text-background font-semibold backdrop-blur-sm"
                onClick={handleStakeClick}
                disabled={isStaking || (connected && displayData.isActive) || (connected && !stakeAmount)}
              >
                {isStaking ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Staking...
                  </>
                ) : (
                  <>
                    <Coins className="w-4 h-4 mr-2" />
                    {!connected
                      ? "Connect Wallet"
                      : displayData.isActive
                        ? "Already Staked"
                        : `Stake KNS (${lockTiers.find((t) => t.key === selectedLockTier)?.multiplier} multiplier)`}
                  </>
                )}
              </Button>

              {/* Unstake KNS Section */}
              <div className="mt-4 border-t border-white/10 pt-4">
                {/* Unstake Header - Collapsible Toggle */}
                <button
                  onClick={() => setIsUnstakeExpanded(!isUnstakeExpanded)}
                  className="w-full flex items-center justify-between p-3 rounded-xl bg-red-500/10 border border-zinc-800 hover:border-red-500/30 transition-colors"
                >
                  <div className="flex items-center gap-2">
                    <div className="w-6 h-6 rounded-full bg-red-500/20 flex items-center justify-center">
                      <ArrowDownUp className="w-3.5 h-3.5 text-red-500" />
                    </div>
                    <span className="text-sm font-bold text-white">Unstake KNS</span>
                    {/* SOON Badge - show when lock is active */}
                    {displayData.isActive && !displayData.isUnlocked && (
                      <Badge className="bg-red-500/20 text-red-400 border-red-500/30 text-[10px] px-1.5 py-0">
                        SOON
                      </Badge>
                    )}
                  </div>
                  <ChevronDown
                    className={`w-4 h-4 text-red-500 transition-transform duration-200 ${
                      isUnstakeExpanded ? "rotate-180" : ""
                    }`}
                  />
                </button>

                {/* Unstake Content - Expandable */}
                {isUnstakeExpanded && (
                  <div className="mt-3 space-y-3">
                    {/* Currently Staked Display */}
                    <div className="flex justify-between text-xs">
                      <span className="text-muted-foreground">Currently Staked</span>
                      <span className="text-white font-medium">{displayData.yourStaked} KNS</span>
                    </div>

                    {/* Unstake Amount Display (read-only - full withdrawal only) */}
                    <div>
                      <Input
                        type="text"
                        value={`${displayData.yourStaked} KNS`}
                        className="bg-gray-900/50 border-slate-800 text-base text-white cursor-not-allowed"
                        disabled
                        readOnly
                      />
                      <p className="text-[10px] text-muted-foreground/60 mt-1">
                        Full withdrawal only - all staked KNS will be returned
                      </p>
                    </div>

                    {/* Unstake Button */}
                    <Button
                      className="w-full bg-red-500/10 border border-zinc-800 text-red-500 hover:bg-red-500/20 hover:border-red-500/30 font-semibold"
                      disabled={!connected || !displayData.isActive || !displayData.isUnlocked || isUnstaking}
                      onClick={handleUnstake}
                    >
                      {isUnstaking ? (
                        <>
                          <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                          Unstaking...
                        </>
                      ) : !connected ? (
                        "Connect Wallet"
                      ) : !displayData.isActive ? (
                        "No Active Stake"
                      ) : !displayData.isUnlocked ? (
                        `Unlocks in ${lockCountdown || displayData.lockEndDate}`
                      ) : (
                        "Unstake KNS"
                      )}
                    </Button>
                  </div>
                )}
              </div>

            </div>
          </Card>

          {/* Your Earnings Card */}
          <Card className="border-primary/20 bg-primary/5 rounded-2xl hover:border-primary/40 transition-colors">
            <div className="flex flex-col space-y-1 md:space-y-1.5 p-4 md:p-6 pb-3 md:pb-4">
              <h3 className="flex items-center gap-2 text-base md:text-lg font-semibold leading-none tracking-tight">
                <Wallet className="w-4 h-4 md:w-5 md:h-5 text-primary" />
                Your Earnings
              </h3>
              <p className="text-xs md:text-sm text-muted-foreground/80">
                Track and claim your USDC revenue share
              </p>
            </div>
            <div className="p-4 md:p-6 pt-0 space-y-3">
              {/* Total Revenue Earned - Highlighted Box */}
              <div className="p-4 rounded-xl bg-teal-500/5 border border-teal-500/40">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-xs text-muted-foreground mb-1">
                      <span className="text-cyan-400 font-bold">$</span> Total Revenue Earned
                    </p>
                    <div className="flex items-center gap-2">
                      <div className="w-6 h-6 rounded-full bg-[#2775CA] flex items-center justify-center shrink-0">
                        <span className="text-white font-bold text-[10px]">$</span>
                      </div>
                      <p className="text-2xl font-bold text-teal-500">{displayData.unclaimedUsdc} USDC</p>
                    </div>
                    <p className="text-xs text-teal-500 mt-1">
                      {displayData.canClaim ? "Ready to claim" : displayData.nextPayoutDays === 0 ? "No rewards yet" : `Claimable in ~${displayData.nextPayoutDays} days`}
                    </p>
                  </div>
                </div>
              </div>

              {/* Total Revenue Box */}
              <div className="p-4 rounded-xl bg-gray-900/50 border border-slate-800">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-xs text-muted-foreground mb-1">Total Revenue</p>
                    <div className="flex items-center gap-2">
                      <div className="w-6 h-6 rounded-full bg-[#2775CA] flex items-center justify-center shrink-0">
                        <span className="text-white font-bold text-[10px]">$</span>
                      </div>
                      <p className="text-2xl font-bold text-white">{displayData.totalRevenue} USDC</p>
                    </div>
                  </div>
                  <TrendingUp className="w-7 h-7 text-cyan-400/50" />
                </div>
              </div>

              {/* Next Payout Box */}
              <div className="p-4 rounded-xl bg-gray-900/50 border border-slate-800">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-xs text-muted-foreground mb-1">Next Payout</p>
                    <p className="text-2xl font-bold text-white">
                      {displayData.nextPayoutDays === 0 ? "Now" : `~${displayData.nextPayoutDays} days`}
                    </p>
                  </div>
                  <Clock className="w-6 h-6 text-muted-foreground/50" />
                </div>
              </div>

              {/* Claim Amount Input */}
              <div className="space-y-2">
                <div className="flex justify-between items-center">
                  <span className="text-xs text-muted-foreground">Claim Amount</span>
                  <button
                    onClick={() => setClaimAmount(displayData.unclaimedUsdcRaw.toString())}
                    className="text-cyan-400 text-sm font-bold hover:text-cyan-300 transition-colors"
                    disabled={!connected || !displayData.canClaim}
                  >
                    Max
                  </button>
                </div>
                <div className="relative">
                  <Input
                    type="number"
                    placeholder="0"
                    value={claimAmount}
                    onChange={(e) => setClaimAmount(e.target.value)}
                    className="bg-gray-900/50 border-slate-800 text-sm pr-16 focus:border-primary/30"
                    disabled={!connected || !displayData.canClaim}
                  />
                  <span className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground font-bold text-sm">
                    USDC
                  </span>
                </div>
              </div>

              {/* Claim Button */}
              <Button
                className="w-full bg-gradient-to-r from-primary to-secondary hover:opacity-90 text-background font-semibold backdrop-blur-sm"
                disabled={claimButtonDisabled || isClaiming}
                onClick={handleClaim}
              >
                {isClaiming ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Claiming...
                  </>
                ) : (
                  <>
                    <div className="w-4 h-4 rounded-full bg-teal-300 flex items-center justify-center mr-2">
                      <span className="text-black font-bold text-[10px]">$</span>
                    </div>
                    {!connected ? "Connect Wallet" : `Claim ${claimAmount || "0.00"} USDC`}
                  </>
                )}
              </Button>

              {/* Helper Text */}
              <p className="text-xs text-muted-foreground text-center">
                Minimum claim: $1 USDC • You pay gas fees
              </p>

              {/* Total Claimed Box */}
              <div className="p-4 rounded-xl bg-gray-900/50 border border-slate-800">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-xs text-muted-foreground mb-1">Total Claimed</p>
                    <div className="flex items-center gap-2">
                      <div className="w-6 h-6 rounded-full bg-[#2775CA] flex items-center justify-center shrink-0">
                        <span className="text-white font-bold text-[10px]">$</span>
                      </div>
                      <p className="text-2xl font-bold text-cyan-400">{displayData.totalClaimed} USDC</p>
                    </div>
                  </div>
                  <TrendingUp className="w-7 h-7 text-cyan-400/50" />
                </div>
              </div>
            </div>
          </Card>
          </div>

          {/* Activity History Section Header */}
          <div className="mb-6 md:mb-8">
            <div className="w-72 justify-start text-white text-xl font-bold font-['Arial'] leading-5 mb-2">Activity History</div>
            <div className="justify-start text-slate-500 text-sm font-normal font-['Arial'] leading-5">Track your ledger of KNS staking actions, periodic reward distributions, and USDC claim records in real-time.</div>
          </div>

          {/* Staking & Unstaking History */}
          <div className="mb-6 md:mb-8">
            {/* Header */}
            <div className="inline-flex justify-start items-center gap-3 mb-4">
              <div className="size-10 bg-cyan-400/10 rounded-xl shadow-[inset_0px_2px_4px_0px_rgba(0,0,0,0.05)] flex justify-center items-center">
                <ArrowDownUp className="w-5 h-4 text-cyan-400" />
              </div>
              <div className="relative flex items-center gap-2">
                <div className="justify-start text-white text-lg font-bold font-['Arial'] leading-5">Staking &amp; Unstaking History</div>
                {isHistoryLoading && <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" />}
              </div>
            </div>

            {/* Table Container */}
            <div className="bg-gray-900 rounded-3xl shadow-[0px_4px_6px_-2px_rgba(0,0,0,0.05)] shadow-[0px_10px_30px_-5px_rgba(216,137,28,0.10)] outline outline-1 outline-offset-[-1px] outline-gray-900 overflow-hidden">
              {!connected ? (
                <div className="text-center py-8 text-muted-foreground">
                  Connect wallet to view history
                </div>
              ) : stakingHistory.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  {isHistoryLoading ? "Loading history..." : "No staking history found"}
                </div>
              ) : (
                <>
                  {/* Table Header */}
                  <div className="border-b border-gray-800 inline-flex justify-start items-start w-full">
                    <div className="w-52 px-8 py-5 inline-flex flex-col justify-start items-start">
                      <div className="text-slate-400 text-xs font-bold font-['Plus_Jakarta_Sans'] uppercase tracking-wide">Date</div>
                    </div>
                    <div className="w-48 px-8 py-5 inline-flex flex-col justify-start items-start">
                      <div className="text-slate-400 text-xs font-bold font-['Plus_Jakarta_Sans'] uppercase tracking-wide">Action</div>
                    </div>
                    <div className="w-52 px-8 py-5 inline-flex flex-col justify-start items-start">
                      <div className="text-slate-400 text-xs font-bold font-['Plus_Jakarta_Sans'] uppercase tracking-wide">Amount (KNS)</div>
                    </div>
                    <div className="w-48 px-8 py-5 inline-flex flex-col justify-start items-start">
                      <div className="text-slate-400 text-xs font-bold font-['Plus_Jakarta_Sans'] uppercase tracking-wide">Lock Period</div>
                    </div>
                    <div className="w-44 px-8 py-5 inline-flex flex-col justify-start items-start">
                      <div className="text-slate-400 text-xs font-bold font-['Plus_Jakarta_Sans'] uppercase tracking-wide">Multiplier</div>
                    </div>
                    <div className="flex-1 px-8 py-5 inline-flex flex-col justify-start items-end whitespace-nowrap">
                      <div className="text-right text-slate-400 text-xs font-bold font-['Plus_Jakarta_Sans'] uppercase tracking-wide">Transaction Hash</div>
                    </div>
                  </div>

                  {/* Table Body */}
                  <div className="flex flex-col justify-start items-start w-full">
                    {paginatedHistory.map((entry, idx) => (
                      <div key={idx} className={`self-stretch pr-8 inline-flex justify-start items-center ${idx > 0 ? 'border-t border-gray-800' : ''}`}>
                        <div className="w-52 px-8 py-6 inline-flex flex-col justify-start items-start">
                          <div className="text-white text-base font-semibold font-['Plus_Jakarta_Sans']">
                            {entry.date.toLocaleDateString("en-US", {
                              year: "numeric",
                              month: "2-digit",
                              day: "2-digit",
                            })}
                          </div>
                        </div>
                        <div className="w-48 px-8 py-5 inline-flex flex-col justify-start items-start">
                          <div className={`px-4 py-1.5 rounded-full outline outline-1 outline-offset-[-1px] inline-flex justify-start items-start ${
                            entry.action === "stake"
                              ? "bg-teal-500/10 outline-teal-500/20"
                              : "bg-red-500/10 outline-red-500/20"
                          }`}>
                            <div className={`text-[10px] font-black font-['Plus_Jakarta_Sans'] uppercase tracking-wide ${
                              entry.action === "stake" ? "text-teal-500" : "text-red-500"
                            }`}>
                              {entry.action}
                            </div>
                          </div>
                        </div>
                        <div className="w-52 px-8 py-6 inline-flex flex-col justify-start items-start">
                          <div className="text-white text-base font-extrabold font-['Plus_Jakarta_Sans']">
                            {formatNumber(entry.amount, 2)}
                          </div>
                        </div>
                        <div className="w-48 px-8 py-6 inline-flex flex-col justify-start items-start">
                          <div className="text-white text-base font-normal font-['Plus_Jakarta_Sans']">
                            {entry.lockPeriod || "—"}
                          </div>
                        </div>
                        <div className="w-44 px-8 py-6 flex justify-start items-center gap-1">
                          <div className="text-cyan-400 text-base font-bold font-['Plus_Jakarta_Sans']">
                            {entry.multiplier ? `${entry.multiplier.toFixed(1)}x` : "—"}
                          </div>
                          {entry.multiplier && (
                            <div className="inline-flex flex-col justify-start items-start">
                              <TrendingUp className="w-3 h-2.5 text-cyan-400" />
                            </div>
                          )}
                        </div>
                        <div className="flex-1 px-8 flex justify-end items-center gap-1">
                          <a
                            href={`https://solscan.io/tx/${entry.txSignature}?cluster=devnet`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-right text-cyan-400 text-sm font-normal font-['Liberation_Mono'] leading-5 hover:text-cyan-300 transition-colors"
                          >
                            {entry.txSignature.slice(0, 6)}...{entry.txSignature.slice(-4)}
                          </a>
                          <ExternalLink className="size-3 text-cyan-400" />
                        </div>
                      </div>
                    ))}
                  </div>

                  {/* Pagination Controls */}
                  {historyTotalPages > 1 && (
                    <div className="flex items-center justify-end gap-2 px-8 py-4 border-t border-gray-800">
                      <button
                        onClick={() => setHistoryCurrentPage(p => Math.max(1, p - 1))}
                        disabled={historyCurrentPage === 1}
                        className="w-8 h-8 flex items-center justify-center rounded-2xl disabled:opacity-30 disabled:cursor-not-allowed transition-colors hover:text-slate-300"
                      >
                        <ChevronLeft className="w-4 h-4 text-slate-400" />
                      </button>
                      <div className="flex items-center gap-1.5">
                        {Array.from({ length: historyTotalPages }, (_, i) => i + 1).map(page => (
                          <button
                            key={page}
                            onClick={() => setHistoryCurrentPage(page)}
                            className={`w-8 h-8 flex items-center justify-center rounded-xl text-xs font-semibold transition-all ${
                              historyCurrentPage === page
                                ? "bg-cyan-400 text-gray-900 shadow-lg shadow-cyan-400/20"
                                : "text-slate-400 hover:text-slate-300"
                            }`}
                          >
                            {page}
                          </button>
                        ))}
                      </div>
                      <button
                        onClick={() => setHistoryCurrentPage(p => Math.min(historyTotalPages, p + 1))}
                        disabled={historyCurrentPage === historyTotalPages}
                        className="w-8 h-8 flex items-center justify-center rounded-2xl disabled:opacity-30 disabled:cursor-not-allowed transition-colors hover:text-slate-300"
                      >
                        <ChevronRight className="w-4 h-4 text-slate-400" />
                      </button>
                    </div>
                  )}
                </>
              )}
            </div>
          </div>

          {/* Reward Distribution History */}
          <div className="mb-6 md:mb-8">
            {/* Header */}
            <div className="inline-flex justify-start items-center gap-3 mb-4">
              <div className="size-10 bg-cyan-400/10 rounded-xl shadow-[inset_0px_2px_4px_0px_rgba(0,0,0,0.05)] flex justify-center items-center">
                <TrendingUp className="w-5 h-4 text-cyan-400" />
              </div>
              <div className="relative flex items-center gap-2">
                <div className="justify-start text-white text-lg font-bold leading-5">Reward Distribution History</div>
                {isRewardHistoryLoading && <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" />}
              </div>
            </div>

            {/* Table Container */}
            <div className="bg-gray-900 rounded-3xl shadow-[0px_4px_6px_-2px_rgba(0,0,0,0.05)] shadow-[0px_10px_30px_-5px_rgba(216,137,28,0.10)] outline outline-1 outline-offset-[-1px] outline-gray-900 overflow-hidden">
              {!connected ? (
                <div className="text-center py-8 text-muted-foreground">
                  Connect wallet to view reward history
                </div>
              ) : rewardDistributionHistory.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  {isRewardHistoryLoading ? "Loading reward history..." : "No reward distribution history found"}
                </div>
              ) : (
                <>
                  {/* Table Header */}
                  <div className="border-b border-gray-800 inline-flex justify-start items-start w-full">
                    <div className="w-52 px-8 py-5 inline-flex flex-col justify-start items-start">
                      <div className="text-slate-400 text-xs font-bold uppercase tracking-wide">Date</div>
                    </div>
                    <div className="w-64 px-8 py-5 inline-flex flex-col justify-start items-start">
                      <div className="text-slate-400 text-xs font-bold uppercase tracking-wide">Distribution Period</div>
                    </div>
                    <div className="w-56 px-8 py-5 inline-flex flex-col justify-start items-start">
                      <div className="text-slate-400 text-xs font-bold uppercase tracking-wide">Total Reward Pool</div>
                    </div>
                    <div className="w-52 px-8 py-5 inline-flex flex-col justify-start items-start">
                      <div className="text-slate-400 text-xs font-bold uppercase tracking-wide whitespace-nowrap">Your Weighted Share</div>
                    </div>
                    <div className="flex-1 px-8 py-5 inline-flex flex-col justify-start items-end">
                      <div className="text-right text-slate-400 text-xs font-bold uppercase tracking-wide whitespace-nowrap">Rewards Earned (USDC)</div>
                    </div>
                  </div>

                  {/* Table Body */}
                  <div className="flex flex-col justify-start items-start w-full">
                    {paginatedRewardHistory.map((entry, idx) => (
                      <div key={idx} className={`self-stretch inline-flex justify-start items-center ${idx > 0 ? 'border-t border-gray-800' : ''}`}>
                        <div className="w-52 px-8 py-7 inline-flex flex-col justify-center items-start">
                          <div className="text-white text-base font-semibold leading-tight">
                            {entry.date.toLocaleDateString("en-US", {
                              year: "numeric",
                              month: "2-digit",
                              day: "2-digit",
                            })}
                          </div>
                        </div>
                        <div className="w-64 px-8 py-7 inline-flex flex-col justify-center items-start">
                          <div className="text-white text-base font-normal leading-tight">
                            {entry.distributionPeriodStart.toLocaleDateString("en-US", {
                              month: "short",
                              day: "numeric",
                            })} - {entry.distributionPeriodEnd.toLocaleDateString("en-US", {
                              month: "short",
                              day: "numeric",
                            })}
                          </div>
                        </div>
                        <div className="w-56 px-8 py-7 inline-flex flex-col justify-center items-start">
                          <div className="relative inline-flex items-baseline">
                            <span className="text-white text-base font-bold">
                              {formatNumber(entry.totalRewardPool, 2)}
                            </span>
                            <span className="ml-1.5 text-white text-[10px] font-bold">
                              USDC
                            </span>
                          </div>
                        </div>
                        <div className="w-52 px-8 py-7 inline-flex flex-col justify-center items-start">
                          <div className="text-cyan-400 text-base font-bold leading-tight">
                            {entry.yourWeightedShare.toFixed(3)}%
                          </div>
                        </div>
                        <div className="flex-1 px-8 py-7 inline-flex flex-col justify-center items-end">
                          <div className="relative inline-flex items-baseline">
                            <span className="text-teal-500 text-lg font-extrabold leading-7">
                              {formatNumber(entry.rewardsEarned, 2)}
                            </span>
                            <span className="ml-1.5 text-teal-500 text-xs font-bold leading-4 opacity-70">
                              USDC
                            </span>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>

                  {/* Pagination Controls */}
                  {rewardHistoryTotalPages > 1 && (
                    <div className="flex items-center justify-end gap-2 px-8 py-4 border-t border-gray-800">
                      <button
                        onClick={() => setRewardHistoryCurrentPage(p => Math.max(1, p - 1))}
                        disabled={rewardHistoryCurrentPage === 1}
                        className="w-8 h-8 flex items-center justify-center rounded-2xl disabled:opacity-30 disabled:cursor-not-allowed transition-colors hover:text-slate-300"
                      >
                        <ChevronLeft className="w-4 h-4 text-slate-400" />
                      </button>
                      <div className="flex items-center gap-1.5">
                        {Array.from({ length: rewardHistoryTotalPages }, (_, i) => i + 1).map(page => (
                          <button
                            key={page}
                            onClick={() => setRewardHistoryCurrentPage(page)}
                            className={`min-w-8 h-8 px-2 flex items-center justify-center rounded-2xl text-sm font-medium transition-colors ${
                              page === rewardHistoryCurrentPage
                                ? 'bg-ocean-cyan/20 text-ocean-cyan'
                                : 'text-slate-400 hover:text-slate-300'
                            }`}
                          >
                            {page}
                          </button>
                        ))}
                      </div>
                      <button
                        onClick={() => setRewardHistoryCurrentPage(p => Math.min(rewardHistoryTotalPages, p + 1))}
                        disabled={rewardHistoryCurrentPage === rewardHistoryTotalPages}
                        className="w-8 h-8 flex items-center justify-center rounded-2xl disabled:opacity-30 disabled:cursor-not-allowed transition-colors hover:text-slate-300"
                      >
                        <ChevronRight className="w-4 h-4 text-slate-400" />
                      </button>
                    </div>
                  )}
                </>
              )}
            </div>
          </div>

          {/* Claim History */}
          <div className="mb-6 md:mb-8">
            {/* Header */}
            <div className="inline-flex justify-start items-center gap-3 mb-4">
              <div className="size-10 bg-emerald-500/10 rounded-xl shadow-[inset_0px_2px_4px_0px_rgba(0,0,0,0.05)] flex justify-center items-center">
                <Check className="w-5 h-4 text-emerald-500" />
              </div>
              <div className="relative flex items-center gap-2">
                <div className="justify-start text-white text-lg font-bold leading-5">Claim History</div>
                {isClaimHistoryLoading && <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" />}
              </div>
            </div>

            {/* Table Container */}
            <div className="bg-gray-900 rounded-3xl shadow-[0px_4px_6px_-2px_rgba(0,0,0,0.05)] shadow-[0px_10px_30px_-5px_rgba(216,137,28,0.10)] outline outline-1 outline-offset-[-1px] outline-gray-900 overflow-hidden">
              {!connected ? (
                <div className="text-center py-8 text-muted-foreground">
                  Connect wallet to view claim history
                </div>
              ) : claimHistory.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  {isClaimHistoryLoading ? "Loading claim history..." : "No claim history found"}
                </div>
              ) : (
                <>
                  {/* Table Header */}
                  <div className="border-b border-gray-800 inline-flex justify-start items-start w-full">
                    <div className="w-64 px-8 py-5 inline-flex flex-col justify-start items-start">
                      <div className="text-slate-400 text-xs font-bold uppercase tracking-wide">Date</div>
                    </div>
                    <div className="flex-1 px-8 py-5 inline-flex flex-col justify-start items-start">
                      <div className="text-slate-400 text-xs font-bold uppercase tracking-wide">Amount Claimed (USDC)</div>
                    </div>
                    <div className="w-48 px-8 py-5 inline-flex flex-col justify-start items-start">
                      <div className="text-slate-400 text-xs font-bold uppercase tracking-wide">Status</div>
                    </div>
                    <div className="flex-1 px-8 py-5 inline-flex flex-col justify-start items-end">
                      <div className="text-right text-slate-400 text-xs font-bold uppercase tracking-wide">Transaction Hash</div>
                    </div>
                  </div>

                  {/* Table Body */}
                  <div className="flex flex-col justify-start items-start w-full">
                    {paginatedClaimHistory.map((entry, idx) => (
                      <div key={idx} className={`self-stretch inline-flex justify-start items-center ${idx > 0 ? 'border-t border-gray-800' : ''}`}>
                        <div className="w-64 px-8 py-7 inline-flex flex-col justify-center items-start">
                          <div className="text-white text-base font-semibold leading-tight">
                            {entry.date.toLocaleDateString("en-US", {
                              year: "numeric",
                              month: "2-digit",
                              day: "2-digit",
                            })}
                          </div>
                        </div>
                        <div className="flex-1 px-8 py-7 inline-flex flex-col justify-center items-start">
                          <div className="relative inline-flex items-baseline">
                            <span className="text-white text-base font-bold">
                              {formatNumber(entry.amountClaimed, 2)}
                            </span>
                            <span className="ml-1.5 text-white text-[10px] font-bold">
                              USDC
                            </span>
                          </div>
                        </div>
                        <div className="w-48 px-8 py-7 inline-flex flex-col justify-center items-start">
                          <div className="inline-flex items-center gap-2">
                            <div className="size-2 bg-emerald-500 rounded-full" />
                            <span className="text-emerald-500 text-sm font-bold uppercase">Success</span>
                          </div>
                        </div>
                        <div className="flex-1 px-8 py-7 inline-flex flex-col justify-center items-end">
                          <a
                            href={`https://solscan.io/tx/${entry.txSignature}?cluster=devnet`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-2 text-cyan-400 hover:text-cyan-300 transition-colors"
                          >
                            <span className="text-sm font-medium">
                              {entry.txSignature.slice(0, 8)}...{entry.txSignature.slice(-4)}
                            </span>
                            <ExternalLink className="w-4 h-4" />
                          </a>
                        </div>
                      </div>
                    ))}
                  </div>

                  {/* Pagination Controls */}
                  {claimHistoryTotalPages > 1 && (
                    <div className="flex items-center justify-end gap-2 px-8 py-4 border-t border-gray-800">
                      <button
                        onClick={() => setClaimHistoryCurrentPage(p => Math.max(1, p - 1))}
                        disabled={claimHistoryCurrentPage === 1}
                        className="w-8 h-8 flex items-center justify-center rounded-2xl disabled:opacity-30 disabled:cursor-not-allowed transition-colors hover:text-slate-300"
                      >
                        <ChevronLeft className="w-4 h-4 text-slate-400" />
                      </button>
                      <div className="flex items-center gap-1.5">
                        {Array.from({ length: claimHistoryTotalPages }, (_, i) => i + 1).map(page => (
                          <button
                            key={page}
                            onClick={() => setClaimHistoryCurrentPage(page)}
                            className={`min-w-8 h-8 px-2 flex items-center justify-center rounded-2xl text-sm font-medium transition-colors ${
                              page === claimHistoryCurrentPage
                                ? 'bg-ocean-cyan/20 text-ocean-cyan'
                                : 'text-slate-400 hover:text-slate-300'
                            }`}
                          >
                            {page}
                          </button>
                        ))}
                      </div>
                      <button
                        onClick={() => setClaimHistoryCurrentPage(p => Math.min(claimHistoryTotalPages, p + 1))}
                        disabled={claimHistoryCurrentPage === claimHistoryTotalPages}
                        className="w-8 h-8 flex items-center justify-center rounded-2xl disabled:opacity-30 disabled:cursor-not-allowed transition-colors hover:text-slate-300"
                      >
                        <ChevronRight className="w-4 h-4 text-slate-400" />
                      </button>
                    </div>
                  )}
                </>
              )}
            </div>
          </div>

          {/* Dev View - All Stakers */}
          <Card className="border-yellow-500/30 bg-yellow-500/5 rounded-2xl">
            <div className="flex flex-col space-y-1.5 p-4 md:p-6 pb-3 md:pb-4">
              <div className="flex items-center justify-between">
                <h3 className="flex items-center gap-2 text-base md:text-lg font-semibold leading-none tracking-tight">
                  <Code className="w-4 h-4 md:w-5 md:h-5 text-yellow-500" />
                  Dev View - All Stakers
                  {isLoading && <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" />}
                </h3>
                <Badge variant="outline" className="border-yellow-500/50 text-yellow-500 text-xs">
                  <Users className="w-3 h-3 mr-1" />
                  {allStakers.filter(s => s.active).length} Active
                </Badge>
              </div>
              <p className="text-xs text-muted-foreground">
                Live on-chain data from devnet staking program
              </p>
            </div>
            <div className="p-4 md:p-6 pt-0">
              {allStakers.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  {isLoading ? "Loading stakers..." : "No stakers found"}
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow className="border-white/10">
                        <TableHead className="text-xs">Owner</TableHead>
                        <TableHead className="text-xs">Status</TableHead>
                        <TableHead className="text-xs text-right">Staked</TableHead>
                        <TableHead className="text-xs">Tier</TableHead>
                        <TableHead className="text-xs text-right">Multiplier</TableHead>
                        <TableHead className="text-xs text-right">Pool Share</TableHead>
                        <TableHead className="text-xs text-right">Unclaimed USDC</TableHead>
                        <TableHead className="text-xs text-right">Total Revenue</TableHead>
                        <TableHead className="text-xs text-center">Next Payout</TableHead>
                        <TableHead className="text-xs">Lock End</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {allStakers.map((staker, idx) => {
                        const rewards = allStakersRewards.get(staker.owner);
                        return (
                          <TableRow key={idx} className="border-white/10">
                            <TableCell className="font-mono text-xs">
                              {staker.owner.slice(0, 4)}...{staker.owner.slice(-4)}
                            </TableCell>
                            <TableCell>
                              <Badge
                                variant="outline"
                                className={`text-[10px] ${
                                  staker.active
                                    ? "border-green-500/50 text-green-400 bg-green-500/10"
                                    : "border-red-500/50 text-red-400 bg-red-500/10"
                                }`}
                              >
                                {staker.active ? "Active" : "Inactive"}
                              </Badge>
                            </TableCell>
                            <TableCell className="text-right font-medium text-xs">
                              {formatNumber(staker.stakedAmount, 2)} KNS
                            </TableCell>
                            <TableCell>
                              <Badge
                                variant="outline"
                                className={`text-[10px] ${
                                  staker.lockTier === "M12"
                                    ? "border-cyan-500/50 text-cyan-400"
                                    : staker.lockTier === "M9"
                                    ? "border-purple-500/50 text-purple-400"
                                    : staker.lockTier === "M6"
                                    ? "border-orange-500/50 text-orange-400"
                                    : "border-gray-500/50 text-gray-400"
                                }`}
                              >
                                {staker.lockTier}
                              </Badge>
                            </TableCell>
                            <TableCell className="text-right text-orange-400 font-medium text-xs">
                              {staker.multiplier.toFixed(1)}x
                            </TableCell>
                            <TableCell className="text-right text-purple-400 font-medium text-xs">
                              {staker.poolSharePercent.toFixed(2)}%
                            </TableCell>
                            <TableCell className="text-right text-teal-400 font-bold text-xs">
                              {rewards ? `$${formatNumber(rewards.unclaimedUsdc, 2)}` : "--"}
                            </TableCell>
                            <TableCell className="text-right text-cyan-400 font-medium text-xs">
                              {rewards ? `$${formatNumber(rewards.totalRevenue, 2)}` : "--"}
                            </TableCell>
                            <TableCell className="text-center text-xs">
                              {rewards ? (
                                rewards.nextPayoutDays === 0 ? (
                                  <Badge variant="outline" className="text-[10px] border-green-500/50 text-green-400 bg-green-500/10">
                                    Now
                                  </Badge>
                                ) : (
                                  <span className="text-muted-foreground">{rewards.nextPayoutDays}d</span>
                                )
                              ) : (
                                <span className="text-muted-foreground">--</span>
                              )}
                            </TableCell>
                            <TableCell className="text-xs text-muted-foreground">
                              {formatDate(staker.lockEndTime)}
                            </TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                </div>
              )}
            </div>
          </Card>
        </div>
      </div>

      {/* Stake Warning Modal */}
      <StakeWarningModal
        isOpen={showStakeWarning}
        onConfirm={handleStakeWarningConfirm}
        onCancel={handleStakeWarningCancel}
      />

      {/* Transaction Modal */}
      <TransactionModal
        isOpen={showTransactionModal}
        status={stakeStatus}
        txSignature={txSignature || undefined}
        onClose={handleCloseTransactionModal}
        onRetry={handleRetry}
        transactionType={transactionType}
      />
    </>
    </PinProtection>
  );
};

export default StakingStatsPage;

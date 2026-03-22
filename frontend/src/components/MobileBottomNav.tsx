import { Link, useLocation } from "react-router-dom";

// Swap icon
const SwapIcon = ({ className }: { className?: string }) => (
  <svg
    className={className}
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <path d="M7 16V4M7 4L3 8M7 4L11 8" />
    <path d="M17 8V20M17 20L21 16M17 20L13 16" />
  </svg>
);

// Leaderboard icon
const LeaderboardIcon = ({ className }: { className?: string }) => (
  <svg
    className={className}
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <path d="M8 21V12H4V21H8Z" />
    <path d="M14 21V8H10V21H14Z" />
    <path d="M20 21V4H16V21H20Z" />
  </svg>
);

const MobileBottomNav = () => {
  const location = useLocation();
  const isSwapActive = location.pathname === "/swap";
  const isLeaderboardActive = location.pathname === "/leaderboard";

  return (
    <div className="fixed bottom-0 left-0 right-0 z-50 md:hidden">
      <div className="flex w-full">
        {/* Swap Tab */}
        <Link
          to="/swap"
          className={`flex-1 flex flex-col items-center justify-center py-2 ${
            isSwapActive ? "bg-[#0a2a2a]" : "bg-[#0f0f0f]"
          }`}
        >
          <SwapIcon
            className={`w-5 h-5 rotate-90 ${
              isSwapActive ? "text-ocean-cyan" : "text-neutral-500"
            }`}
          />
          <span
            className={`text-[10px] mt-1 ${
              isSwapActive ? "text-ocean-cyan" : "text-neutral-500"
            }`}
          >
            Swap
          </span>
        </Link>
        {/* Leaderboard Tab */}
        <Link
          to="/leaderboard"
          className={`flex-1 flex flex-col items-center justify-center py-2 ${
            isLeaderboardActive ? "bg-[#0a2a2a]" : "bg-[#0f0f0f]"
          }`}
        >
          <LeaderboardIcon
            className={`w-5 h-5 ${
              isLeaderboardActive ? "text-ocean-cyan" : "text-neutral-500"
            }`}
          />
          <span
            className={`text-[10px] mt-1 ${
              isLeaderboardActive ? "text-ocean-cyan" : "text-neutral-500"
            }`}
          >
            Leaderboard
          </span>
        </Link>
      </div>
    </div>
  );
};

export default MobileBottomNav;

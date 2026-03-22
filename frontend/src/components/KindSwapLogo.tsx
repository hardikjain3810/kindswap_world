const KindSwapLogo = ({ className = "w-10 h-10" }: { className?: string }) => {
  return (
    <svg
      viewBox="0 0 48 48"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
    >
      <defs>
        <linearGradient id="dropGradient" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="hsl(var(--ocean-cyan))" />
          <stop offset="100%" stopColor="hsl(var(--ocean-seafoam))" />
        </linearGradient>
      </defs>
      
      {/* Water drop outline */}
      <path
        d="M24 6C24 6 12 20 12 28C12 34.627 17.373 40 24 40C30.627 40 36 34.627 36 28C36 20 24 6 24 6Z"
        stroke="url(#dropGradient)"
        strokeWidth="2.5"
        strokeLinecap="round"
        strokeLinejoin="round"
        fill="none"
      />
      
      {/* Heart carved inside */}
      <path
        d="M24 32C24 32 18 27 18 23.5C18 21 20 19 22.5 19C23.5 19 24 19.5 24 19.5C24 19.5 24.5 19 25.5 19C28 19 30 21 30 23.5C30 27 24 32 24 32Z"
        fill="url(#dropGradient)"
      />
    </svg>
  );
};

export default KindSwapLogo;

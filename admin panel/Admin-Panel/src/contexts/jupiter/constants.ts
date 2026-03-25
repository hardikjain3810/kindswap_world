export const CONFIG = {
    // SOLANA_RPC: "https://api.mainnet-beta.solana.com",
    SOLANA_RPC:
      "https://mainnet.helius-rpc.com/?api-key=ee0a995b-ada7-43be-8d82-3f7b3c0379c0",
    //   SOLANA_RPC: "https://api.devnet.solana.com",
    JUPITER_API: "https://api.jup.ag",
    JUPITER_API_KEY: import.meta.env.VITE_JUPITER_API_KEY,
    KNS_TOKEN_MINT: "CVfniqNEj2f4Yd8Z4TEtaTU49gWNTwUyCiDDUbsZpump",
    PLATFORM_FEE_WALLET: "DysFi1tNRMfFgYkBZnDKVeeBKpmLtd9USJ2Fssqjpbqx",
    CHARITY_FEE_WALLET: "kNSBmzPU33zmNAbJeKp986iqDii8aa4mnJnAZkZ1TED",
  
    DEFAULT_BASE_FEE_BPS: 0.1,
    DEFAULT_CHARITY_FEE_BPS: 0.025,
  } as const;
  
  export const FEE_DISCOUNT_TIERS = [
    { minBalance: 500000, discount: 0.2 },
    { minBalance: 100000, discount: 0.15 },
    { minBalance: 25000, discount: 0.1 },
    { minBalance: 5000, discount: 0.05 },
    { minBalance: 0, discount: 0 },
  ] as const;
  
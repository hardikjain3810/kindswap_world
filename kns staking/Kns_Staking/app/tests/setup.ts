import * as anchor from "@coral-xyz/anchor";
import { PublicKey } from "@solana/web3.js";
import { TOKEN_PROGRAM_ID } from "@solana/spl-token";

export const PROGRAM_ID = new PublicKey(
  "C9GxYtuuY61heBvnTpPhNkEyaofcCPUgJwcL14mwceU1"
);

// Devnet mints matching the on-chain config PDA (original initialization)
export const KNS_MINT = new PublicKey(
  "BvM3AzQJ7vRjm5PGa32K37dDxL4i5aFra1FVjMKVr95Z"
);

export const USDC_MINT = new PublicKey(
  "2pk726N9Dqhvp4vwAL43MAjC5A8SbRYwfthstUnKRjAG"
);

export function getProvider() {
  const provider = anchor.AnchorProvider.env();
  anchor.setProvider(provider);
  return provider;
}

export function getProgram(provider: anchor.AnchorProvider, idl: any) {
  return new anchor.Program(idl, provider);
}

export function derivePDAs(wallet: PublicKey, programId: PublicKey) {
  const [config] = PublicKey.findProgramAddressSync(
    [Buffer.from("config")],
    programId
  );

  const [userStake] = PublicKey.findProgramAddressSync(
    [Buffer.from("user_stake"), wallet.toBuffer()],
    programId
  );

  const [stakeVault] = PublicKey.findProgramAddressSync(
    [Buffer.from("stake_vault"), wallet.toBuffer()],
    programId
  );

  return { config, userStake, stakeVault };
}

/** Derive PDAs for a specific epoch */
export function deriveEpochPDAs(epochId: number, programId: PublicKey) {
  const epochIdBuf = Buffer.alloc(8);
  epochIdBuf.writeBigUInt64LE(BigInt(epochId));

  const [epoch] = PublicKey.findProgramAddressSync(
    [Buffer.from("epoch"), epochIdBuf],
    programId
  );

  const [epochVault] = PublicKey.findProgramAddressSync(
    [Buffer.from("epoch_vault"), epochIdBuf],
    programId
  );

  return { epoch, epochVault, epochIdBuf };
}

/** Derive the per-user-per-epoch claim record PDA */
export function deriveClaimRecord(
  epochId: number,
  claimer: PublicKey,
  programId: PublicKey
): PublicKey {
  const epochIdBuf = Buffer.alloc(8);
  epochIdBuf.writeBigUInt64LE(BigInt(epochId));

  const [claimRecord] = PublicKey.findProgramAddressSync(
    [Buffer.from("epoch_claim"), epochIdBuf, claimer.toBuffer()],
    programId
  );
  return claimRecord;
}

export const TOKEN_PROGRAM = TOKEN_PROGRAM_ID;

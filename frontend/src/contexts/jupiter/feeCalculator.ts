import { Connection, PublicKey } from "@solana/web3.js";
import BN from "bn.js";
import { CONFIG, FEE_DISCOUNT_TIERS } from "../jupiter/constants";
import { FeeCalculation, FeeConfig } from "./jupiter";

export class FeeCalculator {
  constructor(private connection: Connection, private feeConfig: FeeConfig) {}

  async getKNSBalance(walletAddress: string): Promise<number> {
    try {
      const walletPubkey = new PublicKey(walletAddress);
      const knsMint = new PublicKey(CONFIG.KNS_TOKEN_MINT);
      console.log(`walletPubkey ${walletPubkey}`);
      console.log(`knsMint ${knsMint}`);
      console.log(`RPC Endpoint: ${this.connection.rpcEndpoint}`);

      const tokenAccounts = await this.connection.getParsedTokenAccountsByOwner(
        walletPubkey,
        { mint: knsMint }
      );
      if (tokenAccounts.value.length === 0) {
        return 0;
      }

      const balance =
        tokenAccounts.value[0].account.data.parsed.info.tokenAmount.uiAmount;
      return balance;
    } catch (error) {
      console.error("Failed to fetch KNS balance:", error);
      return 0;
    }
  }

  calculateDiscount(knsBalance: number): number {
    const tier = FEE_DISCOUNT_TIERS.find((t) => knsBalance >= t.minBalance);
    return tier?.discount || 0;
  }

  calculateEffectiveFee(knsBalance: number): number {
    const discount = this.calculateDiscount(knsBalance);
    const baseFee = this.feeConfig.baseFeePercentage;

    const effectiveFee = baseFee * (1 - discount);

    return effectiveFee;
  }

  calculateFeeAmounts(
    inputAmount: string,
    inputDecimals: number,
    knsBalance: number
  ): FeeCalculation {
    const effectiveFeeBps = this.calculateEffectiveFee(knsBalance);
    const charityFeeBps = this.feeConfig.charityFeePercentage;
    const totalFeeBps = effectiveFeeBps + charityFeeBps;

    const totalFeeAmount = (parseFloat(inputAmount) * totalFeeBps) / 100;

    const platformFeeAmount = (parseFloat(inputAmount) * effectiveFeeBps) / 100;

    const charityFeeAmount = (parseFloat(inputAmount) * charityFeeBps) / 100;

    return {
      effectiveFeeBps,
      charityFeeBps,
      totalFeeBps,
      feeAmountInInputToken: totalFeeAmount,
      platformFeeAmount: platformFeeAmount,
      charityFeeAmount: charityFeeAmount,
    };
  }

  calculateRemainingAmount(inputAmount: string, feeAmount: string): string {
    const inputBN = new BN(inputAmount);
    const feeBN = new BN(feeAmount);
    return inputBN.sub(feeBN).toString();
  }
}

export async function calculateSwapFees(
  connection: Connection,
  walletAddress: string,
  inputAmount: string,
  inputDecimals: number,
  feeConfig: FeeConfig
): Promise<FeeCalculation> {
  const calculator = new FeeCalculator(connection, feeConfig);

  const knsBalance = await calculator.getKNSBalance(walletAddress);
  const fees = calculator.calculateFeeAmounts(
    inputAmount,
    inputDecimals,
    knsBalance
  );

  console.log(`KNS Balance: ${knsBalance}`);
  console.log(
    `Discount Applied: ${calculator.calculateDiscount(knsBalance) * 100}%`
  );
  console.log(`Effective Platform Fee: ${fees.effectiveFeeBps} bps`);
  console.log(`Total Fee: ${fees.totalFeeBps} bps`);

  return fees;
}

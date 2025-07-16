import { LiteSVM, TransactionMetadata } from "litesvm";
import {
  Keypair,
  LAMPORTS_PER_SOL,
  PublicKey,
  SystemProgram,
  SYSVAR_SLOT_HASHES_PUBKEY,
} from "@solana/web3.js";

// Use the standard web3.js imports
import { Transaction, TransactionInstruction } from "@solana/web3.js";
import {
  createMint,
  getAssociatedTokenAddress,
  createSetAuthorityInstruction,
  AuthorityType,
  createAssociatedTokenAccountInstruction,
  TOKEN_PROGRAM_ID,
  ASSOCIATED_TOKEN_PROGRAM_ID,
  createInitializeMintInstruction,
  MINT_SIZE,
} from "@solana/spl-token";
import * as assert from "assert";
import { BN } from "@coral-xyz/anchor";
import * as path from "path";

// Helper to convert keypair array to PublicKey
function keypairFromArray(arr: number[]): Keypair {
  return Keypair.fromSecretKey(new Uint8Array(arr));
}

const PROGRAM_ID = new PublicKey("pmnSxWFQUz7nCncGznUYhaJdJFFUvcx97GZFhbiCYWi");

// Instruction discriminators (from anchor IDL)
const INITIALIZE_PROGRAM_DISCRIMINATOR = Buffer.from([
  176, 107, 205, 168, 24, 157, 175, 103,
]);
const PURCHASE_INITIAL_FARM_DISCRIMINATOR = Buffer.from([
  233, 62, 49, 138, 164, 181, 114, 69,
]);
const STAKE_CARD_DISCRIMINATOR = Buffer.from([
  97, 111, 171, 186, 179, 198, 68, 172,
]);
const CLAIM_REWARDS_DISCRIMINATOR = Buffer.from([
  4, 144, 132, 71, 116, 23, 151, 80,
]);

class LiteSVMTestHelper {
  svm: LiteSVM;
  authority: Keypair;
  mint: PublicKey;
  globalState: PublicKey;
  feesWallet: PublicKey;
  solRewardsWallet: PublicKey;
  stakingVault: PublicKey;
  feesTokenAccount: PublicKey;

  constructor() {
    this.svm = new LiteSVM();
    this.authority = Keypair.generate();

    // Load the ponzimon program
    const programPath = path.join(__dirname, "../target/deploy/ponzimon.so");
    this.svm.addProgramFromFile(PROGRAM_ID, programPath);

    // Airdrop SOL to authority
    this.svm.airdrop(this.authority.publicKey, BigInt(10 * LAMPORTS_PER_SOL));
  }

  async setupProgram() {
    // Create mint
    const mintKeypair = Keypair.generate();
    this.mint = mintKeypair.publicKey;

    const createMintIx = SystemProgram.createAccount({
      fromPubkey: this.authority.publicKey,
      newAccountPubkey: this.mint,
      lamports: 1461600, // Fixed rent for mint account
      space: MINT_SIZE,
      programId: TOKEN_PROGRAM_ID,
    });

    const initMintIx = createInitializeMintInstruction(
      this.mint,
      6, // decimals
      this.authority.publicKey,
      null
    );

    // Find PDAs
    const [globalStatePda] = PublicKey.findProgramAddressSync(
      [Buffer.from("global_state"), this.mint.toBuffer()],
      PROGRAM_ID
    );
    this.globalState = globalStatePda;

    const [solRewardsWalletPda] = PublicKey.findProgramAddressSync(
      [Buffer.from("sol_rewards_wallet"), this.mint.toBuffer()],
      PROGRAM_ID
    );
    this.solRewardsWallet = solRewardsWalletPda;

    const [stakingVaultPda] = PublicKey.findProgramAddressSync(
      [Buffer.from("staking_vault"), this.mint.toBuffer()],
      PROGRAM_ID
    );
    this.stakingVault = stakingVaultPda;

    this.feesWallet = this.authority.publicKey;
    this.feesTokenAccount = await getAssociatedTokenAddress(
      this.mint,
      this.authority.publicKey
    );

    // Execute mint creation
    const mintTx = new Transaction();
    mintTx.recentBlockhash = this.svm.latestBlockhash();
    mintTx.add(createMintIx, initMintIx);
    mintTx.sign(this.authority, mintKeypair);

    const mintResult = this.svm.sendTransaction(mintTx);
    if (!(mintResult instanceof TransactionMetadata)) {
      throw new Error("Failed to create mint: " + mintResult);
    }

    // Transfer mint authority to global state
    const transferAuthIx = createSetAuthorityInstruction(
      this.mint,
      this.authority.publicKey,
      AuthorityType.MintTokens,
      this.globalState
    );

    const transferTx = new Transaction();
    transferTx.recentBlockhash = this.svm.latestBlockhash();
    transferTx.add(transferAuthIx);
    transferTx.sign(this.authority);

    const transferResult = this.svm.sendTransaction(transferTx);
    if (!(transferResult instanceof TransactionMetadata)) {
      throw new Error("Failed to transfer mint authority");
    }

    // Create fees token account
    const createFeesTokenAccountIx = createAssociatedTokenAccountInstruction(
      this.authority.publicKey,
      this.feesTokenAccount,
      this.authority.publicKey,
      this.mint
    );

    const feesAccountTx = new Transaction();
    feesAccountTx.recentBlockhash = this.svm.latestBlockhash();
    feesAccountTx.add(createFeesTokenAccountIx);
    feesAccountTx.sign(this.authority);

    const feesResult = this.svm.sendTransaction(feesAccountTx);
    if (!(feesResult instanceof TransactionMetadata)) {
      throw new Error("Failed to create fees token account");
    }

    // Initialize program
    const initProgramIx = this.createInitializeProgramInstruction();
    const initTx = new Transaction();
    initTx.recentBlockhash = this.svm.latestBlockhash();
    initTx.add(initProgramIx);
    initTx.sign(this.authority);

    const initResult = this.svm.sendTransaction(initTx);
    if (!(initResult instanceof TransactionMetadata)) {
      throw new Error("Failed to initialize program" + initResult);
    }
  }

  createInitializeProgramInstruction(): TransactionInstruction {
    const data = Buffer.concat([
      INITIALIZE_PROGRAM_DISCRIMINATOR,
      this.serializeBN(new BN(0)), // startSlot
      this.serializeBN(new BN("1000000000000000")), // totalSupply

      Buffer.from([0]), // cooldownSlots (Option<u64> = None)
      Buffer.from([0]), // initialFarmPurchaseFeeLamports (Option<u64> = None)
      Buffer.from([0]), // boosterPackCostMicrotokens (Option<u64> = None)
      Buffer.from([0]), // gambleFeeLamports (Option<u64> = None)
      this.serializeBN(new BN(100)), // stakingLockupSlots
      this.serializeBN(new BN(5)), // tokenRewardRate
    ]);

    // Find rewards_vault PDA
    const [rewardsVault] = PublicKey.findProgramAddressSync(
      [Buffer.from("rewards_vault"), this.mint.toBuffer()],
      PROGRAM_ID
    );

    return new TransactionInstruction({
      programId: PROGRAM_ID,
      keys: [
        { pubkey: this.authority.publicKey, isSigner: true, isWritable: true }, // authority
        { pubkey: this.globalState, isSigner: false, isWritable: true }, // global_state
        { pubkey: this.feesWallet, isSigner: false, isWritable: false }, // fees_wallet
        { pubkey: this.feesTokenAccount, isSigner: false, isWritable: true }, // fees_token_account
        { pubkey: rewardsVault, isSigner: false, isWritable: true }, // rewards_vault
        { pubkey: this.mint, isSigner: false, isWritable: true }, // token_mint
        { pubkey: TOKEN_PROGRAM_ID, isSigner: false, isWritable: false }, // token_program
        {
          pubkey: ASSOCIATED_TOKEN_PROGRAM_ID,
          isSigner: false,
          isWritable: false,
        }, // associated_token_program
        { pubkey: SystemProgram.programId, isSigner: false, isWritable: false }, // system_program
        {
          pubkey: new PublicKey("SysvarRent111111111111111111111111111111111"),
          isSigner: false,
          isWritable: false,
        }, // rent
      ],
      data,
    });
  }

  createPurchaseInitialFarmInstruction(
    playerWallet: PublicKey
  ): TransactionInstruction {
    const data = Buffer.concat([PURCHASE_INITIAL_FARM_DISCRIMINATOR]);

    const [playerPda] = PublicKey.findProgramAddressSync(
      [Buffer.from("player"), playerWallet.toBuffer(), this.mint.toBuffer()],
      PROGRAM_ID
    );

    // Player token account PDA (from IDL)
    const [playerTokenAccount] = PublicKey.findProgramAddressSync(
      [
        playerWallet.toBuffer(),
        TOKEN_PROGRAM_ID.toBuffer(),
        this.mint.toBuffer(),
      ],
      ASSOCIATED_TOKEN_PROGRAM_ID
    );

    return new TransactionInstruction({
      programId: PROGRAM_ID,
      keys: [
        { pubkey: playerWallet, isSigner: true, isWritable: true }, // player_wallet
        { pubkey: playerPda, isSigner: false, isWritable: true }, // player
        { pubkey: this.globalState, isSigner: false, isWritable: true }, // global_state
        { pubkey: this.feesWallet, isSigner: false, isWritable: true }, // fees_wallet
        { pubkey: this.feesWallet, isSigner: false, isWritable: true }, // referrer_wallet (optional - using fees_wallet)
        { pubkey: this.mint, isSigner: false, isWritable: true }, // token_mint
        { pubkey: playerTokenAccount, isSigner: false, isWritable: true }, // player_token_account (PDA)
        { pubkey: TOKEN_PROGRAM_ID, isSigner: false, isWritable: false }, // token_program
        {
          pubkey: ASSOCIATED_TOKEN_PROGRAM_ID,
          isSigner: false,
          isWritable: false,
        }, // associated_token_program
        { pubkey: SystemProgram.programId, isSigner: false, isWritable: false }, // system_program
        {
          pubkey: new PublicKey("SysvarRent111111111111111111111111111111111"),
          isSigner: false,
          isWritable: false,
        }, // rent
      ],
      data,
    });
  }

  createStakeCardInstruction(
    playerWallet: PublicKey,
    cardIndex: number,
    playerTokenAccount: PublicKey
  ): TransactionInstruction {
    const data = Buffer.concat([
      STAKE_CARD_DISCRIMINATOR,
      Buffer.from([cardIndex]), // u8 card index
    ]);

    const [playerPda] = PublicKey.findProgramAddressSync(
      [Buffer.from("player"), playerWallet.toBuffer(), this.mint.toBuffer()],
      PROGRAM_ID
    );

    const [rewardsVault] = PublicKey.findProgramAddressSync(
      [Buffer.from("rewards_vault"), this.mint.toBuffer()],
      PROGRAM_ID
    );

    return new TransactionInstruction({
      programId: PROGRAM_ID,
      keys: [
        { pubkey: playerWallet, isSigner: true, isWritable: true }, // player_wallet
        { pubkey: playerPda, isSigner: false, isWritable: true }, // player
        { pubkey: this.globalState, isSigner: false, isWritable: true }, // global_state
        { pubkey: rewardsVault, isSigner: false, isWritable: true }, // rewards_vault
        { pubkey: this.mint, isSigner: false, isWritable: false }, // token_mint
        { pubkey: playerTokenAccount, isSigner: false, isWritable: true }, // player_token_account
        { pubkey: TOKEN_PROGRAM_ID, isSigner: false, isWritable: false }, // token_program
      ],
      data,
    });
  }

  createClaimRewardsInstruction(
    playerWallet: PublicKey,
    playerTokenAccount: PublicKey
  ): TransactionInstruction {
    const data = Buffer.concat([CLAIM_REWARDS_DISCRIMINATOR]);

    const [playerPda] = PublicKey.findProgramAddressSync(
      [Buffer.from("player"), playerWallet.toBuffer(), this.mint.toBuffer()],
      PROGRAM_ID
    );

    const [rewardsVault] = PublicKey.findProgramAddressSync(
      [Buffer.from("rewards_vault"), this.mint.toBuffer()],
      PROGRAM_ID
    );

    return new TransactionInstruction({
      programId: PROGRAM_ID,
      keys: [
        { pubkey: playerWallet, isSigner: true, isWritable: false },
        { pubkey: playerPda, isSigner: false, isWritable: true },
        { pubkey: this.globalState, isSigner: false, isWritable: true },
        { pubkey: playerTokenAccount, isSigner: false, isWritable: true },
        { pubkey: rewardsVault, isSigner: false, isWritable: true },
        { pubkey: this.mint, isSigner: false, isWritable: false },
        { pubkey: TOKEN_PROGRAM_ID, isSigner: false, isWritable: false },
      ],
      data,
    });
  }

  serializeBN(bn: BN): Buffer {
    return Buffer.from(bn.toArray("le", 8)); // 8 bytes little endian
  }

  airdrop(publicKey: PublicKey, sol: number) {
    this.svm.airdrop(publicKey, BigInt(sol * LAMPORTS_PER_SOL));
  }

  advanceSlots(slots: number) {
    // In LiteSVM, we can advance the slot by creating empty transactions
    for (let i = 0; i < slots; i++) {
      const dummyKeypair = Keypair.generate();
      this.svm.airdrop(dummyKeypair.publicKey, BigInt(1));
    }
  }

  async createTokenAccount(
    mint: PublicKey,
    owner: PublicKey
  ): Promise<PublicKey> {
    const tokenAccount = await getAssociatedTokenAddress(mint, owner);

    const createIx = createAssociatedTokenAccountInstruction(
      this.authority.publicKey,
      tokenAccount,
      owner,
      mint
    );

    const tx = new Transaction();
    tx.recentBlockhash = this.svm.latestBlockhash();
    tx.add(createIx);
    tx.sign(this.authority);

    const result = this.svm.sendTransaction(tx);
    if (!(result instanceof TransactionMetadata)) {
      throw new Error("Failed to create token account");
    }

    return tokenAccount;
  }

  getAccountData(pubkey: PublicKey): Buffer | null {
    const account = this.svm.getAccount(pubkey);
    return account?.data ? Buffer.from(account.data) : null;
  }

  getTokenBalance(tokenAccount: PublicKey): number {
    const accountData = this.getAccountData(tokenAccount);
    if (!accountData) return 0;

    // Parse token account data - amount is at bytes 64-72 (8 bytes, little endian)
    if (accountData.length >= 72) {
      const amountBuffer = accountData.slice(64, 72);
      const amount = new BN(amountBuffer, "le");
      return amount.toNumber();
    }
    return 0;
  }

  getCurrentSlot(): number {
    // LiteSVM doesn't have getSlot, use a workaround
    return Date.now(); // Simple slot simulation
  }
}

describe("Ponzimon Basic Flow (LiteSVM)", () => {
  let helper: LiteSVMTestHelper;

  beforeAll(async () => {
    helper = new LiteSVMTestHelper();
    await helper.setupProgram();
  });

  it("should create a player, stake cards, and claim rewards", async () => {
    // --- Player Setup ---
    const playerWallet = Keypair.generate();
    helper.airdrop(playerWallet.publicKey, 10); // 10 SOL

    const [playerPda] = PublicKey.findProgramAddressSync(
      [
        Buffer.from("player"),
        playerWallet.publicKey.toBuffer(),
        helper.mint.toBuffer(),
      ],
      PROGRAM_ID
    );

    const playerTokenAccount = await helper.createTokenAccount(
      helper.mint,
      playerWallet.publicKey
    );

    // --- Purchase Initial Farm ---
    const purchaseIx = helper.createPurchaseInitialFarmInstruction(
      playerWallet.publicKey
    );
    const purchaseTx = new Transaction();
    purchaseTx.recentBlockhash = helper.svm.latestBlockhash();
    purchaseTx.add(purchaseIx);
    purchaseTx.sign(playerWallet);

    const purchaseResult = helper.svm.sendTransaction(purchaseTx);
    if (!(purchaseResult instanceof TransactionMetadata)) {
      throw new Error("Failed to purchase initial farm" + purchaseResult);
    }

    // Verify player account creation
    const playerAccountData = helper.getAccountData(playerPda);
    assert.ok(playerAccountData, "Player account should be created");

    // Wait for cooldown to expire - advance enough slots
    helper.advanceSlots(150); // Advance more slots to ensure cooldown expires

    // --- Stake Starter Cards ---
    const stakeIx = helper.createStakeCardInstruction(
      playerWallet.publicKey,
      0,
      playerTokenAccount
    );
    const stakeTx = new Transaction();
    stakeTx.recentBlockhash = helper.svm.latestBlockhash();
    stakeTx.add(stakeIx);
    stakeTx.sign(playerWallet);

    const stakeResult = helper.svm.sendTransaction(stakeTx);
    if (!(stakeResult instanceof TransactionMetadata)) {
      throw new Error("Failed to stake card" + stakeResult);
    }

    // --- Simulate Time and Claim Rewards ---
    const initialBalance = helper.getTokenBalance(playerTokenAccount);
    assert.strictEqual(initialBalance, 0, "Player should start with 0 tokens");

    // Simulate slots passing
    const slotsToAdvance = 10;
    helper.advanceSlots(slotsToAdvance);

    const claimIx = helper.createClaimRewardsInstruction(
      playerWallet.publicKey,
      playerTokenAccount
    );
    const claimTx = new Transaction();
    claimTx.recentBlockhash = helper.svm.latestBlockhash();
    claimTx.add(claimIx);
    claimTx.sign(playerWallet);

    const claimResult = helper.svm.sendTransaction(claimTx);
    if (!(claimResult instanceof TransactionMetadata)) {
      throw new Error("Failed to claim rewards");
    }

    const finalBalance = helper.getTokenBalance(playerTokenAccount);

    // --- Verification ---
    assert.ok(
      finalBalance > initialBalance,
      `Final balance should be greater than initial balance. Got: ${finalBalance}, Initial: ${initialBalance}`
    );

    // --- In-Test Emission Log ---
    const emittedTokens = finalBalance / Math.pow(10, 6);
    console.log("\n--- In-Test Emissions (LiteSVM) ---");
    console.log(
      `Emitted ${emittedTokens.toFixed(6)} tokens over ${slotsToAdvance} slots.`
    );
    console.log("--------------------------------\n");

    // --- Real-world Issuance Calculation ---
    const slotsPerHour = 3600 / 0.4; // 9000
    const mintDecimals = 6;

    // Estimate tokens per hour (simplified calculation)
    const tokensPerSlot = finalBalance / slotsToAdvance;
    const tokensPerHour =
      (tokensPerSlot * slotsPerHour) / Math.pow(10, mintDecimals);

    // Calculate issuance in different time periods
    const tokensIn6Hours = tokensPerHour * 6;
    const tokensIn24Hours = tokensPerHour * 24;
    const tokensInOneWeek = tokensPerHour * 24 * 7;

    console.log("--- Token Issuance Simulation (1 User, LiteSVM) ---");
    console.log(`Estimated tokens per hour: ${tokensPerHour.toFixed(4)}`);
    console.log(`Estimated tokens in 6 hours: ${tokensIn6Hours.toFixed(4)}`);
    console.log(`Estimated tokens in 24 hours: ${tokensIn24Hours.toFixed(4)}`);
    console.log(`Estimated tokens in one week: ${tokensInOneWeek.toFixed(4)}`);
    console.log("------------------------------------------------");
  });
});

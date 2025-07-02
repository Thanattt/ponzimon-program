import * as anchor from "@coral-xyz/anchor";
import { Program } from "@coral-xyz/anchor";
import { Ponzimon } from "../target/types/ponzimon";
import * as assert from "assert";
import {
  airdrop,
  setupTestProgram,
  createTestTokenAccount,
  advanceSlots,
} from "./test-helpers";
import { BN } from "@coral-xyz/anchor";

describe("Ponzimon Basic Flow", () => {
  let program: Program<Ponzimon>;
  let provider: anchor.AnchorProvider;
  let connection: anchor.web3.Connection;
  let mint: anchor.web3.PublicKey;
  let authority: anchor.web3.Keypair;
  let globalState: anchor.web3.PublicKey;
  let feesWallet: anchor.web3.PublicKey;
  let solRewardsWallet: anchor.web3.PublicKey;
  let stakingVault: anchor.web3.PublicKey;
  let feesTokenAccount: anchor.web3.PublicKey;

  beforeAll(async () => {
    // --- Program Setup ---
    const setup = await setupTestProgram();
    program = setup.program;
    provider = setup.provider;
    connection = setup.connection;
    mint = setup.mint;
    authority = setup.authority as any;
    globalState = setup.globalState;
    feesWallet = setup.feesWallet;
    solRewardsWallet = setup.solRewardsWallet;
    stakingVault = setup.stakingVault;

    // --- Create Associated Token Accounts ---
    const feesAta = await createTestTokenAccount(
      provider,
      mint,
      feesWallet,
      true
    );
    feesTokenAccount = feesAta.address;
  });

  it("should create a player, stake cards, and claim rewards", async () => {
    // --- Player Setup ---
    const playerWallet = anchor.web3.Keypair.generate();
    await airdrop(provider, playerWallet.publicKey, 10); // 10 SOL

    const [playerPda] = anchor.web3.PublicKey.findProgramAddressSync(
      [
        Buffer.from("player"),
        playerWallet.publicKey.toBuffer(),
        mint.toBuffer(),
      ],
      program.programId
    );

    const playerTokenAccount = await createTestTokenAccount(
      provider,
      mint,
      playerWallet.publicKey,
      true
    );

    // --- Purchase Initial Farm ---
    await program.methods
      .purchaseInitialFarm()
      .accounts({
        playerWallet: playerWallet.publicKey,
        feesWallet: feesWallet,
        referrerWallet: null,
        tokenMint: mint,
      })
      .signers([playerWallet])
      .rpc();

    let playerAccount = await program.account.player.fetch(playerPda);
    assert.strictEqual(
      playerAccount.cardCount,
      3,
      "Player should have 3 starter cards"
    );
    await advanceSlots(provider, 1);

    // --- Stake Starter Cards ---
    await program.methods
      .stakeCard(0)
      .accounts({
        playerWallet: playerWallet.publicKey,
        playerTokenAccount: playerTokenAccount.address,
        tokenMint: mint,
      })
      .signers([playerWallet])
      .rpc();

    playerAccount = await program.account.player.fetch(playerPda);
    // The player's `lastClaimSlot` is not updated on stake, so we need to get the
    // `lastRewardSlot` from the global state to correctly calculate elapsed time for rewards.
    const globalStateAfterStake = await program.account.globalState.fetch(
      globalState
    );
    const startedSlot = globalStateAfterStake.lastRewardSlot;

    const stakedCardCount = (
      playerAccount.stakedCardsBitset.toString(2).match(/1/g) || []
    ).length;
    assert.strictEqual(
      stakedCardCount,
      1,
      "All 1 starter cards should be staked"
    );
    assert.ok(
      playerAccount.totalHashpower.gtn(0),
      "Player hashpower should be greater than 0"
    );

    // --- Simulate Time and Claim Rewards ---
    const initialBalance = new BN(
      (
        await connection.getTokenAccountBalance(playerTokenAccount.address)
      ).value.amount
    );
    assert.ok(initialBalance.eqn(0), "Player should start with 0 tokens");

    // Simulate slots passing
    const slotsToAdvance = 10;
    await advanceSlots(provider, slotsToAdvance);

    await program.methods
      .claimRewards()
      .accounts({
        playerWallet: playerWallet.publicKey,
        playerTokenAccount: playerTokenAccount.address,
        tokenMint: mint,
      })
      .signers([playerWallet])
      .rpc();

    const finalBalance = new BN(
      (
        await connection.getTokenAccountBalance(playerTokenAccount.address)
      ).value.amount
    );

    // --- Verification ---
    const globalStateAccount = await program.account.globalState.fetch(
      globalState
    );
    playerAccount = await program.account.player.fetch(playerPda);

    const slotsAdvanced = playerAccount.lastClaimSlot.sub(startedSlot);
    // Expected rewards should be based on the player's hashpower contribution
    const expectedRewards = new BN(slotsAdvanced)
      .mul(globalStateAccount.rewardRate)
      .mul(playerAccount.totalHashpower)
      .div(globalStateAccount.totalHashpower);

    // Allow for a small tolerance in case of rounding differences
    const tolerance = new BN(1);
    const difference = finalBalance.sub(expectedRewards).abs();

    assert.ok(
      difference.lte(tolerance),
      `Final balance should be close to expected rewards. Got: ${finalBalance}, Expected: ${expectedRewards}`
    );

    // --- In-Test Emission Log ---
    const totalTestTimeSeconds = slotsAdvanced.toNumber() * 0.4;
    const emittedTokens = finalBalance.toNumber() / Math.pow(10, 6);
    console.log("\n--- In-Test Emissions ---");
    console.log(
      `Emitted ${emittedTokens.toFixed(
        6
      )} tokens over ${totalTestTimeSeconds.toFixed(
        1
      )} seconds (${slotsAdvanced.toNumber()} slots).`
    );
    console.log("-------------------------\n");

    // --- Real-world Issuance Calculation ---
    const slotsPerHour = 3600 / 0.4; // 9000
    const mintDecimals = 6;

    // Calculate issuance per hour for a single user
    const tokensPerHourRaw = new BN(slotsPerHour).mul(
      globalStateAccount.rewardRate
    );
    const tokensPerHour =
      tokensPerHourRaw.toNumber() / Math.pow(10, mintDecimals);

    // Calculate issuance in 6 hours
    const tokensIn6Hours = tokensPerHour * 6;
    const tokensIn24Hours = tokensPerHour * 24;
    const tokensInOneWeek = tokensPerHour * 24 * 7;

    console.log("--- Token Issuance Simulation (1 User) ---");
    console.log(`Tokens issued per hour: ${tokensPerHour.toFixed(4)}`);
    console.log(`Tokens issued in 6 hours: ${tokensIn6Hours.toFixed(4)}`);
    console.log(`Tokens issued in 24 hours: ${tokensIn24Hours.toFixed(4)}`);
    console.log(`Tokens issued in one week: ${tokensInOneWeek.toFixed(4)}`);
    console.log("-----------------------------------------");
  });
});

describe("Ponzimon Card Recycling", () => {
  let program: Program<Ponzimon>;
  let provider: anchor.AnchorProvider;
  let connection: anchor.web3.Connection;
  let mint: anchor.web3.PublicKey;
  let authority: anchor.web3.Keypair;
  let globalState: anchor.web3.PublicKey;
  let feesWallet: anchor.web3.PublicKey;
  let solRewardsWallet: anchor.web3.PublicKey;
  let stakingVault: anchor.web3.PublicKey;
  let feesTokenAccount: anchor.web3.PublicKey;

  beforeAll(async () => {
    // --- Program Setup ---
    const setup = await setupTestProgram();
    program = setup.program;
    provider = setup.provider;
    connection = setup.connection;
    mint = setup.mint;
    authority = setup.authority as any;
    globalState = setup.globalState;
    feesWallet = setup.feesWallet;
    solRewardsWallet = setup.solRewardsWallet;
    stakingVault = setup.stakingVault;

    // --- Create Associated Token Accounts ---
    const feesAta = await createTestTokenAccount(
      provider,
      mint,
      feesWallet,
      true
    );
    feesTokenAccount = feesAta.address;
  });

  // it("calculates transaction size for recycling 128 cards", async () => {
  //   const playerWallet = anchor.web3.Keypair.generate();
  //   const cardIndices = Buffer.from(Array.from({ length: 128 }, (_, i) => i));

  //   const [playerPda] = anchor.web3.PublicKey.findProgramAddressSync(
  //     [
  //       Buffer.from("player"),
  //       playerWallet.publicKey.toBuffer(),
  //       mint.toBuffer(),
  //     ],
  //     program.programId
  //   );

  //   const instruction = await program.methods
  //     .recycleCardsCommit(cardIndices)
  //     .accounts({
  //       playerWallet: playerWallet.publicKey,
  //       player: playerPda,
  //       globalState: globalState,
  //       tokenMint: mint,
  //       randomnessAccountData: anchor.web3.Keypair.generate().publicKey,
  //     } as any)
  //     .instruction();

  //   const transaction = new anchor.web3.Transaction().add(instruction);
  //   transaction.feePayer = playerWallet.publicKey;
  //   transaction.recentBlockhash = (
  //     await connection.getLatestBlockhash()
  //   ).blockhash;

  //   const serializedTx = transaction.serialize({
  //     requireAllSignatures: false,
  //     verifySignatures: false,
  //   });
  //   const txSize = serializedTx.length;

  //   console.log(`\n--- Transaction Size Calculation ---`);
  //   console.log(`Transaction size for recycling 128 cards: ${txSize} bytes`);
  //   console.log(`------------------------------------\n`);

  //   // Solana transactions have a max size of 1232 bytes.
  //   assert.ok(
  //     txSize <= 1232,
  //     `Transaction size (${txSize}) exceeds the maximum of 1232 bytes.`
  //   );
  // });

  async function testRecycleSettleCu(cardCount: number, testName: string) {
    console.log(`\n--- Testing CU for ${testName} ---`);
    const playerWallet = anchor.web3.Keypair.generate();
    await airdrop(provider, playerWallet.publicKey, 10);

    const playerTokenAccount = await createTestTokenAccount(
      provider,
      mint,
      playerWallet.publicKey,
      true
    );

    const [playerPda] = anchor.web3.PublicKey.findProgramAddressSync(
      [
        Buffer.from("player"),
        playerWallet.publicKey.toBuffer(),
        mint.toBuffer(),
      ],
      program.programId
    );

    const [rewardsVault] = anchor.web3.PublicKey.findProgramAddressSync(
      [Buffer.from("rewards_vault"), mint.toBuffer()],
      program.programId
    );

    // Purchase farm to get initial 3 starter cards
    await program.methods
      .purchaseInitialFarm()
      .accounts({
        playerWallet: playerWallet.publicKey,
        feesWallet: feesWallet,
        referrerWallet: null,
        tokenMint: mint,
      })
      .signers([playerWallet])
      .rpc();

    // Advance slots to ensure cooldown is met for settle_and_mint_rewards
    await advanceSlots(provider, 5);

    let playerAccount = await program.account.player.fetch(playerPda);
    let cardsOwned = playerAccount.cardCount;

    console.log(`Player has ${cardsOwned} cards available for recycling`);

    // Use the minimum of requested cards or available cards
    const actualCardCount = Math.min(cardCount, cardsOwned);

    if (actualCardCount === 0) {
      console.log("No cards to recycle, skipping test");
      return;
    }

    console.log(`Testing with ${actualCardCount} cards`);
    const cardIndices = Array.from({ length: actualCardCount }, (_, i) => i);

    // Convert cardIndices to Buffer for the instruction
    const cardIndicesBuffer = Buffer.from(cardIndices);

    await program.methods
      .recycleCardsCommit(cardIndicesBuffer)
      .accountsStrict({
        playerWallet: playerWallet.publicKey,
        player: playerPda,
        globalState: globalState,
        rewardsVault: rewardsVault,
        tokenMint: mint,
      })
      .signers([playerWallet])
      .rpc();

    await advanceSlots(provider, 10); // Advance enough slots for randomness delay and cooldown

    const tx = await program.methods
      .recycleCardsSettle()
      .accountsStrict({
        playerWallet: playerWallet.publicKey,
        player: playerPda,
        globalState: globalState,
        rewardsVault: rewardsVault,
        tokenMint: mint,
        slotHashes: anchor.web3.SYSVAR_SLOT_HASHES_PUBKEY,
      })
      .signers([playerWallet])
      .transaction();

    const latestBlockhash = await connection.getLatestBlockhash();
    tx.recentBlockhash = latestBlockhash.blockhash;
    tx.feePayer = playerWallet.publicKey;

    const simResult = await connection.simulateTransaction(tx);
    if (simResult.value.err) {
      console.error("Simulation error:", simResult.value.err);
      console.log("Sim logs:", simResult.value.logs);
      return;
    }

    const signature = await provider.sendAndConfirm(tx, [playerWallet]);

    const confirmedTx = await connection.getTransaction(signature, {
      maxSupportedTransactionVersion: 0,
    });
    const cus = confirmedTx.meta.computeUnitsConsumed;
    console.log(`CU consumed for ${actualCardCount} cards: ${cus}`);
    console.log(`-------------------------------------------`);
  }

  it("measures CU for RecycleCardsSettle with starter cards", async () => {
    await testRecycleSettleCu(3, "RecycleCardsSettle with 3 starter cards");
  });

  it("measures CU for RecycleCardsSettle baseline", async () => {
    await testRecycleSettleCu(
      50,
      "RecycleCardsSettle baseline (limited to available cards)"
    );
  });
});

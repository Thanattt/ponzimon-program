#!/usr/bin/env node

import { Command } from "commander";
import { Connection, PublicKey } from "@solana/web3.js";
import { AnchorProvider, Program, Wallet } from "@coral-xyz/anchor";
import { Ponzimon } from "../target/types/ponzimon";
import idl from "../target/idl/ponzimon.json";

const PROGRAM_ID = new PublicKey("PNZdxJNSEFmp2UZ39pEekFHZf15emsrbkaHv36xjgtx");

async function showCards(
  playerWallet: string,
  tokenMint: string,
  network: string = "https://api.devnet.solana.com"
) {
  try {
    console.log(`\n🎮 Fetching cards for player: ${playerWallet}`);
    console.log(`📍 Network: ${network}`);
    console.log(`🪙 Token Mint: ${tokenMint}\n`);

    // Setup connection and provider
    const connection = new Connection(network, "confirmed");
    const provider = new AnchorProvider(
      connection,
      {} as Wallet, // We don't need a wallet for read-only operations
      { commitment: "confirmed" }
    );

    const program = new Program(idl as Ponzimon, provider);

    // Derive player PDA
    const playerWalletPubkey = new PublicKey(playerWallet);
    const tokenMintPubkey = new PublicKey(tokenMint);

    const [playerPDA] = PublicKey.findProgramAddressSync(
      [
        Buffer.from("player"),
        playerWalletPubkey.toBuffer(),
        tokenMintPubkey.toBuffer(),
      ],
      PROGRAM_ID
    );

    console.log(`📂 Player PDA: ${playerPDA.toBase58()}\n`);

    // Fetch player account
    const playerAccount = await connection.getAccountInfo(playerPDA);
    if (!playerAccount) {
      throw new Error("Account does not exist");
    }

    // Decode the account data using the program's coder
    const decodedAccount = program.coder.accounts.decode(
      "player",
      playerAccount.data
    );

    console.log(`👤 Player Owner: ${decodedAccount.owner.toBase58()}`);
    console.log(`🏭 Farm Type: ${decodedAccount.farm.farmType}`);
    console.log(`🍓 Berries: ${decodedAccount.berries.toString()}`);
    console.log(
      `⚡ Total Hashpower: ${decodedAccount.totalHashpower.toString()}`
    );
    console.log(`🎴 Total Cards: ${decodedAccount.cardCount}`);

    if (decodedAccount.referrer) {
      console.log(`👥 Referrer: ${decodedAccount.referrer.toBase58()}`);
    }

    console.log(`\n📊 Stats:`);
    console.log(`  • Total Rewards: ${decodedAccount.totalRewards.toString()}`);
    console.log(`  • Total Gambles: ${decodedAccount.totalGambles.toString()}`);
    console.log(
      `  • Gamble Wins: ${decodedAccount.totalGambleWins.toString()}`
    );
    console.log(
      `  • Booster Packs Opened: ${decodedAccount.totalBoosterPacksOpened.toString()}`
    );
    console.log(
      `  • Cards Recycled: ${decodedAccount.totalCardsRecycled.toString()}`
    );

    console.log(`\n🎴 CARDS (${decodedAccount.cardCount}/128):`);
    console.log("=".repeat(60));

    if (decodedAccount.cardCount === 0) {
      console.log("  No cards found for this player.");
    } else {
      for (let i = 0; i < decodedAccount.cardCount; i++) {
        const card = decodedAccount.cards[i];
        const isStaked =
          (BigInt(decodedAccount.stakedCardsBitset) &
            (BigInt(1) << BigInt(i))) !==
          BigInt(0);
        const stakedIndicator = isStaked ? "🔒 STAKED" : "🔓 Available";

        console.log(
          `  [${i.toString().padStart(2, "0")}] Card ID: ${card.id
            .toString()
            .padStart(3, "0")} | Rarity: ${
            card.rarity
          } | Hashpower: ${card.hashpower
            .toString()
            .padStart(4, " ")} | Berry Cost: ${card.berryConsumption
            .toString()
            .padStart(2, " ")} | ${stakedIndicator}`
        );
      }
    }

    // Show pending action if any
    if (
      decodedAccount.pendingAction &&
      Object.keys(decodedAccount.pendingAction)[0] !== "none"
    ) {
      console.log(
        `\n⏳ Pending Action: ${Object.keys(decodedAccount.pendingAction)[0]}`
      );
    }

    console.log("\n✅ Cards fetched successfully!");
  } catch (error) {
    console.error("❌ Error fetching cards:", error);

    if (error.message?.includes("Account does not exist")) {
      console.log(
        "\n💡 Tip: This player might not have purchased an initial farm yet."
      );
    }
  }
}

// CLI setup
const program = new Command();

program
  .name("show-cards")
  .description("Show all cards for a player")
  .version("1.0.0");

program
  .command("show")
  .description("Show cards for a player")
  .requiredOption("-p, --player <address>", "Player wallet address")
  .option(
    "-u, --network <url>",
    "Solana network URL",
    "https://api.devnet.solana.com"
  )
  .action(async (opts) => {
    await showCards(
      opts.player,
      "PNeZtT8TrKSkMCYamwymQsbENKvuiXu2kgqmNsXvQUT",
      opts.network
    );
  });

// If run directly
if (require.main === module) {
  program.parse();
}

export { showCards };

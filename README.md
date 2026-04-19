# Ponzimon Program

This repository now acts as a small Ponzimon monorepo:

- `programs/ponzimon`: the Anchor on-chain program
- `tests/`: program tests
- `cli/`: helper scripts for interacting with the program
- `app/`: a React + Vite frontend prototype built from the public Ponzimon docs and live asset URLs

## Docs Alignment

The frontend prototype in `app/` is based on the current public documentation:

- [Overview](https://ponzimon.com/docs)
- [Getting Started](https://ponzimon.com/docs/early-registration)
- [Cards and Creatures](https://ponzimon.com/docs/cards)
- [The Farm](https://ponzimon.com/docs/farm)
- [Earning Formula](https://ponzimon.com/docs/economy)
- [The Heist](https://ponzimon.com/docs/heist)
- [Wheel and Seasons](https://ponzimon.com/docs/wheel)
- [Strategies](https://ponzimon.com/docs/strategies)

The prototype uses official live asset URLs from `ponzimon.com` for logo, card art, and environment imagery.

## Program Workflow

### Install root dependencies

```bash
yarn
```

### Run Anchor tests

```bash
anchor test
```

For debugging:

1. Start `solana-test-validator`
2. Keep it running
3. Run `yarn test`

## Frontend Workflow

### Install app dependencies

```bash
cd app
npm install
```

### Start the prototype

```bash
npm run dev
```

### Build the prototype

```bash
npm run build
```

## Notes

- The on-chain program already contains Ponzimon-oriented concepts such as farms, cards, staking, recycling, and booster packs.
- Some economic values and gameplay details in the on-chain program still look older than the public docs. The new frontend is a docs-driven prototype layer, not a claim that every program constant already matches the live game spec.

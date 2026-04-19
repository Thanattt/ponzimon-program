import { useState, type CSSProperties } from 'react'

type Rarity = {
  name: string
  badge: string
  level: number
  power: number
  rate: number
  effectiveRate: number
  accent: string
}

const rarities: Rarity[] = [
  {
    name: 'Common',
    badge: 'C',
    level: 1,
    power: 4,
    rate: 0.6,
    effectiveRate: 0.6,
    accent: '#7bdc65',
  },
  {
    name: 'Uncommon',
    badge: 'U',
    level: 2,
    power: 16,
    rate: 0.259,
    effectiveRate: 0.361,
    accent: '#4db6ff',
  },
  {
    name: 'Rare',
    badge: 'R',
    level: 3,
    power: 64,
    rate: 0.1,
    effectiveRate: 0.1614,
    accent: '#4f72ff',
  },
  {
    name: 'Double Rare',
    badge: 'DR',
    level: 4,
    power: 256,
    rate: 0.03,
    effectiveRate: 0.0574,
    accent: '#8c57ff',
  },
  {
    name: 'Very Rare',
    badge: 'VR',
    level: 5,
    power: 1024,
    rate: 0.01,
    effectiveRate: 0.0198,
    accent: '#ff5aa5',
  },
  {
    name: 'Super Rare',
    badge: 'SR',
    level: 6,
    power: 4096,
    rate: 0.0009,
    effectiveRate: 0.00426,
    accent: '#ff8f32',
  },
  {
    name: 'Mega Rare',
    badge: 'MR',
    level: 7,
    power: 16384,
    rate: 0.0001,
    effectiveRate: 0.00082,
    accent: '#ffdb3a',
  },
]

const creatureShowcase = [
  {
    name: 'Zephyrdrake',
    rarity: 'Mega Rare',
    image: 'https://ponzimon.com/images/cards/card_1_zephyrdrake.png',
  },
  {
    name: 'Bloomingo',
    rarity: 'Mega Rare',
    image: 'https://ponzimon.com/images/cards/card_2_bloomingo.png',
  },
  {
    name: 'Glaciowl',
    rarity: 'Mega Rare',
    image: 'https://ponzimon.com/images/cards/card_3_Glaciowl.png',
  },
  {
    name: 'Terraclaw',
    rarity: 'Super Rare',
    image: 'https://ponzimon.com/images/cards/card_4_Terraclaw.png',
  },
  {
    name: 'Voltibra',
    rarity: 'Super Rare',
    image: 'https://ponzimon.com/images/cards/card_5_Voltibra.png',
  },
  {
    name: 'Aquarion',
    rarity: 'Super Rare',
    image: 'https://ponzimon.com/images/cards/card_6_Aquarion.png',
  },
]

const strategyCards = [
  {
    title: 'The Farmer',
    risk: 'Low risk',
    body: 'Prioritize slot unlocks, stake your strongest cards, then loop rewards back into more efficient farm upgrades.',
  },
  {
    title: 'The Heister',
    risk: 'High risk',
    body: 'Use conservative 1.5x to 2.0x cashouts for smoother variance, while accepting the fixed 20% house edge.',
  },
  {
    title: 'The Recycler',
    risk: 'Low cost',
    body: 'Recycle bulk commons to chase rarity upgrades. The full Common to Mega Rare chain lands at roughly 1 in 15,625.',
  },
  {
    title: 'The Season Bridger',
    risk: 'Medium risk',
    body: 'Accumulate legacy tokens after season rollover, then use the Wheel to convert them into current-season value.',
  },
]

const launchPhases = [
  'Farm Purchase Opens',
  'Liquidity Pool Goes Live',
  'Emissions and Rewards Begin',
]

const farmUpgradeRows = [
  { label: 'Locked -> Lv1', cost: 100, cumulative: 100, card: 'Common' },
  { label: 'Lv1 -> Lv2', cost: 300, cumulative: 400, card: 'Uncommon' },
  { label: 'Lv2 -> Lv3', cost: 900, cumulative: 1300, card: 'Rare' },
  { label: 'Lv3 -> Lv4', cost: 2700, cumulative: 4000, card: 'Double Rare' },
  { label: 'Lv4 -> Lv5', cost: 8100, cumulative: 12100, card: 'Very Rare' },
  { label: 'Lv5 -> Lv6', cost: 24300, cumulative: 36400, card: 'Super Rare' },
  { label: 'Lv6 -> Lv7', cost: 72900, cumulative: 109300, card: 'Mega Rare' },
]

const farmMixDefaults = {
  common: 6,
  uncommon: 5,
  rare: 3,
  doubleRare: 2,
  veryRare: 1,
  superRare: 1,
  megaRare: 0,
}

const heistTiers = {
  Small: { bet: 100, maxMultiplier: 7 },
  Medium: { bet: 500, maxMultiplier: 10 },
  Big: { bet: 2000, maxMultiplier: 15 },
}

const formatNumber = (value: number) =>
  new Intl.NumberFormat('en-US', { maximumFractionDigits: 2 }).format(value)

function App() {
  const [networkHashpower, setNetworkHashpower] = useState(50000)
  const [farmMix, setFarmMix] = useState(farmMixDefaults)
  const [heistTier, setHeistTier] = useState<keyof typeof heistTiers>('Medium')
  const [cashoutMultiplier, setCashoutMultiplier] = useState(2.5)
  const [legacyTokens, setLegacyTokens] = useState(2500)

  const playerHashpower =
    farmMix.common * 4 +
    farmMix.uncommon * 16 +
    farmMix.rare * 64 +
    farmMix.doubleRare * 256 +
    farmMix.veryRare * 1024 +
    farmMix.superRare * 4096 +
    farmMix.megaRare * 16384

  const dailyEmission = 800000
  const playerShare =
    networkHashpower > 0 ? playerHashpower / networkHashpower : 0
  const dailyEarnings = playerShare * dailyEmission
  const hourlyEarnings = dailyEarnings / 24

  const currentHeist = heistTiers[heistTier]
  const clampedMultiplier = Math.min(
    Math.max(cashoutMultiplier, 1),
    currentHeist.maxMultiplier,
  )
  const reachProbability = Math.min(0.8 / clampedMultiplier, 0.8)
  const heistPayout = Math.floor(currentHeist.bet * clampedMultiplier)
  const heistProfit = heistPayout - currentHeist.bet
  const heistExpectedReturn = currentHeist.bet * 0.8
  const heistExpectedDelta = heistExpectedReturn - currentHeist.bet

  const expectedPowerPerCard = rarities.reduce(
    (sum, rarity) => sum + rarity.rate * rarity.power,
    0,
  )
  const expectedPowerPerPack = expectedPowerPerCard * 5
  const wheelExpectedTokenPrize = 0.05 * 52.5
  const wheelExpectedCardPower =
    0.45 *
    rarities.reduce(
      (sum, rarity) => sum + rarity.effectiveRate * rarity.power,
      0,
    )
  const wheelSpins = Math.floor(legacyTokens / 250)

  const updateFarmMix = (field: keyof typeof farmMixDefaults, value: number) => {
    setFarmMix((current) => ({
      ...current,
      [field]: value,
    }))
  }

  return (
    <main className="app-shell">
      <div className="page-backdrop" />

      <header className="topbar">
        <a className="brand" href="#hero">
          <img
            src="https://ponzimon.com/images/ponzimonlogo.png"
            alt="Ponzimon logo"
          />
          <span>Ponzimon</span>
        </a>

        <nav className="topnav">
          <a href="#systems">Systems</a>
          <a href="#simulators">Simulators</a>
          <a href="#cards">Cards</a>
          <a href="#roadmap">Launch</a>
        </nav>
      </header>

      <section className="hero-panel" id="hero">
        <div className="hero-copy">
          <p className="eyebrow">Collectible Card Farming Protocol</p>
          <h1>Prototype the Ponzimon experience from the official docs.</h1>
          <p className="lede">
            This frontend recreates the core gameplay loop described in the
            official Ponzimon documentation: registration, farming, earning,
            heists, recycling, and season bridging. Visual assets are loaded
            directly from the live Ponzimon site.
          </p>

          <div className="hero-actions">
            <a
              className="primary-action"
              href="https://ponzimon.com/docs"
              target="_blank"
              rel="noreferrer"
            >
              Read official docs
            </a>
            <a className="secondary-action" href="#simulators">
              Jump to simulators
            </a>
          </div>

          <div className="metrics-grid">
            <article>
              <strong>191</strong>
              <span>creatures</span>
            </article>
            <article>
              <strong>7</strong>
              <span>rarity tiers</span>
            </article>
            <article>
              <strong>800K</strong>
              <span>$PONZI per day</span>
            </article>
            <article>
              <strong>25</strong>
              <span>farm slots</span>
            </article>
          </div>
        </div>

        <div className="hero-stage">
          <div className="stage-card stage-large">
            <img
              src="https://ponzimon.com/images/bg/bg_6_cherry_garden.png"
              alt="Ponzimon environment"
            />
          </div>
          <div className="stage-stack">
            {creatureShowcase.slice(0, 3).map((creature) => (
              <article className="creature-chip" key={creature.name}>
                <img src={creature.image} alt={creature.name} />
                <div>
                  <h2>{creature.name}</h2>
                  <p>{creature.rarity}</p>
                </div>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section className="panel" id="systems">
        <div className="section-heading">
          <p className="eyebrow">Core Loop</p>
          <h2>Built around the exact systems described in the docs</h2>
        </div>

        <div className="system-grid">
          <article className="system-card">
            <h3>Early Registration</h3>
            <p>
              Invite-only signup, free Rare card at power 64, and a 0.7 SOL
              one-time entry fee when the season opens.
            </p>
          </article>
          <article className="system-card">
            <h3>Farm and Hashpower</h3>
            <p>
              Stake cards on a 5x5 grid, unlock higher slot levels, and convert
              rarity into exponentially larger hashpower.
            </p>
          </article>
          <article className="system-card">
            <h3>Heists and Recycling</h3>
            <p>
              Bet $PONZI in a provably fair crash game or recycle unwanted cards
              with a 20% upgrade chance.
            </p>
          </article>
          <article className="system-card">
            <h3>Wheel and Seasons</h3>
            <p>
              Previous-season tokens become legacy tokens and can be spun back
              into current-season cards or rewards.
            </p>
          </article>
        </div>
      </section>

      <section className="panel simulators" id="simulators">
        <div className="section-heading">
          <p className="eyebrow">Interactive Layer</p>
          <h2>Simulate the economy, farm, and risk loops</h2>
        </div>

        <div className="sim-grid">
          <article className="sim-card">
            <div className="card-heading">
              <h3>Farm and Earning Calculator</h3>
              <p>
                Uses the docs formula:
                <code>(your hashpower / network hashpower) x 800,000</code>
              </p>
            </div>

            <label className="field">
              <span>Total network hashpower</span>
              <input
                type="range"
                min="10000"
                max="200000"
                step="1000"
                value={networkHashpower}
                onChange={(event) =>
                  setNetworkHashpower(Number(event.target.value))
                }
              />
              <strong>{formatNumber(networkHashpower)}</strong>
            </label>

            <div className="farm-grid">
              {[
                ['common', 'Common cards'],
                ['uncommon', 'Uncommon cards'],
                ['rare', 'Rare cards'],
                ['doubleRare', 'Double Rare cards'],
                ['veryRare', 'Very Rare cards'],
                ['superRare', 'Super Rare cards'],
                ['megaRare', 'Mega Rare cards'],
              ].map(([key, label]) => (
                <label className="field compact" key={key}>
                  <span>{label}</span>
                  <input
                    type="number"
                    min="0"
                    max="25"
                    value={farmMix[key as keyof typeof farmMixDefaults]}
                    onChange={(event) =>
                      updateFarmMix(
                        key as keyof typeof farmMixDefaults,
                        Number(event.target.value),
                      )
                    }
                  />
                </label>
              ))}
            </div>

            <div className="stats-row">
              <article>
                <span>Your hashpower</span>
                <strong>{formatNumber(playerHashpower)}</strong>
              </article>
              <article>
                <span>Network share</span>
                <strong>{(playerShare * 100).toFixed(2)}%</strong>
              </article>
              <article>
                <span>Daily earnings</span>
                <strong>{formatNumber(dailyEarnings)} $PONZI</strong>
              </article>
              <article>
                <span>Hourly earnings</span>
                <strong>{formatNumber(hourlyEarnings)} $PONZI</strong>
              </article>
            </div>
          </article>

          <article className="sim-card">
            <div className="card-heading">
              <h3>Heist Risk Calculator</h3>
              <p>
                Based on the docs survival rule:
                <code>P(crash &gt;= m) = 0.80 / m</code>
              </p>
            </div>

            <label className="field">
              <span>Tier</span>
              <select
                value={heistTier}
                onChange={(event) =>
                  setHeistTier(event.target.value as keyof typeof heistTiers)
                }
              >
                {Object.keys(heistTiers).map((tier) => (
                  <option key={tier} value={tier}>
                    {tier}
                  </option>
                ))}
              </select>
            </label>

            <label className="field">
              <span>Cashout target</span>
              <input
                type="range"
                min="1"
                max={currentHeist.maxMultiplier}
                step="0.1"
                value={clampedMultiplier}
                onChange={(event) =>
                  setCashoutMultiplier(Number(event.target.value))
                }
              />
              <strong>{clampedMultiplier.toFixed(1)}x</strong>
            </label>

            <div className="stats-row">
              <article>
                <span>Bet size</span>
                <strong>{formatNumber(currentHeist.bet)} $PONZI</strong>
              </article>
              <article>
                <span>Reach probability</span>
                <strong>{(reachProbability * 100).toFixed(2)}%</strong>
              </article>
              <article>
                <span>Payout if successful</span>
                <strong>{formatNumber(heistPayout)} $PONZI</strong>
              </article>
              <article>
                <span>Profit if successful</span>
                <strong>{formatNumber(heistProfit)} $PONZI</strong>
              </article>
            </div>

            <div className="heist-note">
              <p>
                Expected return remains {formatNumber(heistExpectedReturn)}{' '}
                $PONZI per {formatNumber(currentHeist.bet)} bet.
              </p>
              <p>
                Expected delta: {formatNumber(heistExpectedDelta)} $PONZI from
                the fixed 20% house edge.
              </p>
            </div>
          </article>

          <article className="sim-card">
            <div className="card-heading">
              <h3>Pack and Wheel Snapshot</h3>
              <p>
                Converts the published rarity tables into quick expected-value
                references.
              </p>
            </div>

            <label className="field">
              <span>Legacy tokens available</span>
              <input
                type="range"
                min="250"
                max="10000"
                step="250"
                value={legacyTokens}
                onChange={(event) =>
                  setLegacyTokens(Number(event.target.value))
                }
              />
              <strong>{formatNumber(legacyTokens)} legacy $PONZI</strong>
            </label>

            <div className="stats-row">
              <article>
                <span>Expected power per card</span>
                <strong>{formatNumber(expectedPowerPerCard)}</strong>
              </article>
              <article>
                <span>Expected power per 5-card pack</span>
                <strong>{formatNumber(expectedPowerPerPack)}</strong>
              </article>
              <article>
                <span>Wheel spins</span>
                <strong>{wheelSpins}</strong>
              </article>
              <article>
                <span>Expected token prize per spin</span>
                <strong>{wheelExpectedTokenPrize.toFixed(2)} $PONZI</strong>
              </article>
            </div>

            <div className="wheel-box">
              <p>
                Wheel expected card power contribution:{' '}
                <strong>{formatNumber(wheelExpectedCardPower)}</strong>
              </p>
              <p>Wheel split from docs: 50% nothing, 45% card, 5% tokens.</p>
            </div>
          </article>
        </div>
      </section>

      <section className="panel" id="cards">
        <div className="section-heading">
          <p className="eyebrow">Cards and Creatures</p>
          <h2>Rarity grows at 4x each tier</h2>
        </div>

        <div className="rarity-table">
          {rarities.map((rarity) => (
            <article
              className="rarity-row"
              key={rarity.name}
              style={{ '--accent': rarity.accent } as CSSProperties}
            >
              <div>
                <strong>
                  {rarity.badge} {rarity.name}
                </strong>
                <span>Level {rarity.level}</span>
              </div>
              <div>
                <strong>{formatNumber(rarity.power)}</strong>
                <span>hashpower</span>
              </div>
              <div>
                <strong>{(rarity.rate * 100).toFixed(2)}%</strong>
                <span>base pull rate</span>
              </div>
              <div>
                <strong>{(rarity.effectiveRate * 100).toFixed(3)}%</strong>
                <span>effective with recycle</span>
              </div>
            </article>
          ))}
        </div>

        <div className="creature-grid">
          {creatureShowcase.map((creature) => (
            <article className="creature-card" key={creature.name}>
              <img src={creature.image} alt={creature.name} />
              <h3>{creature.name}</h3>
              <p>{creature.rarity}</p>
            </article>
          ))}
        </div>
      </section>

      <section className="panel">
        <div className="section-heading">
          <p className="eyebrow">Farm Progression</p>
          <h2>Slot upgrades mirror the official geometric cost curve</h2>
        </div>

        <div className="upgrade-list">
          {farmUpgradeRows.map((row) => (
            <article className="upgrade-card" key={row.label}>
              <h3>{row.label}</h3>
              <p>Upgrade cost: {formatNumber(row.cost)} $PONZI</p>
              <p>Cumulative: {formatNumber(row.cumulative)} $PONZI</p>
              <p>Unlocks: {row.card}</p>
            </article>
          ))}
        </div>
      </section>

      <section className="panel" id="roadmap">
        <div className="section-heading">
          <p className="eyebrow">Launch Readiness</p>
          <h2>Registration and season flow from the docs</h2>
        </div>

        <div className="roadmap-grid">
          <article className="roadmap-card">
            <h3>Registration Rules</h3>
            <ul>
              <li>Invite code required</li>
              <li>Free 1x Rare card at power 64</li>
              <li>0.7 SOL entry fee on launch</li>
              <li>Referral reward of 20% SOL on booster purchases</li>
            </ul>
          </article>

          <article className="roadmap-card">
            <h3>Season 2 Launch Sequence</h3>
            <ol>
              {launchPhases.map((phase) => (
                <li key={phase}>{phase}</li>
              ))}
            </ol>
          </article>

          <article className="roadmap-card">
            <h3>Strategy Snapshots</h3>
            <div className="strategy-stack">
              {strategyCards.map((card) => (
                <div key={card.title}>
                  <strong>{card.title}</strong>
                  <span>{card.risk}</span>
                  <p>{card.body}</p>
                </div>
              ))}
            </div>
          </article>
        </div>
      </section>
    </main>
  )
}

export default App

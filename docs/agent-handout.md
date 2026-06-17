# EMBERWATCH — Agent Handout
### Complete Project & Commercialization Briefing
*Prepared for agent handoff. Contains all technical, design, and business context needed to continue work without losing any history.*

---

## 1. Project Identity

### 1.1 What Emberwatch Is

Emberwatch is a top-down action roguelite / horde-survivor in the lineage of Vampire Survivors, built as a **single self-contained HTML file** (canvas + vanilla JavaScript, ~3,200 lines, no external dependencies, no build pipeline). It runs in any desktop or mobile browser. All assets are procedurally generated — audio via WebAudio API synthesis, visuals via canvas draw calls — meaning there are **zero third-party licensed assets** to clear.

### 1.2 Core Fantasy & Thesis

> **"Feed the fire. Hold the dark."**

The campfire at world origin (0,0) does **triple duty**:

- **Progression anchor** — its level is your level; feeding it drives all advancement.
- **Safety** — at night, straying beyond its light radius triggers the Exposed effect (mounting negative health regen that kills you if you stay in the dark too long).
- **Bank** — you must carry remains from kills back to the fire to deposit and grow it.

This triple role creates a constant spatial tension loop: the best kills and loot are at the edges of your light, but retrieving remains means running back through danger to fuel the fire. By day the cycle is generous; by night it becomes a survival puzzle. This is the game's primary commercial differentiator and its strongest design idea.

### 1.3 Genre & Comps

| Comp | Relationship |
|---|---|
| Vampire Survivors | Primary genre ancestor — auto-attack horde wave structure, boon system |
| Loop Hero | Thematic kinship — campfire/loop base, per-character loot tables with rarity tiers |
| Darkest Dungeon | Tonal kinship — firelight as safety, darkness as threat |
| Soulstone Survivors / Death Must Die | Direct market peers — breakout solo-dev horde-survivors |
| Megabonk | 2025 cautionary/aspirational case — solo Unity dev, 1M+ copies in two weeks at $9.99 |

### 1.4 Current Build State

- Enemy types: grunt, swift, brute, spitter, bomber, boss (6 + 1 boss)
- Classes: Ranger, Mage, Knight — each with unique base stats, passive, and four abilities (Q/W/E/R)
- Balance: largely unvalidated by real playtesters
- Monetization hooks (watch-ad, buy-embers): exist as stubs only — no SDK integrated
- Expert evaluation score: **8.3/10**. "Better than 80% of $5-10 Steam roguelites." Has "breakout indie DNA."

---

## 2. Core Architecture

### 2.1 File & Runtime

- Single HTML file, ~3,200 lines. No build step, no npm, no framework.
- Canvas 2D rendering with DPR scaling. `requestAnimationFrame` game loop.
- WebAudio API for all SFX (procedural synthesis — no audio files).
- `localStorage` for meta-persistence (embers, best score) with in-memory fallback.
- Touch + mouse + keyboard input. Mobile detection via `navigator.maxTouchPoints` and `matchMedia`.

### 2.2 Composable Stat System

The entire power model flows through `resolveStat(actor, statKey, ctx)` which sums modifiers from all sources on the actor's `sources[]` array.

- **Source types:** `classPassive`, `fireSource()`, `perks[]`, `equipment[]`, `setBonusSources()`, world rules
- **Modifier operations:** `flat` (additive), `increased` (additive %), `more` (multiplicative %)
- **Condition support:** `{kind:"phase", phase:"night"}` and `{kind:"selfHealthBelow", pct:0.5}` etc.
- **FRAC set** (displayed as %): critChance, critMultiplier, lifesteal, goldFind, cdr, counter, evasion

### 2.3 Full Stat List

`maxHealth`, `healthRegen`, `attackDamage`, `attackSpeed`, `critChance`, `critMultiplier`, `armor`, `moveSpeed`, `lifesteal`, `goldFind` ("Harvest"), `attackRange`, `cleave`, `chain`, `armorPen`, `cdr`, `counter` (hero only — reflects damage back), `evasion` (enemy only — dodge chance)

### 2.4 Classes

| Class | HP | AD | AS | Range | MS | Color | Passive |
|---|---|---|---|---|---|---|---|
| Ranger | 110 | 8 | 1.6 | 215 | 156 | #5fae6b (green) | Hunter's Focus: +15% crit at night; heal 10% maxHP at daybreak |
| Mage | 85 | 18 | 1.0 | 100 | 130 | #9b6cd6 (purple) | Emberheart: +30% AD at night; cleave 48 |
| Knight | 170 | 15 | 1.25 | 30 | 126 | #c9a23c (gold) | Bulwark: +14 armor; **heal 6% maxHP on kill** ← explains un-equipped healing |

### 2.5 Abilities (Q/W/E/R per class)

Ability array order: `[Q unlock5, W unlock10, E dash/movement unlock0, R ult unlock20]`. `ab.key` lowercase (q/w/e/r).

`castDash` sets `dashT=0.16`, `dashVX/VY`, `dashPass`, and `invulnT = max(invulnT, dashT+0.06)` for i-frames. All dashes give i-frames; Ranger's Tumble has passthrough; Knight's Lunge still damages enemies it passes.

### 2.6 Resolve Attack Pipeline

`resolveAttack(att, tgt, p, ctx)`:

1. Invuln / i-frame guard (`hero.invulnT > 0` → skip)
2. Enemy evasion check (`tgt != hero && !proc && !reflect`): roll vs `resolveStat(tgt, 'evasion')` → "miss" float text
3. Crit roll, armor mitigation (armorPen), lifesteal
4. `onDamage` (flash, hurt SFX, vibrate, screen flash, blood)
5. **Counter reflect:** if `tgt == hero && att != hero && !reflect` → fire reflect attack back at attacker
6. Emit `onCrit` / `onKill` events → trigger system (heal, proc attacks, etc.)

### 2.7 Enemy System

| Tag | HP | AD | MS | Armor | Evasion | Windup | Loot: chance / count / lvl offset / rar |
|---|---|---|---|---|---|---|---|
| grunt | 32 | 8 | 62 | 2 | — | 0.34s | 12% / 1-2 / [-5,0] / common |
| swift | 18 | 6 | 118 | 0 | 0.30 | 0.24s | 10% / 1 / [-4,0] / magic |
| brute | 90 | 18 | 42 | 8 | — | 0.50s | 32% / 1-2 / [-2,2] / rare |
| spitter | 24 | 9 | 74 | 1 | — | 0.42s ranged | 14% / 1-2 / [-3,1] / magic |
| bomber | 30 | 26 | 138 | 0 | 0.18 | 0.45s fuse | 12% / 1 / [-3,1] / magic |
| boss | 820 | 30 | 46 | 14 | — | 0.50s | 100% / 2-3 / [0,3] / rare |

All stats scale by `diffMul = 1 + (wave-1)*0.11` on spawn. Boss schedule: `wave >= 8 && (wave-8)%6===0` (first at wave 8, then every 6). Enemy wind-ups root the enemy; melee commits arc; spitter locks aim at hero position on commit; bomber has 0.45s fuse before explosion.

### 2.8 Loot System

- `rollItem(level, rarMaxIdx)`: level drives power (`diff = 1 + (level-1)*0.11`). Loot level = `cur + ri(lo, hi)` clamped to min 1.
- Rarity: common (1 affix), magic (2), rare (3). Odds shift toward rarer as level climbs.
- **60%** of items belong to a themed set (leading with that set's signature affix).
- **Stat deduplication:** `used` set seeded with base item stats — affixes can never double a stat already present on the item.
- Proc chance: rare 55%, magic 22%, common 0%.
- If set's themed affix would duplicate a base stat, the affix is skipped (set identity + bonuses still apply).

### 2.9 Equipment Sets (9 themes)

| Set | Color | Signature Stat | 2-piece bonus | 4-piece bonus |
|---|---|---|---|---|
| Regeneration | #8fe0a0 | healthRegen | +0.5/s regen | +1/s regen, +100 HP |
| Vampirism | #e06a8a | lifesteal | +2% lifesteal | +5% lifesteal, +10% AD |
| Defense | #8fb2e0 | armor | +12 armor | +24 armor, +60 HP |
| Counter | #e0a24a | counter | +12% reflect | +25% reflect, +18 armor |
| Critical | #ffd24a | critChance | +10% crit | +50% crit mult, +10% crit |
| Berserker | #e0653c | attackDamage | +12% inc AD | +12% more AD |
| Swiftness | #a0e0d0 | attackSpeed | +12% AS | +12% AS, +12% MS |
| Fortitude | #d0c090 | maxHealth | +70 HP | +15% inc HP |
| Avarice | #e0c84a | goldFind | +20% harvest | +40% harvest, +8% MS |

`setBonusSources(items)` generates synthetic source objects injected into the hero's `sources[]` via `rebuild()`. The equip-preview (`sourcesWith`) also includes them so delta comparisons are accurate.

### 2.10 Gather-and-Bank Loop ← the key mechanic

> This is the most distinctive and commercially risky system. Understand it before changing anything.

- **`MAGNET_R = 100`:** hero sweeps up loose remains within 100px → adds to `G.carry`
- **`BANK_R = 46`:** hero must stand within 46px of the fire origin to unload. Being inside the light radius is NOT enough.
- **Banking is progressive:** rhythmic pour every `TICK=0.06s`, each chunk = `min(carry, max(1, round(carry*0.2)))`. Tapers as carry empties.
- **Unload feedback:** `SFX.feed(G.bankStep++)` plays rising-pitch chimes. Fire flares (`G.fireFeed` brightens the pool). Rising `+N` tallies float off the flames. Final whoomp (`SFX.fire()`, shake, ring pulse) when carry hits 0.
- **Level-up is DEFERRED** while `G._banking` is true — the full pour plays out before the level-up screen appears.
- **`DEATH_SPILL = 0.5`:** dying halves the un-banked carry. Banked xp is safe.
- **`REMAINS_TTL = 30`:** loose remains fade after 30 seconds if not collected.
- Carried count shown as glowing `⬥ N` floating above the hero.

**Tuning levers (all one-liners):** `MAGNET_R`, `BANK_R`, `DEATH_SPILL`, `REMAINS_TTL`, `TICK`, chunk fraction (`carry*0.2`), fireFeed flare strength (`fireFeed*0.16` on pool line).

### 2.11 Day/Night Cycle & Exposure

- `G.ambient`: 0 = deep night, 1 = full day. Eases smoothly between states.
- Hour 18-19: sun sets; hour 06-07: sun returns.
- `G.lightR = min(460, 250 + (level-1)*8)`: firelight radius grows with fire level.
- Exposed effect: applied when hero is beyond `lightR` at night. Negative healthRegen stack, exposed overlay, warning banner.
- Enemy spawn at `max(lightR+70, 440)` from origin.
- `ambient` affects: firefly visibility (inverse — night only), butterfly visibility (day AND not raining), storm gloom overlay (day × rain intensity), SFX levels.

### 2.12 Weather System

- `G.storm: {on, intensity, t, strikeIn}`. Spawns ground splats, falling rain streaks, lightning bolts.
- **Daytime storm gloom:** multiply `#5f6675` at `0.34*gloom` + haze at `0.10*gloom`, where `gloom = ambient * min(1, intensity*1.3)`. Night is already dark so gloom = 0 at night.
- Butterflies hidden during rain: `vis *= 1 - min(1, intensity*2.2)`.
- Rain ambient gain: `level*0.07`. Crackle pop gap: `(0.22 + rand*0.48)/(0.22 + fireStr*1.2)`. Flame bed: `fireStr*0.03`.

### 2.13 SFX Module (procedural WebAudio)

SFX IIFE with looping beds: rain, crickets (gated/pulsing via `crickPulse()`), fire (noise + LFO + crackle pops).

One-shot sounds: `hit`, `crit`, `hurt`, `enemyDie`, `bossDie`, `cast`, `levelUp`, `pickup`, `waveStart`, `fire`, `death`, `thunder`, `swing` (melee whiff), `melee(power)` (melee connect), `feed(step)` (rising chime during banking).

Synthesis primitives: `tone(freq, dur, opts)` and `noise(dur, opts)`. M key toggles mute. `silenceAmbience()` ramps all beds to 0.

### 2.14 Melee Combat Feel (Knight)

`meleeSwing(h)` — connect vs whiff are clearly differentiated:

- **CONNECT:** `hitstop(0.055)` freezes game 55ms; `shake(4.6)`; `camKick` toward blow; 11 bright sparks; impact flash + shock ring at contact point; `SFX.melee(power)`; knockback 28px.
- **WHIFF:** `shake(1.0)`; `SFX.swing()` (air whoosh); no hitstop; no sparks; no impact fx.
- Knight starting `attackRange: 30`. Effective reach = range + enemy.r.

### 2.15 Mobile UI

- **Joystick:** fixed bottom-left, `joyCenter()={x:96, y:innerHeight-128}`. `JOY_MAXR=58px`. `JOY_TOP=1.0` (capped at 1× mouse top speed). Touch position relative to `joyCenter` — no drag-to-start.
- **Ability cluster:** gamepad-style 2×2. `pos-a` (E, A button, 70px, bottom-right), `pos-x` (Q), `pos-y` (W), `pos-b` (R). QWER watermark labels. Border colors: green/blue/amber/red.
- **Mobile HUD fixes:** `#topleft` width `38vw` max `165px`; `#clock .phase` `letter-spacing:0.28em`; `#topright` `top:56px` (drops below Inventory button).

---

## 3. Ambient Life Systems

### 3.1 Fireflies (night)
6 fireflies drift near camp. Night-only visibility (`clamp((1-ambient)/0.35)`). Warm glow (additive blend). Random wander with turn drift.

### 3.2 Butterflies (day, clear weather only)
2 butterflies. Perch-and-dart state machine:

- **State `rest`:** holds position, wings slowly fan (`flap += dt*2.4`). Rests 3–7.5s then picks a new perch.
- **State `fly`:** homes toward `tx,ty`. Dir snaps toward target (fast when fleeing: `dt*14`, gentle otherwise: `dt*7`). Wings beat at `fsp*dt`.
- **Startle:** if hero within 92px and not already fleeing → `perch(away=true)`. Flee angle = away from hero ±0.55 rad. Burst speed 235 px/s decaying at -260/s. New perch 210–380px away.
- **Visibility:** `max(0, min(1, (ambient-0.5)/0.35)) * (1 - min(1, storm.intensity*2.2))`
- Rendered: 4 ellipse wings (forewing + hindwing per side), slim dark body, oriented by `dir`. Size: `1.8 + rand*0.83`.

### 3.3 Fireplace SFX
`ensureFire()`: looping lowpass(520Hz) noise + LFO(6.5Hz) amplitude flicker + slow breath LFO(0.7Hz) → fireGain (bed `0.03`). `crackPop()` scheduler: `(0.22+rand*0.48)/(0.22+fireStr*1.2)` seconds between pops; peak `= (0.15+rand*0.24)*fireStr`; bandpass 900–3700Hz.

### 3.4 Cricket Pulse
`crickPulse()` scheduler: gate node swells chorus in (0.45s), holds (1–2.4s), dips to 0.05 for a gap (1.2–3.8s). Gain: `level*0.0275`. Creates rhythmic bursts rather than continuous drone.

---

## 4. UI & Inventory

### 4.1 Watcher's Pack Modal
Sections: Equipment (equip slots with set pip + level badge), Satchel, Item Detail (name, Lv N, rarity, slot, mods, proc, set-progress panel, compare delta, equip/unequip/salvage), Stats (2-col grid), Boons & Effects.

### 4.2 Item Detail — Set Progress Panel
Shows set name + `N/4 worn`. Each tier (2pc, 4pc) displayed with mod text; active tiers highlighted. Color matches set color. Only shown if `item.set != 'basic'` and `SETS[item.set]` exists.

### 4.3 Boons & Effects Section (`renderBoons`)
Lists all non-equipment power sources:

- **Class passive** (`h.classPassive.nm` / `.ds`) — this is why Bulwark's heal-on-kill now has visible explanation.
- **Campfire contribution** (+N HP from fire level, when fireLevel > 1).
- **All boons picked at level-up** (stored in `h.boons[]`, pushed on card click with `nm + ds + rarCls`).
- **Active set bonuses** from worn gear (computed live from equipment slots).

### 4.4 Level-Up Screen
3 boon cards with rarity (common cream / magic blue #7fb2ff / rare gold #ffd24a). Card types: generic perks (PERKS array), ability upgrades (`ABILITIES[ab].upgrades`), class signatures (SIGNATURE). Chosen card is pushed to `h.boons[]` with `nm + ds + rarCls`.

### 4.5 Game-Over Screen
Animated count-up stats (waves, level, kills, days, score) staggered with CSS `statPop`/`scorePop` animations. Watch ad (+30 embers stub), Buy embers (stub), Revive (`25 + 25*reviveCount` embers), Restart, Home.

---

## 5. Design Evaluation

### 5.1 Strengths
- **Thematic cohesion:** campfire does triple duty (progression + safety + bank) — most prototypes never find this.
- **Gather-and-bank loop:** physically carrying fuel back to the fire makes the theme literal. The "venture out / return" trip creates real push-your-luck tension by night.
- **Procedural audio:** fire crackle, rain, crickets, hearth bed — unusually atmospheric for a single HTML file.
- **Mobile-first design:** joystick, gamepad cluster, responsive HUD — already playable on device.
- **Composable stat system:** extensible, supports conditions and triggers — clean foundation for future content.
- **Visual game-feel:** hitstop, camKick, impact flash, shock ring, melee connect vs whiff differentiation — pro-level juice for a prototype.

### 5.2 Risks & Open Questions
- **Genre identity unresolved:** straddles horde-survivor (fast, auto-attack), ARPG looter (deliberate inventory), and extraction-lite (gather/carry/bank). Which one wins determines every subsequent design and marketing decision.
- **Gather-and-bank loop unvalidated:** is it tension or tedium? This is the single most important open question. Cannot be answered from the code.
- **Content depth light:** 6 enemies + 1 boss is not enough for long-term retention.
- **Ember economy mostly stubbed:** three overlapping progression layers (boons, gear, embers) with the meta-currency layer doing almost nothing yet.
- **Onboarding:** high cognitive load. First 2–3 runs overwhelming. Tutorial needed.
- **Balance entirely unplaytested:** windups, boss cadence, wave counts, ember economy all untuned.

### 5.3 Playtest Priority Questions
1. Is the core 30 seconds fun on its own (combat feel)?
2. Is the gather-and-bank loop tension or tedium?
3. Which genre does this want to be — and is anything actively fighting that?

> See companion file `emberwatch-playtest-checklist.md` for the full session protocol with per-system dials.

---

## 6. Commercialization Strategy

> Developer profile: solo, bootstrapping, limited budget, based in Türkiye. Figures current as of 2025–2026 research. Verify before acting — platform terms change frequently.

### 6.1 Core Principle: Validate Before Spending
The game is a strong prototype with unvalidated balance and light content. Marketing/discoverability — not the build — decides commercial outcomes. Do not spend on platform fees, engine ports, or ads until the loop is proven fun. The correct sequencing is web-first, cheapest-possible, then double down only on validated signals.

### 6.2 Path Comparison Table

| Path | Upfront Cost | Effort | Legal Complexity | Realistic Revenue (unknown game) | Time to First $ |
|---|---|---|---|---|---|
| Web portals (Poki/CrazyGames/itch/Newgrounds) | ~$0 | Low | Low | $500–$3,000/mo at best; often far less | Weeks–months |
| Aggregators (GameDistribution/GameMonetize) | $0 | Low | Low | $1.5–$3/1,000 ad-views; 33–90% split | ~1 month |
| Mobile F2P (WebView wrap) | $99+$25 | Medium | Medium | Low without UA spend | 1–2 months |
| Mobile F2P (engine port) | $99+$25+port time | High | Medium | Low–moderate; crowded | Months |
| Premium Steam | $100/app+port time | High | Medium | 40% don't recoup $100; top 8% >$100k | Months |
| Open-source/crowdfunding | $0 | Medium | Low | Minimal until audience exists | Months+ |
| HTML5 licensing/source sale | $0 | Low–Med | Medium (contracts) | $500 non-excl; $2k–$5k excl per deal | Weeks |
| Discord/Telegram/web3 | $0 | Medium | Medium–High | Niche; Discord payouts US-only | Months |

### 6.3 Web Portals (Phase 1 — Start Here)

- **itch.io + Newgrounds:** zero gatekeeping, free hosting, community feedback. Publish immediately.
- **Poki:** curated (~1 game/day). Revenue: 100% on direct-search traffic, 50% on Poki-referred traffic. SDK integration required. Use Poki's free prototype playtest tool for session data first.
- **CrazyGames:** 20% cost deduction off gross, then ~60/40 split (dev/CG) for ad revenue. +50% bonus for 2-month timed exclusivity if full SDK implemented. Min payout €100 via Tipalti.
- **GameDistribution:** 33% net to developer. NET-60, €100 min.
- **GameMonetize:** 45% per role (up to 90% if dev+publisher). NET-30, $30 min, PayPal/USDT. Quotes "$1.5–$3 per 1,000 ad views."
- Integrate rewarded-ad hooks that already exist as stubs: +30 embers, revive, extra loot roll. These are the right non-predatory F2P touchpoints.
- **Benchmark to advance:** 4+ min average sessions, organically scaling plays.

### 6.4 Quick-Win Monetization (Add Now)
- **Supporter Pack ($4–7):** ad removal + cosmetic fire effects + starting embers. Non-predatory, fits the tone, low implementation effort.
- **itch.io PWYW or $3–5** for the web build — first-dollar signal with zero friction.
- **Ko-fi tip button** on the itch.io page. Zero setup cost.

### 6.5 Mobile F2P (Phase 2, after validation)

- **WebView wrap (Capacitor/Cordova):** cheapest but Android WebView performance is materially slower than Chrome for real-time action. Risk of store rejection.
- **Native engine port:** recommended for serious mobile. Better performance, native ad SDKs, IAP.
- **Rewarded video eCPM:** $15–30 tier-1 (US iOS ~$30); $2–4 emerging markets. Turkish-heavy traffic earns low eCPMs — global audience matters.
- **Ad networks:** AppLovin + Google AdMob ~50% market share. Unity Ads/LevelPlay, ironSource, Mintegral follow.
- **IAP targets:** embers, battle pass (seasonal perks/cosmetics), class skins, "No Ads + Starter Pack" ~$4.99.
- **Store costs:** Apple $99/yr, Google $25 one-time. Both require W-8BEN to avoid 30% US withholding.
- **Market reality:** saturated genre dominated by funded studios. Organic mobile discovery needs UA spend — contradicts bootstrapping. Treat as later-stage.

### 6.6 Premium PC / Steam (Phase 3)

- **Steam Direct:** $100/app fee (recoupable after $1,000 gross), 30% Valve cut.
- **Genre is proven:** Vampire Survivors (HTML5/Phaser prototype → itch.io free → rebuilt for performance → massive success), Brotato (Godot, strong seller), Megabonk (Unity, 1M+ copies in 2 weeks, Sept 2025, $9.99).
- **Brutal reality (2025 Gamalytic data):** 65.9% of Steam releases grossed under $1,000; 40% didn't recoup the $100 fee; only 8% grossed over $100k. Being better than the median doesn't map to commercial success — discoverability is the deciding variable.
- **Content bar for a paid roguelite:** multiple classes + biomes, 15–20+ enemy types, 50+ hours replayability. Current build is far below this.
- **Price target:** $6.99–$9.99. Wishlist + pre-launch community essential.
- **HTML5 vs native on Steam:** Vampire Survivors' dev deliberately rebuilt in a "standard industry engine" for performance. A native engine rebuild is strongly advised for a paid product.

### 6.7 Open-Source & Community Funding

- **Platforms:** GitHub Sponsors (0% fee), Ko-fi (0–5%), Patreon (~8–12%), itch.io donations. Easy to enable. Don't expect meaningful returns without an existing audience.
- **Crowdfunding** (Kickstarter/IndieGoGo): requires existing community and polished pitch — not a launch strategy for an unknown game.
- **License decision (one-way door):**
  - MIT (permissive) — best if you may sell or relicense later
  - GPL/AGPL (copyleft) — forces derivatives open; complicates commercial relicensing and some SDK integrations
  - Open-core (open engine, closed content) — pragmatic monetization-friendly hybrid
  - Because all assets are procedurally generated, you have full freedom. For a commercial bootstrap, staying closed-source until the loop is proven is recommended.

### 6.8 HTML5 Licensing
- Non-exclusive license: ~$500 typical, sold to multiple portals/sites.
- Exclusive license: $2,000–$5,000 typical.
- Marketplaces: CodeCanyon (source templates), GameDistribution/GameMonetize broker networks, HTML5GameDevs forum.

### 6.9 Engine Choice Analysis

| Factor | HTML5/JS (Stay) | Godot 4.x (Free) | Unity 6 (Free <$200k) |
|---|---|---|---|
| Porting effort | None | Moderate (GDScript easy) | Higher (C#) |
| 2D suitability | Good (canvas) | Excellent (native 2D) | Good (2D on 3D engine) |
| Web export | Native | Good (size/threading caveats) | Heavy WebGL builds |
| Windows/Steam | Via Electron (suboptimal) | Excellent | Excellent |
| iOS/Android | Via WebView (janky) | Good (iOS needs Mac) | Best (mature ad SDKs) |
| Built-in ads/IAP | Portal SDK only | Community plugins | Best (Unity Ads/LevelPlay) |
| Cost/royalties | $0 | $0, MIT, no royalties | Free <$200k; Pro ~$2,310/yr above |
| Polish ceiling | Limited on mobile | High for 2D | Very high |
| Long-term risk | Browser/portal dependence | Lowest (MIT) | Vendor terms change frequently |
| Best for | Cheap validation, web portals | Premium Steam, cost-free native | Competitive mobile F2P, console |

> ⚠️ **Unity Runtime Fee was CANCELLED September 12, 2024.** Unity Personal free up to $200,000 annual revenue/funding as of Unity 6 (Oct 2024). Unity Pro raised to ~$2,310/yr/seat Jan 2026. **VERIFY at unity.com before building a business on these terms — they have changed repeatedly.**

> Godot 2025 commercial hits: Brotato ($10.7M), Dome Keeper, Backpack Battles. Strong evidence for the 2D roguelite niche.

### 6.10 Recommended Roadmap (Bootstrapping Sequence)

| Stage | Actions & Gates |
|---|---|
| **Stage 0 — Now, $0** | Finish the game loop. Expand content (more enemies, more loot variety). Run the playtest checklist. Validate: is the core 30s fun? Is gather-bank tension or tedium? |
| **Stage 1 — Month 1–2, $0** | Publish on itch.io (PWYW or $3–5) + Newgrounds. Submit to Poki (use their prototype tool) and CrazyGames. Integrate rewarded-ad SDK stubs. Add Ko-fi. Post to r/incremental_games, r/WebGames, r/roguelites, TikTok clips. Enter a web game jam. **Gate:** 4+ min sessions, organically scaling plays. |
| **Stage 2 — When income starts** | Register şahıs şirketi. Claim genç girişimci exemption if eligible. Engage mali müşavir. Open Wise/Payoneer. File W-8BEN with every US payer. |
| **Stage 3 — After validation** | **IF Steam:** port to Godot, build to premium content bar, gather wishlists, pay $100 Steam Direct fee, consider indie publisher for marketing. **IF mobile F2P:** port to Unity for ad mediation — only if you can drive installs. **Do NOT port before the loop is proven.** |
| **Stage 4 — With audience** | Diversify: Ko-fi/GitHub Sponsors, non-exclusive HTML5 licenses ($500+), Telegram mini-app, DLC packs ($3–5 each: new class + enemy wave), consider publisher for Steam marketing muscle. |

---

## 7. Türkiye-Specific Practicalities

> **DISCLAIMER:** This is general information, not legal or tax advice. Consult a **mali müşavir** (Turkish accountant) and a lawyer for definitive guidance. Rules change frequently.

| Topic | Current Situation (2025–2026) |
|---|---|
| **Legal structure** | Şahıs şirketi (sole proprietorship): cheapest, fastest, standard start. Upgrade to Ltd/AŞ later if needed. |
| **Genç girişimci exemption** | 3-year income-tax exemption on profits up to **₺400,000 for 2026** (was ₺330,000 in 2025). Must be under 29 at first registration, no prior tax record. ⚠️ **1-year Bağ-Kur premium support ABOLISHED from Jan 1, 2026** (Law 7566) — 2026 entrants still get the income-tax exemption but must pay their own Bağ-Kur (~₺10,000–11,000/month). |
| **Software-export incentive** | **100% deduction** on income from software/services rendered to and used abroad (raised from 80% for 2026). Requires earnings repatriation to Turkey. Whether ad/portal revenue qualifies as a software export: confirm with accountant. |
| **VAT/KDV** | Exported software/services to foreign customers: generally KDV-exempt. Domestic sales: standard VAT. Income-tax exemption does NOT exempt from VAT obligations. |
| **US withholding / W-8BEN** | Apple, Google, Steam, US ad networks withhold **30% by default**. File **Form W-8BEN** (individual) to invoke the US–Turkey treaty (**10% cap on royalties**; 5% for some equipment). Enter T.C. kimlik number as foreign TIN. itch.io similarly defaults to 30% without valid TIN. |
| **PayPal** | Consumer money-transfer/receiving **UNAVAILABLE in Turkey since 2016**. Use **Wise or Payoneer** to receive USD/EUR, or direct bank wire. Ko-fi (pays to PayPal) is blocked for direct payout without workaround. |
| **Platform accounts** | Apple Developer: $99/yr — Turkish cards sometimes rejected, use Wise/Revolut/Payoneer virtual card. Google Play: $25 one-time. Steam: standard setup. GitHub Sponsors: requires Stripe — check current Turkey Stripe availability. |
| **TRY/forex** | Earnings arrive in USD/EUR; lira is volatile. Keep a foreign-currency account (Wise/Payoneer or TR FX account). Software-export incentive requires repatriation. |
| **US-Turkey treaty** | In effect. Royalties: 10% max withholding with W-8BEN filed. |

---

## 8. Outstanding Work & Next Steps

### 8.1 Immediate (do before any platform submission)
- Run the playtest checklist — validate gather-bank tension vs tedium and core 30s combat feel.
- Add tutorial / guided first run: highlight fire, remains, exposure, banking.
- Expand enemy variety: at least 2–3 new enemy types, additional boss phases or a second boss.
- Implement the Supporter Pack ($4–7): ad removal + cosmetic fire effects + starting embers.
- Replace ad/IAP stubs with a real lightweight SDK (CrazyGames or Poki rewarded ad hook for web).
- Verify top HUD no-overlap on common mobile device sizes.

### 8.2 Balance (from playtest)
- Enemy windup durations (grunt 0.34s, swift 0.24s, brute 0.5s, spitter 0.42s, boss 0.5s) — may make combat too kiteable.
- Wave composition and count per wave.
- Boss cadence (wave 8, then every 6).
- Death-spill rate (`DEATH_SPILL = 0.5`) and bank-trip danger vs reward.
- Ember earn rate (`floor(score/100)`), revive cost (`25+25*reviveCount`), ad earn (`+30`).

### 8.3 Systems Stubs / Deferred
- **Ember spend side:** almost entirely stubbed. Must either pay off (permanent unlocks, starting gear quality, extra perk roll, cosmetics) or be cut.
- Night-only enemy variants (referenced in design, not implemented).
- Satchel sorting UI.
- Ability-button customization (POS map exists, easy to expose).
- Dead CSS: `.classpick`/`.classcard` — safe to strip.

### 8.4 Content Roadmap for Steam
- 2–3 additional classes with unique passives and ability trees.
- 8–10 new enemy types (flying, burrowing, ranged variants, environmental hazards).
- 2+ biomes with thematic enemy/loot tables.
- Achievements, leaderboards, controller support polish.
- Additional equipment set themes and base item types.

---

## 9. Key Tuning Constants Reference

> All one-line changes. Listed with current values.

| Constant / Location | Current Value & Notes |
|---|---|
| `MAGNET_R` | 100 — radius (px) hero sweeps up loose remains |
| `BANK_R` | 46 — must stand within 46px of fire origin to unload |
| `DEATH_SPILL` | 0.5 — fraction of un-banked carry lost on death |
| `REMAINS_TTL` | 30 — seconds a loose remain lingers before fading |
| `TICK` (bank pour) | 0.06 — seconds between each chunk of the progressive pour |
| Chunk fraction | `carry*0.2` — portion poured per tick (tapers as carry empties) |
| `fireFeed` flare | `fireFeed*0.16` — how much the fire pool brightens during banking |
| `JOY_TOP` | 1.0 — max joystick speed as fraction of mouse top speed |
| `JOY_MAXR` | 58 — joystick thumb cap radius in CSS px |
| `diffMul` | `1 + (wave-1)*0.11` — global difficulty scaling per wave |
| Boss schedule | `wave>=8 && (wave-8)%6===0` — first boss wave 8, every 6 after |
| `lightR` | `min(460, 250+(level-1)*8)` — firelight radius grows with level |
| `INTERMISSION` | 13 — seconds between waves |
| Knight `attackRange` | 30 — base melee reach in px (+ enemy.r for effective reach) |
| Hitstop duration | `0.055s` in `meleeSwing` — the core of melee feel |
| Knockback (melee) | 28 — px shove on melee connect |
| Fire bed gain | `fireStr*0.03` — flame roar/hiss volume (very quiet by design) |
| Crackle pop peak | `(0.15+rand*0.24)*fireStr` — louder than the bed |
| Crackle gap | `(0.22+rand*0.48)/(0.22+fireStr*1.2)` — busier fire = more frequent |
| Cricket gain | `level*0.0275` — half the original volume |
| Rain ambient gain | `level*0.07` — half the original |
| Ground splat rate | `intensity*6.5` per frame — ~2.5× original |
| Set themed ratio | `0.6` in `rollItem` — 60% of drops are themed, 40% basic |
| Butterfly size | `1.8 + rand*0.83` |
| Firefly count | 6 (cap in spawn loop) |
| Butterfly count | 2 (cap in spawn loop) |
| Startle distance | 92px — hero within this triggers butterfly dart-and-flee |
| Flee burst speed | 235 px/s decaying at `-260*dt` — outruns the hero |

---

## 10. Working Style & Conventions

- **The developer is decisive and momentum-driven.** Prefer surgical `str_replace` edits over rewrites.
- **Always `view` the relevant file region immediately before editing** — previous line numbers are stale after any edit.
- **Always validate with a headless Node.js test harness** after non-trivial JS changes.
- The developer playtests on a real mobile device and reports issues with screenshots. If a screenshot is sent with no text, infer the fix from visible symptoms.
- Pure CSS changes can be presented without a headless test. All JS logic changes need one.
- When something is already correct, say so transparently and offer the lever rather than silently "fixing" it.
- `"and try"` means implement experimentally and note it as a tunable.
- The developer uploads modified builds periodically. Always `cp` the uploaded file to `/mnt/user-data/outputs/emberwatch.html` and verify it is fully current before continuing.
- **Canonical output file:** `/mnt/user-data/outputs/emberwatch.html`
- **Playtest checklist:** `/mnt/user-data/outputs/emberwatch-playtest-checklist.md`

### Headless Test Harness Pattern

```javascript
const fs = require('fs');
const code = [...fs.readFileSync("/mnt/user-data/outputs/emberwatch.html","utf8")
  .matchAll(/<script>([\s\S]*?)<\/script>/g)].map(x=>x[1]).join("\n");

const noop = () => {};
const grad = { addColorStop: noop };
const ctx2d = new Proxy({}, {
  get: (t,p) => String(p).includes("Gradient") ? () => grad : () => undefined,
  set: () => true
});

function fakeEl() {
  const o = {
    classList: { add:noop, remove:noop, toggle:noop, contains:()=>false },
    style: { setProperty: noop }, dataset: {},
    addEventListener: noop, appendChild: noop,
    querySelector: () => fakeEl(), querySelectorAll: () => [],
    onclick: null, offsetWidth: 0, getContext: () => ctx2d, width: 0, height: 0
  };
  Object.defineProperty(o,"innerHTML",{get(){return ""},set(v){}});
  Object.defineProperty(o,"textContent",{get(){return ""},set(v){}});
  return o;
}

// For audio tests — stub AudioContext with full fake graph
function FakeParam() {
  return { setValueAtTime:noop, exponentialRampToValueAtTime:noop,
           linearRampToValueAtTime:noop, setTargetAtTime:noop,
           cancelScheduledValues:noop, value:0 };
}
global.window.AudioContext = function() {
  return {
    currentTime: 0, sampleRate: 44100, destination: {},
    createOscillator: () => ({ type:"", frequency:FakeParam(), connect:noop, start:noop, stop:noop }),
    createGain: () => ({ gain: FakeParam(), connect: noop }),
    createBiquadFilter: () => ({ type:"", frequency:FakeParam(), Q:FakeParam(), connect:noop }),
    createBuffer: (c,n) => ({ getChannelData: () => new Float32Array(n) }),
    createBufferSource: () => ({ buffer:null, loop:false, connect:noop, start:noop, stop:noop }),
    createDynamicsCompressor: () => ({ connect:noop, threshold:FakeParam(), knee:FakeParam(),
      ratio:FakeParam(), attack:FakeParam(), release:FakeParam() }),
    resume: noop
  };
};

global.window = global;
global.devicePixelRatio = 1;
global.innerWidth = 900;
global.innerHeight = 600;
global.addEventListener = noop;
global.requestAnimationFrame = noop;
global.setTimeout = () => 0;
global.clearTimeout = noop;
global.matchMedia = () => ({ matches: false });
let T = 0;
global.performance = { now: () => T };
global.document = {
  getElementById: () => fakeEl(),
  createElement: () => fakeEl(),
  querySelector: () => fakeEl()
};

// For mobile detection:
// global.navigator = { maxTouchPoints: 5 };
// global.matchMedia = (q) => ({ matches: q.includes("coarse") || q.includes("hover: none") });

let err = null;
try {
  eval(code + `
    // your test code here — has access to all game functions and state
    startGame("ranger"); buildHotbar();
    function frame(){ T+=1000/60; G.paused=false; update(1/60); render(); }
    for(let i=0;i<60;i++) frame();
    console.log("loop ok");
  `);
} catch(e) { err = e; }
console.log(err ? ("ERROR: " + err.message + "\n" + err.stack.split("\n").slice(0,3).join("\n")) : "ALL OK");
```

**Key gotchas:**
- Put test code INSIDE the `eval` string (game functions are eval-scoped, not global).
- HEREDOC: use bare backticks in `<<'JS'` eval template literals — escaped `` \` `` becomes literal backslash-backtick → syntax error.
- `fakeEl()` style needs `setProperty`.
- `"died true"` is NOT a crash — only `ERROR`-printed uncaught exceptions matter.
- For audio assertions: provide `window.AudioContext` so `SFX.ensure()` creates `actx`.
- For crackle scheduler test: stub `setTimeout` as non-recursing to avoid infinite loop.
- Access DOM els via `document.getElementById` (auto-creates fakeEl), NOT bare variable names.

---

*End of Handout*

> *The campfire is at world origin (0, 0). Feed it.*

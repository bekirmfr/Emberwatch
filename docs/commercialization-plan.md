# EMBERWATCH — Commercialization Plan & MVP Spec

*Phased path from current prototype to revenue, with every integration sequenced behind a validation gate. Time budget to launchable MVP: 1–2 months focused. Companion to the Agent Handout and the compass research file.*

---

## 0. The Strategic Frame

The decision isn't *which* path — it's *what order*. Every later integration (mobile wrap, Steam port, exclusive licensing) is gated behind proof that the one before it earned its cost. We stay single-file HTML5 through the entire MVP because it is the only near-zero-cost channel that actually pays, and because porting before the loop is proven is weeks-to-months of solo effort against an unproven asset.

The MVP exists to answer three questions the code **cannot** answer on its own:

1. **Is the core 30 seconds fun?** (combat feel)
2. **Will players pay or watch ads?** (monetization willingness)
3. **Does it retain past run 3?** (the retention cliff)

Everything in the MVP spec below is justified by whether it helps answer one of those three. Anything that doesn't is cut or deferred.

### The honest gap

The current build is a strong *prototype*, not an MVP that can answer those questions. Against the code as it stands:

- **No telemetry exists at all.** We cannot measure session length, drop-off, or run-count without it. This is the single biggest missing piece — without it the launch produces vibes, not answers.
- **`watchAd()` is a 1.4-second `setTimeout` fake** and **`buyEmbers()` is a toast stub.** We cannot measure willingness-to-pay against placeholders.
- **No tutorial / guided first run.** The handout flags onboarding as high cognitive load; the retention-past-run-3 question is unanswerable if run 1 loses people before they understand banking.
- **Content floor is light** (6 enemies + 1 boss). Retention past run 3 needs enough novelty to survive three sittings.

The MVP is the prototype plus exactly the four things above — no more.

---

## 1. MVP Specification

> Principle: minimum that can *truthfully* answer the three questions. Scoped to 1–2 months solo, part-to-full time.

### 1.1 Must-have (the MVP is not launchable without these)

**A. Telemetry / analytics — answers Q3 (retention) and informs Q1**
- Lightweight, privacy-respecting event beacon (no PII; works within portal sandboxes). A self-hosted endpoint or a free tier of a product-analytics tool.
- **Minimum event set:** `run_start` (class), `run_end` (wave, level, kills, days, score, cause), `first_bank` (time-to-first-bank), `night_survived` / `night_death`, `level_up` (choice taken), `ad_offered` / `ad_completed`, `supporter_pack_viewed` / `purchased`, `session_start` / `session_end`.
- **Derived metrics the launch must produce:** average session length, runs-per-session, % reaching run 3, % surviving first night, ad opt-in rate, drop-off wave histogram.
- Must degrade silently if blocked (ad-blockers, sandbox) — never break the game.

**B. Real rewarded-ad integration — answers Q2 (willingness, ad side)**
- Replace the `watchAd()` stub's `setTimeout` with a real SDK callback. Target **CrazyGames or Poki rewarded-ad hook** (web-native, the channel we're launching on anyway).
- Keep the existing reward shape (+30 embers; revive; consider an extra loot-roll hook). These are the non-predatory touchpoints the research endorses.
- Instrument offer-vs-completion (event set above) so we measure *intent*, not just plays.

**C. Supporter Pack ($4–7) — answers Q2 (willingness, pay side)**
- Replace `buyEmbers()` toast with a real, minimal purchase: **ad-removal + a cosmetic fire effect + a starting-ember grant.** Non-predatory, fits the tone, low effort.
- On web this can route through itch.io's own purchase flow first (zero new SDK), with portal IAP as a Phase-2 upgrade. First-dollar signal matters more than payment polish.
- Instrument view → purchase funnel.

**D. Tutorial / guided first run — unblocks Q3 (retention) and Q1**
- A short, skippable first-run overlay that highlights, in sequence: **the fire (feed it), remains (carry them), exposure (don't stray at night), banking (stand close to unload).**
- This is net-new code (none exists). Keep it diegetic and light — the goal is to stop run 1 from losing people before the loop is legible, not a wall of text.

### 1.2 Should-have (materially improves the answers; include if time allows)

- **2–3 new enemy types** + a second boss or boss phase. Directly addresses the retention floor (Q3). The composable stat/enemy system makes this cheap.
- **First-three-minutes hook pass.** The research's hard rule for web: the opening must hook and *not kill* the player. Tune early wave composition and windups so run 1 is winnable-feeling.
- **Ember spend payoff (at least one).** Embers currently have almost nothing to spend on besides revive. One permanent unlock (e.g. starting-gear quality, extra perk roll) gives the meta-currency a reason to exist and feeds Q2.

### 1.3 Won't-have (explicitly out of MVP scope — defer)

- Engine port (Godot/Unity) — gated behind validation, Stage 3.
- Mobile store builds (WebView wrap or native) — Phase 2.
- Additional classes, biomes, achievements, leaderboards, controller polish — Steam-content-bar work, post-validation.
- Battle pass / seasonal / IAP catalog beyond the single Supporter Pack.
- Night-only enemy variants, satchel sorting, ability-button customization — nice-to-have, not answer-bearing.

### 1.4 MVP definition of done

The build is launchable when: telemetry fires the full event set and degrades silently; the rewarded-ad hook calls a real SDK; the Supporter Pack completes a real purchase; a new player can complete run 1 understanding the loop; and a headless harness run plus a real-device playtest both pass clean.

---

## 2. The Ultimate Path (Phased, Gated)

Each phase has a **gate** — a measurable signal that must be hit before spending effort or money on the next. The plan is web-first and additive: nothing is thrown away, each phase layers a new integration onto a validated base.

### Phase 0 — Build the MVP *(now → ~6 weeks, ~$0)*
Implement §1.1 must-haves (+ §1.2 if time). Validate every JS change with the headless harness; playtest on real device.
**Exit gate:** MVP definition-of-done met. Build is instrumented, monetization is real (not stubbed), run 1 is legible.

### Phase 1 — Free web validation *(Month 1–2 of launch, ~$0)*
- Publish immediately on **itch.io** (PWYW or $3–5) and **Newgrounds** — zero gatekeeping, first-dollar signal, community feedback.
- Submit to **CrazyGames and Poki**; integrate their SDKs (the ad hook is already built). Use **Poki's free prototype/playtest tool** for session data.
- Consider CrazyGames' **+50% for 2-month exclusivity** *only after* measuring non-exclusive reach. Note Poki's "Web Exclusive" model is a **seven-year** open-web exclusivity grant (100% on your traffic, 50% on Poki-referred) — read that term carefully before signing.
- Distribute: r/incremental_games, r/WebGames, r/roguelites, VS-like community, short-form clips, a Discord. Enter a web game jam for free homepage exposure.
- **Exit gate (the three questions, answered with data):**
  - Q1 *combat fun*: drop-off histogram shows people surviving past the first 30s; session length trending toward **4+ min average**.
  - Q2 *willingness*: non-zero ad opt-in rate **and** at least a trickle of Supporter Pack conversions.
  - Q3 *retention*: a meaningful % of players reach **run 3**, and organic plays scale rather than decay.

  If web retention is poor → **fix the loop, do not port.** Iterate or move on.

### Phase 2 — Business setup *(triggered the moment income starts, low cost)*
- Register **şahıs şirketi**; claim **genç girişimci** exemption if under 29 and never previously taxed (≈₺70,500 saved on ₺400k profit for 2026). Note the 1-year Bağ-Kur support is **abolished from Jan 1 2026** — budget ~₺10–11k/month for own premiums.
- Engage a **mali müşavir.** Open **Wise/Payoneer** (PayPal consumer receiving unavailable in TR since 2016). File **Form W-8BEN** (individual, T.C. kimlik as foreign TIN) with every US payer to cut withholding from 30% to treaty rates.
- *Disclaimer: general information, not tax/legal advice — confirm with a current mali müşavir.*

### Phase 3 — Commit to a platform *(only after Phase 1 gate passes)*
This is where the path forks based on *what the data said*:
- **If the validated audience is web/PC and willing to pay → premium Steam.** Port to **Godot** (free, MIT, best-in-class 2D, no royalties), build to the content bar (15–20+ enemies, multiple classes/biomes, 50+ hrs), gather **wishlists** pre-launch, pay the **$100 Steam Direct fee**, consider an indie publisher for marketing muscle. Reality check: ~40% of 2025 Steam releases didn't recoup $100; only ~8% grossed >$100k. Wishlists and marketing decide it, not the build.
- **If the validated signal is high-volume casual + ad tolerance → mobile F2P.** Port to **Unity** for ad mediation (Unity Personal free under $200k; Runtime Fee cancelled Sep 2024 — verify at unity.com) — but only if you can drive installs. Saturated and UA-dependent; treat as higher-risk.
- **Do not port before this gate.** A port is weeks-to-months with no guaranteed payoff.

### Phase 4 — Diversify *(once an audience exists)*
Layer on additional revenue without abandoning the base: **Ko-fi / GitHub Sponsors** (verify Stripe/TR availability), **non-exclusive HTML5 licenses** ($500+ each) or an **exclusive deal** ($2k–$5k), DLC packs ($3–5: new class + enemy wave), **Telegram Mini App / Discord Activity** as engagement channels. Keep the game closed-source unless community funding becomes a deliberate strategy.

---

## 3. What Would Change the Plan

- **Web retention poor →** fix the loop, don't port. The MVP did its job by telling you early and cheaply.
- **A portal offers a strong flat/exclusive license →** weigh guaranteed cash against uncertain rev-share; for an unknown game, a bird in hand is often right.
- **Unity changes terms again →** re-confirm Personal eligibility or favor Godot.
- **Cross ₺400k profit or $200k revenue →** revisit entity type and Unity licensing with the accountant.
- **Ad opt-in is healthy but Supporter Pack converts near zero (or vice-versa) →** that's a real answer to Q2 — lean the model toward whichever side the players actually chose.

---

## 4. Immediate Next Actions (Phase 0, this week)

1. **Telemetry first** — it gates the value of everything else. Pick the endpoint, wire the event set, confirm silent-degrade.
2. **Tutorial overlay** — net-new, biggest retention lever, unblocks Q3.
3. **Real rewarded-ad hook** — swap the `setTimeout` for the chosen portal SDK callback.
4. **Supporter Pack** — replace the `buyEmbers()` toast with a real minimal purchase.
5. (If time) 2–3 new enemies + first-three-minutes hook tuning.

Each JS change validated with the headless harness; each milestone playtested on device before moving on.

---

*The campfire is at world origin (0,0). The plan is: prove it's worth feeding before you spend to scale it.*

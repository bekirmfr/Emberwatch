# Commercializing a Solo-Built HTML5 Horde-Survivor from Türkiye: Full Path Analysis and Bootstrapping Roadmap

## TL;DR
- **Validate first, spend almost nothing: put the existing HTML5 build on free web portals (itch.io, Newgrounds) and submit to CrazyGames/Poki, because for an unknown game discoverability — not the engine — decides everything, and web portals are the only near-zero-cost path that actually pays.** Realistic first-game web earnings are roughly $500–$3,000/month at best and often far less (sub-€1 per 1,000 plays for low-engagement games).
- **Stay HTML5 until the core loop is proven; then port to Godot (free, MIT, best-in-class 2D) if you go premium on Steam or native mobile.** Choose Unity only if competitive mobile F2P (ad mediation) or console reach becomes the priority. Unity is free under Unity Personal up to $200,000 revenue, and the per-install Runtime Fee was cancelled on September 12, 2024.
- **In Türkiye, operate as a şahıs şirketi (sole proprietorship), use the genç girişimci income-tax exemption (₺400,000 of profit for 2026) if you are under 29, file a US W-8BEN to cut US withholding to treaty rates, and budget the unavoidable platform fees (Apple $99/yr, Google $25 once, Steam $100/app).** Consult a mali müşavir — this is general information, not tax advice.

## Key Findings

1. **Web portals are the only true bootstrap path.** They require no upfront fee, accept HTML5 directly, and monetize via ads with revenue share. But earnings for unknown games are modest, and curated portals (CrazyGames, Poki) may reject or ignore submissions on quality grounds. Your light content (6 enemies, 1 boss) and unvalidated balance are the real blockers, not the technology.
2. **The engine question is a sequencing decision, not a binary.** Your single-file vanilla-JS prototype is ideal for cheap validation. A port costs weeks-to-months of solo effort and only pays off once you're targeting paid Steam or competitive mobile. Godot is the rational 2D choice; Unity is the mobile-ads/console choice.
3. **Premium PC (Steam) is the highest-ceiling but not bootstrap-friendly path.** $100 Steam Direct fee per app, 30% cut, and brutal discoverability. The horde-survivor genre is proven (Vampire Survivors, Brotato, Megabonk) — and Vampire Survivors itself began as a free HTML5 (Phaser) itch.io game.
4. **Mobile F2P is crowded and ad-driven.** Wrapping HTML5 in a WebView/Capacitor is cheap but risks performance jank and store rejection; rewarded video is the best earner (eCPM $15–$30 in tier-1 markets, far lower globally). Turkey-heavy traffic earns low eCPMs.
5. **Crowdfunding/open-source funding for games is small and community-driven**; it works for established projects, not unknown prototypes. License choice (MIT vs GPL) materially affects whether you can later sell or relicense.
6. **Türkiye specifics are favorable for a young software exporter** but require a registered şahıs şirketi, an accountant, and correct US tax forms.

## Details

### 1. Web Game Portals / Aggregators — the bootstrap core

**How they work:** You upload an HTML5 build; the portal serves ads (preroll, interstitial, rewarded) via its SDK and shares ad revenue. No payment integration is needed. Curation ranges from open (itch.io, Newgrounds) to tightly curated (Poki releases ~1 game/day; CrazyGames QA-reviews every submission).

**Revenue-share specifics (sourced):**
- **CrazyGames:** Does not publish a universal split. Its developer terms deduct "Direct Game-related Costs… fixed at 20 percent" off the top before the developer's share. A documented **60/40 (dev/CrazyGames) ad split and 70/30 IAP split** exists for its GameMaker Web Jam program (after cost recoup) — treat as program-specific, not a guaranteed universal default. **Confirmed +50% revenue-share bonus** for 2 months of timed exclusivity if you implement the full SDK, allow distribution to other portals, and let CrazyGames host. Payout monthly, €100 minimum, via Tipalti (wire/PayPal).
- **Poki:** Two-tier attribution model. Under Poki's official SDK documentation's "Web Exclusive" model, you grant seven-year exclusivity on open-web browser platforms (including Discord and YouTube Playables) in exchange for "generous revenue splits (100% on direct searches, 50% on Poki referrals)" — i.e., **you keep 100% of earnings from players you bring (search, direct, your community) and 50% from players Poki brings.** Ad-based; no payment integration. A flat non-exclusive license fee is offered as an alternative (amount unpublished).
- **GameDistribution:** **33% of Net Revenue** to the developer (per its Developer Game License Agreement). NET-60 payout, €100 minimum.
- **GameMonetize:** **45% per role; 45%+45% = 90%** if you are both developer and publisher. NET-30, $30 minimum, PayPal/USDT. Quotes "$1.5–$3 per 1,000 ad views."
- **itch.io:** You set the platform cut 0–100% (default 10%); you keep the rest minus payment-processor fees (~2.9% + $0.30). Best as a free-hosting/community/demo channel and a storefront if you later sell a premium build.
- **Newgrounds:** Free hosting, community exposure, modest ad revenue sharing; excellent for the action/roguelite audience with zero gatekeeping.

**Realistic earnings for an unknown new game:** A Poki representative quoted a realistic range of **"$500 to $3,000 per month" for a first web game** (genre/update-dependent, a forward-looking estimate). Concrete developer postmortems are sobering: one dev's WebGL portfolio earned roughly **€0.75–€1.05 per 1,000 gameplays** on low-engagement titles ("In terms of cash? NO! It's a big fail."). GameMonetize's "$1.5–$3 per 1,000 ad views" is per ad-view, not per play, so real per-play revenue is lower. Top performers reportedly scaled from $50k to $1M/year (Dutch Games Association 2024 data) — the ceiling, not the median. A Turkish studio (Emolingo Games) grew from two people to five full-time entirely on Poki revenue (Rainbow Obby, 100M+ plays), showing the catalog-strategy upside.

**Implication:** Web portals validate the loop, generate first dollars, and provide free playtesting data (Poki's prototype tool, CrazyGames' feedback). They are the correct first move. Horde-survivors with strong retention and short sessions fit the casual web audience, but the "first three minutes must hook (and not kill) the player" rule matters.

### 2. Mobile Free-to-Play (iOS / Google Play)

**Two routes:**
- **Wrap the HTML5 (Capacitor/Cordova/WebView):** Cheapest. But Android WebView performance is materially worse than Chrome ("you should not expect WebView to perform equivalently to Chrome"), causing jank that hurts a real-time action game. Store quality bars and the risk of "minimal-functionality" rejection (especially Apple) are real.
- **Port to a native engine (Unity/Godot):** More effort but far better performance, native ad SDKs, and IAP. Unity is the mobile-ads leader.

**Ad networks & earnings:** Rewarded video is the top earner — **eCPM $15–$30 in tier-1 markets (US ~$30 on iOS), but only ~$2–$4 in emerging markets**. Banners earn under $1. AppLovin and Google AdMob together hold ~half the market; Unity Ads/LevelPlay, ironSource, and Mintegral follow. Turkey-heavy traffic earns low eCPMs, so a global audience matters.

**Costs:** Apple Developer Program **$99/year**; Google Play **$25 one-time**. Both withhold US tax unless you file W-8BEN. Google now requires more testing rigor (closed testing with real testers before production for new personal accounts).

**Market reality:** The horde-survivor mobile market is saturated and dominated by well-funded publishers (Vampire Survivors' own free-to-play mobile version exists). An unknown solo F2P entrant faces near-impossible organic discovery without user-acquisition spend — which contradicts bootstrapping. Mobile is a "later, maybe" path, not a first step.

### 3. Premium PC Distribution (Steam, itch.io, Epic, GOG)

- **Steam:** $100 Steam Direct fee per app (recoupable after $1,000 gross revenue), 30% cut (drops to 25%/20% only at $10M/$50M — irrelevant for you). The bar: a paid roguelite needs substantial content and polish. **Per Gamalytic data flagged by Soulash developer Artur Smiarowski (Oct 20, 2025), of an estimated 12,732 Steam releases in 2025, "40% didn't see a return on their $100 release cost," only "8% of the releases are estimated to have grossed over $100k," 8,388 (65.9%) earned under $1,000, and 47.4% sold fewer than 100 copies.** Wishlists and pre-launch marketing are decisive.
- **The genre is proven on Steam:** Vampire Survivors (its solo dev Luca "poncle" Galante built it in the HTML5 Phaser framework and released it free on itch.io on March 31, 2021, having spent only ~£1,100 on assets — he later rebuilt it in a standard engine for performance, noting "It is very common for people to underestimate what you can do with HTML5"); Brotato; 20 Minutes Till Dawn; and **Megabonk** (solo dev Vedinad, released Sept 18, 2025, built in Unity at $9.99, **sold over 1 million copies in two weeks**, peaking at 117,336 concurrent players). This validates demand but signals intense competition and high player expectations.
- **HTML5-wrapped vs native on Steam:** Vampire Survivors shipped initially as an HTML5/Electron wrap, then deliberately **re-built in an "industry-standard engine" for performance**. A wrapped build can technically ship on Steam, but for a paid product a native engine port is strongly advisable for performance, controller support, and polish.
- **itch.io** (premium): 0–100% dev-set cut; good for a cheap paid demo or early-access build with no gatekeeping. **Epic/GOG** are curated and less essential early.

### 4. Open-Source + Crowd/Community Funding

- **Platforms:** GitHub Sponsors (0% fee, needs Stripe), Ko-fi (0–5%, pays direct to PayPal/Stripe), Buy Me a Coffee (5%), Patreon (~8–12%), Open Collective, Liberapay, itch.io donations, Kickstarter/IndieGoGo.
- **Reality:** Donations follow an existing audience and a compelling story; an unknown prototype raises little. Crowdfunding campaigns need an existing community and a polished pitch. This is a *supplement* once you have a Discord/following, not a launch strategy.
- **License choice:** **MIT** (permissive) lets you and others reuse/relicense freely — best if you may later sell or dual-license. **GPL/AGPL** (copyleft) forces derivatives open — protects against closed clones but complicates commercial relicensing and some store/SDK integrations. **Open-core** (open client, paid content/server) is the pragmatic monetization-friendly model. Because all your assets are procedurally generated with no third-party licenses, you have full freedom to choose. For a commercial bootstrap, keep the game **closed-source** (or open the engine under a non-commercial license while keeping content proprietary); open-source mainly helps if community contribution/funding is the deliberate goal.

### 5. Licensing / Selling the Game or IP

- **Non-exclusive HTML5 license:** ~$500 typical; sold repeatedly to multiple portals/sites.
- **Exclusive license:** $2,000–$5,000 typical; subscription deals $20–$50/month/game.
- **Marketplaces:** CodeCanyon (sells HTML5 game source/templates), HTML5GameDevs forum, GameDistribution/GameMonetize broker networks, Genieee.
- **Caveat:** Quality matters; low-tier publishers may pay "$2 for the whole deal." Reskins/white-labeling are a real cottage industry for simple casual games; a content-rich horde-survivor is less of a reskin target but more attractive as a one-off license.
- **Indie publishers** (for Steam) can fund/market in exchange for a revenue cut — viable only once you have a polished vertical slice.

### 6. Other / Emerging Paths

- **Discord Activities:** Embedded HTML5 apps; Discord takes 10% of IAP (dev keeps 90%). **But Server Subscriptions/monetization are US-only**, a hard blocker for a Turkey-based solo dev wanting direct Discord payments. Activities can still drive engagement.
- **Telegram Mini Apps / Games:** HTML5-native, 0% store fee, viral distribution, TON wallet payments; rewarded ads via AppLixir/Monetag. Real but crypto-adjacent and faddish; meaningful revenue needs thousands of DAU.
- **Web3/crypto:** High skepticism warranted — high acquisition costs, regulatory/reputational risk, and Turkey crypto-payment restrictions. Not recommended.
- **Subscription/bundle platforms** (e.g., itch.io bundles): minor supplementary exposure.
- **Game jams as marketing:** High-value, near-zero-cost. CrazyGames and others run jams with prizes and guaranteed homepage exposure; jams build audience and feedback.

### Engine-Choice Analysis (HTML5/JS vs Godot vs Unity)

**Stay HTML5/JS (current state):**
- *Effort:* zero — already working.
- *Reach:* web instantly; mobile only via WebView wrap (janky); Steam only via Electron wrap (suboptimal).
- *Cost:* $0.
- *Polish ceiling:* limited for action games on mobile WebView; fine in desktop browsers.
- *Monetization:* portal SDKs only; no native mobile ad/IAP maturity.
- *Best for:* cheap validation, web portals, the immediate next 1–3 months.

**Port to Godot 4.x (free, MIT):**
- *Effort:* moderate; GDScript is Python-like and fast to learn; 2D is first-class. Rebuilding a working prototype is faster than greenfield because the design is settled.
- *Reach:* Windows/Mac/Linux, Android, iOS (iOS export needs a Mac for signing), and web export (HTML5 export works but has known size/threading caveats). Console requires third-party porting houses.
- *Cost:* $0, no royalties, no revenue threshold — ideal for bootstrapping and aligned with any open-source ambition.
- *Polish ceiling:* excellent for 2D horde-survivors; tiny build sizes; proven commercial hits (Brotato $10.7M, Dome Keeper, Backpack Battles all on Godot).
- *Monetization:* ad/IAP via community plugins (less turnkey than Unity); fine for premium Steam.
- *Best for:* a premium Steam build and/or a cost-free native path.

**Port to Unity 6 (Unity Personal free under $200k):**
- *Effort:* higher API surface; C#; 2D sits on a 3D engine.
- *Reach:* the broadest single-codebase deployment — Windows/Steam, iOS, Android, WebGL, and official console SDKs. Best mobile profiling and the deepest ad-network ecosystem (Unity Ads/LevelPlay, AppLovin, AdMob, ironSource).
- *Cost:* **Unity Personal free up to $200,000 annual revenue/funding**; splash screen optional in Unity 6; the per-install **Runtime Fee was cancelled September 12, 2024** under CEO Matt Bromberg — per Unity's blog, "Unity Personal will remain free, and we'll be doubling the current revenue and funding ceiling from $100,000 to $200,000 USD" (effective with Unity 6 on Oct 17, 2024). Above $200k you need Unity Pro (raised 8% to $2,200/seat from Jan 1, 2025; reported at $2,310/yr/seat after a further Jan 2026 increase). **Flag: Unity's terms have changed repeatedly — verify against unity.com before committing.**
- *Polish ceiling:* very high; best mobile optimization on low-end Android.
- *Best for:* serious mobile F2P with ad mediation, or console ambitions.

**Recommendation on engine:** **Stay HTML5 now to validate cheaply on web portals. If validation succeeds and you target paid Steam, port to Godot** (free, best 2D, no revenue share, ideal for a bootstrapper). **Choose Unity only if your validated path is competitive mobile F2P** (where its ad-mediation and mobile optimization justify the heavier workflow) or you want console. Do not port before the loop is proven — a port is weeks-to-months of solo effort with no guaranteed payoff.

### Türkiye-Specific Practicalities

- **Legal structure:** A **şahıs şirketi (sole proprietorship)** is the cheapest, fastest entity and the standard starting point; you can register via the digital tax office. Limited/anonim şirket only later if scale/liability warrants.
- **Genç girişimci (young entrepreneur) exemption:** If under 29 at first registration and never previously a taxpayer, you get a **3-year income-tax exemption on profits up to ₺330,000 (2025), rising to ₺400,000 for 2026** (a young entrepreneur earning ₺400,000 saves roughly ₺70,500 in income tax). **Important change:** the accompanying 1-year Bağ-Kur premium support was **abolished from January 1, 2026** (Law 7566, Dec 19, 2025) — 2026 entrants still get the income-tax exemption but must pay their own Bağ-Kur premiums (estimated ~₺10,000–11,000/month).
- **Software-export incentive:** Income from software services rendered to and used abroad qualifies for a deduction — **raised to 100% of such earnings from January 1, 2026** (was 80%), conditional on repatriating the earnings to Türkiye. This can stack with the genç girişimci exemption. Whether ad revenue from foreign portals qualifies as a software/service export should be confirmed with your accountant.
- **VAT/KDV:** Exported software/services to foreign customers are generally **KDV-exempt**; domestic sales carry standard VAT. The income-tax exemption does **not** exempt you from VAT obligations.
- **US withholding / treaty:** Apple, Google, Steam, and US ad networks withhold US tax on US-sourced income unless you file **Form W-8BEN (individuals)**. The US–Türkiye treaty caps **royalty withholding at 10%** (5% for certain equipment). Without the form, the default is **30%**. As a Türkiye individual you enter your T.C. kimlik number as the foreign TIN and file W-8BEN (not W-8BEN-E). itch.io similarly defaults to 30% without a valid TIN.
- **Receiving money:** Most platforms pay via wire/PayPal/Payoneer/Wise. **PayPal's consumer money-transfer/receiving service has been unavailable in Türkiye since 2016**, so many Turkish devs use **Wise or Payoneer** to receive USD/EUR, or direct bank wire. Ko-fi (pays to PayPal/Stripe), GitHub Sponsors (Stripe), and Patreon availability depend on Stripe/PayPal access — verify current Stripe/Turkey status. Apple often rejects some Turkish cards for the $99 fee; a Wise/Revolut/Payoneer virtual card is the common workaround.
- **TRY vs USD/forex:** Earnings arrive in USD/EUR; given lira volatility, keeping a foreign-currency account (Wise/Payoneer or a TR FX account) and converting as needed is prudent. Note the software-export incentive requires repatriation to Türkiye.
- **Disclaimer:** This is general information, not legal or tax advice. Consult a Turkish **mali müşavir** and, for contracts/IP, a lawyer.

### Comparison Table — Monetization Paths

| Path | Upfront cost | Effort | Legal complexity | Realistic revenue (unknown game) | Time-to-first-$ | IP implications |
|---|---|---|---|---|---|---|
| Web portals (Poki/CrazyGames/itch/Newgrounds) | ~$0 | Low (upload) | Low | $500–$3,000/mo at best; often far less | Weeks–months | You keep IP; non-exclusive |
| Aggregators (GameDistribution/GameMonetize) | $0 | Low | Low | Low ($1.5–$3/1,000 ad-views; 33–90% share) | ~1 month | You keep IP |
| Mobile F2P (WebView wrap) | $99 + $25 | Medium | Medium | Low without UA spend | 1–2 months | You keep IP |
| Mobile F2P (engine port) | $99 + $25 + port time | High | Medium | Low–moderate; crowded | Months | You keep IP |
| Premium Steam | $100/app + port time | High | Medium | Bimodal: ~40% don't recoup $100; top 8% >$100k | Months | You keep IP |
| Open-source/crowdfunding | $0 | Medium | Low | Minimal until audience exists | Months+ | License-dependent |
| Licensing/selling source | $0 | Low–Medium | Medium (contracts) | $500 non-excl; $2k–$5k excl per deal | Weeks | You may transfer/limit rights |
| Discord/Telegram/web3 | $0 | Medium | Medium–High | Niche; Discord payouts US-only | Months | You keep IP |

### Comparison Table — Engine Options

| Factor | HTML5/JS (stay) | Godot 4.x | Unity 6 |
|---|---|---|---|
| Porting effort (solo, from JS) | None | Moderate (GDScript easy) | Higher (C#) |
| 2D suitability | Good (canvas) | Excellent (native 2D) | Good (2D on 3D) |
| Web export | Native | Good (size/threading caveats) | Heavy WebGL builds |
| Windows/Steam | Via Electron wrap | Excellent | Excellent |
| iOS / Android | Via WebView (janky) | Good (iOS needs Mac) | Best (mature) |
| Built-in ads/IAP | Portal SDK only | Community plugins | Best (Unity Ads/LevelPlay etc.) |
| Controller support | Manual | Good | Excellent |
| Cost / royalties | $0 | $0, MIT, no royalties | Free <$200k; Pro ~$2,310/yr/seat above |
| Polish ceiling | Limited on mobile | High for 2D | Very high |
| Long-term risk | Browser/portal dependence | Lowest (MIT) | Vendor terms can change |

## Recommendations (staged, lowest-cost-first)

**Stage 0 — Finish the game loop (now, ~$0).** Discoverability and quality, not the build, decide success. Before any spend: expand content (more enemies/bosses/items), validate balance with real playtesters, and tighten the critical first-three-minutes hook. Keep it single-file HTML5.

**Stage 1 — Free validation on web (Month 1–2, ~$0).**
- Publish immediately on **itch.io and Newgrounds** (zero gatekeeping, community feedback).
- Use **Poki's free prototype/playtest tool** and **CrazyGames' feedback** to get session-length and drop-off data.
- Submit to **CrazyGames and Poki**; integrate their SDKs (the rewarded-ad hooks you already stubbed). Consider CrazyGames' **2-month exclusivity for +50%** only after testing non-exclusive reach.
- Post devlogs to **r/incremental_games, r/WebGames, r/roguelites**, the Vampire-Survivors-like community, TikTok/short-form clips, and a Discord. Enter a **game jam** for free exposure.
- **Benchmark to advance:** strong retention/session metrics (e.g., 4+ minute average sessions like CrazyGames' better performers) and meaningfully scaling organic plays. If web earnings approach the $500–$3,000/mo range or plays scale steadily, the loop is validated.

**Stage 2 — Set up the business (triggered when income starts, low cost).**
- Register a **şahıs şirketi**; claim **genç girişimci** exemption if eligible; engage a **mali müşavir**.
- Open **Wise/Payoneer** to receive USD/EUR; file **W-8BEN** with every US payer.

**Stage 3 — Decide the engine and platform (only after validation).**
- **If targeting premium Steam:** port to **Godot**, build a content-rich paid version, gather **wishlists** pre-launch, pay the **$100 Steam Direct fee**, and consider an indie publisher for marketing. Threshold to commit: a validated, fun loop plus an audience/wishlist base.
- **If targeting mobile F2P:** port to **Unity** for ad mediation — but only if you can drive installs (organic virality or modest UA). Given saturation, treat as higher-risk.
- **Do not port** if web validation is weak — iterate or move on instead.

**Stage 4 — Diversify (once you have an audience).** Add **Ko-fi/GitHub Sponsors**, sell **non-exclusive HTML5 licenses** ($500+) or an **exclusive deal** ($2k–$5k), and explore **Telegram/Discord Activities** as engagement channels. Keep the game closed-source unless community funding becomes a deliberate strategy.

**What would change the plan:** If web retention is poor → fix the loop, don't port. If a portal offers a strong exclusive/flat license → take guaranteed cash over uncertain rev-share. If Unity changes its terms again → re-confirm Personal eligibility or favor Godot. If you cross ₺400k profit or $200k revenue → revisit entity type and Unity licensing with your accountant.

## Caveats
- **Revenue figures are estimates.** The "$500–$3,000/month" first-game range is a Poki rep's forward-looking estimate; real postmortems show much lower (sub-€1 per 1,000 plays). Portals deliberately keep exact splits opaque (CrazyGames' universal % is unpublished; the 60/40 figure is jam-specific).
- **Unity's pricing has changed repeatedly.** The Runtime Fee cancellation and $200k Personal threshold are current as of 2024–2026 but must be verified at unity.com before you build a business on them.
- **Turkish tax law is changing fast** (genç girişimci Bağ-Kur support abolished for 2026; software-export deduction raised to 100% for 2026). Figures (₺330k/₺400k) and rules require confirmation with a current mali müşavir.
- **Platform terms (fees, withholding, payout methods) shift** and vary by country; PayPal/Stripe availability in Türkiye in particular should be re-checked.
- **The horde-survivor market is saturated**; genre fit is proven but competition is fierce. Marketing and content depth, not the engine, are the deciding factors.
# GHOSTPROTOCOL: FOOLPROOF EXECUTION PLAN
**Project:** GhostProtocol — The Post-Human Sovereign Executor  
**Track:** NEAR Hackathon Track 13: Open Innovation (Uncharted Frontier) + Multi-Track Alignment  
**Target:** Production-Grade Testnet Demo + 3-Minute High-Impact Submission Video  
**Status:** LOCKED & APPROVED  

---

## 1. System Invariants & Anti-Hallucination Ground Rules

1. **Deterministic Smart Contract as Supreme Authority:** The NEAR smart contract controls state transitions and MPC authorization. The AI agent has **zero authority** to touch funds or release key shares while `block_timestamp <= last_heartbeat + timeout`.
2. **Client-Side Cryptography (Zero-Knowledge Estate):** Private notes, cold seeds, and private instructions are encrypted client-side using **AES-256-GCM (PBKDF2)**. Plaintext never touches servers or smart contracts.
3. **Dual-Share Key Split:**
   * **Share A:** Stored in the NEAR contract state (released to beneficiary only post-expiry).
   * **Share B:** Retained by the beneficiary (issued via QR/emergency invite during setup).
   * Decryption requires $\text{Share A} \oplus \text{Share B}$.
4. **Zero-Deadlock Demo Fallbacks:**
   * If real Telegram credentials or external RPCs are absent, auto-switch to a simulated Telegram webhook feed and local mock NEAR client so live execution never stalls.
   * If LLM API keys are unconfigured, fall back gracefully to a deterministic heuristic rule engine with complete reasoning telemetry.

---

## 2. The Behavioral Twin & Trader DNA Architecture

### 2.1 While Alive: Capturing the Owner's "Trader DNA"
The system captures the owner's risk profile through two vectors:
1. **Interactive Risk & Behavioral Calibration (Vault UI):**
   * **Drawdown Tolerance:** Low (panic at $-5\%$), Medium (rides $-20\%$), Degen (diamond-hands $-50\%$).
   * **Exit Discipline:** Sudden market dump vs. gradual Time-Weighted Average Price (TWAP) exit vs. trailing stop-loss.
   * **Leverage & Asset Affinity:** Maximum allowable leverage, preferred hedge instruments (e.g., never short BTC, always hedge with ETH delta-neutral shorts).
2. **The Trader DNA Matrix (Vector Representation):**
   ```json
   {
     "trader_dna": {
       "archetype": "Patience-Disciplined Swing Hedger",
       "max_slippage_tolerance_pct": 0.3,
       "unwind_strategy": "TWAP_VOLATILITY_ADAPTIVE",
       "panic_dump_threshold_rsi": 25,
       "perp_action": "CLOSE_ON_REBOUND_OR_TRAILING_STOP",
       "preferred_reserve_asset": "USDC",
       "risk_vector": [0.35, 0.70, 0.20, 0.85]
     }
   }
   ```

### 2.2 Post-Mortem Takeover: The Hybrid Ghost Brain
When the owner passes, the agent does **not** blindly dump assets into red candles or make generic AI trades. It executes via a **dual-engine decision loop**:
1. **The Persona Mimic (Owner Alignment):** Adheres strictly to the owner's philosophical boundaries:
   * *"The owner never sells into an oversold RSI $< 30$. Wait for 15-minute mean reversion before unwinding ETH longs."*
   * *"The owner preferred trailing stops with $2.5\%$ cushion."*
2. **The Tactical Combat AI (Market Defense):** Protects the estate from live predatory market dynamics:
   * Defends against MEV sandwich attacks via Private RPC / NEAR Intents.
   * Monitors perpetual funding rates (if funding is deeply negative, wait for shorts to pay out before closing).
   * Synthesizes decisions via LLM (Gemini 2.5/Flash) generating structured rationale logs before every onchain transaction.

---

## 3. Proof-of-Absence & Escalation State Machine

1. **Tier 1 (Passive Heartbeat):** Normal Telegram chats, vault opens, or onchain transactions trigger `ping_heartbeat()` on NEAR, continually pushing the expiration timestamp forward.
2. **Tier 2 (Grace Period / Escalation):** When timer drops below critical threshold ($10\text{s}$ in demo / $7\text{ days}$ in production), Python Watchman sends emergency alerts with a quick-reply `/alive` button.
3. **Tier 3 (Onchain Lockout):** If timer hits `00:00`, smart contract logic enforces:
   $$\text{block\_timestamp} > \text{last\_heartbeat} + \text{timeout}$$
   The contract transitions to `GHOST_AWAKE` and unlocks the agent's restricted permissions.

---

## 4. Asset Liquidation & Beneficiary Payout Routing

1. **Perp & Position Unwinding via NEAR Chain Signatures (`v1.signer`):**
   * External chain wallets (Arbitrum, Solana, Ethereum, Hyperliquid) are controlled through NEAR's root MPC key.
   * Agent requests MPC signatures from the NEAR contract to close perps, claim yields, and withdraw LP positions back to the root address.
2. **Consolidation via NEAR Intents (Solver Bus):**
   * The Agent publishes a cross-chain `token_diff` intent to the Solver Bus:
     $$\text{In: [Arbitrum ETH, Solana SOL, NEAR]} \longrightarrow \text{Out: [Unified USDC]}$$
   * Professional Solvers fulfill the trade atomically with minimal slippage and zero bridge risk for the heir.
3. **Delivery to the Beneficiary:**
   * **Lump-Sum Delivery:** Immediate transfer of consolidated USDC to `beneficiary.near` or `0xBeneficiary...`
   * **Programmable Trust Fund Stream:** Pours funds into an automated streaming contract (e.g., \$2,500 USDC on the 1st of every month).
4. **Legacy Note Decryption:**
   * The smart contract releases **Key Share A** to the beneficiary.
   * Beneficiary combines **Key Share A** + pre-held **Key Share B** in the Vault UI:
     $$\text{Share A} \oplus \text{Share B} \longrightarrow \text{AES-256-GCM Master Key}$$
   * Decrypts the deceased owner's final letter, cold-storage master seed, and off-chain passwords directly in the browser.

---

## 5. Complete Project File Tree

```
GhostProtocol - NEAR/
├── FOOLPROOF_PLAN.md              # Single source of truth & architectural contract
├── contracts/                     # NEAR Smart Contract (Rust)
│   ├── Cargo.toml
│   └── src/
│       └── lib.rs                 # State machine, heartbeat timer, MPC delegation, Trader DNA storage
├── agent/                         # Python Autonomous Ghost Executor
│   ├── requirements.txt
│   ├── config.py                  # Endpoints, testnet keys, demo overrides
│   ├── ghost_agent.py             # Main coordinator loop
│   ├── telegram_listener.py       # Telethon / Pyrogram userbot + simulated web fallback
│   ├── trader_dna_engine.py       # Mimicry algorithm + Persona weighting
│   ├── combat_reasoner.py         # Gemini API market analysis (RSI, volatility, orderbook)
│   └── near_intents.py            # Solver Bus intent generator & simulator
├── frontend/                      # Cyberpunk Scarlet Command Center
│   ├── package.json
│   ├── vite.config.ts
│   ├── tailwind.config.js
│   └── src/
│       ├── components/
│       │   ├── CountdownHUD.tsx   # Live circular countdown (15s demo / real toggle)
│       │   ├── TraderDNASetup.tsx # Risk profiler & behavior questionnaire
│       │   ├── VaultEncryptor.tsx # Client-side AES-256-GCM note encryptor & key-splitter
│       │   ├── GhostTerminal.tsx  # Monospace live terminal showing AI thoughts & intent fills
│       │   ├── BeneficiaryClaim.tsx # Heir recovery view (Share A + Share B decryptor)
│       │   └── NetworkHUD.tsx     # NEAR Testnet status & contract state watcher
│       ├── lib/
│       │   ├── crypto.ts          # WebCrypto AES-GCM, PBKDF2, split-key XOR logic
│       │   └── near.ts            # NEAR API JS connection & contract calls
│       └── App.tsx
└── scripts/
    ├── build_contract.bat / .sh
    ├── deploy_testnet.bat / .sh
    └── run_demo.ps1               # 1-click demo orchestrator
```

---

## 6. Phase-by-Phase Roadmap

* **Phase 1: NEAR Smart Contract Core (`contracts/`)**  
  Implement the state machine, heartbeat timer, `assert!` security guardrails, Trader DNA storage, and payout routing.
* **Phase 2: Client-Side Vault & Key Splitter (`frontend/src/lib/crypto.ts`)**  
  Implement WebCrypto AES-256-GCM note encryption and XOR dual-share key splitting.
* **Phase 3: Trader DNA Mimicry & AI Combat Reasoner (`agent/`)**  
  Implement the Python engine: risk profiling, Telegram warning trigger, Gemini market analysis, and NEAR Intent builder.
* **Phase 4: Cyberpunk Frontend Dashboard (`frontend/`)**  
  Build the UI in Obsidian Black (`#0A0A0C`) with Scarlet Red (`#FF2A4D`) accents: HUD countdown, live AI thought stream, and Beneficiary Claim portal.
* **Phase 5: End-to-End Test & 3-Minute Demo Sequence**  
  Validate the complete 15-second takeover demo flow and verify all edge cases.

---

## 7. Demo Verification Criteria

| Step | Expected Result |
| :--- | :--- |
| **1. Vault Lock** | Note encrypted client-side with AES-256-GCM; Share A stored on NEAR, Share B saved by heir |
| **2. Active Countdown** | 15s timer ticks down; user ping resets to 15s |
| **3. Warning Trigger** | At 10s or 5s, Telegram alert pops: "Heartbeat critical. Reply /alive" |
| **4. Ghost Awakens** | At 00:00, contract status turns `GHOST_AWAKE`; agent takes over with Trader DNA mimicry |
| **5. Market Combat AI** | Agent evaluates RSI/funding rates, logs reasoning, submits Intent swap to USDC |
| **6. Heir Settlement** | USDC balance streams/settles to beneficiary, Share A released, note decrypted live |

# Project Map

## Purpose
GhostProtocol: Autonomous Post-Human Sovereign Executor on NEAR that activates upon cryptographic Proof-of-Absence, mimicking the deceased owner's exact trading behavior (Trader DNA) to safely unwind leveraged perps and consolidate cross-chain assets into USDC via NEAR Intents.

## Components
- `contracts/src/lib.rs`: NEAR smart contract enforcing heartbeat countdown, key share lock, and payout routing.
- `agent/trader_dna_engine.py`: Behavioral telemetry extraction engine (archetypes, risk vectors, trading habits).
- `agent/combat_reasoner.py`: OpenRouter LLM combat engine (`inclusionai/ling-3.0-flash`) synthesizing Trader DNA with live market conditions.
- `agent/near_intents.py`: NEP-413 Solver Bus payload builder for atomic cross-chain swaps.
- `agent/ghost_agent.py`: FastAPI & WebSocket daemon synchronizing live trade telemetry, timer, and takeover execution.
- `frontend/src/components/TradingTerminal.tsx`: TradingView charting, Perp/Spot/Futures order form, active positions table, NEAR Testnet token selector, and Atomic Batch NearBlocks links.
- `frontend/src/lib/nearTestnet.ts`: Hybrid Ed25519 testnet session manager, live RPC balance fetcher, testnet faucet relayer, and atomic 2-action batch transaction builder (`near-api-js`).
- `frontend/src/components/VaultEncryptor.tsx`: Client-side WebCrypto AES-256-GCM dual-share key splitter.
- `frontend/src/components/BeneficiaryClaim.tsx`: Heir decryption portal.

## Data and Trust Boundaries
- Plaintext legacy notes NEVER touch server or contract (zero-knowledge client-side encryption).
- Proof-of-Life is strictly deterministic on NEAR (`assert!(now > last_heartbeat + timeout)`).
- AI agent has ZERO authorization to touch funds or release keys while owner is alive.

## Build and Verification
- Frontend: `cd frontend && npm.cmd run build`
- Python Agent: `cd agent && python ghost_agent.py`
- Contract: Rust `cargo check` / unit tests

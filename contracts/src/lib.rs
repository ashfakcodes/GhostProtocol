use near_sdk::json_types::U128;
use near_sdk::{env, near, require, AccountId, Gas, NearToken, PanicOnDefault, Promise, PromiseOrValue};
use std::collections::HashMap;

const DEFAULT_MPC_SIGNER: &str = "v1.signer-prod.testnet";
const MPC_GAS: Gas = Gas::from_tgas(250);
const FT_TRANSFER_GAS: Gas = Gas::from_tgas(30);
const CALLBACK_GAS: Gas = Gas::from_tgas(15);
const ONE_YOCTO: NearToken = NearToken::from_yoctonear(1);

#[near(serializers = [borsh, json])]
#[derive(Clone, Copy, PartialEq, Debug)]
pub enum ProtocolStatus {
    Alive,
    Warning,
    GhostAwake,
    Executed,
}

/// Standard NEAR MPC Chain Signatures request payload
#[near(serializers = [borsh, json])]
#[derive(Clone, Debug, PartialEq)]
pub struct SignRequest {
    pub payload: [u8; 32],
    pub path: String,
    pub key_version: u32,
}

#[near(serializers = [json])]
#[derive(Clone, Debug)]
pub struct SignArgs {
    pub request: SignRequest,
}

#[near(serializers = [json])]
#[derive(Debug)]
pub struct ProtocolStateView {
    pub owner: AccountId,
    pub agent_account: AccountId,
    pub beneficiary: AccountId,
    pub mpc_signer: AccountId,
    pub last_heartbeat_ms: u64,
    pub timeout_period_ms: u64,
    pub time_remaining_ms: i64,
    pub status: ProtocolStatus,
    pub has_key_share: bool,
    pub encrypted_vault_hash: String,
    pub contract_balance: NearToken,
    pub nep141_balances: Vec<(AccountId, U128)>,
}

#[near(contract_state)]
#[derive(PanicOnDefault)]
pub struct GhostProtocolContract {
    pub owner: AccountId,
    pub agent_account: AccountId,
    pub beneficiary: AccountId,
    pub mpc_signer: AccountId,
    pub last_heartbeat_ms: u64,
    pub timeout_period_ms: u64,
    pub status: ProtocolStatus,
    pub encrypted_key_share: String, // Share A of AES-GCM Key (Split-Key)
    pub encrypted_vault_hash: String,
    pub trader_dna: String,          // JSON representation of owner's risk vector & habits
    pub nep141_balances: HashMap<AccountId, u128>,
}

#[near]
impl GhostProtocolContract {
    #[init]
    pub fn new(
        beneficiary: AccountId,
        agent_account: AccountId,
        timeout_period_ms: Option<u64>,
        encrypted_key_share: String,
        encrypted_vault_hash: String,
        trader_dna: String,
        mpc_signer: Option<AccountId>,
    ) -> Self {
        require!(!env::state_exists(), "Already initialized");
        let timeout = timeout_period_ms.unwrap_or(15_000); // 15s default for hackathon live demo
        let signer = mpc_signer.unwrap_or_else(|| DEFAULT_MPC_SIGNER.parse().unwrap());

        Self {
            owner: env::predecessor_account_id(),
            agent_account,
            beneficiary,
            mpc_signer: signer,
            last_heartbeat_ms: env::block_timestamp_ms(),
            timeout_period_ms: timeout,
            status: ProtocolStatus::Alive,
            encrypted_key_share,
            encrypted_vault_hash,
            trader_dna,
            nep141_balances: HashMap::new(),
        }
    }

    /// Owner (or authorized heartbeat process) pings life signal
    pub fn ping_heartbeat(&mut self) {
        let caller = env::predecessor_account_id();
        require!(
            caller == self.owner || caller == self.agent_account,
            "Unauthorized heartbeat sender"
        );
        require!(
            self.status != ProtocolStatus::Executed,
            "Protocol is already finalized"
        );

        self.last_heartbeat_ms = env::block_timestamp_ms();
        self.status = ProtocolStatus::Alive;
        env::log_str(&format!("GhostProtocol: Heartbeat pinged by {}. Timer reset.", caller));
    }

    /// Update Trader DNA matrix while alive
    pub fn update_trader_dna(&mut self, trader_dna: String) {
        require!(
            env::predecessor_account_id() == self.owner,
            "Only owner can update Trader DNA"
        );
        require!(
            self.status != ProtocolStatus::Executed,
            "Protocol is already finalized"
        );
        self.trader_dna = trader_dna;
    }

    /// Configure MPC Signer account (owner only)
    pub fn set_mpc_signer(&mut self, mpc_signer: AccountId) {
        require!(
            env::predecessor_account_id() == self.owner,
            "Only owner can update MPC signer account"
        );
        self.mpc_signer = mpc_signer;
    }

    /// Deposit NEAR funds to the protocol treasury
    #[payable]
    pub fn deposit_treasury(&mut self) {
        let amount = env::attached_deposit();
        env::log_str(&format!("GhostProtocol: Deposited {} yoctoNEAR to treasury", amount));
    }

    /// Triggered when proof of absence is cryptographically verified.
    /// Anti-deadlock: Beneficiary, Agent, or Owner can trigger once now > expiration_time.
    pub fn trigger_ghost_protocol(&mut self) -> Promise {
        let caller = env::predecessor_account_id();
        require!(
            caller == self.agent_account || caller == self.owner || caller == self.beneficiary,
            "Unauthorized caller: only agent, owner, or beneficiary can trigger post-human protocol"
        );
        require!(
            self.status != ProtocolStatus::Executed,
            "Protocol has already been executed"
        );

        let now = env::block_timestamp_ms();
        let expiration_time = self.last_heartbeat_ms.saturating_add(self.timeout_period_ms);

        require!(
            now > expiration_time,
            format!("Owner is still alive! Expiration at {} ms, current block time {} ms", expiration_time, now)
        );

        self.status = ProtocolStatus::Executed;
        let balance = env::account_balance();

        // Dynamically compute exact required storage cost + minimal reserve
        let storage_required_yocto = (env::storage_usage() as u128)
            .saturating_mul(env::storage_byte_cost().as_yoctonear());
        let storage_cushion = NearToken::from_yoctonear(storage_required_yocto)
            .saturating_add(NearToken::from_millinear(20));
        let transfer_amount = balance.saturating_sub(storage_cushion);

        env::log_str(&format!(
            "GhostProtocol: Execution confirmed. Transferring {} yoctoNEAR to beneficiary {}",
            transfer_amount, self.beneficiary
        ));

        // Transfer funds with on_transfer_complete callback to prevent state lock
        Promise::new(self.beneficiary.clone())
            .transfer(transfer_amount)
            .then(
                Self::ext(env::current_account_id())
                    .with_static_gas(CALLBACK_GAS)
                    .on_transfer_complete(transfer_amount)
            )
    }

    /// Callback for treasury transfer to beneficiary:
    /// If transfer fails, status is reverted from Executed back to GhostAwake to prevent permanent deadlock.
    #[private]
    pub fn on_transfer_complete(&mut self, transfer_amount: NearToken) -> bool {
        let success = if env::promise_results_count() == 1 {
            near_sdk::is_promise_success()
        } else {
            false
        };
        if success {
            env::log_str(&format!(
                "GhostProtocol: Transfer of {} yoctoNEAR to beneficiary {} succeeded",
                transfer_amount, self.beneficiary
            ));
            true
        } else {
            env::log_str(&format!(
                "GhostProtocol: Transfer of {} yoctoNEAR to beneficiary {} FAILED. Reverting status to allow retry.",
                transfer_amount, self.beneficiary
            ));
            self.status = ProtocolStatus::GhostAwake;
            false
        }
    }

    /// Post-Human Chain Signatures (MPC) Authorization:
    /// Agent, Beneficiary, or Owner requests an MPC signature from `v1.signer-prod.testnet` (or configured signer)
    /// to unwind external chain positions (e.g. Arbitrum, Solana, Hyperliquid).
    /// Guardrail: Zero authority while the owner is alive!
    pub fn request_chain_signature(
        &mut self,
        payload: [u8; 32],
        path: String,
        key_version: u32,
    ) -> Promise {
        let caller = env::predecessor_account_id();
        require!(
            caller == self.agent_account || caller == self.owner || caller == self.beneficiary,
            "Unauthorized caller: only designated agent, owner, or beneficiary can request chain signatures"
        );

        let now = env::block_timestamp_ms();
        let expiration_time = self.last_heartbeat_ms.saturating_add(self.timeout_period_ms);
        require!(
            self.status == ProtocolStatus::Executed || now > expiration_time,
            "Owner is still alive. Chain signatures are strictly locked!"
        );

        let sign_request = SignRequest {
            payload,
            path: path.clone(),
            key_version,
        };

        let sign_args = SignArgs {
            request: sign_request,
        };

        let serialized_args = serde_json::to_vec(&sign_args)
            .expect("Failed to serialize SignRequest args");

        env::log_str(&format!(
            "GhostProtocol: Authorized MPC Chain Signature call to {} with 'sign' for path '{}'",
            self.mpc_signer, path
        ));

        // Call MPC contract `sign` method with exact SignRequest struct, 250 TGas, and 1 yoctoNEAR deposit
        Promise::new(self.mpc_signer.clone()).function_call(
            "sign".to_string(),
            serialized_args,
            ONE_YOCTO,
            MPC_GAS,
        )
    }

    /// NEP-141 token receiver hook:
    /// Called when tokens are transferred via `ft_transfer_call` on any standard NEP-141 token contract.
    pub fn ft_on_transfer(
        &mut self,
        sender_id: AccountId,
        amount: U128,
        msg: String,
    ) -> PromiseOrValue<U128> {
        let token_contract = env::predecessor_account_id();
        require!(
            self.status != ProtocolStatus::Executed,
            "Protocol is already executed; new token deposits are disabled"
        );

        let current_balance = self.nep141_balances.entry(token_contract.clone()).or_insert(0);
        *current_balance = current_balance.saturating_add(amount.0);

        env::log_str(&format!(
            "GhostProtocol: Received {} tokens of {} from {}. Message: '{}'. Total tracked: {}",
            amount.0, token_contract, sender_id, msg, *current_balance
        ));

        // Return 0 unused tokens to indicate all tokens are accepted
        PromiseOrValue::Value(U128(0))
    }

    /// Transfer NEP-141 token balance to beneficiary upon demise/expiration.
    /// Anti-deadlock: Callable by Agent, Beneficiary, or Owner once expired or executed.
    pub fn transfer_nep141_to_beneficiary(
        &mut self,
        token_id: AccountId,
        amount: Option<U128>,
    ) -> Promise {
        let caller = env::predecessor_account_id();
        require!(
            caller == self.agent_account || caller == self.owner || caller == self.beneficiary,
            "Unauthorized caller: only agent, owner, or beneficiary can trigger token transfers"
        );

        let now = env::block_timestamp_ms();
        let expiration_time = self.last_heartbeat_ms.saturating_add(self.timeout_period_ms);
        require!(
            self.status == ProtocolStatus::Executed || now > expiration_time,
            "Owner is still alive. NEP-141 token assets are locked!"
        );

        let current_bal = self.nep141_balances.get(&token_id).copied().unwrap_or(0);
        require!(current_bal > 0, "No tracked balance for this NEP-141 token");

        let transfer_amount = match amount {
            Some(amt) => {
                require!(
                    amt.0 <= current_bal,
                    "Requested transfer amount exceeds available token balance"
                );
                amt.0
            }
            None => current_bal,
        };

        // Deduct tracked balance optimistically
        let remaining = current_bal.saturating_sub(transfer_amount);
        if remaining == 0 {
            self.nep141_balances.remove(&token_id);
        } else {
            self.nep141_balances.insert(token_id.clone(), remaining);
        }

        env::log_str(&format!(
            "GhostProtocol: Transferring {} of NEP-141 token {} to beneficiary {}",
            transfer_amount, token_id, self.beneficiary
        ));

        let ft_transfer_args = serde_json::to_vec(&serde_json::json!({
            "receiver_id": self.beneficiary,
            "amount": U128(transfer_amount),
            "memo": "GhostProtocol Post-Human Inheritance Distribution"
        }))
        .expect("Failed to serialize ft_transfer args");

        Promise::new(token_id.clone())
            .function_call(
                "ft_transfer".to_string(),
                ft_transfer_args,
                ONE_YOCTO,
                FT_TRANSFER_GAS,
            )
            .then(
                Self::ext(env::current_account_id())
                    .with_static_gas(CALLBACK_GAS)
                    .on_nep141_transfer_complete(token_id, U128(transfer_amount))
            )
    }

    /// Callback for NEP-141 transfer to beneficiary:
    /// Restores tracked balance if transfer failed to allow retry.
    #[private]
    pub fn on_nep141_transfer_complete(&mut self, token_id: AccountId, amount: U128) -> bool {
        let success = if env::promise_results_count() == 1 {
            near_sdk::is_promise_success()
        } else {
            false
        };
        if success {
            env::log_str(&format!(
                "GhostProtocol: NEP-141 transfer of {} {} to beneficiary succeeded",
                amount.0, token_id
            ));
            true
        } else {
            env::log_str(&format!(
                "GhostProtocol: NEP-141 transfer of {} {} to beneficiary FAILED. Restoring tracked balance.",
                amount.0, token_id
            ));
            let current_bal = self.nep141_balances.entry(token_id).or_insert(0);
            *current_bal = current_bal.saturating_add(amount.0);
            false
        }
    }

    // --- VIEW METHODS ---

    pub fn get_protocol_state(&self) -> ProtocolStateView {
        let now = env::block_timestamp_ms();
        let expiration_time = self.last_heartbeat_ms.saturating_add(self.timeout_period_ms);
        let time_remaining = (expiration_time as i64) - (now as i64);

        let effective_status = if self.status == ProtocolStatus::Executed {
            ProtocolStatus::Executed
        } else if time_remaining <= 0 {
            ProtocolStatus::GhostAwake
        } else if time_remaining <= (self.timeout_period_ms as i64 / 3) {
            ProtocolStatus::Warning
        } else {
            ProtocolStatus::Alive
        };

        let nep141_list = self
            .nep141_balances
            .iter()
            .map(|(k, v)| (k.clone(), U128(*v)))
            .collect();

        ProtocolStateView {
            owner: self.owner.clone(),
            agent_account: self.agent_account.clone(),
            beneficiary: self.beneficiary.clone(),
            mpc_signer: self.mpc_signer.clone(),
            last_heartbeat_ms: self.last_heartbeat_ms,
            timeout_period_ms: self.timeout_period_ms,
            time_remaining_ms: time_remaining,
            status: effective_status,
            has_key_share: !self.encrypted_key_share.is_empty(),
            encrypted_vault_hash: self.encrypted_vault_hash.clone(),
            contract_balance: env::account_balance(),
            nep141_balances: nep141_list,
        }
    }

    pub fn get_mpc_signer(&self) -> AccountId {
        self.mpc_signer.clone()
    }

    pub fn get_nep141_balance(&self, token_id: AccountId) -> U128 {
        U128(self.nep141_balances.get(&token_id).copied().unwrap_or(0))
    }

    pub fn get_all_nep141_balances(&self) -> Vec<(AccountId, U128)> {
        self.nep141_balances
            .iter()
            .map(|(k, v)| (k.clone(), U128(*v)))
            .collect()
    }

    /// Trader DNA is readable by the designated Ghost Agent to mimic trading behavior
    pub fn get_trader_dna(&self) -> String {
        self.trader_dna.clone()
    }

    /// CRITICAL SECURITY INVARIANT:
    /// Key Share A is strictly locked while Owner is Alive.
    /// Only revealed when Proof of Absence is reached (GhostAwake or Executed).
    pub fn get_beneficiary_key_share(&self) -> Option<String> {
        let now = env::block_timestamp_ms();
        let expiration_time = self.last_heartbeat_ms.saturating_add(self.timeout_period_ms);

        if self.status == ProtocolStatus::Executed || now > expiration_time {
            Some(self.encrypted_key_share.clone())
        } else {
            None
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use near_sdk::test_utils::{accounts, VMContextBuilder};
    use near_sdk::testing_env;

    fn get_context(predecessor: AccountId, current_time_ms: u64) -> VMContextBuilder {
        let mut builder = VMContextBuilder::new();
        builder
            .current_account_id(accounts(0))
            .signer_account_id(predecessor.clone())
            .predecessor_account_id(predecessor)
            .block_timestamp(current_time_ms * 1_000_000) // nanoseconds
            .account_balance(NearToken::from_near(10));
        builder
    }

    #[test]
    fn test_initialize_and_state() {
        let owner = accounts(1);
        let beneficiary = accounts(2);
        let agent = accounts(3);

        let context = get_context(owner.clone(), 1_000);
        testing_env!(context.build());

        let contract = GhostProtocolContract::new(
            beneficiary.clone(),
            agent.clone(),
            Some(15_000),
            "SHARE_A_SECRET".to_string(),
            "IPFS_HASH_123".to_string(),
            r#"{"risk_vector":[0.3,0.7]}"#.to_string(),
            None,
        );

        let state = contract.get_protocol_state();
        assert_eq!(state.owner, owner);
        assert_eq!(state.beneficiary, beneficiary);
        assert_eq!(state.agent_account, agent);
        assert_eq!(state.mpc_signer.as_str(), DEFAULT_MPC_SIGNER);
        assert_eq!(state.status, ProtocolStatus::Alive);
        assert_eq!(state.time_remaining_ms, 15_000);

        // Security check: key share is hidden while alive
        assert_eq!(contract.get_beneficiary_key_share(), None);
    }

    #[test]
    fn test_heartbeat_resets_timer() {
        let owner = accounts(1);
        let mut context = get_context(owner.clone(), 1_000);
        testing_env!(context.build());

        let mut contract = GhostProtocolContract::new(
            accounts(2),
            accounts(3),
            Some(15_000),
            "SHARE_A".to_string(),
            "HASH".to_string(),
            "{}".to_string(),
            None,
        );

        // Move time forward by 10s
        testing_env!(context.block_timestamp(11_000 * 1_000_000).build());
        let state1 = contract.get_protocol_state();
        assert_eq!(state1.time_remaining_ms, 5_000);

        // Ping heartbeat at 11s
        contract.ping_heartbeat();
        let state2 = contract.get_protocol_state();
        assert_eq!(state2.time_remaining_ms, 15_000);
    }

    #[test]
    #[should_panic(expected = "Owner is still alive!")]
    fn test_premature_trigger_fails() {
        let owner = accounts(1);
        let agent = accounts(3);
        let mut context = get_context(owner.clone(), 1_000);
        testing_env!(context.build());

        let mut contract = GhostProtocolContract::new(
            accounts(2),
            agent.clone(),
            Some(15_000),
            "SHARE_A".to_string(),
            "HASH".to_string(),
            "{}".to_string(),
            None,
        );

        // Agent tries to trigger after only 5s (10s remaining)
        testing_env!(context
            .predecessor_account_id(agent)
            .block_timestamp(6_000 * 1_000_000)
            .build());

        let _ = contract.trigger_ghost_protocol();
    }

    #[test]
    fn test_valid_trigger_post_expiry_by_agent() {
        let owner = accounts(1);
        let agent = accounts(3);
        let mut context = get_context(owner.clone(), 1_000);
        testing_env!(context.build());

        let mut contract = GhostProtocolContract::new(
            accounts(2),
            agent.clone(),
            Some(15_000),
            "SHARE_A".to_string(),
            "HASH".to_string(),
            "{}".to_string(),
            None,
        );

        // Move time past expiration (16.1s later)
        testing_env!(context
            .predecessor_account_id(agent)
            .block_timestamp(17_100 * 1_000_000)
            .build());

        // Ghost awake status and key share is now revealed!
        assert_eq!(contract.get_beneficiary_key_share(), Some("SHARE_A".to_string()));

        let _promise = contract.trigger_ghost_protocol();
        assert_eq!(contract.status, ProtocolStatus::Executed);
    }

    #[test]
    fn test_anti_deadlock_beneficiary_can_trigger() {
        let owner = accounts(1);
        let beneficiary = accounts(2);
        let agent = accounts(3);
        let mut context = get_context(owner.clone(), 1_000);
        testing_env!(context.build());

        let mut contract = GhostProtocolContract::new(
            beneficiary.clone(),
            agent.clone(),
            Some(15_000),
            "SHARE_A".to_string(),
            "HASH".to_string(),
            "{}".to_string(),
            None,
        );

        // Move time past expiration (16.1s later)
        testing_env!(context
            .predecessor_account_id(beneficiary.clone())
            .block_timestamp(17_100 * 1_000_000)
            .build());

        // Beneficiary triggers protocol successfully to prevent deadlock if agent is offline!
        let _promise = contract.trigger_ghost_protocol();
        assert_eq!(contract.status, ProtocolStatus::Executed);
    }

    #[test]
    #[should_panic(expected = "Unauthorized caller")]
    fn test_unauthorized_trigger_fails() {
        let owner = accounts(1);
        let attacker = accounts(4);
        let mut context = get_context(owner.clone(), 1_000);
        testing_env!(context.build());

        let mut contract = GhostProtocolContract::new(
            accounts(2),
            accounts(3),
            Some(15_000),
            "SHARE_A".to_string(),
            "HASH".to_string(),
            "{}".to_string(),
            None,
        );

        // Move time past expiration
        testing_env!(context
            .predecessor_account_id(attacker)
            .block_timestamp(17_100 * 1_000_000)
            .build());

        let _ = contract.trigger_ghost_protocol();
    }

    #[test]
    #[should_panic(expected = "Owner is still alive. Chain signatures are strictly locked!")]
    fn test_chain_signature_locked_while_alive() {
        let owner = accounts(1);
        let agent = accounts(3);
        let mut context = get_context(owner.clone(), 1_000);
        testing_env!(context.build());

        let mut contract = GhostProtocolContract::new(
            accounts(2),
            agent.clone(),
            Some(15_000),
            "SHARE_A".to_string(),
            "HASH".to_string(),
            "{}".to_string(),
            None,
        );

        testing_env!(context
            .predecessor_account_id(agent)
            .block_timestamp(5_000 * 1_000_000)
            .build());

        let _ = contract.request_chain_signature([0u8; 32], "ethereum-1".to_string(), 0);
    }

    #[test]
    fn test_chain_signature_allowed_post_expiry() {
        let owner = accounts(1);
        let agent = accounts(3);
        let mut context = get_context(owner.clone(), 1_000);
        testing_env!(context.build());

        let mut contract = GhostProtocolContract::new(
            accounts(2),
            agent.clone(),
            Some(15_000),
            "SHARE_A".to_string(),
            "HASH".to_string(),
            "{}".to_string(),
            None,
        );

        testing_env!(context
            .predecessor_account_id(agent)
            .block_timestamp(16_500 * 1_000_000)
            .build());

        let _promise = contract.request_chain_signature([1u8; 32], "arbitrum-perps".to_string(), 0);
    }

    #[test]
    fn test_on_transfer_complete_callback_anti_lock() {
        let owner = accounts(1);
        let beneficiary = accounts(2);
        let agent = accounts(3);
        let mut context = get_context(owner.clone(), 1_000);
        testing_env!(context.build());

        let mut contract = GhostProtocolContract::new(
            beneficiary.clone(),
            agent.clone(),
            Some(15_000),
            "SHARE_A".to_string(),
            "HASH".to_string(),
            "{}".to_string(),
            None,
        );

        // Move to expired and trigger
        testing_env!(context
            .predecessor_account_id(agent)
            .block_timestamp(17_000 * 1_000_000)
            .build());
        let _ = contract.trigger_ghost_protocol();
        assert_eq!(contract.status, ProtocolStatus::Executed);

        // Simulate callback when transfer fails (e.g. promise failed)
        // With predecessor = current_account_id (private method requirement)
        context.predecessor_account_id(accounts(0));
        testing_env!(
            context.build(),
            near_sdk::test_vm_config(),
            near_sdk::RuntimeFeesConfig::test(),
            Default::default(),
            vec![near_sdk::PromiseResult::Failed],
        );

        let success = contract.on_transfer_complete(NearToken::from_near(5));
        assert!(!success);
        // Anti-lock: status reverted from Executed back to GhostAwake!
        assert_eq!(contract.status, ProtocolStatus::GhostAwake);

        // Simulate callback when transfer succeeds
        testing_env!(
            context.build(),
            near_sdk::test_vm_config(),
            near_sdk::RuntimeFeesConfig::test(),
            Default::default(),
            vec![near_sdk::PromiseResult::Successful(vec![])],
        );
        contract.status = ProtocolStatus::Executed;
        let success = contract.on_transfer_complete(NearToken::from_near(5));
        assert!(success);
        assert_eq!(contract.status, ProtocolStatus::Executed);
    }

    #[test]
    fn test_nep141_ft_on_transfer_and_distribution() {
        let owner = accounts(1);
        let beneficiary = accounts(2);
        let agent = accounts(3);
        let token_contract: AccountId = "usdc.testnet".parse().unwrap();

        let mut context = get_context(owner.clone(), 1_000);
        testing_env!(context.build());

        let mut contract = GhostProtocolContract::new(
            beneficiary.clone(),
            agent.clone(),
            Some(15_000),
            "SHARE_A".to_string(),
            "HASH".to_string(),
            "{}".to_string(),
            None,
        );

        // Deposit 5,000 USDC via NEP-141 ft_on_transfer
        testing_env!(context
            .predecessor_account_id(token_contract.clone())
            .build());

        let res = contract.ft_on_transfer(
            owner.clone(),
            U128(5_000_000_000), // 5,000 USDC (6 decimals)
            "Treasury funding".to_string(),
        );
        match res {
            PromiseOrValue::Value(unused) => assert_eq!(unused.0, 0),
            _ => panic!("Expected value return"),
        }

        assert_eq!(contract.get_nep141_balance(token_contract.clone()).0, 5_000_000_000);
        assert_eq!(contract.get_all_nep141_balances().len(), 1);

        // While owner is alive (t = 2s, timeout = 15s), distribution must fail
        testing_env!(context
            .predecessor_account_id(agent.clone())
            .block_timestamp(2_000 * 1_000_000)
            .build());

        let panic_alive = std::panic::catch_unwind(std::panic::AssertUnwindSafe(|| {
            let mut c = contract;
            let _ = c.transfer_nep141_to_beneficiary(token_contract.clone(), None);
        }));
        assert!(panic_alive.is_err());

        // Fast forward past expiration (t = 1_000 + 15_000 = 16_000; set t = 20_000)
        let mut contract = GhostProtocolContract::new(
            beneficiary.clone(),
            agent.clone(),
            Some(15_000),
            "SHARE_A".to_string(),
            "HASH".to_string(),
            "{}".to_string(),
            None,
        );
        testing_env!(context
            .predecessor_account_id(token_contract.clone())
            .block_timestamp(1_000 * 1_000_000)
            .build());
        let _ = contract.ft_on_transfer(owner.clone(), U128(5_000_000_000), "".to_string());

        // Beneficiary calls transfer_nep141_to_beneficiary post expiration (t = 20_000ms > 16_000ms)
        testing_env!(context
            .predecessor_account_id(beneficiary.clone())
            .block_timestamp(20_000 * 1_000_000)
            .build());

        let _promise = contract.transfer_nep141_to_beneficiary(token_contract.clone(), Some(U128(2_000_000_000)));
        // Remaining should be 3,000,000,000
        assert_eq!(contract.get_nep141_balance(token_contract.clone()).0, 3_000_000_000);

        // Test NEP-141 callback failure rollback
        context.predecessor_account_id(accounts(0));
        testing_env!(
            context.build(),
            near_sdk::test_vm_config(),
            near_sdk::RuntimeFeesConfig::test(),
            Default::default(),
            vec![near_sdk::PromiseResult::Failed],
        );
        let callback_result = contract.on_nep141_transfer_complete(token_contract.clone(), U128(2_000_000_000));
        assert!(!callback_result);
        // Balance restored back to 5,000,000,000 on failure!
        assert_eq!(contract.get_nep141_balance(token_contract.clone()).0, 5_000_000_000);
    }
}

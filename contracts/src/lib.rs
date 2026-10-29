use near_sdk::borsh::{BorshDeserialize, BorshSerialize};
use near_sdk::serde::{Deserialize, Serialize};
use near_sdk::{env, near, require, AccountId, NearToken, PanicOnDefault, Promise};

#[derive(BorshDeserialize, BorshSerialize, Serialize, Deserialize, Clone, Copy, PartialEq, Debug)]
#[serde(crate = "near_sdk::serde")]
pub enum ProtocolStatus {
    Alive,
    Warning,
    GhostAwake,
    Executed,
}

#[derive(Serialize, Deserialize, Debug)]
#[serde(crate = "near_sdk::serde")]
pub struct ProtocolStateView {
    pub owner: AccountId,
    pub agent_account: AccountId,
    pub beneficiary: AccountId,
    pub last_heartbeat_ms: u64,
    pub timeout_period_ms: u64,
    pub time_remaining_ms: i64,
    pub status: ProtocolStatus,
    pub has_key_share: bool,
    pub encrypted_vault_hash: String,
    pub contract_balance: NearToken,
}

#[near(contract_state)]
#[derive(PanicOnDefault)]
pub struct GhostProtocolContract {
    pub owner: AccountId,
    pub agent_account: AccountId,
    pub beneficiary: AccountId,
    pub last_heartbeat_ms: u64,
    pub timeout_period_ms: u64,
    pub status: ProtocolStatus,
    pub encrypted_key_share: String, // Share A of AES-GCM Key (Split-Key)
    pub encrypted_vault_hash: String,
    pub trader_dna: String,          // JSON representation of owner's risk vector & habits
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
    ) -> Self {
        require!(!env::state_exists(), "Already initialized");
        let timeout = timeout_period_ms.unwrap_or(15_000); // 15s default for hackathon live demo

        Self {
            owner: env::predecessor_account_id(),
            agent_account,
            beneficiary,
            last_heartbeat_ms: env::block_timestamp_ms(),
            timeout_period_ms: timeout,
            status: ProtocolStatus::Alive,
            encrypted_key_share,
            encrypted_vault_hash,
            trader_dna,
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

    /// Deposit funds to the protocol treasury
    #[payable]
    pub fn deposit_treasury(&mut self) {
        let amount = env::attached_deposit();
        env::log_str(&format!("GhostProtocol: Deposited {} yoctoNEAR to treasury", amount));
    }

    /// Triggered by the Ghost Agent when proof of absence is cryptographically verified
    pub fn trigger_ghost_protocol(&mut self) -> Promise {
        let caller = env::predecessor_account_id();
        require!(
            caller == self.agent_account || caller == self.owner,
            "Only designated agent can trigger post-human protocol"
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
        
        // Retain 0.05 NEAR for storage / gas threshold, transfer the rest to beneficiary
        let storage_cushion = NearToken::from_millinear(50);
        let transfer_amount = balance.saturating_sub(storage_cushion);

        env::log_str(&format!(
            "GhostProtocol: Execution confirmed. Transferring {} yoctoNEAR to beneficiary {}",
            transfer_amount, self.beneficiary
        ));

        Promise::new(self.beneficiary.clone()).transfer(transfer_amount)
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

        ProtocolStateView {
            owner: self.owner.clone(),
            agent_account: self.agent_account.clone(),
            beneficiary: self.beneficiary.clone(),
            last_heartbeat_ms: self.last_heartbeat_ms,
            timeout_period_ms: self.timeout_period_ms,
            time_remaining_ms: time_remaining,
            status: effective_status,
            has_key_share: !self.encrypted_key_share.is_empty(),
            encrypted_vault_hash: self.encrypted_vault_hash.clone(),
            contract_balance: env::account_balance(),
        }
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
        );

        let state = contract.get_protocol_state();
        assert_eq!(state.owner, owner);
        assert_eq!(state.beneficiary, beneficiary);
        assert_eq!(state.agent_account, agent);
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
        );

        // Agent tries to trigger after only 5s (10s remaining)
        testing_env!(context
            .predecessor_account_id(agent)
            .block_timestamp(6_000 * 1_000_000)
            .build());

        contract.trigger_ghost_protocol();
    }

    #[test]
    fn test_valid_trigger_post_expiry() {
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
}

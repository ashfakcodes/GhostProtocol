import os
from dotenv import load_dotenv

load_dotenv()

# NEAR Protocol Configuration
NEAR_NETWORK = os.getenv("NEAR_NETWORK", "testnet")
NEAR_RPC_URL = os.getenv("NEAR_RPC_URL", "https://rpc.testnet.near.org")
CONTRACT_ID = os.getenv("CONTRACT_ID", "ghostprotocol.testnet")
OWNER_ACCOUNT_ID = os.getenv("OWNER_ACCOUNT_ID", "owner.testnet")
AGENT_ACCOUNT_ID = os.getenv("AGENT_ACCOUNT_ID", "ghost-agent.testnet")
AGENT_PRIVATE_KEY = os.getenv("AGENT_PRIVATE_KEY", "")
BENEFICIARY_ACCOUNT_ID = os.getenv("BENEFICIARY_ACCOUNT_ID", "heir.testnet")
BENEFICIARY_TG = os.getenv("BENEFICIARY_TG", "@heir_telegram")

# AI & Gemini API Configuration
GEMINI_API_KEY = os.getenv("GEMINI_API_KEY", "")
GEMINI_MODEL = os.getenv("GEMINI_MODEL", "gemini-2.5-flash")

# Telegram Configuration (Telethon)
TELEGRAM_API_ID = int(os.getenv("TELEGRAM_API_ID", "0"))
TELEGRAM_API_HASH = os.getenv("TELEGRAM_API_HASH", "")
TELEGRAM_PHONE = os.getenv("TELEGRAM_PHONE", "")

# Demo Mode Settings
DEMO_MODE = os.getenv("DEMO_MODE", "true").lower() == "true"
SIMULATED_POLL_INTERVAL_S = float(os.getenv("SIMULATED_POLL_INTERVAL_S", "1.0"))
WARNING_THRESHOLD_MS = int(os.getenv("WARNING_THRESHOLD_MS", "5000")) # Trigger warning at 5s remaining in demo

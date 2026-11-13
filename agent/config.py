import os
from pathlib import Path
from dotenv import load_dotenv

agent_dir = Path(__file__).resolve().parent
env_path = agent_dir / ".env"
if env_path.exists():
    load_dotenv(dotenv_path=env_path)
load_dotenv()  # Fallback to current working directory

# NEAR Protocol Configuration
NEAR_NETWORK = os.getenv("NEAR_NETWORK", "testnet")
NEAR_RPC_URL = os.getenv("NEAR_RPC_URL", "https://rpc.testnet.near.org")
CONTRACT_ID = os.getenv("CONTRACT_ID", "ghostprotocol.testnet")
OWNER_ACCOUNT_ID = os.getenv("OWNER_ACCOUNT_ID", "owner.testnet")
AGENT_ACCOUNT_ID = os.getenv("AGENT_ACCOUNT_ID", "ghost-agent.testnet")
AGENT_PRIVATE_KEY = os.getenv("AGENT_PRIVATE_KEY", "")
BENEFICIARY_ACCOUNT_ID = os.getenv("BENEFICIARY_ACCOUNT_ID", "heir.testnet")
BENEFICIARY_TG = os.getenv("BENEFICIARY_TG", "@safiyaayra")

# AI & OpenRouter / LLM Configuration
OPENROUTER_API_KEY = os.getenv("OPENROUTER_API_KEY", "")
OPENROUTER_BASE_URL = os.getenv("OPENROUTER_BASE_URL", "https://openrouter.ai/api/v1")
OPENROUTER_MODEL = os.getenv("OPENROUTER_MODEL", "inclusionai/ling-3.0-flash")
GEMINI_API_KEY = os.getenv("GEMINI_API_KEY", "")
GEMINI_MODEL = os.getenv("GEMINI_MODEL", "gemini-2.5-flash")

# Telegram Configuration (Telethon StringSession)
raw_tg_api_id = os.getenv("TELEGRAM_API_ID") or os.getenv("API_ID", "0")
try:
    TELEGRAM_API_ID = int(raw_tg_api_id) if raw_tg_api_id else 0
except ValueError:
    TELEGRAM_API_ID = 0

TELEGRAM_API_HASH = os.getenv("TELEGRAM_API_HASH") or os.getenv("API_HASH", "")
TELEGRAM_SESSION_STRING = os.getenv("TELEGRAM_SESSION_STRING") or os.getenv("SESSION_STRING", "")
TELEGRAM_PHONE = os.getenv("TELEGRAM_PHONE", "")

# Demo Mode Settings
DEMO_MODE = os.getenv("DEMO_MODE", "true").lower() == "true"
SIMULATED_POLL_INTERVAL_S = float(os.getenv("SIMULATED_POLL_INTERVAL_S", "1.0"))

# Dynamic Proof-of-Life & Warning Resolution (Supports 15,000, 50,000, or any interval)
raw_timeout = os.getenv("TIMEOUT_PERIOD_MS")
raw_warning = os.getenv("WARNING_THRESHOLD_MS")

if raw_timeout and raw_warning:
    t_val = int(raw_timeout)
    w_val = int(raw_warning)
    if w_val >= t_val:
        w_val = max(1000, min(w_val, int(t_val / 3)))
    TIMEOUT_PERIOD_MS = t_val
    WARNING_THRESHOLD_MS = w_val
elif raw_timeout and not raw_warning:
    t_val = int(raw_timeout)
    TIMEOUT_PERIOD_MS = t_val
    WARNING_THRESHOLD_MS = max(1000, int(t_val / 3))
elif raw_warning and not raw_timeout:
    w_val = int(raw_warning)
    # If user provided a large value like 50,000 to WARNING_THRESHOLD_MS without setting TIMEOUT_PERIOD_MS,
    # auto-adapt the total countdown to that value and scale the warning to 1/3 of the period.
    if w_val > 15000:
        TIMEOUT_PERIOD_MS = w_val
        WARNING_THRESHOLD_MS = max(1000, int(w_val / 3))
    else:
        TIMEOUT_PERIOD_MS = 15000
        WARNING_THRESHOLD_MS = min(w_val, 5000)
else:
    TIMEOUT_PERIOD_MS = 50000
    WARNING_THRESHOLD_MS = 15000

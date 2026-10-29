import asyncio
from typing import Optional, Callable

try:
    from config import TELEGRAM_API_ID, TELEGRAM_API_HASH, TELEGRAM_PHONE
except ImportError:
    from agent.config import TELEGRAM_API_ID, TELEGRAM_API_HASH, TELEGRAM_PHONE

class TelegramBridge:
    """
    Manages Proof-of-Life communications:
    - Sends Grace Period warning alerts.
    - Receives /alive replies to trigger heartbeat resets.
    - Gracefully operates in Simulated/Mock Mode if API keys are unconfigured.
    """

    def __init__(self, on_alive_callback: Optional[Callable] = None):
        self.on_alive_callback = on_alive_callback
        self.client = None
        self.is_simulated = True

        if TELEGRAM_API_ID and TELEGRAM_API_HASH:
            try:
                from telethon import TelegramClient
                self.client = TelegramClient('ghost_session', TELEGRAM_API_ID, TELEGRAM_API_HASH)
                self.is_simulated = False
                print("[TELEGRAM] Live Telethon Client initialized.")
            except Exception as e:
                print(f"[TELEGRAM] Telethon init failed ({e}). Running in resilient simulated mode.")
                self.is_simulated = True
        else:
            print("[TELEGRAM] No Telegram API keys detected. Active in Simulated Webhook Mode.")

    async def start(self):
        if not self.is_simulated and self.client:
            try:
                await self.client.start(phone=TELEGRAM_PHONE)
            except Exception as e:
                print(f"[TELEGRAM] Could not connect live Telegram ({e}). Falling back to simulation.")
                self.is_simulated = True

    async def send_emergency_warning(self, target: str, seconds_left: int):
        message = (
            f"🚨 **GHOST PROTOCOL EMERGENCY ALERT** 🚨\n\n"
            f"Cryptographic Proof-of-Life has lapsed!\n"
            f"Time remaining: **{seconds_left} seconds**\n\n"
            f"Reply `/alive` immediately to abort autonomous executor takeover."
        )
        if not self.is_simulated and self.client:
            try:
                await self.client.send_message(target, message)
                print(f"[TELEGRAM] Emergency alert delivered to {target}.")
                return
            except Exception as e:
                print(f"[TELEGRAM] Warning send error ({e}).")

        # Simulated broadcast log
        print(f"\n[TELEGRAM BROADCAST -> {target}]")
        print(message)
        print("-" * 50)

    async def send_beneficiary_settlement(self, target: str, summary: dict):
        message = (
            f"🕊️ **GHOST PROTOCOL: ESTATE SETTLEMENT DELIVERED**\n\n"
            f"Your designated benefactor's sovereign executor has completed execution:\n"
            f"• Assets Consolidated: {summary.get('consolidated_amount', 'N/A')}\n"
            f"• Settlement Tx: `{summary.get('intent_tx', 'N/A')}`\n"
            f"• Beneficiary Payout: `{summary.get('beneficiary', 'N/A')}`\n\n"
            f"🔑 **AES-256-GCM Vault Decryption Key (Share A):**\n"
            f"`{summary.get('key_share_a', 'N/A')}`\n\n"
            f"Open the GhostProtocol Recovery Portal and combine with your Share B to decrypt."
        )
        if not self.is_simulated and self.client:
            try:
                await self.client.send_message(target, message)
                print(f"[TELEGRAM] Settlement and key share delivered to {target}.")
                return
            except Exception as e:
                print(f"[TELEGRAM] Settlement delivery error ({e}).")

        # Simulated broadcast log
        print(f"\n[TELEGRAM BROADCAST -> {target}]")
        print(message)
        print("-" * 50)

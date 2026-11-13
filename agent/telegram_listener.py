import sys
import asyncio
from typing import Optional, Callable

if hasattr(sys.stdout, 'reconfigure'):
    try:
        sys.stdout.reconfigure(encoding='utf-8', errors='replace')
    except Exception:
        pass

def safe_print(*args, **kwargs):
    try:
        print(*args, **kwargs)
    except Exception:
        try:
            cleaned = [str(a).encode('ascii', errors='replace').decode('ascii') for a in args]
            print(*cleaned, **kwargs)
        except Exception:
            pass

try:
    from config import (
        TELEGRAM_API_ID, TELEGRAM_API_HASH, 
        TELEGRAM_SESSION_STRING, TELEGRAM_PHONE
    )
except ImportError:
    from agent.config import (
        TELEGRAM_API_ID, TELEGRAM_API_HASH, 
        TELEGRAM_SESSION_STRING, TELEGRAM_PHONE
    )

class TelegramBridge:
    """
    Manages Proof-of-Life communications:
    - Sends Grace Period warning alerts.
    - Receives /alive replies to trigger heartbeat resets.
    - Supports Telethon StringSession (Zero-Signup / Zero-Prompt).
    - Gracefully operates in Simulated/Mock Mode if API keys are unconfigured.
    """

    def __init__(self, on_alive_callback: Optional[Callable] = None, min_debounce_seconds: float = 2.0):
        self.on_alive_callback = on_alive_callback
        self.min_debounce_seconds = min_debounce_seconds
        self.last_activity_time = 0.0
        self.client = None
        self.is_simulated = True
        self.me_id = None

        if TELEGRAM_API_ID and TELEGRAM_API_HASH:
            try:
                from telethon import TelegramClient
                from telethon.sessions import StringSession

                if TELEGRAM_SESSION_STRING:
                    self.client = TelegramClient(
                        StringSession(TELEGRAM_SESSION_STRING),
                        TELEGRAM_API_ID,
                        TELEGRAM_API_HASH
                    )
                    self.is_simulated = False
                    print("[TELEGRAM] Live Telethon Client initialized with StringSession (Zero-Signup).")
                else:
                    self.client = TelegramClient('ghost_session', TELEGRAM_API_ID, TELEGRAM_API_HASH)
                    self.is_simulated = False
                    print("[TELEGRAM] Live Telethon Client initialized with file session.")
            except Exception as e:
                print(f"[TELEGRAM] Telethon init failed ({e}). Running in resilient simulated mode.")
                self.is_simulated = True
        else:
            print("[TELEGRAM] No Telegram API keys detected. Active in Simulated Webhook Mode.")

    async def _handle_proof_of_life_trigger(self, source: str, event_info: str = ""):
        """Centralized helper to debounce and execute proof-of-life heartbeat reset."""
        import time
        now = time.time()
        if now - self.last_activity_time < self.min_debounce_seconds:
            return
        self.last_activity_time = now

        print(f"[TELEGRAM] Activity detected via {source} ({event_info}). Triggering Proof-of-Life reset.")
        if self.on_alive_callback:
            try:
                if asyncio.iscoroutinefunction(self.on_alive_callback):
                    await self.on_alive_callback(source=source)
                else:
                    self.on_alive_callback(source=source)
            except TypeError:
                # Fallback if callback does not accept source kwarg
                try:
                    if asyncio.iscoroutinefunction(self.on_alive_callback):
                        await self.on_alive_callback()
                    else:
                        self.on_alive_callback()
                except Exception as inner_err:
                    print(f"[TELEGRAM] Callback execution error: {inner_err}")
            except Exception as cb_err:
                print(f"[TELEGRAM] Callback execution error: {cb_err}")

    async def start(self):
        if not self.is_simulated and self.client:
            try:
                if TELEGRAM_SESSION_STRING:
                    await self.client.connect()
                    if not await self.client.is_user_authorized():
                        print("[TELEGRAM] Provided SESSION_STRING is invalid or unauthorized. Falling back to simulation.")
                        self.is_simulated = True
                        return
                    me = await self.client.get_me()
                    self.me_id = getattr(me, "id", None)
                    identifier = f"@{me.username}" if getattr(me, "username", None) else getattr(me, "first_name", "User")
                    print(f"[TELEGRAM] Live userbot connected as {identifier} (ID: {self.me_id}) via Session String.")
                else:
                    await self.client.start(phone=TELEGRAM_PHONE)
                    me = await self.client.get_me()
                    self.me_id = getattr(me, "id", None)
                    print(f"[TELEGRAM] Live Telegram connected (ID: {self.me_id}).")

                # Register activity listeners for Proof-of-Life detection
                if self.on_alive_callback:
                    from telethon import events, types

                    # 1. Listen for explicit /alive commands (strict sender authorization)
                    @self.client.on(events.NewMessage(pattern=r"(?i)^/alive"))
                    async def alive_cmd_handler(event):
                        sender_id = getattr(event, "sender_id", None)
                        # Strictly verify sender is either the authenticated userbot or designated owner
                        is_authorized = (self.me_id and sender_id == self.me_id) or getattr(event, "out", False)
                        if not is_authorized:
                            print(f"[TELEGRAM] Unauthorized /alive ping rejected from sender_id={sender_id}")
                            return

                        await self._handle_proof_of_life_trigger(
                            source="Command",
                            event_info=f"msg_id={event.id}, sender={sender_id}"
                        )
                        try:
                            await event.reply("✅ **GhostProtocol Proof-of-Life Acknowledged**\nHeartbeat timer reset on NEAR smart contract.")
                        except Exception:
                            pass

                    # 2. Ambient Activity: Listen to ANY outgoing message sent by the user account
                    @self.client.on(events.NewMessage(outgoing=True))
                    async def outgoing_msg_handler(event):
                        # Avoid double-triggering if it was already handled by /alive
                        text = getattr(event, "raw_text", "") or ""
                        if text.strip().lower().startswith("/alive"):
                            return
                        preview = (text[:25] + "...") if len(text) > 25 else text
                        await self._handle_proof_of_life_trigger(
                            source="Outgoing Message",
                            event_info=f"chat={event.chat_id}, text='{preview}'"
                        )

                    # 3. Ambient Activity: Listen to message reactions (Userbot & Bot)
                    def check_is_my_reaction(peer_reactions) -> bool:
                        """Helper to check if any reaction belongs to the current user."""
                        if not peer_reactions:
                            return False
                        for r in peer_reactions:
                            # 1. Check direct 'my' flag on MessagePeerReaction
                            if getattr(r, "my", False):
                                return True
                            # 2. Check peer_id matching self.me_id
                            peer = getattr(r, "peer_id", None)
                            user_id = getattr(peer, "user_id", None) if peer else None
                            if self.me_id and user_id == self.me_id:
                                return True
                        return False

                    # A. Listen to Raw reaction updates (unwrapping Updates/UpdatesCombined containers)
                    @self.client.on(events.Raw)
                    async def reaction_raw_handler(event_update):
                        try:
                            # Extract all single update objects from potential container
                            updates_list = []
                            if hasattr(event_update, "updates") and isinstance(event_update.updates, list):
                                updates_list.extend(event_update.updates)
                            else:
                                updates_list.append(event_update)

                            for upd in updates_list:
                                # Userbot: UpdateMessageReactions
                                if isinstance(upd, types.UpdateMessageReactions):
                                    rx_obj = getattr(upd, "reactions", None)
                                    recent = getattr(rx_obj, "recent_reactions", None) if rx_obj else None
                                    if check_is_my_reaction(recent):
                                        await self._handle_proof_of_life_trigger(
                                            source="Message Reaction (Userbot)",
                                            event_info=f"peer={getattr(upd, 'peer', 'unknown')}, msg_id={getattr(upd, 'msg_id', 0)}"
                                        )
                                # Bot fallback: UpdateBotMessageReaction
                                elif isinstance(upd, types.UpdateBotMessageReaction):
                                    actor_id = getattr(upd.actor, "user_id", None) if getattr(upd, "actor", None) else None
                                    if not self.me_id or actor_id == self.me_id:
                                        await self._handle_proof_of_life_trigger(
                                            source="Message Reaction (Bot)",
                                            event_info=f"msg_id={getattr(upd, 'msg_id', 0)}, actor={actor_id}"
                                        )
                        except Exception as react_err:
                            print(f"[TELEGRAM] Error processing reaction update: {react_err}")

                    # B. Also listen to MessageEdited (Telegram sends MessageEdited when reaction is added in 1-on-1 DMs)
                    @self.client.on(events.MessageEdited)
                    async def message_edited_handler(event):
                        try:
                            msg = getattr(event, "message", None)
                            if not msg:
                                return
                            rx_obj = getattr(msg, "reactions", None)
                            if not rx_obj:
                                return
                            recent = getattr(rx_obj, "recent_reactions", None)
                            if check_is_my_reaction(recent):
                                await self._handle_proof_of_life_trigger(
                                    source="Message Reaction (Edited DM)",
                                    event_info=f"chat={event.chat_id}, msg_id={msg.id}"
                                )
                        except Exception as edit_err:
                            print(f"[TELEGRAM] Error processing message edit reaction: {edit_err}")

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
        safe_print(f"\n[TELEGRAM BROADCAST -> {target}]")
        safe_print(message)
        safe_print("-" * 50)

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
        safe_print(f"\n[TELEGRAM BROADCAST -> {target}]")
        safe_print(message)
        safe_print("-" * 50)

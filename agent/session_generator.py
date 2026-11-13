"""One-time script to generate a Telethon session string.

Run this once:
    python session_generator.py

It will prompt for your API_ID, API_HASH, phone number, and Telegram OTP,
then print the session string to paste into your .env file as TELEGRAM_SESSION_STRING.
"""

import asyncio
from telethon import TelegramClient
from telethon.sessions import StringSession


async def main():
    print("=" * 60)
    print("  GhostProtocol — Telegram Session String Generator")
    print("=" * 60)
    print()

    api_id = input("Enter your Telegram API_ID: ").strip()
    api_hash = input("Enter your Telegram API_HASH: ").strip()

    if not api_id or not api_hash:
        print("❌ Error: API_ID and API_HASH are required.")
        return

    async with TelegramClient(StringSession(), int(api_id), api_hash) as client:
        print()
        print("✅ Logged in successfully!")
        print()
        session_string = client.session.save()
        print("Your session string (copy this into agent/.env as TELEGRAM_SESSION_STRING):")
        print()
        print(session_string)
        print()
        print("=" * 60)


if __name__ == "__main__":
    asyncio.run(main())

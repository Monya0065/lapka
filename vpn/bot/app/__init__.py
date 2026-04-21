"""Telegram Bot for VPN activation."""
import os

from telegram import Update
from telegram.ext import Application, CommandHandler, MessageHandler, filters, ContextTypes

BOT_TOKEN = os.getenv("TELEGRAM_BOT_TOKEN", "")
API_URL = os.getenv("API_URL", "http://api:8000")


async def start(update: Update, context: ContextTypes.DEFAULT_TYPE):
    await update.message.reply_text(
        "Welcome to Lapka VPN!\n\n"
        "Use /activate to get your device claim link."
    )


async def activate(update: Update, context: ContextTypes.DEFAULT_TYPE):
    user = update.effective_user
    if not user:
        return
        
    async with httpx.AsyncClient() as client:
        try:
            response = await client.post(
                f"{API_URL}/api/telegram/activation",
                json={"telegram_user_id": str(user.id)},
            )
            if response.status_code == 200:
                data = response.json()
                claim_url = f"{API_URL}/claim/{data.get('token')}"
                await update.message.reply_text(
                    f"Click to activate: {claim_url}"
                )
            else:
                await update.message.reply_text("Error creating activation. Try again later.")
        except Exception as e:
            await update.message.reply_text(f"Error: {e}")


def main():
    app = Application.builder().token(BOT_TOKEN).build()
    app.add_handler(CommandHandler("start", start))
    app.add_handler(CommandHandler("activate", activate))
    app.run_polling()


if __name__ == "__main__":
    import httpx
    main()
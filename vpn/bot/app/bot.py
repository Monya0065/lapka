"""Telegram Bot for VPN activation."""
import os
import asyncio
import httpx
from telegram import Update
from telegram.ext import Application, CommandHandler, MessageHandler, filters, ContextTypes

API_URL = os.getenv("API_URL", "http://api:8000")
BOT_TOKEN = os.getenv("TELEGRAM_BOT_TOKEN", "")


async def start(update: Update, context: ContextTypes.DEFAULT_TYPE):
    """Handle /start command."""
    await update.message.reply_text(
        "Привет! 👋\n\n"
        "Я бот Lapka VPN — помогу активировать VPN на вашем устройстве.\n\n"
        "Команды:\n"
        "/start — Показать это сообщение\n"
        "/activate — Получить ссылку для активации\n"
        "/status — Проверить статус подписки\n"
        "/help — Помощь"
    )


async def help_command(update: Update, context: ContextTypes.DEFAULT_TYPE):
    """Handle /help command."""
    await update.message.reply_text(
        "📖 *Помощь*\n\n"
        "*Как активировать VPN:*\n"
        "1. Нажмите /activate\n"
        "2. Перейдите по ссылке\n"
        "3. Войдите в аккаунт\n"
        "4. Следуйте инструкциям на сайте\n\n"
        "*После активации:*\n"
        "- Скачайте конфигурацию\n"
        "- Импортируйте в приложение WireGuard\n"
        "- Подключитесь!",
        parse_mode="Markdown"
    )


async def activate(update: Update, context: ContextTypes.DEFAULT_TYPE):
    """Handle /activate command."""
    user = update.effective_user
    
    async with httpx.AsyncClient() as client:
        try:
            response = await client.post(
                f"{API_URL}/api/telegram/link-start",
                json={"telegram_user_id": str(user.id)},
            )
            
            if response.status_code == 200:
                data = response.json()
                link = data.get("link", f"http://localhost:3001/claim?user={user.id}")
                
                await update.message.reply_text(
                    f"🔗 *Активация VPN*\n\n"
                    f"Перейдите по ссылке:\n{link}\n\n"
                    f"Ссылка действительна 1 час.",
                    parse_mode="Markdown"
                )
            else:
                await update.message.reply_text("❌ Ошибка. Попробуйте позже.")
        except Exception as e:
            await update.message.reply_text(f"❌ Ошибка: {str(e)[:100]}")


async def status(update: Update, context: ContextTypes.DEFAULT_TYPE):
    """Handle /status command."""
    user = update.effective_user
    
    async with httpx.AsyncClient() as client:
        try:
            response = await client.get(f"{API_URL}/api/telegram/status/{user.id}")
            
            if response.status_code == 200:
                data = response.json()
                status_text = data.get("subscription_status", "unknown")
                
                emoji = {"active": "✅", "trial": "⏳", "past_due": "⚠️", "canceled": "❌"}.get(status_text, "❓")
                await update.message.reply_text(
                    f"{emoji} *Статус:* {status_text}\n\nTelegram ID: `{user.id}`",
                    parse_mode="Markdown"
                )
            else:
                await update.message.reply_text("❌ Аккаунт не найден.")
        except Exception:
            await update.message.reply_text("❌ Ошибка проверки статуса.")


async def echo(update: Update, context: ContextTypes.DEFAULT_TYPE):
    """Handle unknown messages."""
    await update.message.reply_text("Не понимаю. Используйте /help.")


async def run_bot():
    """Run the bot."""
    if not BOT_TOKEN:
        print("ERROR: TELEGRAM_BOT_TOKEN not set")
        return
    
    app = Application.builder().token(BOT_TOKEN).connect_timeout(60).read_timeout(60).build()
    
    app.add_handler(CommandHandler("start", start))
    app.add_handler(CommandHandler("help", help_command))
    app.add_handler(CommandHandler("activate", activate))
    app.add_handler(CommandHandler("status", status))
    app.add_handler(MessageHandler(filters.TEXT & ~filters.COMMAND, echo))
    
    print("🤖 Bot starting...")
    await app.initialize()
    await app.start()
    await app.updater.start_polling(allowed_updates=Update.ALL_TYPES)
    print("🤖 Bot started.")
    
    while True:
        await asyncio.sleep(3600)


def main():
    asyncio.run(run_bot())


if __name__ == "__main__":
    main()
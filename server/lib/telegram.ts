/**
 * Telegram Bot helper — free internal staff notifications.
 *
 * Setup:
 *   1. Open @BotFather on Telegram → /newbot → copy token → set TELEGRAM_BOT_TOKEN env
 *   2. Add the bot to a group (or DM it) → send /start
 *   3. Visit https://api.telegram.org/bot<TOKEN>/getUpdates → copy chat.id
 *   4. Set TELEGRAM_STAFF_CHAT_ID env (comma-separated for multiple chats)
 *
 * If env vars are missing, calls become no-ops (silent).
 */

export async function sendTelegramMessage(text: string, chatIdOverride?: string): Promise<boolean> {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  const chatIds = chatIdOverride || process.env.TELEGRAM_STAFF_CHAT_ID;
  if (!token || !chatIds) return false;

  const ids = chatIds.split(",").map(s => s.trim()).filter(Boolean);
  let okCount = 0;

  for (const chatId of ids) {
    try {
      const res = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          chat_id: chatId,
          text,
          parse_mode: "HTML",
          disable_web_page_preview: true,
        }),
      });
      if (res.ok) okCount++;
      else {
        const body = await res.text().catch(() => "");
        console.error(`Telegram send failed for ${chatId}:`, res.status, body.slice(0, 200));
      }
    } catch (e: any) {
      console.error("Telegram send error:", e.message);
    }
  }
  return okCount > 0;
}

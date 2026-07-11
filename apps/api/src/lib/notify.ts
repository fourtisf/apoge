/**
 * Ops notifications via Telegram. Zero-config off: without
 * TELEGRAM_BOT_TOKEN + TELEGRAM_CHAT_ID env vars every call is a no-op.
 *
 * Setup: create a bot with @BotFather, add it to a private group/channel,
 * grab the chat id (e.g. via https://api.telegram.org/bot<TOKEN>/getUpdates),
 * set both env vars and restart the API.
 *
 * Fire-and-forget by design — a Telegram outage must never slow down or
 * fail a user request.
 */
import { env } from '../env';

let warnedOnce = false;

export function notifyOps(text: string): void {
  const { TELEGRAM_BOT_TOKEN: token, TELEGRAM_CHAT_ID: chatId } = env;
  if (!token || !chatId) return;
  void fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ chat_id: chatId, text, parse_mode: 'HTML', disable_web_page_preview: true }),
    signal: AbortSignal.timeout(8_000),
  })
    .then(async (res) => {
      if (!res.ok && !warnedOnce) {
        warnedOnce = true;
        console.warn(`[notify] Telegram responded ${res.status}: ${(await res.text()).slice(0, 200)}`);
      }
    })
    .catch((err) => {
      if (!warnedOnce) {
        warnedOnce = true;
        console.warn('[notify] Telegram unreachable:', err instanceof Error ? err.message : err);
      }
    });
}

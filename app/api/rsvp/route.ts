import { NextResponse } from "next/server";

/**
 * RSVP endpoint. If TELEGRAM_BOT_TOKEN and TELEGRAM_CHAT_ID are set,
 * every answer is forwarded to that chat; otherwise it is only logged.
 */
export async function POST(req: Request) {
  const body = (await req.json().catch(() => null)) as Record<string, unknown> | null;
  const name = typeof body?.name === "string" ? body.name.trim().slice(0, 120) : "";
  if (!name) return NextResponse.json({ ok: false, error: "name required" }, { status: 400 });

  const clean = (v: unknown, max = 500) => (typeof v === "string" ? v.trim().slice(0, max) : "");
  const answer = {
    name,
    phone: clean(body?.phone, 40),
    attending: body?.attending === "no" ? "no" : "yes",
    guests: Number(body?.guests) || 1,
    message: clean(body?.message),
    at: new Date().toISOString(),
  };
  console.log("[rsvp]", answer);

  const token = process.env.TELEGRAM_BOT_TOKEN;
  const chat = process.env.TELEGRAM_CHAT_ID;
  if (token && chat) {
    const text =
      `💌 RSVP\n${answer.name}${answer.phone ? ` · ${answer.phone}` : ""}\n` +
      (answer.attending === "yes" ? `✅ Придёт, гостей: ${answer.guests}` : "❌ Не сможет прийти") +
      (answer.message ? `\n«${answer.message}»` : "");
    await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ chat_id: chat, text }),
    }).catch((e) => console.error("[rsvp] telegram failed", e));
  }

  return NextResponse.json({ ok: true });
}

"use client";
import { useState } from "react";

type Status = "idle" | "sending" | "done" | "error";

export default function Rsvp() {
  const [status, setStatus] = useState<Status>("idle");
  const [attending, setAttending] = useState<"yes" | "no">("yes");

  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const data = Object.fromEntries(new FormData(e.currentTarget));
    setStatus("sending");
    try {
      const res = await fetch("/api/rsvp", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...data, attending }),
      });
      setStatus(res.ok ? "done" : "error");
    } catch {
      setStatus("error");
    }
  }

  const field =
    "w-full rounded-xl border border-champagne/30 bg-white/50 px-4 py-2 text-base outline-none placeholder:text-ink/40 focus:border-champagne focus:bg-white/80 transition";

  return (
    <div
      data-scrollable
      className="focus-in pointer-events-auto absolute inset-x-0 bottom-[5vh] mx-auto max-h-[64vh] w-[min(90vw,380px)] overflow-y-auto rounded-3xl border border-champagne/30 bg-ivory/75 p-5 shadow-[0_30px_70px_-25px_rgba(90,70,50,.5)] backdrop-blur-xl"
      style={{ animationDelay: "1.1s" }}
    >
      {status === "done" ? (
        <div className="py-8 text-center">
          <p className="foil-text font-script text-5xl">Спасибо!</p>
          <p className="mt-3 text-lg italic text-ink/80">Ваш ответ получен. До встречи на празднике!</p>
        </div>
      ) : (
        <form onSubmit={submit} className="flex flex-col gap-2.5 text-ink">
          <input name="name" required placeholder="Ваше имя и фамилия" className={field} />
          <input name="phone" type="tel" placeholder="Телефон" className={field} />
          <div className="grid grid-cols-2 gap-2">
            {(["yes", "no"] as const).map((v) => (
              <button
                type="button"
                key={v}
                onClick={() => setAttending(v)}
                className={`rounded-xl border px-3 py-2.5 text-sm transition ${
                  attending === v ? "border-champagne bg-champagne text-white" : "border-champagne/30 bg-white/40"
                }`}
              >
                {v === "yes" ? "С радостью приду" : "Не смогу прийти"}
              </button>
            ))}
          </div>
          {attending === "yes" && (
            <select name="guests" defaultValue="1" className={field}>
              {[1, 2, 3, 4, 5].map((n) => (
                <option key={n} value={n}>
                  {n === 1 ? "Буду один / одна" : `Нас будет ${n}`}
                </option>
              ))}
            </select>
          )}
          <textarea name="message" rows={2} placeholder="Пожелание молодожёнам" className={field} />
          <button
            disabled={status === "sending"}
            className="mt-1 rounded-xl bg-gradient-to-r from-[#a8885c] via-[#d8bf8e] to-[#a8885c] bg-[length:200%_100%] py-3 text-sm uppercase tracking-[0.25em] text-white shadow-md transition-[background-position] duration-700 hover:bg-right disabled:opacity-60"
          >
            {status === "sending" ? "Отправляем…" : "Отправить"}
          </button>
          {status === "error" && <p className="text-center text-sm text-red-700">Не удалось отправить, попробуйте ещё раз.</p>}
        </form>
      )}
    </div>
  );
}

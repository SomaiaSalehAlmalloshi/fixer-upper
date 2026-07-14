import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const Channel = z.enum(["email", "sms", "push", "in_app"]);
const Priority = z.enum(["low", "normal", "high", "urgent"]);
const Module = z.enum(["compliance", "credit", "market", "operational", "liquidity", "stress", "rwa", "reporting", "system"]);

const DispatchInput = z.object({
  user_id: z.string().uuid(),
  channel: Channel,
  subject: z.string().min(1).max(200),
  body: z.string().max(4000).optional(),
  priority: Priority.default("normal"),
  source_module: Module.default("system"),
  source_id: z.string().uuid().optional(),
  action_url: z.string().optional(),
  metadata: z.record(z.string(), z.any()).optional(),
});

async function sendEmail(to: string, subject: string, body: string): Promise<{ ok: boolean; error?: string }> {
  const key = process.env.LOVABLE_API_KEY;
  if (!key) return { ok: false, error: "LOVABLE_API_KEY missing" };
  try {
    const res = await fetch("https://api.lovable.dev/v1/email/send", {
      method: "POST",
      headers: { "content-type": "application/json", authorization: `Bearer ${key}` },
      body: JSON.stringify({ to, subject, html: `<div style="font-family:system-ui,sans-serif;padding:16px">${body.replace(/\n/g, "<br/>")}</div>` }),
    });
    if (!res.ok) return { ok: false, error: `email ${res.status}: ${await res.text()}` };
    return { ok: true };
  } catch (e) {
    return { ok: false, error: String(e) };
  }
}

async function sendSms(to: string, body: string): Promise<{ ok: boolean; error?: string }> {
  const key = process.env.LOVABLE_API_KEY;
  const twilio = process.env.TWILIO_API_KEY;
  const from = process.env.TWILIO_FROM_NUMBER;
  if (!key || !twilio || !from) return { ok: false, error: "Twilio connector not configured" };
  try {
    const res = await fetch("https://connector-gateway.lovable.dev/twilio/Messages.json", {
      method: "POST",
      headers: {
        authorization: `Bearer ${key}`,
        "X-Connection-Api-Key": twilio,
        "content-type": "application/x-www-form-urlencoded",
      },
      body: new URLSearchParams({ To: to, From: from, Body: body }),
    });
    if (!res.ok) return { ok: false, error: `sms ${res.status}: ${await res.text()}` };
    return { ok: true };
  } catch (e) {
    return { ok: false, error: String(e) };
  }
}

export const dispatchNotification = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((v: unknown) => DispatchInput.parse(v))
  .handler(async ({ data, context }) => {
    const { supabase } = context;

    // Check user preferences
    const { data: prefs } = await supabase
      .from("notification_preferences")
      .select("*")
      .eq("user_id", data.user_id)
      .eq("channel", data.channel)
      .in("source_module", [data.source_module, "system"]);
    const disabled = (prefs ?? []).some((p) => !p.enabled);

    // Insert record
    const { data: inserted, error: insErr } = await supabase
      .from("notifications")
      .insert({
        user_id: data.user_id,
        channel: data.channel,
        priority: data.priority,
        subject: data.subject,
        body: data.body ?? null,
        source_module: data.source_module,
        source_id: data.source_id ?? null,
        action_url: data.action_url ?? null,
        metadata: data.metadata ?? {},
        status: disabled ? "skipped" : "pending",
      })
      .select("id")
      .single();
    if (insErr) throw insErr;

    if (disabled) return { id: inserted.id, status: "skipped" as const };

    if (data.channel === "in_app" || data.channel === "push") {
      // in-app + push are stored; the client subscribes to notifications table
      await supabase.from("notifications").update({ status: "sent", sent_at: new Date().toISOString() }).eq("id", inserted.id);
      return { id: inserted.id, status: "sent" as const };
    }

    // email / sms — resolve recipient contact
    const { data: profile } = await supabase.from("profiles").select("email").eq("id", data.user_id).maybeSingle();
    const email = profile?.email;
    let phone: string | undefined;
    if (data.channel === "sms") {
      const meta = (data.metadata ?? {}) as Record<string, unknown>;
      phone = typeof meta.phone === "string" ? meta.phone : undefined;
    }

    let result: { ok: boolean; error?: string };
    if (data.channel === "email") {
      if (!email) result = { ok: false, error: "recipient has no email" };
      else result = await sendEmail(email, data.subject, data.body ?? data.subject);
    } else {
      if (!phone) result = { ok: false, error: "no phone number in metadata.phone" };
      else result = await sendSms(phone, `${data.subject}\n${data.body ?? ""}`);
    }

    await supabase
      .from("notifications")
      .update({
        status: result.ok ? "sent" : "failed",
        sent_at: result.ok ? new Date().toISOString() : null,
        error: result.error ?? null,
      })
      .eq("id", inserted.id);

    return { id: inserted.id, status: result.ok ? ("sent" as const) : ("failed" as const), error: result.error };
  });

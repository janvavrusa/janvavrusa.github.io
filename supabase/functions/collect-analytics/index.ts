import "@supabase/functions-js/edge-runtime.d.ts";
import { withSupabase } from "@supabase/server";

const corsHeaders = {
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Origin": "*",
  "Content-Type": "application/json",
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: corsHeaders });

const asString = (value: unknown, maxLength: number) =>
  typeof value === "string" && value.length > 0 && value.length <= maxLength ? value : null;

const asNonNegativeInteger = (value: unknown) =>
  Number.isInteger(value) && Number(value) >= 0 ? Number(value) : null;

const getClientIp = (request: Request) => {
  const forwardedFor = request.headers.get("x-forwarded-for");
  return request.headers.get("cf-connecting-ip") ||
    request.headers.get("x-real-ip") ||
    forwardedFor?.split(",")[0].trim() ||
    null;
};

const getGeoLocation = async (request: Request) => {
  const headerCountry = request.headers.get("cf-ipcountry") ||
    request.headers.get("x-vercel-ip-country") ||
    request.headers.get("x-country-code");
  const headerCity = request.headers.get("cf-ipcity") || request.headers.get("x-vercel-ip-city");
  const ip = getClientIp(request);

  if (!ip && !headerCountry) return { country_code: "UNKNOWN", city: null };

  if (ip) {
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 2500);
      const response = await fetch(`https://ipapi.co/${encodeURIComponent(ip)}/json/`, {
        signal: controller.signal,
        headers: { Accept: "application/json" },
      });
      clearTimeout(timeout);
      if (response.ok) {
        const data = await response.json();
        return {
          country_code: asString(data.country_code, 3)?.toUpperCase() || "UNKNOWN",
          city: asString(data.city, 100),
        };
      }
    } catch {
      // Fall back to trusted hosting headers when the GeoIP request fails.
    }
  }

  return {
    country_code: headerCountry?.trim().toUpperCase().slice(0, 3) || "UNKNOWN",
    city: headerCity ? decodeURIComponent(headerCity).slice(0, 100) : null,
  };
};

export default {
  fetch: withSupabase({ auth: ["publishable"] }, async (request, context) => {
    if (request.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
    if (request.method === "HEAD") return new Response(null, { status: 204, headers: corsHeaders });
    if (request.method !== "POST") return json({ error: "POST required" }, 405);

    let payload: Record<string, unknown>;
    try {
      payload = await request.json();
    } catch {
      return json({ error: "Invalid JSON" }, 400);
    }

    const eventName = asString(payload.event_name, 40);
    const sessionId = asString(payload.session_id, 100);
    if (!eventName || !sessionId) {
      return json({ error: "event_name and session_id are required" }, 400);
    }

    const allowedEvents = new Set(["session_start", "section_view", "section_leave", "section_skip", "session_end"]);
    if (!allowedEvents.has(eventName)) return json({ error: "Unsupported event_name" }, 400);

    const sectionIndex = asNonNegativeInteger(payload.section_index);
    const visibleMs = asNonNegativeInteger(payload.visible_ms);
    const visitNumber = asNonNegativeInteger(payload.visit_number);
    const session: Record<string, unknown> = {
      session_id: sessionId,
      visitor_id: asString(payload.visitor_id, 100),
      started_at: asString(payload.started_at, 40) || undefined,
      ended_at: asString(payload.ended_at, 40) || undefined,
      duration_ms: asNonNegativeInteger(payload.duration_ms),
      latency_avg_ms: asNonNegativeInteger(payload.latency_avg_ms),
      latency_jitter_ms: asNonNegativeInteger(payload.latency_jitter_ms),
      max_section_reached: asNonNegativeInteger(payload.max_section_reached),
    };

    if (eventName === "session_start") {
      Object.assign(session, await getGeoLocation(request));
    }

    const event = {
      session_id: sessionId,
      event_name: eventName,
      section_key: asString(payload.section_key, 100),
      section_index: sectionIndex,
      visible_ms: visibleMs,
      visit_number: visitNumber,
      navigation_method: asString(payload.navigation_method, 30),
      entered_at: asString(payload.entered_at, 40) || undefined,
      left_at: asString(payload.left_at, 40) || undefined,
    };

    const { error: sessionError } = await context.supabaseAdmin
      .from("sessions")
      .upsert(session, { onConflict: "session_id" });
    if (sessionError) {
      console.error("sessions insert failed", sessionError.message);
      return json({ error: "Could not store session" }, 500);
    }

    if (eventName === "session_start") return json({ ok: true });

    const { error: eventError } = await context.supabaseAdmin.from("section_events").insert(event);
    if (eventError) {
      console.error("section event insert failed", eventError.message);
      return json({ error: "Could not store event" }, 500);
    }

    return json({ ok: true });
  }),
};

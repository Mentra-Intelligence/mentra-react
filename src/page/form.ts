/**
 * Submit a `form` page block from the browser, straight to the tenant's
 * service. Mentra never receives the submission.
 *
 * A plain function with no React in it, so a site's own `"use client"` form
 * component can call it (the default `FormBlock` is a native form and needs
 * no script). Follows the recipes in Mentra's `06c-pages.md`:
 * - `webhook`: a form-encoded POST with `mode: "no-cors"`, so it reaches an
 *   endpoint that sends no CORS headers; the reply can't be read, so `"sent"`
 *   means the browser sent it.
 * - `mailchimp`: Mailchimp's JSONP endpoint, which answers success or error.
 *   Your `script-src` CSP must allow the `list-manage.com` host.
 * - `hubspot`: a JSON POST; a non-2xx reply throws.
 */
import type { FormResolved } from "./types";

export interface MentraFormValues {
  email: string;
  name?: string;
  /** Whether the consent checkbox was ticked. */
  consent?: boolean;
  /** The hidden bot-trap input's value. Non-empty: nothing is sent. */
  honeypot?: string;
}

export interface MentraFormOptions {
  /** HubSpot's `context`; defaults to the current page. */
  pageUri?: string;
  pageName?: string;
}

/** `"sent"`: submitted. `"skipped"`: the honeypot was filled, so nothing was sent; show success anyway. */
export type MentraFormResult = "sent" | "skipped";

function liveUrl(value: unknown): string {
  if (typeof value !== "string" || !/^https:\/\//i.test(value)) {
    throw new Error("This form has no live destination.");
  }
  return value;
}

/** Load Mailchimp's JSONP reply; resolves with `{result, msg}`. */
function mailchimpJsonp(url: string): Promise<{ result?: string; msg?: string }> {
  return new Promise((resolve, reject) => {
    const callback = `mentraMailchimp${Date.now().toString(36)}${Math.random().toString(36).slice(2)}`;
    const script = document.createElement("script");
    const w = window as unknown as Record<string, unknown>;
    const timer = setTimeout(() => done(new Error("Mailchimp did not answer.")), 15000);
    function done(error: Error | null, reply?: { result?: string; msg?: string }) {
      clearTimeout(timer);
      delete w[callback];
      script.remove();
      if (error) reject(error);
      else resolve(reply ?? {});
    }
    w[callback] = (reply: { result?: string; msg?: string }) => done(null, reply);
    script.onerror = () => done(new Error("Could not reach Mailchimp."));
    script.src = `${url}&c=${callback}`;
    document.head.appendChild(script);
  });
}

/**
 * Send `values` to the destination in `resolved`. Throws on a preview read,
 * on a missing destination, or when the service reports a failure.
 */
export async function submitMentraForm(
  resolved: Partial<FormResolved> | null | undefined,
  values: MentraFormValues,
  options: MentraFormOptions = {},
): Promise<MentraFormResult> {
  if (!resolved || resolved.preview !== false) {
    throw new Error("Preview: submitting is off.");
  }
  if (values.honeypot) return "skipped";
  const f = resolved.fieldNames;
  if (!f || typeof f.email !== "string") throw new Error("This form has no live destination.");
  const name = values.name?.trim();

  if (resolved.type === "hubspot") {
    const fields = [{ name: f.email, value: values.email }];
    if (name && f.name) fields.push({ name: f.name, value: name });
    const loc = typeof window !== "undefined" ? window.location.href : undefined;
    const title = typeof document !== "undefined" ? document.title : undefined;
    const res = await fetch(liveUrl(resolved.submitUrl), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        fields,
        context: { pageUri: options.pageUri ?? loc, pageName: options.pageName ?? title },
      }),
    });
    if (!res.ok) throw new Error(`HubSpot refused the submission (${res.status}).`);
    return "sent";
  }

  const params = new URLSearchParams({ [f.email]: values.email });
  if (name && f.name) params.set(f.name, name);
  if (values.consent && f.consent) params.set(f.consent, "yes");
  if (resolved.honeypotField) params.set(resolved.honeypotField, "");

  if (resolved.type === "mailchimp") {
    const reply = await mailchimpJsonp(`${liveUrl(resolved.jsonpUrl)}&${params}`);
    if (reply.result !== "success") throw new Error(reply.msg || "Mailchimp refused the submission.");
    return "sent";
  }
  if (resolved.type === "webhook") {
    await fetch(liveUrl(resolved.submitUrl), { method: "POST", body: params, mode: "no-cors" });
    return "sent";
  }
  throw new Error("This form has no live destination.");
}

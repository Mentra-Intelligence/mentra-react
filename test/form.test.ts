import { afterEach, describe, expect, it, vi } from "vitest";
import { submitMentraForm, type FormResolved } from "../src";

const HOOK: FormResolved = {
  type: "webhook", method: "POST", preview: false, submitUrl: "https://hooks.zapier.com/hooks/catch/1/abc/",
  encoding: "form", fieldNames: { email: "email", name: "name", consent: "consent" }, honeypotField: "_gotcha",
};
const HUBSPOT: FormResolved = {
  type: "hubspot", method: "POST", preview: false,
  submitUrl: "https://api.hsforms.com/submissions/v3/integration/submit/123/0f1e2d3c-4b5a-6978-8796-a5b4c3d2e1f0",
  encoding: "json", fieldNames: { email: "email", name: "firstname", consent: null }, honeypotField: "_gotcha",
};

const MAILCHIMP: FormResolved = {
  type: "mailchimp", method: "POST", preview: false,
  submitUrl: "https://acme.us1.list-manage.com/subscribe/post?u=abc&id=def",
  jsonpUrl: "https://acme.us1.list-manage.com/subscribe/post-json?u=abc&id=def",
  encoding: "form", fieldNames: { email: "EMAIL", name: "FNAME", consent: null }, honeypotField: "b_abc_def",
};

/** A fake page whose `<script>` loads answer the JSONP callback with `reply`. */
function stubPage(reply: { result: string; msg?: string }) {
  const win: Record<string, unknown> = {};
  const scripts: { src: string }[] = [];
  vi.stubGlobal("window", win);
  vi.stubGlobal("document", {
    createElement: () => ({ src: "", remove() {}, onerror: null }),
    head: {
      appendChild(script: { src: string }) {
        scripts.push(script);
        const callback = new URL(script.src).searchParams.get("c")!;
        queueMicrotask(() => (win[callback] as (r: unknown) => void)(reply));
      },
    },
  });
  return { win, scripts };
}

function stubFetch(status = 200) {
  const fetch = vi.fn(async () => new Response(null, { status }));
  vi.stubGlobal("fetch", fetch);
  return fetch;
}

afterEach(() => vi.unstubAllGlobals());

describe("submitMentraForm", () => {
  it("posts a webhook form-encoded, with the empty honeypot", async () => {
    const fetch = stubFetch();
    await expect(submitMentraForm(HOOK, { email: "ada@example.com", name: " Ada ", consent: true })).resolves.toBe("sent");
    const [url, init] = fetch.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe(HOOK.submitUrl);
    expect(init.mode).toBe("no-cors");
    expect(String(init.body)).toBe("email=ada%40example.com&name=Ada&consent=yes&_gotcha=");
  });

  it("posts HubSpot JSON without the honeypot, and throws on a refusal", async () => {
    const fetch = stubFetch();
    await submitMentraForm(HUBSPOT, { email: "ada@example.com", name: "Ada", consent: true }, { pageUri: "https://www.example.com/n", pageName: "N" });
    const [, init] = fetch.mock.calls[0] as unknown as [string, RequestInit];
    expect(JSON.parse(String(init.body))).toEqual({
      fields: [{ name: "email", value: "ada@example.com" }, { name: "firstname", value: "Ada" }],
      context: { pageUri: "https://www.example.com/n", pageName: "N" },
    });
    stubFetch(400);
    await expect(submitMentraForm(HUBSPOT, { email: "x" }, { pageUri: "u", pageName: "n" })).rejects.toThrow("400");
  });

  it("sends Mailchimp over JSONP and reads its answer", async () => {
    const { win, scripts } = stubPage({ result: "success" });
    await expect(submitMentraForm(MAILCHIMP, { email: "ada@example.com", name: "Ada", consent: true })).resolves.toBe("sent");
    const url = new URL(scripts[0].src);
    expect(`${url.origin}${url.pathname}`).toBe("https://acme.us1.list-manage.com/subscribe/post-json");
    expect(url.searchParams.get("EMAIL")).toBe("ada@example.com");
    expect(url.searchParams.get("FNAME")).toBe("Ada");
    expect(url.searchParams.get("b_abc_def")).toBe("");
    expect(url.searchParams.has("consent")).toBe(false);
    expect(Object.keys(win)).toEqual([]); // the callback is cleaned up

    stubPage({ result: "error", msg: "Already subscribed" });
    await expect(submitMentraForm(MAILCHIMP, { email: "ada@example.com" })).rejects.toThrow("Already subscribed");
  });

  it("refuses a Mailchimp JSONP URL on another host, since it would run as script", async () => {
    const { scripts } = stubPage({ result: "success" });
    for (const jsonpUrl of ["https://evil.example.com/x?u=1", "https://list-manage.com.evil.example/x?u=1", null]) {
      await expect(submitMentraForm({ ...MAILCHIMP, jsonpUrl }, { email: "ada@example.com" })).rejects.toThrow();
    }
    expect(scripts).toEqual([]);
  });

  it("sends nothing when the honeypot is filled", async () => {
    const fetch = stubFetch();
    await expect(submitMentraForm(HOOK, { email: "bot@example.com", honeypot: "spam" })).resolves.toBe("skipped");
    expect(fetch).not.toHaveBeenCalled();
  });

  it("refuses a preview or a missing destination", async () => {
    const fetch = stubFetch();
    for (const resolved of [
      null, { ...HOOK, preview: true }, { ...HOOK, preview: undefined }, { ...HOOK, submitUrl: null },
      { ...HOOK, submitUrl: "http://hooks.zapier.com/x" },
    ]) {
      await expect(submitMentraForm(resolved as never, { email: "ada@example.com" })).rejects.toThrow();
    }
    expect(fetch).not.toHaveBeenCalled();
  });
});

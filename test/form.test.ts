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

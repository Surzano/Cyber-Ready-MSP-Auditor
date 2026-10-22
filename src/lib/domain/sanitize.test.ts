import { describe, expect, it } from "vitest";
import { emailDomainOf, sanitizeDomain } from "./sanitize";

describe("sanitizeDomain", () => {
  it.each([
    ["example.org", "example.org"],
    ["  Example.ORG.  ", "example.org"],
    ["https://www.hopevalley.org/donate?x=1#top", "www.hopevalley.org"],
    ["http://hopevalley.org:8080/path", "hopevalley.org"],
    ["mailto:ed@hopevalley.org", "hopevalley.org"],
    ["ed@hopevalley.org", "hopevalley.org"],
    ["*.hopevalley.org", "hopevalley.org"],
    ["xn--bcher-kva.example.de", "xn--bcher-kva.example.de"],
  ])("accepts %j → %s", (input, expected) => {
    expect(sanitizeDomain(input)).toBe(expected);
  });

  it.each([
    "",
    "localhost",
    "10.0.0.1",
    "192.168.1.1",
    "[::1]",
    "printer.local",
    "db.internal",
    "nas.lan",
    "foo.test",
    "a.example",
    "-bad.org",
    "bad-.org",
    "under_score.org",
    `${"a".repeat(64)}.org`,
    `${"a.".repeat(127)}org`,
  ])("rejects %j", (input) => {
    expect(sanitizeDomain(input)).toBeNull();
  });
});

describe("emailDomainOf", () => {
  it("strips a leading www.", () => {
    expect(emailDomainOf("www.hopevalley.org")).toBe("hopevalley.org");
    expect(emailDomainOf("mail.hopevalley.org")).toBe("mail.hopevalley.org");
  });
});

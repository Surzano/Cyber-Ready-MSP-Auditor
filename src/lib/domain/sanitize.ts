/**
 * Turns whatever a user pastes ("https://www.Example.org/donate?x=1", "mailto:ed@example.org",
 * " example.org. ") into a bare, lowercase hostname, or returns null if it isn't a public domain.
 */
export function sanitizeDomain(input: string): string | null {
  if (!input) return null;
  let s = input.trim().toLowerCase();
  s = s.replace(/^mailto:/, "");
  if (s.includes("@")) s = s.slice(s.lastIndexOf("@") + 1);
  s = s.replace(/^[a-z][a-z0-9+.-]*:\/\//, ""); // scheme
  s = s.split(/[/?#\\]/)[0]; // path, query, fragment
  s = s.replace(/:\d+$/, ""); // port
  s = s.replace(/\.$/, ""); // trailing dot
  s = s.replace(/^\*\./, "");
  if (s.length > 253) return null;

  const labels = s.split(".");
  if (labels.length < 2) return null;
  const labelOk = /^(?!-)[a-z0-9-]{1,63}(?<!-)$/;
  if (!labels.every((l) => labelOk.test(l) || /^xn--[a-z0-9-]+$/.test(l))) return null;
  // TLD must be alphabetic (or punycode) — rejects raw IPv4 like 10.0.0.1
  const tld = labels[labels.length - 1];
  if (!/^[a-z]{2,63}$/.test(tld) && !tld.startsWith("xn--")) return null;

  const blockedSuffixes = ["localhost", "local", "internal", "intranet", "lan", "home", "corp", "test", "invalid", "example"];
  if (blockedSuffixes.includes(tld)) return null;
  return s;
}

/** Strip a leading "www." so email checks run on the organizational domain. */
export function emailDomainOf(domain: string): string {
  return domain.startsWith("www.") ? domain.slice(4) : domain;
}

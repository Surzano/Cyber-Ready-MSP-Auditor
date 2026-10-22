# Domain scanner validation

Run 2026-10-22 17:46 UTC against http://localhost:3123 · 25 domains · 0 scan errors

**Overall agreement: 148 of 148 comparisons (100%).**

| Check | Agreed | Rate |
|---|---|---|
| SPF policy | 23 of 23 | 100% |
| DMARC policy | 25 of 25 | 100% |
| HSTS | 20 of 20 | 100% |
| CSP | 20 of 20 | 100% |
| Clickjacking | 20 of 20 | 100% |
| X-Content-Type-Options | 20 of 20 | 100% |
| Referrer-Policy | 20 of 20 | 100% |

## How this was checked

- **SPF and DMARC:** records fetched separately from Cloudflare's public DNS and read by a simple parser that shares no code with the app. SPF compares the final `all` rule; DMARC compares the `p=` policy. SPF records that use `redirect=` are not compared, because the simple parser doesn't follow them.
- **Security headers:** fetched directly from each website and compared with the header values MSP Auditor recorded. Only presence is compared; the app's quality grade is shown in brackets. When the app couldn't reach a website (a timeout, or a page that blocks automated checks), it leaves the website ungraded and those rows are not compared.
- **Mozilla Observatory:** an independent website grade, shown for context only. It weighs more headers than the app checks, so the grades aren't expected to match.

## Results

| Domain | MSP Auditor grade | SPF (ours / independent) | DMARC (ours / independent) | Headers agreed | Website pts | Mozilla Observatory |
|---|---|---|---|---|---|---|
| redcross.org | B (88) | ✓ ~all / ~all | ✓ reject / reject | 5/5 | 34/40 | D (30) |
| unicef.org | A+ (97) | ✓ -all / -all | ✓ reject / reject | 5/5 | 37/40 | B (70) |
| habitat.org | C (72) | ✓ ~all / ~all | ✓ quarantine / quarantine | 5/5 | 25/40 | C (50) |
| unitedway.org | C (73) | ✓ ~all / ~all | ✓ quarantine / quarantine | 5/5 | 34/40 | D (30) |
| feedingamerica.org | B (84) | ✓ -all / -all | ✓ quarantine / quarantine | 5/5 | 34/40 | B (70) |
| wikimedia.org | C (75) | ✓ ~all / ~all | ✓ reject / reject | 5/5 | 21/40 | C (50) |
| savethechildren.org | C (77) | ✓ ~all / ~all | ✓ reject / reject | 0/0 | not graded | D- (25) |
| worldwildlife.org | B (88) | ✓ -all / -all | ✓ quarantine / quarantine | 0/0 | not graded | C+ (60) |
| goodwill.org | B (82) | – ~all / redirect | ✓ reject / reject | 0/0 | not graded | F (10) |
| bgca.org | F (59) | – -all / redirect | ✓ none / none | 5/5 | 21/40 | F (0) |
| nature.org | F (56) | ✓ ?all / ?all | ✓ quarantine / quarantine | 5/5 | 29/40 | F (20) |
| charitywater.org | B (84) | ✓ ~all / ~all | ✓ quarantine / quarantine | 5/5 | 37/40 | B (75) |
| kiva.org | C (72) | ✓ ~all / ~all | ✓ none / none | 5/5 | 37/40 | B (75) |
| eff.org | F (59) | ✓ -all / -all | ✓ none / none | 5/5 | 18/40 | C (50) |
| khanacademy.org | A (94) | ✓ -all / -all | ✓ reject / reject | 5/5 | 34/40 | D (30) |
| girlscouts.org | D (67) | ✓ -all / -all | ✓ none / none | 5/5 | 29/40 | B- (65) |
| bbbs.org | C (73) | ✓ -all / -all | ✓ reject / reject | 5/5 | 16/40 | D (35) |
| specialolympics.org | F (54) | ✓ -all / -all | ✓ none / none | 5/5 | 16/40 | D- (25) |
| stjude.org | B (88) | ✓ ~all / ~all | ✓ reject / reject | 5/5 | 34/40 | F (20) |
| americares.org | A (95) | ✓ -all / -all | ✓ reject / reject | 0/0 | not graded | C (55) |
| directrelief.org | D (63) | ✓ ~all / ~all | ✓ quarantine / quarantine | 5/5 | 16/40 | D (30) |
| care.org | C (75) | ✓ -all / -all | ✓ quarantine / quarantine | 5/5 | 25/40 | D (30) |
| heifer.org | B (81) | ✓ ~all / ~all | ✓ reject / reject | 5/5 | 27/40 | unavailable (The site seems to be down.) |
| mozilla.org | A (91) | ✓ ~all / ~all | ✓ reject / reject | 5/5 | 37/40 | B+ (80) |
| doctorswithoutborders.org | F (55) | ✓ ~all / ~all | ✓ none / none | 0/0 | not graded | B (75) |

## Disagreements to review

Check each one by hand with the linked tools and note which side was right.

None.

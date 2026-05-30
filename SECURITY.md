# Security Policy

Dryline takes the security and privacy of its users — and of the Texans whose
public environmental data it surfaces — seriously. Thank you for helping keep
the project and its community safe.

## Reporting a vulnerability

**Please do not open a public issue for security vulnerabilities.**

Instead, report them privately through either of these channels:

- **GitHub:** use [private vulnerability reporting](https://github.com/willhines90/dryline/security/advisories/new)
  (Security tab → "Report a vulnerability").
- **Email:** [mail@willhin.es](mailto:mail@willhin.es) with `SECURITY` in the
  subject line.

Please include:

- A description of the vulnerability and its potential impact.
- Steps to reproduce, or a proof of concept.
- Affected component(s) — `mcp/`, `web/`, the agent skill, or deployment.
- Any suggested remediation, if you have one.

### What to expect

- **Acknowledgement** within 3 business days.
- **An initial assessment** within 7 business days.
- We will keep you informed as we work on a fix, and credit you in the release
  notes once it ships — unless you prefer to remain anonymous.

Dryline is an independently maintained project, handled on a best-effort
basis. We will move as quickly as we reasonably can.

## Scope

Things we especially care about:

- **Privacy leakage.** Dryline must never surface the names of individual
  private well owners or water-rights holders. Any path that exposes
  individual-level private data is a high-priority report.
- **Address handling.** Addresses entered for investigation should not be
  logged, retained, or transmitted beyond what is needed to query upstream
  public APIs.
- **Subscribe form.** The email-capture flow stores an address with no auth and
  no accounts; report anything that leaks or misuses those addresses.
- **Injection / SSRF** through the MCP tools or the `investigate` route.
- **Dependency vulnerabilities** with a practical exploit path.

## Out of scope

- The accuracy or freshness of upstream public datasets (TWDB, EPA ECHO, USGS,
  USDM, etc.). Data quality is communicated through structured `caveats`, not
  treated as a security issue.
- Findings that require physical access to a user's device.
- Reports generated purely by automated scanners with no demonstrated impact.

## A note on responsible use

Dryline drafts civic-action artifacts (public comments, GCD letters, Public
Information Act requests) but never auto-submits them, and it does not provide
legal or health advice. Please report any behavior that contradicts these
guarantees — we consider it a safety issue.

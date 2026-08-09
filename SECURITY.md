# Security Policy

## Supported versions

Security fixes are applied on the default branch (`main`) of this repository.

## Reporting a vulnerability

Please **do not** open a public GitHub issue for security-sensitive reports.

Prefer one of:

1. [GitHub Security Advisories](https://github.com/Kura-Finance/mobile-app/security/advisories/new) (private report), or
2. Email **security@kura-finance.com** with a clear description, impact, and reproduction steps.

We aim to acknowledge reports within **7 days** and to keep you updated while we investigate.

## Scope

In scope for this repository:

- Mobile client code (Expo / React Native)
- Local key material handling, SecureStore usage, WalletConnect approval UI
- Misconfiguration that exposes secrets in the published client

Out of scope (report to the relevant operator):

- Hosted backend (`EXPO_PUBLIC_API_BASE_URL` / `api.*`) — separate service
- Third-party SaaS (Privy, Reown, Pimlico, Li.Fi, Morpho, …)
- Social engineering, physical device attacks, or issues requiring rooted/jailbroken devices with no realistic additional impact

## Safe harbor

We will not pursue legal action against researchers who:

- Make a good-faith effort to avoid privacy violations and service disruption
- Report promptly and do not exploit the issue beyond what is needed to demonstrate it
- Do not publicly disclose before we have had a reasonable time to remediate

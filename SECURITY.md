# Security Policy

## Supported versions

Security updates are provided for the latest `0.1.x` release.

| Version | Supported |
| --- | --- |
| Latest `0.1.x` | Yes |
| Older releases | No |

## Reporting a vulnerability

Do not open a public issue for a suspected vulnerability.

Use [GitHub's private vulnerability reporting](https://github.com/GTuritto/quorum/security/advisories/new)
when possible. If that channel is unavailable, email `giuseppe@turitto.com`
with:

- The affected version and platform
- Reproduction steps or a proof of concept
- The expected security impact
- Any known mitigations

You should receive an acknowledgment within seven days. Please allow time to
investigate and prepare a coordinated fix before public disclosure.

## Scope

Relevant reports include installer path handling, unsafe replacement or backup
behavior, terminal-state handling, payload integrity, and prompt instructions
that could expand permissions or misrepresent model provenance.

# License exceptions

cdp-web is licensed to the public under AGPL-3.0-or-later (see [`LICENSE`](LICENSE)).

Oliver Larkin is the sole copyright holder in the AGPL-licensed portion of this
repository — `index.html`, `src/`, `scripts/`, `recipes/` and the design assets.
A sole copyright holder is not bound by the terms they offer to everyone else,
and may license the same work differently to specific parties. The grants below
are that: additional licenses running *alongside* the AGPL, not amendments to it.

## Grant 1 — sibling projects in the cdp-wasm suite

Oliver Larkin additionally licenses the AGPL-covered portion of cdp-web, in
source and binary form, to the following projects under the **Apache License,
Version 2.0**:

- [cdp-plugin](https://github.com/cdp-wasm-suite/cdp-plugin)
- [cdp-extension](https://github.com/cdp-wasm-suite/cdp-extension)

This lets those projects embed cdp-web without their combined distribution
becoming AGPL, and without the AGPL §13 network-source obligation attaching to
their users.

## Grant 2 — distribution channels with conflicting terms

Oliver Larkin additionally licenses the AGPL-covered portion of cdp-web to
himself, for the purpose of distributing binaries through channels whose terms
are incompatible with the AGPL. This is needed because:

- **Apple's App Store** imposes DRM and per-device install limits. AGPL §10
  forbids imposing further restrictions on downstream recipients, which is why
  VLC was removed from the store. Any App Store build of a cdp-wasm-suite
  product relies on this grant.
- **AAX**, if ever targeted, is NDA-proprietary and admits no copyleft at all.

The plugin-format SDKs currently in use need no exception: VST3 is MIT (© 2025
Steinberg Media Technologies GmbH — Steinberg relicensed from the old
GPL-3.0-or-proprietary dual scheme), CLAP is MIT, and Audio Unit comes with the
macOS SDK. All are permissive and combine with AGPL freely.

## What these grants do NOT cover

**They reach only Oliver Larkin's own copyright.** cdp-web ships third-party
components that are somebody else's work, and no grant here can relicense them:

| Component | Holder | License |
|---|---|---|
| `vendor/cdp-wasm/wasm/*.wasm` | Trevor Wishart, Richard Dobson, Martin Atkins, Composers Desktop Project Ltd | LGPL-2.1-or-later |
| `vendor/@grame/faustwasm` | GRAME-CNCM | LGPL |
| `vendor/monaco-editor` | Microsoft | MIT |

The MIT component is unproblematic anywhere. The **LGPL** components are not
fully settled for App Store distribution: LGPL-2.1 §6 requires that recipients
be able to modify the library and relink, and store terms restrict that. This is
less contested than the GPL case — plenty of LGPL libraries ship on the App
Store — but it is a live question, and Grant 2 does nothing to resolve it,
because the copyright belongs to CDP Ltd and GRAME rather than to Oliver Larkin.
Anyone shipping to a restrictive store should evaluate that separately, and
ideally get written permission from those holders.

## Conditions on the grants

These grants do not extend to third parties. A fork of cdp-web, or any other
work embedding it, receives it under the AGPL alone.

Both grants are revocable as to future versions, but not retroactively: a
release already distributed under a grant stays distributed under it.

## Provenance

Recording an exception is only meaningful while the copyright stays undivided.
If cdp-web ever accepts outside contributions, a CLA or copyright assignment
must be in place **before** the first one is merged — otherwise these grants can
no longer be made for the affected code, and dual licensing becomes impossible
to offer without tracking down every past contributor.

## Commercial licensing

Separate proprietary licenses are available on the same basis. Contact
[olilarkin.com](https://www.olilarkin.com/).

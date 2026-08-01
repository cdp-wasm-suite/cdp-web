# Saving, opening & sharing patches

A patch — the windows, cables, parameter values, envelopes and Faust code on
your desk — saves as a single **`.cdp` file** (plain JSON inside, so it travels
well and diffs cleanly). This page covers getting patches on and off your
machine, and sharing them as links.

## Saving

- **File ▸ Save patch…** saves under the patch's name. The first save asks for
  a name; after that it saves silently under the same one.
- **File ▸ Save patch as…** names (or renames) the patch. The name is kept
  *inside* the patch, so it survives reloads, share links and other machines.

In **Chrome and Edge** saving uses a real OS save dialog — pick any folder, and
subsequent saves **overwrite that same file in place**, like a desktop app.
Opening a patch keeps the same connection: Save after Open updates the file you
opened. In other browsers (Safari, Firefox) saves download to your Downloads
folder instead.

Rendered sounds work the same way: the Output window's **↓ Save** (and the
waveform editor's region export) opens an OS save dialog in Chrome/Edge and
downloads elsewhere.

## Opening

- **File ▸ Open patch…** — pick a `.cdp` file (older `.cdpweb.json` saves open
  too).
- Or just **drag the file from your computer onto the desk**.

Opening replaces the whole desk, like File ▸ New patch. Your work-in-progress
is autosaved per browser, so closing the tab never loses the current patch.

## Share links

**File ▸ Share patch…** — or the **↗ share button** in the menu bar, which is
there on a phone too — packs the entire patch into a URL (compressed, in the
part after `#`, so nothing is uploaded anywhere — the link *is* the patch).
A dialog explains what travels, lets you **name the patch** (the name is the
patch's own — it travels with the link and stays on your copy, where Save uses
it), and then offers **Copy link**, plus **Share…** where the platform has a
share sheet (phones, macOS Safari) to hand the link straight to Messages, Mail
or anything else. Opening a link loads the patch, asking first if the recipient
already has a patch of their own on the desk.

What travels in a link:

- **Everything structural** — windows, cables, parameters, envelopes, Faust
  code, tempo, the patch name.
- **Generator and tone sources** — they re-synthesise themselves on open.
- **URL sources** — a Source loaded from a web address stores just the address
  and re-fetches the audio on open.

What doesn't: **audio picked from disk**. A file on your computer can't ride
along in a URL, so those Sources open *empty* for the recipient — the share
dialog says so and names them. To make a patch fully shareable, host the
audio somewhere public and load it with the Source's **URL…** button.

### Opening a link by hand

Following a link is the usual way in, but a link can also be **pasted**:

- **File ▸ Open shared link…** takes a pasted link (surrounding text and all —
  it finds the link in what you paste) and opens the patch it carries.
- **Pasting a link onto the desk** (⌘V / Ctrl-V) does the same. A share link is
  a whole patch rather than a fragment to add to this one, so it opens instead
  of pasting — after asking, since it replaces what's on the desk.

This is the way in for an app **added to an iOS home screen**. iOS opens links
in the browser and will not hand them to an installed web app — so copy the
link where you received it, then paste it in. (Android is different: an
installed copy captures its own links, and one opens the app directly.)

## URL sources

A Source window's **URL…** button loads audio from a web address instead of a
local file. WAV and AIFF load directly; other formats (mp3, flac…) are decoded
by the browser. Because only the address is stored, URL sources are the one
source kind that survives save/load and share links with sound intact.

One catch: the server hosting the file must allow cross-origin (CORS) fetches —
if it doesn't, the log says so. Raw files on public code/file hosts generally
work.

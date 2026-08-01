# Banks and multichannel sound

Some CDP programs don't fit the one-sound-in, one-sound-out mould. This page
covers the two ways that shows up in the patcher: **banks** (a set of sounds on
one cable) and **multichannel output** (effects that decide their own channel
count).

## Banks: a set of sounds on one cable

A handful of effects produce *several* files from one input — **partition**
splits a sound into interleaved wavesets, **isolate** cuts it at silences or
threshold crossings, **envcut**, **distcut** and **cantor** slice by envelope or
by Cantor-set holes. How many pieces you get depends on the sound itself, so it
isn't known until the effect runs.

Bank machinery is marked wherever you browse for effects: a **▣ suffix** in the
Process menu, and **▣ bank out** / **▣ bank in** tags in the quick-add palette
(⌘K) — typing "bank" there finds them all.

Rather than a cable per piece, the whole set travels **one bank cable** from the
effect's **▣ stacked-square** output. A bank cable can go to:

- **An Output window** — it lists every sound in the bank with its own play ▶
  and save ↓ button (plus **Save all**).
- **A Pick node** *(Process ▸ Control ▸ Pick from bank)* — extracts one sound
  (the **Item** slider chooses which) as ordinary audio, ready for any further
  processing. Add several Picks to the same bank cable to process different
  pieces differently. The **▶ Audition** button renders up to the Pick and plays
  its current item.
- **A multi-input effect's bank input** — see below.

## Multi-input effects

The mirror image: **rejoin** reassembles partitioned pieces, and the mix-family
effects — **multimix**, **panorama** — place *N* sounds in a
multichannel image. These effects have a **▣ bank input** alongside their normal
`in` socket:

- Cable a multi-output effect straight in: `partition → rejoin` is a single
  bank cable — the first sound of the bank becomes the main input and the rest
  become the extra inputs.
- Or collect arbitrary sounds with a **Gather node** *(Process ▸ Control ▸
  Gather to bank)*: it has growable audio inputs (**+ input** / **− input**) and
  one bank output. Feed each sound its own socket, then run one cable onward.

If both `in` and the bank input are cabled, `in` is the main sound and the whole
bank supplies the extras.

## Splitting a stereo file (process L and R separately)

**Split channels** (Process ▸ Mix) turns any sound into a bank of mono files,
one per channel, left first. Take each side with a **Pick** (item 1 = left,
item 2 = right), process the chains independently, then **Join channels
(interleave)** puts two mono sounds back into one stereo file (first input →
left). The *Stereo split-process* recipe is a working example. For wider
files, rejoin N processed channels with a Gather into *Spread to channels*.

## Multichannel output

Spatialising effects — **crumble** (8 or 16 channels), **tangent**, **transit**,
**panorama**, **multimix**, the `mchan` family, **wrappage** and friends — set
their **own output channel count** regardless of the input. In the patcher these
behave like any other effect; the multichannel-ness shows up at the ends of the
chain:

- **Saving** always keeps the full channel count — an 8-channel render saves an
  8-channel WAV, ready for a multichannel rig or a DAW surround track.
- **Playback** asks your output device for the file's channel count. On a
  multichannel interface you hear true discrete playback; on a stereo device the
  app folds the channels down (odd → left, even → right) so you still hear
  *everything* while auditioning.
- The mini waveform scope composites all channels; pop it out (click the
  waveform) for a per-channel lane view.

The ⓘ readout on a Source window shows a file's channel count, and each
effect's **?** help notes when it sets its own channels.

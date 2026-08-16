# Common error fixes

> Status: source-of-truth
> Goal: map a parse/reference failure to a one-step fix. Do not retry preview.

## What this is

A repair table. Error → meaning → why → how AI should patch.

## When to use

When the tool returns a schema or reference error after emit.

## Hard rules

- If parse fails, fix JSON. Do not debug preview.
- Duplicate ids and missing refs fail **before** compile.
- Extra keys fail because the object is `.strict()`.
- Root missing `zIndex` / `timing` is a layer rule (details in Layers docs).

## Quick reference

| Error | Meaning | Why it happened | How AI should fix it |
| --- | --- | --- | --- |
| `formatVersion` ≠ 1 | Wrong discriminator | Model emitted 2 or omitted | Set `formatVersion: 1` |
| Unrecognized key / extra key | Strict object | `scenes`, `visualTracks`, `locked`, `modifiers` | Delete the key |
| Duplicate id | Two layers/assets/variables/bindings share an id | Copied a block | Unique kebab-case ids |
| Missing asset ref | `payload.assetId` not in `assets[]` | Invented id | Add asset or change id |
| Missing variable ref | Binding `variableId` unknown | Typo | Add variable or fix id |
| Root requires `zIndex` | Root layer incomplete | Omitted | Unique sibling zIndex |
| Root requires `timing` | Root layer incomplete | Omitted | `{ start, duration }` |
| Audio must be project root | Nested audio | Put under group | `parentLayerId: null`, `zIndex < 0` |
| Audio `zIndex < 0` | Visual z on audio | Used 0 | Negative zIndex |
| `transform.z` unrecognized | Invalid field | Confused with depth | `transform.depth` or `zIndex` |
| Layer ends beyond `timeline.duration` | Overflow | Timing too long | Shorten layer or raise duration |
| WorkArea/marker outside duration | Clock bounds | Marker `t` too large | Clamp to duration |
| Managed asset has `uri` | Storage policy | Copied fixture uri | Drop `uri`; keep integrity + sizeBytes |
| `source.kind` not upload | Invalid origin | `url` / googleDrive | `upload` only |

## Canonical shape

Fix in place. Keep ids stable ([Patching existing projects](/docs/ai/patching)).

## Valid example

After missing-ref: add the asset.

```jsonc
{
  "assets": [
    {
      "id": "bgm",
      "uri": "./assets/audio/background.mp3",
      "assetType": "audio",
      "mimeType": "audio/mpeg"
    }
  ]
}
```

## Invalid example

Retrying the same JSON with a comment for the preview:

```jsonc
{ "formatVersion": 2, "_note": "works in canvas" }
```

## Common mistakes

| Mistake | Why it is wrong | What to use instead |
| --- | --- | --- |
| New random ids to “clear” duplicate | Breaks bindings | Rename one id only |
| Adding `uri` on managed assets | Policy | integrity + sizeBytes |

## AI writing guide

- Prefer the smallest patch that clears the error.
- Do not regenerate the whole tree unless the envelope is wrong.
- If you need … a new media file, upload first, then write `assets[]`.

## Related pages

- [Valid and invalid patterns](/docs/ai/patterns)
- [Patching existing projects](/docs/ai/patching)
- [Validation basics](/docs/validation)

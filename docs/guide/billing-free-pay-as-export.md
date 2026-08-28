# Free billing: pay as you export

> Status: proposed launch pricing for Neonix Free accounts. Prices are quoted
> and charged server-side in US dollars (USD).

Free is a workspace and storage tier, not an included-render subscription.
Users sign in, add balance, and pay only when they start a remote export.

## Free account limits

| Limit | Free allowance |
| --- | --- |
| Active projects | 5 |
| Total asset and export storage | 2 GB |
| Storage per project | 1 GB |
| Maximum single upload | 500 MB |
| Included remote renders | None |

Browser preview remains available without a remote render. A Lambda export and
an export stored in `neonix-user-exports` require an authenticated account.

## Currency and money storage

USD is the product currency. An accepted export quote never changes with an
exchange rate. The billing database stores chargeable amounts as integer USD
cents; the per-second rate may use a more precise decimal while calculating a
quote, which is rounded up to the next cent.

If Neonix later accepts a local currency for wallet top-ups, that conversion
happens at checkout. It does not alter the USD export pricing below.

## Standard export price

The export quote is based on its output duration and preset. Duration is
calculated from the frozen V2 revision and rounded up to a full second.

```text
billable_seconds = ceil(duration_in_frames / fps)

standard_price_usd =
  max(0.04, round_up_to_cent(billable_seconds * preset_rate_usd_per_second))
```

| Preset | Rate | 30-second example | 60-second example |
| --- | ---: | ---: | ---: |
| 720p, 30 FPS | $0.0012 / second | $0.04 | $0.08 |
| 1080p, 30 FPS | $0.0020 / second | $0.06 | $0.12 |
| 1440p, 30 FPS | $0.0040 / second | $0.12 | $0.24 |
| 4K, 30 FPS | $0.0080 / second | $0.24 | $0.48 |
| 60 FPS | 2x the matching 30 FPS preset | N/A | N/A |

The $0.04 minimum covers the fixed cost of starting a distributed render,
even for very short timelines. Quotes are shown before the user confirms an
export and are stored with the render job; future price changes never alter an
accepted quote.

## Export cache and re-export pricing

### Exact export cache: free

An export costs **$0.00** when an existing artifact has the same:

- frozen project revision;
- output preset, FPS, codec, and renderer version; and
- asset content versions.

Neonix returns the existing artifact rather than starting Lambda again. This
only applies while that artifact is still available in R2.

### Edited re-export: 20% off

An edited revision receives a **20% discount** when all of these are true:

- it belongs to the same project as a successfully completed export;
- it uses the same output preset (resolution and FPS);
- the new export starts within 24 hours of that completed export; and
- it is not an exact-cache hit.

```text
reexport_price_usd =
  max(0.04, round_up_to_cent(standard_price_usd * 0.80))
```

| Example | Standard price | Re-export price within 24 hours |
| --- | ---: | ---: |
| 30s, 1080p, 30 FPS | $0.06 | $0.05 |
| 60s, 1080p, 30 FPS | $0.12 | $0.10 |
| 60s, 720p, 30 FPS | $0.08 | $0.07 |
| 60s, 4K, 30 FPS | $0.48 | $0.39 |

Changing only the project content is eligible. Moving to a higher or different
output preset is a new standard-price export, because it can materially change
the render cost.

## Billing lifecycle

```text
User selects export preset
  -> server calculates the quote from the saved V2 revision
  -> wallet balance is reserved
  -> render is dispatched
  -> success: capture the reserved amount
  -> failure, cancellation, or timeout: release the reserved amount
```

The server, not the editor client, decides the price, cache eligibility, and
discount. Every wallet movement is an immutable ledger entry linked to the
render job.

## Scope for the first launch

- Start with 720p and 1080p at 30 FPS in the UI.
- Keep 1440p, 4K, and 60 FPS behind a feature gate until Lambda benchmarks are
  collected for Neonix projects.
- Revisit rates after measuring cold and warm renders for JSON-only and
  media-heavy projects in `ap-southeast-1`.
- Exports count toward the user's storage quota until deleted.

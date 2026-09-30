# Neonix Font CDN Worker

Serves the Google Fonts-compatible CSS API at `fonts.neonix.video/css2` and
continues serving public font objects from the `neonix-system-fonts` R2 bucket.

## Examples

```html
<link rel="stylesheet" href="https://fonts.neonix.video/css2?family=Inter:wght@400;700;900&display=swap">
```

```text
https://fonts.neonix.video/css2?family=Inter:wght@900&display=swap
```

The Worker reads the public system-font catalog from
`https://api.neonix.video/v1/system-fonts`, generates `@font-face` rules, and
returns URLs that point back to the same CDN. It only exposes GET/HEAD for font
objects; it does not expose R2 listing, PUT, or DELETE operations.

## Deployment order

1. Deploy the API change that makes `GET /v1/system-fonts` return the public
   system-font catalog without authentication.
2. Disable the existing R2 Custom Domain for `fonts.neonix.video`.
3. Deploy this Worker with `pnpm deploy`.
4. Verify `/css2`, a font `HEAD`, a font `GET`, and CORS.

The Worker owns the hostname after step 3 and uses an R2 binding, so the font
objects remain in R2 and do not need to be copied.

# Neonix Authoring Rules

This project targets the Neonix HTML compiler and Protocol V2 video runtime.

- The composition in `neonix.config.json` is mandatory.
- Unsupported HTML tags and CSS declarations must fail compilation.
- Do not rely on browser interaction, scrolling, responsive layout or DOM state.
- Use explicit dimensions and composition-space coordinates.
- Keep assets local under `assets/` or declare them in the project asset manifest.
- `npm run validate` must pass before `npm run compile`.

The complete compiler contract is provided by the installed `@neonix/html-compiler` package.

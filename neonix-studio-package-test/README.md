# neonix-studio-package-test

Neonix HTML/CSS video project using the `1:1` composition preset.

## Commands

```bash
npm install
npm run studio
```

`npm run studio` starts the Neonix Studio package and opens a constrained iframe preview. The Studio package lives in `node_modules`; the iframe stage always uses the composition dimensions from `neonix.config.json`, so it previews the scene as a video composition instead of as a responsive web page.

Project files live in `src/scene.html` and `src/scene.css`. Put local images, videos, audio and fonts in `assets/`.

The current template is preview-only. Compiler, Protocol V2 and export commands will be added separately when the Neonix compiler packages are ready.

# JSON Project Design - Chuan cau truc `project.mt`

> Status: Draft design specification
>
> Muc dich: Lam tai lieu chuan truoc khi thay doi Zod schema, compiler, workspace linker va render pipeline.
>
> Scope: Canonical authoring project JSON. Tai lieu nay khong dinh nghia Runtime IR, editor UI state hay render job schema.

## 1. Ket luan thiet ke

Mot project MotiClip co ba representation:

```text
Workspace source
  workspace.mt + timeline.mt + scenes/* + components/*
        |
        v
Portable project bundle
  project.bundle.mt
        |
        v
Runtime artifact
  runtime.mtir.json
```

Quyet dinh chinh:

- `.mt` la UTF-8 JSON thuan, khong phai TypeScript va khong chua executable code.
- Root discriminator tiep tuc la `format: "motion-project"`.
- Schema v2 hien tai duoc giu lam compatibility baseline.
- Target v3 bo sung composition settings, visual timeline tracks va portable component profile.
- Runtime, Pixi va Remotion khong doc workspace tree truc tiep.
- Asset binary khong inline Base64 theo mac dinh; project tham chieu qua asset ID va integrity hash.
- Editor-only state nam trong file khac, khong duoc dua vao canonical project.
- 3D duoc chuan bi bang projection/capability seam; khong mo authoring fields truoc khi runtime va painters san sang.

## 2. Thuat ngu va artifact boundaries

### Workspace

Cay thu muc source de con nguoi, AI va Git lam viec. Workspace co the chia project thanh nhieu scene, component, variable va asset module.

### Project manifest

`workspace.mt` la root manifest cua workspace. Neu san pham giu ten `project.mt` cho manifest, discriminator van phai la `format: "motion-workspace"` de khong nham voi portable project.

### Project bundle

`project.bundle.mt` la JSON da duoc linker gom lai. Bundle co the validate ma khong can scan folder source.

### Runtime IR

`runtime.mtir.json` la compiler output da resolve variables/components/layout, normalize tracks va tao indexes. Runtime IR khong phai format de edit.

| Artifact               | Editable | Multi-file | Chua indexes   | Chua editor UI | Renderer doc truc tiep |
| ---------------------- | -------- | ---------- | -------------- | -------------- | ---------------------- |
| Workspace modules      | Co       | Co         | Khong          | Khong          | Khong                  |
| `project.bundle.mt`    | Co the   | Khong      | Khong          | Khong          | Khong                  |
| `runtime.mtir.json`    | Khong    | Khong      | Co             | Khong          | Co                     |
| `editor/workspace.mt`  | Co       | Khong      | UI-only        | Co             | Khong                  |
| `render-manifest.json` | Khong    | Khong      | Build metadata | Khong          | Render worker doc      |

## 3. Quy tac serialization bat buoc

- Encoding: UTF-8.
- MIME de xuat: `application/vnd.moticlip.project+json`.
- Extension: `.mt`.
- Khong comment hoac trailing comma.
- Khong `NaN`, `Infinity`, `undefined`, function hoac class instance.
- Moi object schema chinh dung strict validation; unknown field bi reject, tru `extensions`.
- Time dung seconds; angle dung degrees; position/size dung composition pixels.
- Anchor, opacity va volume dung normalized range `[0, 1]`.
- Frame index chi thuoc Runtime IR/render APIs, khong thay seconds trong authoring schema.
- URI portable dung `/` lam separator, khong luu absolute local path.

### ID rules

ID la stable logical identity, khong phai array index, URL hay file path.

Khuyen nghi:

```text
^[a-z][a-z0-9-]{0,63}$
```

Vi du tot: `scene-intro`, `facebook-logo`, `track-narration`, `clip-harvard`.

### Deterministic output

- Array order co semantic phai duoc ton trong.
- Object map key order khong duoc quyet dinh render order.
- Moi sort co tie-break bang declaration order va stable ID.
- Canonical serializer sort object keys de tao content hash.
- Timestamp va provenance khong duoc nam trong deterministic render hash.

## 4. Compatibility baseline - v2 hien tai

Root v2 dang duoc codebase trien khai:

```ts
type MotionProjectV2 = {
  format: "motion-project";
  formatVersion: 2;
  metadata: ProjectMetadataV2;
  dependencies: { components: ComponentDependency[] };
  assets: AssetV2[];
  variables: VariableV2[];
  timeline: {
    sceneOrder: string[];
    audioTracks: AudioTrack[];
    captionTracks: CaptionTrack[];
  };
  scenes: SceneV2[];
  bindings: ProjectBinding[];
  extensions: {
    constraints: JsonValue[];
    events: JsonValue[];
  };
};
```

Uu diem v2:

- Root gon va strict.
- Authoring IR va Runtime IR da tach.
- Asset, variable, scene va binding ownership ro.
- Scene graph va property tracks co capability validation.
- Camera 2D/2.5D co schema seam ban dau.

Gioi han v2:

- `metadata.locale` chi chap nhan `vi-VN`.
- Composition size suy ra tu ba aspect ratio co dinh.
- Global visual timeline chi co `sceneOrder`.
- Transition gan vao scene, nen scene kho reuse voi transition khac nhau.
- Component dependency duoc pin nhung definition khong embed trong root.
- Chua co project capability requirements va source map profile.

V2 tiep tuc duoc parse va migrate; khong sua meaning cua field v2 tai cho.

## 5. Target root - Motion Project v3

```ts
type MotionProjectV3 = {
  format: "motion-project";
  formatVersion: 3;
  metadata: ProjectMetadata;
  composition: CompositionSettings;
  capabilities: ProjectCapabilityRequirements;
  dependencies: ProjectDependencies;
  tokens: DesignTokens;
  variables: ProjectVariable[];
  assets: AssetDeclaration[];
  components: EmbeddedComponent[];
  scenes: SceneDefinition[];
  timeline: ProjectTimeline;
  bindings: ProjectBinding[];
  provenance?: ProjectProvenance;
  extensions?: Record<string, JsonValue>;
};
```

| Field                            | Owner              | Render hash   | Bat buoc |
| -------------------------------- | ------------------ | ------------- | -------- |
| `format`, `formatVersion`        | Schema/migration   | Co            | Co       |
| `metadata`                       | Project identity   | Mot phan      | Co       |
| `composition`                    | Runtime settings   | Co            | Co       |
| `capabilities`                   | Compiler/preflight | Co            | Co       |
| `dependencies`                   | Linker/compiler    | Co            | Co       |
| `tokens`, `variables`            | Authoring/compiler | Co            | Co       |
| `assets`, `components`           | Registry/linker    | Co            | Co       |
| `scenes`, `timeline`, `bindings` | Authoring/runtime  | Co            | Co       |
| `provenance`                     | Linker/debug       | Khong         | Khong    |
| `extensions`                     | Namespaced plugins | Tuy namespace | Khong    |

## 6. `metadata`

```ts
type ProjectMetadata = {
  id: Id;
  name: string;
  description?: string;
  locale: string;
  industry?: string;
  tags?: string[];
  createdAt?: string;
  updatedAt?: string;
};
```

Rules:

- `id` stable sau khi tao project.
- `locale` dung BCP 47, vi du `vi-VN`, `en-US`.
- Timestamp dung ISO 8601 UTC va khong anh huong render hash.
- Brand/design tokens khong nam trong metadata o v3.

## 7. `composition`

```ts
type CompositionSettings = {
  width: number;
  height: number;
  fps: number;
  background: string;
  colorSpace: "srgb";
  pixelAspectRatio?: number;
  audioSampleRate: number;
  safeArea?: SafeArea;
  motionBlur?: MotionBlurDefaults;
};
```

Rules:

- `width` va `height` la source of truth; aspect ratio duoc derive.
- V2 migration map `9:16 -> 1080x1920`, `16:9 -> 1920x1080`, `1:1 -> 1080x1080`, tru khi caller cung cap preset khac.
- Background la composition default.
- V3 ban dau chi productionize `srgb`.
- `audioSampleRate` default 48000.

## 8. `capabilities`

```ts
type ProjectCapabilityRequirements = {
  required: string[];
  optional?: string[];
  experimental?: string[];
};
```

Rules:

- Required capability thieu o preview/export la hard error.
- Optional capability thieu phai co diagnostic/fallback duoc khai bao.
- Experimental capability khong render production khi feature flag tat.
- Capability ID den tu central registry, project khong tu dat tuy y.

## 9. `dependencies`

```ts
type ProjectDependencies = {
  compiler: { range: string };
  components: ComponentDependency[];
  plugins?: PluginDependency[];
};
```

Rules:

- Workspace co the dung semver range; `motion.lock` pin exact version va integrity.
- Portable bundle dung exact resolved version.
- Cloud render khong fetch unpinned latest dependency.
- Plugin chi la trusted declarative compiler extension; project khong chua executable JS/TS.

## 10. `tokens` va `variables`

Tokens la design system, khac variables noi dung:

```ts
type DesignTokens = {
  colors?: Record<string, string>;
  fonts?: Record<string, Id>;
  spacing?: Record<string, number>;
  radii?: Record<string, number>;
  motion?: Record<string, number>;
};
```

Font token tro toi font asset ID. Token resolution la compile-time va token khong tu dong thanh public editor variable.

Supported variable kinds:

- `string`
- `color`
- `number`
- `boolean`
- `asset`
- `enum`
- `list`

Rules:

- Variable ID unique project-wide.
- Asset variable phai tro toi asset dung kind.
- Enum value nam trong options.
- Number finite va nam trong min/max.
- Variable reference khong ton tai trong Runtime IR.

Vi du:

```json
{
  "tokens": {
    "colors": {
      "brand-primary": "#1877f2",
      "surface": "#ffffff"
    },
    "fonts": {
      "heading": "font-lora-bold"
    },
    "motion": {
      "normal": 0.4
    }
  },
  "variables": [
    {
      "id": "founder-name",
      "name": "Founder name",
      "type": "string",
      "value": "Mark Zuckerberg"
    },
    {
      "id": "facebook-blue",
      "name": "Facebook blue",
      "type": "color",
      "value": "#1877f2"
    }
  ]
}
```

## 11. `assets`

```ts
type AssetBase = {
  id: Id;
  assetType: "image" | "svg" | "video" | "audio" | "font";
  uri: string;
  integrity?: string;
};
```

| Kind  | Metadata chinh                                                         |
| ----- | ---------------------------------------------------------------------- |
| image | mime, width, height, pixelFormat, hasAlpha                             |
| svg   | mime, width, height, viewBox, sanitized                                |
| video | mime, width, height, duration, fps, codec, pixelFormat, audio metadata |
| audio | mime, duration, codec, sampleRate, channels, optional analysis         |
| font  | mime, family, weight, style, locale coverage                           |

Rules:

- Node/timeline tham chieu qua `assetId`, khong tham chieu URI truc tiep.
- URI workspace resolve tu asset manifest.
- Portable/cloud URI duoc rewrite qua render manifest, khong sua asset ID.
- Integrity la content hash.
- SVG phai sanitized.
- Asset metadata khong duoc probe trong RAF/playback loop.

Vi du:

```json
[
  {
    "id": "facebook-logo",
    "assetType": "svg",
    "uri": "assets/images/facebook-logo.svg",
    "integrity": "sha256:...",
    "mimeType": "image/svg+xml",
    "width": 512,
    "height": 512,
    "viewBox": "0 0 512 512",
    "sanitized": true
  },
  {
    "id": "narration",
    "assetType": "audio",
    "uri": "assets/audio/narration.mp3",
    "integrity": "sha256:...",
    "mimeType": "audio/mpeg",
    "duration": 42.5,
    "codec": "mp3",
    "sampleRate": 48000,
    "channels": 2
  }
]
```

## 12. `components`

Portable v3 co the embed definitions:

```ts
type EmbeddedComponent = {
  id: Id;
  version: string;
  integrity: string;
  publicParams: PublicParam[];
  variables: ComponentVariable[];
  nodes: Node[];
  bindings: ComponentBinding[];
  actions: ComponentAction[];
  variants?: ComponentVariant[];
  assetDependencies?: Id[];
};
```

Rules:

- Workspace co the import component module ngoai; linker verify integrity truoc khi embed.
- Component node IDs la component-local.
- Instance compiler namespace IDs de tranh collision.
- Runtime IR khong con node `component`; compiler flatten instance.

Hai bundle profiles:

```text
embedded-components
  Giu definitions + component instances, tot cho interchange/edit.

flattened-components
  Expand thanh normal nodes, tot cho render handoff.
```

Profile duoc ghi trong provenance/render manifest, khong suy luan tu array rong.

## 13. `scenes`

```ts
type SceneDefinition = {
  id: Id;
  name?: string;
  duration: number;
  semantic?: Semantic;
  space: "flat-2d" | "layered-2.5d";
  markers?: SceneMarker[];
  motionBlur?: MotionBlurSettings;
  drivers?: ProceduralDriver[];
  nodes: Node[];
  clips: MotionClip[];
  activeCameraId?: Id;
};
```

Quyet dinh v3:

- Bo `scene.transition`; transition thuoc visual timeline clip/edge.
- Scene duration la intrinsic duration.
- Timeline clip co the trim/rate/reuse scene.
- Scene-local clips chi animate nodes trong scene.

Invariants:

- Scene ID unique project-wide.
- Node ID unique trong scene.
- `parentId` tham chieu node cung scene va khong tao cycle.
- `activeCameraId` tham chieu camera cung scene.
- Marker ID unique va marker time nam trong duration.
- Scene clip target ton tai trong scene hoac component action scope hop le.

## 14. Nodes va transform

V2 production node union:

```text
group, bone, text, shape, path, image, svg, video,
camera, solid, adjustment, component
```

Common node:

```ts
type NodeBase = {
  id: Id;
  type: NodeType;
  name?: string;
  parentId: Id | null;
  zIndex?: number;
  transform: Transform2D;
  timing?: { start: number; duration: number };
  semantic?: Semantic;
  repeat?: Repeater;
  modifiers?: Modifier[];
  effects?: Effect[];
  blendMode?: BlendMode;
  inheritPosition?: boolean;
  inheritRotation?: boolean;
  inheritScale?: boolean;
  inheritOpacity?: boolean;
  mask?: MaskReference;
};
```

Transform v2:

```ts
type Transform2D = {
  x: number;
  y: number;
  depth?: number;
  width: number;
  height: number;
  rotation: number;
  scaleX: number;
  scaleY: number;
  anchorX: number;
  anchorY: number;
  opacity: number;
  visible: boolean;
  flipX: boolean;
  flipY: boolean;
};
```

V2 hien tai yeu cau cac field transform, parser/editor nen dung canonical defaults: position/rotation/size `0`, scale `1`, anchor `0`, opacity `1`, visible `true`, flips `false`.

## 15. Scene-local motion clips va tracks

```ts
type MotionClip = {
  id: Id;
  targetId?: Id;
  schedule:
    | { kind: "absolute"; at: number }
    | { kind: "scene-end"; offset: number }
    | { kind: "after"; clipId: Id; offset?: number }
    | { kind: "with"; clipId: Id; offset?: number };
  duration: number;
  playback: {
    iterations: number | "infinite";
    direction: "normal" | "reverse" | "alternate";
    rate: ResolvableValue;
  };
  source:
    | { kind: "preset"; presetId: Id; params?: Params }
    | { kind: "tracks"; tracks: PropertyTrack[] }
    | { kind: "component-action"; actionId: Id; params?: Params };
};
```

Track rules:

- Keys sorted theo resolved local time.
- Duplicate key time bi reject, tru explicit step-pair semantics trong version sau.
- Property phai ton tai trong capability registry cho node type.
- `targetId` clip va tracks khong duoc mau thuan.
- `infinite` playback bi clamp boi scene/timeline lifetime.

## 16. Global `timeline`

```ts
type ProjectTimeline = {
  duration?: number;
  workArea?: { start: number; end: number };
  markers?: TimelineMarker[];
  visualTracks: VisualTrack[];
  audioTracks: AudioTrack[];
  captionTracks: CaptionTrack[];
};

type VisualTrack = {
  id: Id;
  role: "main" | "overlay";
  order: number;
  muted?: boolean;
  clips: VisualClip[];
};

type VisualClip = {
  id: Id;
  source:
    | { kind: "scene"; sceneId: Id }
    | { kind: "component"; componentId: Id; props?: Params };
  start: number;
  duration: number;
  trimStart?: number;
  playbackRate?: number;
  loop?: boolean;
  opacity?: number;
  transitionIn?: Transition;
  transitionOut?: Transition;
};
```

Timeline invariants:

- Clip va track IDs unique trong scope quy dinh.
- `start >= 0`, `duration > 0`, `playbackRate > 0`.
- Scene local range khong vuot intrinsic duration, tru loop.
- Transition duration khong vuot overlap/lifetime cua hai clips.
- Main track overlap chi hop le voi transition/explicit overlap policy.
- Overlay order deterministic.
- Project duration derive tu max clip/audio/caption end neu khong explicit.

## 17. Audio tracks

V3 mo rong audio track v2:

```ts
type AudioTrack = {
  id: Id;
  role: "bgm" | "voiceover" | "sfx";
  assetId: Id;
  start: number;
  duration: number;
  trimStart: number;
  trimEnd?: number;
  playbackRate: number;
  volume: number;
  loop: boolean;
  fadeIn: number;
  fadeOut: number;
  muted?: boolean;
};
```

`duration`, `trimEnd` va `playbackRate` bat buoc de preview/export cung resolve lifetime. Khong mac dinh audio keo dai toi composition end neu asset metadata da co.

## 18. Bindings

```ts
type ProjectBinding = {
  id: Id;
  source: { kind: "variable"; variableId: Id };
  target: {
    sceneId: Id;
    nodeId: Id;
    property: PropertyPath;
  };
};
```

Rules:

- Binding ID unique.
- Variable, scene va node ton tai.
- Target property bindable theo capability registry.
- Variable kind tuong thich property value kind.
- Mot target property chi co mot project binding, tru explicit composition policy.
- Compiler resolve binding truoc Runtime IR.

## 19. `provenance` va source map

```ts
type ProjectProvenance = {
  workspaceId?: string;
  sourceHash?: string;
  bundleProfile?: "embedded-components" | "flattened-components";
  sourceMap?: {
    scenes?: Record<Id, string>;
    components?: Record<Id, string>;
    variables?: Record<Id, string>;
    assets?: Record<Id, string>;
  };
};
```

Rules:

- Path workspace-relative, dung POSIX separator.
- Renderer khong dung source map de resolve semantic references.
- Source map co the strip khoi cloud payload.
- Absolute path bi cam trong portable bundle.
- Provenance khong anh huong render hash.

## 20. `extensions`

V3 dung namespaced map:

```json
{
  "com.moticlip.events": [],
  "com.moticlip.constraints": [],
  "com.example.plugin": {
    "version": 1,
    "data": {}
  }
}
```

Rules:

- Namespace reverse-domain hoac reserved `com.moticlip.*`.
- Data la JSON value.
- Required semantic khai bao trong `capabilities.required`.
- Unknown optional extension co the preserve round-trip nhung khong tu y render.
- Khong cho source code, function hoac dynamic import.

## 21. Editor state khong thuoc project

Nhung field sau nam trong `editor/workspace.mt`, khong nam trong canonical project:

```text
currentTime, playing, selectedNodeIds, selectedClipIds,
timelineZoom, timelineScroll, collapsedLanes, activePanel,
inspectorTab, stageScale, stagePan, stageView, undoHistory
```

Xoa editor state khong duoc lam thay doi video output hay project/runtime hash.

## 22. Minimal valid v2 project

Vi du nay bam schema dang chay:

```json
{
  "format": "motion-project",
  "formatVersion": 2,
  "metadata": {
    "id": "empty-project",
    "name": "Empty Project",
    "aspectRatio": "16:9",
    "fps": 30,
    "locale": "vi-VN",
    "brand": {
      "name": "Default"
    }
  },
  "dependencies": {
    "components": []
  },
  "assets": [],
  "variables": [],
  "timeline": {
    "sceneOrder": [],
    "audioTracks": [],
    "captionTracks": []
  },
  "scenes": [],
  "bindings": [],
  "extensions": {
    "constraints": [],
    "events": []
  }
}
```

Reference validator hoac app policy co the yeu cau it nhat mot scene du root Zod schema chap nhan array rong.

## 23. Representative v2 project

Vi du ngan nay la fixture hop voi root/node/track schema hien tai:

```json
{
  "format": "motion-project",
  "formatVersion": 2,
  "metadata": {
    "id": "facebook-history",
    "name": "Facebook History",
    "aspectRatio": "16:9",
    "fps": 30,
    "locale": "vi-VN",
    "brand": {
      "name": "Facebook",
      "primaryColor": "#1877f2",
      "logoAssetId": "facebook-logo"
    },
    "description": "A short history of Facebook"
  },
  "dependencies": {
    "components": []
  },
  "assets": [
    {
      "id": "facebook-logo",
      "uri": "assets/images/facebook-logo.svg",
      "integrity": "sha256:facebook-logo",
      "assetType": "svg",
      "mimeType": "image/svg+xml",
      "width": 512,
      "height": 512,
      "viewBox": "0 0 512 512",
      "sanitized": true
    }
  ],
  "variables": [
    {
      "id": "facebook-blue",
      "name": "Facebook blue",
      "type": "color",
      "value": "#1877f2"
    }
  ],
  "timeline": {
    "sceneOrder": ["intro"],
    "audioTracks": [],
    "captionTracks": []
  },
  "scenes": [
    {
      "id": "intro",
      "name": "Introduction",
      "duration": 5,
      "space": "flat-2d",
      "nodes": [
        {
          "id": "main-camera",
          "type": "camera",
          "parentId": null,
          "transform": {
            "x": 960,
            "y": 540,
            "width": 0,
            "height": 0,
            "rotation": 0,
            "scaleX": 1,
            "scaleY": 1,
            "anchorX": 0,
            "anchorY": 0,
            "opacity": 1,
            "visible": true,
            "flipX": false,
            "flipY": false
          },
          "payload": {
            "zoom": 1,
            "projection": "orthographic",
            "parallaxStrength": 1
          }
        },
        {
          "id": "facebook-logo-node",
          "type": "svg",
          "parentId": null,
          "zIndex": 10,
          "transform": {
            "x": 704,
            "y": 284,
            "width": 512,
            "height": 512,
            "rotation": 0,
            "scaleX": 1,
            "scaleY": 1,
            "anchorX": 0.5,
            "anchorY": 0.5,
            "opacity": 1,
            "visible": true,
            "flipX": false,
            "flipY": false
          },
          "payload": {
            "assetId": "facebook-logo",
            "fit": "contain"
          }
        }
      ],
      "clips": [
        {
          "id": "logo-enter",
          "targetId": "facebook-logo-node",
          "schedule": {
            "kind": "absolute",
            "at": 0
          },
          "duration": 1,
          "playback": {
            "iterations": 1,
            "direction": "normal",
            "rate": 1
          },
          "source": {
            "kind": "tracks",
            "tracks": [
              {
                "targetId": "facebook-logo-node",
                "property": "transform.opacity",
                "valueKind": "number",
                "keys": [
                  { "t": 0, "v": 0 },
                  { "t": 1, "v": 1, "easing": "easeOut" }
                ]
              }
            ]
          }
        }
      ],
      "activeCameraId": "main-camera",
      "transition": {
        "type": "cut",
        "duration": 0
      }
    }
  ],
  "bindings": [],
  "extensions": {
    "constraints": [],
    "events": []
  }
}
```

## 24. Minimal target v3 project

V3 la proposal, chua phai schema dang chay:

```json
{
  "format": "motion-project",
  "formatVersion": 3,
  "metadata": {
    "id": "empty-project",
    "name": "Empty Project",
    "locale": "vi-VN"
  },
  "composition": {
    "width": 1920,
    "height": 1080,
    "fps": 30,
    "background": "#ffffff",
    "colorSpace": "srgb",
    "audioSampleRate": 48000
  },
  "capabilities": {
    "required": ["projection.orthographic-2d"]
  },
  "dependencies": {
    "compiler": {
      "range": ">=0.1.0 <1.0.0"
    },
    "components": []
  },
  "tokens": {},
  "variables": [],
  "assets": [],
  "components": [],
  "scenes": [],
  "timeline": {
    "visualTracks": [],
    "audioTracks": [],
    "captionTracks": []
  },
  "bindings": [],
  "extensions": {}
}
```

## 25. Workspace manifest profile

Workspace manifest dung discriminator rieng:

```json
{
  "format": "motion-workspace",
  "formatVersion": 1,
  "id": "facebook-history",
  "entry": {
    "timeline": "timeline.mt",
    "assets": "assets/manifest.mt"
  },
  "imports": {
    "tokens": ["variables/brand.mt", "variables/theme.mt"],
    "variables": ["variables/globals.mt"],
    "scenes": ["scenes/intro/scene.mt", "scenes/harvard/scene.mt"],
    "components": [
      "components/timeline-card/component.mvc",
      "components/logo-reveal/component.mvc"
    ]
  }
}
```

Naming de xuat:

```text
workspace.mt           -> motion-workspace manifest
project.bundle.mt      -> motion-project portable JSON
runtime.mtir.json      -> motion-runtime artifact
```

Tooling khong suy schema chi dua vao filename; luon doc `format` va `formatVersion`.

## 26. Workspace linker contract

```ts
interface MotionWorkspaceReader {
  readText(path: string): Promise<string>;
  readBinary(path: string): Promise<Uint8Array>;
  exists(path: string): Promise<boolean>;
  resolve(from: string, specifier: string): string;
}

interface MotionWorkspaceLinker {
  link(
    manifestPath: string,
    options: {
      profile: "embedded-components" | "flattened-components";
    },
  ): Promise<{
    project: MotionProject;
    diagnostics: LinkDiagnostic[];
    sourceMap: ProjectSourceMap;
    sourceHash: string;
  }>;
}
```

Link order:

```text
read manifest
  -> parse modules
  -> resolve paths
  -> detect import cycles
  -> validate module-local IDs
  -> resolve assets/components
  -> namespace instances
  -> merge variables/tokens
  -> build canonical project
  -> validate cross references
  -> canonical serialize/hash
```

Runtime va renderer khong biet `MotionWorkspaceReader` ton tai.

## 27. Validation pipeline

Validation gom nhieu lop:

```text
1. Syntax
   JSON parse, UTF-8, no invalid numbers.

2. Shape
   Zod strict schema, types, limits, defaults.

3. References
   assets, variables, scenes, nodes, clips, markers, cameras.

4. Graphs
   parent, dependency, mask, component va modifier cycles.

5. Capabilities
   property/node/effect/transition support end-to-end.

6. Timeline
   ranges, overlap, transitions, trim, rate va loop.

7. Asset preflight
   integrity, metadata, fonts va media support.

8. Compiler
   no unresolved variable/component/layout in Runtime IR.

9. Renderer preflight
   required capability support in Pixi and export painter.
```

Diagnostic shape:

```ts
type ProjectDiagnostic = {
  severity: "error" | "warning" | "info";
  code: string;
  message: string;
  path: Array<string | number>;
  sourceRef?: { file: string; moduleId?: string };
  relatedIds?: string[];
};
```

Khong chi throw string error khong co project path.

## 28. Referential invariants

Project chi hop le khi:

- Scene, asset, variable va binding IDs unique dung scope.
- Component ID/version pair unique.
- Timeline track/clip IDs unique dung scope.
- Timeline chi tham chieu scene/component/asset ton tai.
- Camera ID tham chieu camera node cung scene.
- Parent, mask source, modifier va constraint targets ton tai.
- Parent/mask/motion-path/constraint graphs khong co cycle bi cam.
- Track target/property ton tai va duoc capability registry chap nhan.
- Binding source/target ton tai va value kinds tuong thich.
- Media node va asset variable dung asset kind.
- Font references tro toi `assetType: "font"`.
- Visual clip range va transition hop le.

## 29. Canonical hashing

Can ba hash:

```text
sourceHash
  Canonical workspace module contents.

projectHash
  Canonical portable project sau linker.

runtimeHash
  Runtime IR + compiler version + capability registry version.
```

Project hash khong gom timestamp, provenance-only source paths, editor state, local absolute paths hay non-semantic diagnostic order.

Render manifest pin project/runtime/compiler/capability versions va asset hashes.

## 30. Security rules

- Khong chay `motion.config.ts`, variable TS hay project-provided JS trong untrusted pipeline.
- Expression neu co dung allowlisted DSL voi operation/time/memory limits.
- SVG sanitize bat buoc.
- Asset URI allowlist: workspace-relative, signed HTTPS, approved object storage.
- Block `file://`, shell command, dynamic import va network fetch tuy y trong cloud compiler.
- Apply limits cho project size, scenes, nodes, keys, paths, text runs va media duration.
- ZIP `.moticlip` chong zip-slip va decompression bomb.
- Extension/plugin chi load tu trusted registry voi integrity pin.

## 31. 3D seam

V3 production van dung:

```text
flat-2d
layered-2.5d
orthographic camera
```

Future union:

```ts
type SceneSpace = "flat-2d" | "layered-2.5d" | "perspective-3d";

type CameraPayload =
  | {
      projection: "orthographic";
      zoom: number;
      parallaxStrength?: number;
    }
  | {
      projection: "perspective";
      focalLength?: number;
      fieldOfView?: number;
      near: number;
      far: number;
    };
```

Future transform channels:

```ts
type Transform3DChannels = {
  z: number;
  rotationX: number;
  rotationY: number;
  rotationZ: number;
  scaleZ?: number;
};
```

Rules mo 3D:

- Fields 3D chi parse khi project khai bao capability tuong ung.
- Defaults `z=0`, rotations X/Y=0 giu exact 2D output.
- Runtime so huu view/projection matrix; Pixi/Remotion khong tu resolve camera.
- Frame contract dung geometry union `affine-2d | projected-quad | mesh`.
- Flat stage preview la evaluate option, khong xoa camera trong project.
- AI/editor khong author 3D truoc full schema/compiler/runtime/Pixi/export gate.

## 32. V2 -> V3 migration

```text
metadata.aspectRatio + fps
  -> composition.width/height/fps

metadata.safeArea
  -> composition.safeArea

metadata.designTokens
  -> tokens

metadata.brand
  -> tokens + optional variables/provenance

timeline.sceneOrder
  -> timeline.visualTracks[main].clips

scene.transition
  -> corresponding visual clip transitionOut

timeline.audioTracks
  -> add duration/playbackRate from asset metadata/defaults

extensions.constraints/events
  -> namespaced extension keys
```

Migration emit warning neu asset duration thieu, transition vuot scene duration, component khong resolve, brand font khong map duoc font asset, hoac aspect preset khong du thong tin chon exact dimensions.

## 33. Versioning policy

- `formatVersion` la integer major schema version.
- Doi ownership/meaning can major migration.
- Runtime IR co `runtimeVersion` rieng.
- Paint list co `paintContractVersion` rieng.
- Worker protocol co `protocolVersion` rieng.
- Compiler version khong thay schema version.
- Parser khong silent guess unknown future version.

## 34. De xuat package/file layout

```text
packages/motion-protocol/src/v3/
  project.ts
  metadata.ts
  composition.ts
  capabilities.ts
  assets.ts
  variables.ts
  components.ts
  scenes.ts
  timeline.ts
  nodes/
  animation/
  extensions.ts
  provenance.ts
  references/
  migrations/v2-to-v3.ts

packages/motion-workspace/
  schema.ts
  loader.ts
  resolver.ts
  linker.ts
  canonicalize.ts
  source-map.ts
```

Workspace module schema khong tron voi Runtime IR schema.

## 35. Implementation order

1. Freeze v2 fixtures va exact behavior.
2. Generate JSON Schema tu Zod de tooling/AI cung dung.
3. Tao `MotionWorkspaceManifestSchema` discriminator rieng.
4. Tao memory workspace reader/linker.
5. Bundle workspace ve v2 truoc, chua doi runtime.
6. Them canonical serializer va hashes.
7. Chot v3 composition + visual timeline.
8. Viet v2 -> v3 migration voi golden fixtures.
9. Nang composition evaluator dung visual clips/tracks.
10. Them embedded/flattened component profiles.
11. Nang audio lifetime/rate schema.
12. Them project capability requirements va preflight.
13. Them provenance/source map.
14. Chi sau parity moi mo perspective 3D fields.

## 36. Acceptance checklist

- [ ] Co Zod schema strict va generated JSON Schema.
- [ ] Co minimal positive va representative fixtures.
- [ ] Co negative fixture cho moi invariant quan trong.
- [ ] Parse -> serialize -> parse round-trip on dinh.
- [ ] Canonical project hash on dinh.
- [ ] V2 fixtures migrate sang v3 deterministic.
- [ ] Workspace bundle cho cung semantic voi single-file input.
- [ ] Components pin va portable profile khong can network latest.
- [ ] Asset references khong phu thuoc absolute path.
- [ ] Editor state khong anh huong project/runtime hash.
- [ ] Runtime khong con unresolved variable/component.
- [ ] Preview va export cung composition plan.
- [ ] Unsupported required capability fail preflight.
- [ ] 2D output giu parity sau projection seam.
- [ ] Security tests cover code, SVG, URI va ZIP attacks.

## 37. Final standard

```text
motion-workspace
  To chuc source nhieu file.

motion-project v3
  Portable canonical authoring JSON.

motion-runtime
  Compiled renderer artifact.
```

Pipeline:

```text
Workspace modules
  -> load/resolve/link
  -> MotionProject
  -> validate/compile/prepare
  -> MotionRuntime
  -> evaluateCompositionFrame
  -> Pixi preview / Remotion export
```

Khong de mot artifact lam ba vai tro. Workspace toi uu organization; project JSON toi uu portability va authoring semantics; Runtime IR toi uu playback/render.

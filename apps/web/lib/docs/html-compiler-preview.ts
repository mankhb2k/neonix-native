import type { HtmlCompilerFontAsset, HtmlCompilerMediaAsset, HtmlCssComposition } from "@motionvideo/html-compiler";
import { HTML_COMPILER_PREVIEW_FONT_ASSETS_GENERATED } from "./html-compiler-preview-font-assets";

export type HtmlCompilerPreviewTopic =
  | "New project"
  | "Composition & geometry"
  | "HTML tags"
  | "Cascade & values"
  | "Transform 2D"
  | "Paint"
  | "Media"
  | "Typography"
  | "Layout"
  | "Motion & animation";

export type HtmlCompilerPreviewCategory =
  | "HTML tag lowering"
  | "Text compiler & layout"
  | "Motion export samples"
  | "Layout primitives"
  | "Paint primitives"
  | "Effect primitives"
  | "Transform & 3D primitives"
  | "Typography & media primitives"
  | "Animation & keyframe primitives"
  | "Combined pipeline cases";

export type HtmlCompilerPreviewClassification = "primitive" | "combined";

export type HtmlCompilerPreviewCase = {
  id: string;
  phase: "P0" | "P1.1" | "P1.2" | "P1.3" | "P1.4" | "P2.0" | "P2.1" | "P2.2" | "P2.3" | "P2.4" | "P2.5" | "P2.6" | "P2.7" | "P2.8" | "P2.9" | "P3" | "P5" | "P6" | "P7" | "P8" | "P9";
  category?: HtmlCompilerPreviewCategory;
  classification?: HtmlCompilerPreviewClassification;
  classificationLabel?: string;
  topic: HtmlCompilerPreviewTopic;
  label: string;
  properties: string[];
  hint: string;
  fixtureUrl: string;
  composition: HtmlCssComposition;
  durationMs?: number;
};

/** Public directory containing the self-contained HTML compiler fixtures. */
export const HTML_COMPILER_FIXTURE_ROOT = "/docs/html-compiler/fixtures";

export const HTML_COMPILER_PREVIEW_FONT_ASSETS_LEGACY: HtmlCompilerFontAsset[] = [
  {
    "id": "preview-font-inter-100",
    "kind": "font",
    "uri": "/preview/font/Inter/Inter-100.ttf",
    "mimeType": "font/ttf",
    "family": "Inter",
    "weight": 100,
    "style": "normal",
    "integrity": "sha256:1cf469f52b89c6af1e827b0d37617f35f84429ae0efe0f507558e47ba7574433"
  },
  {
    "id": "preview-font-inter-100-italic",
    "kind": "font",
    "uri": "/preview/font/Inter/Inter-100-Italic.ttf",
    "mimeType": "font/ttf",
    "family": "Inter",
    "weight": 100,
    "style": "italic",
    "integrity": "sha256:e4dad758f4e8bacb8b37d3a1eb3312fb3303db16ce75c5084a0069b87046e4e7"
  },
  {
    "id": "preview-font-inter-200",
    "kind": "font",
    "uri": "/preview/font/Inter/Inter-200.ttf",
    "mimeType": "font/ttf",
    "family": "Inter",
    "weight": 200,
    "style": "normal",
    "integrity": "sha256:80ec1646bd113db67722befd6f1842843097c1357c53e464989421fdf5e7489f"
  },
  {
    "id": "preview-font-inter-200-italic",
    "kind": "font",
    "uri": "/preview/font/Inter/Inter-200-Italic.ttf",
    "mimeType": "font/ttf",
    "family": "Inter",
    "weight": 200,
    "style": "italic",
    "integrity": "sha256:e4088ee3e3c8e1bfeefc7f84d370b5620edc1d9e82caa928f190bb82029ee26f"
  },
  {
    "id": "preview-font-inter-300",
    "kind": "font",
    "uri": "/preview/font/Inter/Inter-300.ttf",
    "mimeType": "font/ttf",
    "family": "Inter",
    "weight": 300,
    "style": "normal",
    "integrity": "sha256:16944253febe38709bdd5d228597606fb396d174be74be1edcc9c188691c5ba4"
  },
  {
    "id": "preview-font-inter-300-italic",
    "kind": "font",
    "uri": "/preview/font/Inter/Inter-300-Italic.ttf",
    "mimeType": "font/ttf",
    "family": "Inter",
    "weight": 300,
    "style": "italic",
    "integrity": "sha256:e703e00da647cc83da8480adb9899b344158a8689c0e54ad4682b25612fcee3c"
  },
  {
    "id": "preview-font-inter-400",
    "kind": "font",
    "uri": "/preview/font/Inter/Inter-400.ttf",
    "mimeType": "font/ttf",
    "family": "Inter",
    "weight": 400,
    "style": "normal",
    "integrity": "sha256:72744c3ebeded883deac5ca28ddd410b92c8f8538b9e8e87b503097fccb8f35c"
  },
  {
    "id": "preview-font-inter-400-italic",
    "kind": "font",
    "uri": "/preview/font/Inter/Inter-400-Italic.ttf",
    "mimeType": "font/ttf",
    "family": "Inter",
    "weight": 400,
    "style": "italic",
    "integrity": "sha256:2e04b6562a77aca3cc55d11be6adfe0fb5b842369fc1500fbbc7b0bd8694c0d9"
  },
  {
    "id": "preview-font-inter-500",
    "kind": "font",
    "uri": "/preview/font/Inter/Inter-500.ttf",
    "mimeType": "font/ttf",
    "family": "Inter",
    "weight": 500,
    "style": "normal",
    "integrity": "sha256:06a213482cfd4675e4e3dcf6f3212c864d153919e4fa5121c4c56759bf813227"
  },
  {
    "id": "preview-font-inter-500-italic",
    "kind": "font",
    "uri": "/preview/font/Inter/Inter-500-Italic.ttf",
    "mimeType": "font/ttf",
    "family": "Inter",
    "weight": 500,
    "style": "italic",
    "integrity": "sha256:c9bf547bef305b85abaaf37bd14f9c21871a2cd09fcc262b54a2412c5f897c77"
  },
  {
    "id": "preview-font-inter-600",
    "kind": "font",
    "uri": "/preview/font/Inter/Inter-600.ttf",
    "mimeType": "font/ttf",
    "family": "Inter",
    "weight": 600,
    "style": "normal",
    "integrity": "sha256:2390e2083d000bd60635d303fe7a192cc1d3612a0acd97cf42cda6bd00a71ae8"
  },
  {
    "id": "preview-font-inter-600-italic",
    "kind": "font",
    "uri": "/preview/font/Inter/Inter-600-Italic.ttf",
    "mimeType": "font/ttf",
    "family": "Inter",
    "weight": 600,
    "style": "italic",
    "integrity": "sha256:b9483dd78b8389011d4ed55f4ec9e4255ce32dfcfdb80642f03103c005577eeb"
  },
  {
    "id": "preview-font-inter-700",
    "kind": "font",
    "uri": "/preview/font/Inter/Inter-700.ttf",
    "mimeType": "font/ttf",
    "family": "Inter",
    "weight": 700,
    "style": "normal",
    "integrity": "sha256:d1880c32462082e10b7e20a0a51adca9546c04666a4dba32f4f061a307b2cd28"
  },
  {
    "id": "preview-font-inter-700-italic",
    "kind": "font",
    "uri": "/preview/font/Inter/Inter-700-Italic.ttf",
    "mimeType": "font/ttf",
    "family": "Inter",
    "weight": 700,
    "style": "italic",
    "integrity": "sha256:5d48ca218484f91a521e5bfadd24dc962b715ce23f50c9e3ed782de236c09948"
  },
  {
    "id": "preview-font-inter-800",
    "kind": "font",
    "uri": "/preview/font/Inter/Inter-800.ttf",
    "mimeType": "font/ttf",
    "family": "Inter",
    "weight": 800,
    "style": "normal",
    "integrity": "sha256:cd04014a44afce52684347106cb69edd7cb43f80539a6e78cc90d561d3226abf"
  },
  {
    "id": "preview-font-inter-800-italic",
    "kind": "font",
    "uri": "/preview/font/Inter/Inter-800-Italic.ttf",
    "mimeType": "font/ttf",
    "family": "Inter",
    "weight": 800,
    "style": "italic",
    "integrity": "sha256:16a5f54270cb595ffbf436491733d81a51852978a93fe4696fa4054f3327b688"
  },
  {
    "id": "preview-font-inter-900",
    "kind": "font",
    "uri": "/preview/font/Inter/Inter-900.ttf",
    "mimeType": "font/ttf",
    "family": "Inter",
    "weight": 900,
    "style": "normal",
    "integrity": "sha256:0f331a947a9692955f102b20ed2f359d333a60738367d4a2beea0cb75d2310cb"
  },
  {
    "id": "preview-font-inter-900-italic",
    "kind": "font",
    "uri": "/preview/font/Inter/Inter-900-Italic.ttf",
    "mimeType": "font/ttf",
    "family": "Inter",
    "weight": 900,
    "style": "italic",
    "integrity": "sha256:1889cd6094eab9c2b7a9652f1527df639ef86f75604e44e1dbfa894a41a11236"
  },
  {
    "id": "preview-font-lora-400",
    "kind": "font",
    "uri": "/preview/font/Lora/Lora-400.ttf",
    "mimeType": "font/ttf",
    "family": "Lora",
    "weight": 400,
    "style": "normal",
    "integrity": "sha256:eda6535f25c993bd1ba4dca95dedba46b4e622ea9a6b16b0bc6ad5317c4f4cff"
  },
  {
    "id": "preview-font-lora-400-italic",
    "kind": "font",
    "uri": "/preview/font/Lora/Lora-400-Italic.ttf",
    "mimeType": "font/ttf",
    "family": "Lora",
    "weight": 400,
    "style": "italic",
    "integrity": "sha256:f3e909b75d7ea81fdd86889170c885f7c05ceb88bf4837634049840f7d30bf1e"
  },
  {
    "id": "preview-font-lora-500",
    "kind": "font",
    "uri": "/preview/font/Lora/Lora-500.ttf",
    "mimeType": "font/ttf",
    "family": "Lora",
    "weight": 500,
    "style": "normal",
    "integrity": "sha256:fef4821577395926ad0921d7f0dc1c079581c039d54f7387e8a5fa3fc33cf566"
  },
  {
    "id": "preview-font-lora-500-italic",
    "kind": "font",
    "uri": "/preview/font/Lora/Lora-500-Italic.ttf",
    "mimeType": "font/ttf",
    "family": "Lora",
    "weight": 500,
    "style": "italic",
    "integrity": "sha256:4bb105e6a57e1c32ead3ab5e403d648b0d84f6fe50ef0ed3e4ad98b27530095d"
  },
  {
    "id": "preview-font-lora-600",
    "kind": "font",
    "uri": "/preview/font/Lora/Lora-600.ttf",
    "mimeType": "font/ttf",
    "family": "Lora",
    "weight": 600,
    "style": "normal",
    "integrity": "sha256:521278598ac3054294b94192d94b351eeda8699bee10a2211bfbb3d2e05694ba"
  },
  {
    "id": "preview-font-lora-600-italic",
    "kind": "font",
    "uri": "/preview/font/Lora/Lora-600-Italic.ttf",
    "mimeType": "font/ttf",
    "family": "Lora",
    "weight": 600,
    "style": "italic",
    "integrity": "sha256:aa03a1e22ad286255329cf450a77d84a81f8b7f94e56bea58eae003d1d34559b"
  },
  {
    "id": "preview-font-lora-700",
    "kind": "font",
    "uri": "/preview/font/Lora/Lora-700.ttf",
    "mimeType": "font/ttf",
    "family": "Lora",
    "weight": 700,
    "style": "normal",
    "integrity": "sha256:2f330807f3ecb1de9e99a94ffd3938b24b8429d1fde25ee6a1346d5657bf1580"
  },
  {
    "id": "preview-font-lora-700-italic",
    "kind": "font",
    "uri": "/preview/font/Lora/Lora-700-Italic.ttf",
    "mimeType": "font/ttf",
    "family": "Lora",
    "weight": 700,
    "style": "italic",
    "integrity": "sha256:8db37c0daa8aa4427db627aa5bfb5c36750c2ae863f2a2f77e4f3b0e53bdb63e"
  },
  {
    "id": "preview-font-roboto-100",
    "kind": "font",
    "uri": "/preview/font/Roboto/Roboto-100.ttf",
    "mimeType": "font/ttf",
    "family": "Roboto",
    "weight": 100,
    "style": "normal",
    "integrity": "sha256:fa8ca3e1570a43da3a2c4f7759180e6996bf773d0c6bfc81de4069d99a572565"
  },
  {
    "id": "preview-font-roboto-100-italic",
    "kind": "font",
    "uri": "/preview/font/Roboto/Roboto-100-Italic.ttf",
    "mimeType": "font/ttf",
    "family": "Roboto",
    "weight": 100,
    "style": "italic",
    "integrity": "sha256:c4bd0fda4b30fadf266f200c6d473bcc9543c7c6e673a12a56c0cd0ee1c813a9"
  },
  {
    "id": "preview-font-roboto-200",
    "kind": "font",
    "uri": "/preview/font/Roboto/Roboto-200.ttf",
    "mimeType": "font/ttf",
    "family": "Roboto",
    "weight": 200,
    "style": "normal",
    "integrity": "sha256:55601b60cbf056e5e79ef35a79675a62def276fdaa43199db537eca9c6027195"
  },
  {
    "id": "preview-font-roboto-200-italic",
    "kind": "font",
    "uri": "/preview/font/Roboto/Roboto-200-Italic.ttf",
    "mimeType": "font/ttf",
    "family": "Roboto",
    "weight": 200,
    "style": "italic",
    "integrity": "sha256:79c331c7007f47ffc026ad2d48be37e3490fedb5097139cb86d2fe84364000cc"
  },
  {
    "id": "preview-font-roboto-300",
    "kind": "font",
    "uri": "/preview/font/Roboto/Roboto-300.ttf",
    "mimeType": "font/ttf",
    "family": "Roboto",
    "weight": 300,
    "style": "normal",
    "integrity": "sha256:3813faa822d451059dd4bbb533dcefaefd95dec4871281c9aae6879cc0e6114a"
  },
  {
    "id": "preview-font-roboto-300-italic",
    "kind": "font",
    "uri": "/preview/font/Roboto/Roboto-300-Italic.ttf",
    "mimeType": "font/ttf",
    "family": "Roboto",
    "weight": 300,
    "style": "italic",
    "integrity": "sha256:abc4ac14fa78512b41b995762e9dd76616ccd5a1c798617079d500f8b8dedf9e"
  },
  {
    "id": "preview-font-roboto-400",
    "kind": "font",
    "uri": "/preview/font/Roboto/Roboto-400.ttf",
    "mimeType": "font/ttf",
    "family": "Roboto",
    "weight": 400,
    "style": "normal",
    "integrity": "sha256:1bb77f668740dd7e64eea850b710abcbd2c4273af7111c335b8184a1759c85f4"
  },
  {
    "id": "preview-font-roboto-400-italic",
    "kind": "font",
    "uri": "/preview/font/Roboto/Roboto-400-Italic.ttf",
    "mimeType": "font/ttf",
    "family": "Roboto",
    "weight": 400,
    "style": "italic",
    "integrity": "sha256:1ddb16b0a438e9505f24b07f838a4eec089d4c306c6879a8d064d5efa416f052"
  },
  {
    "id": "preview-font-roboto-500",
    "kind": "font",
    "uri": "/preview/font/Roboto/Roboto-500.ttf",
    "mimeType": "font/ttf",
    "family": "Roboto",
    "weight": 500,
    "style": "normal",
    "integrity": "sha256:c79755bc1ca65630ff20378dc4e7ae5f48ce870db42463335c94f720519f902e"
  },
  {
    "id": "preview-font-roboto-500-italic",
    "kind": "font",
    "uri": "/preview/font/Roboto/Roboto-500-Italic.ttf",
    "mimeType": "font/ttf",
    "family": "Roboto",
    "weight": 500,
    "style": "italic",
    "integrity": "sha256:606a56e073325eba4d6edc8e8c492633cf1228994250be9ac51e8a0a8fe566cd"
  },
  {
    "id": "preview-font-roboto-600",
    "kind": "font",
    "uri": "/preview/font/Roboto/Roboto-600.ttf",
    "mimeType": "font/ttf",
    "family": "Roboto",
    "weight": 600,
    "style": "normal",
    "integrity": "sha256:5b1a28212b6252322ef161367269af96b703eaff4bbc85832ef2091238799c72"
  },
  {
    "id": "preview-font-roboto-600-italic",
    "kind": "font",
    "uri": "/preview/font/Roboto/Roboto-600-Italic.ttf",
    "mimeType": "font/ttf",
    "family": "Roboto",
    "weight": 600,
    "style": "italic",
    "integrity": "sha256:54c53a1693675b9b48caa950ccc9c4ccd51d6b632c1f4a9736126de7fc3d186d"
  },
  {
    "id": "preview-font-roboto-700",
    "kind": "font",
    "uri": "/preview/font/Roboto/Roboto-700.ttf",
    "mimeType": "font/ttf",
    "family": "Roboto",
    "weight": 700,
    "style": "normal",
    "integrity": "sha256:23253883bcf146d7439444689c4119bc27161fc7e7e4aa0016eea9b3e755da4a"
  },
  {
    "id": "preview-font-roboto-700-italic",
    "kind": "font",
    "uri": "/preview/font/Roboto/Roboto-700-Italic.ttf",
    "mimeType": "font/ttf",
    "family": "Roboto",
    "weight": 700,
    "style": "italic",
    "integrity": "sha256:659c01e124fcfc6091a650b8151206f865cc85cb09bbd7e04614fb0f8fb8b813"
  },
  {
    "id": "preview-font-roboto-800",
    "kind": "font",
    "uri": "/preview/font/Roboto/Roboto-800.ttf",
    "mimeType": "font/ttf",
    "family": "Roboto",
    "weight": 800,
    "style": "normal",
    "integrity": "sha256:22680b1e469883c073d7747433230e9213be6a13687a9f62d9fd8fc5d6be62e0"
  },
  {
    "id": "preview-font-roboto-800-italic",
    "kind": "font",
    "uri": "/preview/font/Roboto/Roboto-800-Italic.ttf",
    "mimeType": "font/ttf",
    "family": "Roboto",
    "weight": 800,
    "style": "italic",
    "integrity": "sha256:b17981efc2e9443f8b17f04b9a82c07f4f5a80f3968fe0d5c6c57c6919be7f2d"
  },
  {
    "id": "preview-font-roboto-900",
    "kind": "font",
    "uri": "/preview/font/Roboto/Roboto-900.ttf",
    "mimeType": "font/ttf",
    "family": "Roboto",
    "weight": 900,
    "style": "normal",
    "integrity": "sha256:cbd7e9adf4d630d5e986a33e54da72ff0b8f68a049811d54f922b10b6dbb8087"
  },
  {
    "id": "preview-font-roboto-900-italic",
    "kind": "font",
    "uri": "/preview/font/Roboto/Roboto-900-Italic.ttf",
    "mimeType": "font/ttf",
    "family": "Roboto",
    "weight": 900,
    "style": "italic",
    "integrity": "sha256:59436e7e2d2c24cd2b826f4d0197f95f987a3d668240c3a5d98e6f30db15c0fd"
  },
  {
    "id": "preview-font-noto-sans-100",
    "kind": "font",
    "uri": "/preview/font/Noto_Sans/NotoSans-100.ttf",
    "mimeType": "font/ttf",
    "family": "Noto Sans",
    "weight": 100,
    "style": "normal",
    "integrity": "sha256:65a17c9aaa9ce267ae6582e5efb83f9b20a52bccb80097a23b18a29c7293c0c2"
  },
  {
    "id": "preview-font-noto-sans-100-italic",
    "kind": "font",
    "uri": "/preview/font/Noto_Sans/NotoSans-100-Italic.ttf",
    "mimeType": "font/ttf",
    "family": "Noto Sans",
    "weight": 100,
    "style": "italic",
    "integrity": "sha256:10c0054fdd5f6aa585b9cb9135b61b790cfce1ce34e3a2b5be79a308da5f7bc7"
  },
  {
    "id": "preview-font-noto-sans-200",
    "kind": "font",
    "uri": "/preview/font/Noto_Sans/NotoSans-200.ttf",
    "mimeType": "font/ttf",
    "family": "Noto Sans",
    "weight": 200,
    "style": "normal",
    "integrity": "sha256:8796896c369634107db7c22619b9f73a66f20f9a77a0c91c75664e0022e16f7a"
  },
  {
    "id": "preview-font-noto-sans-200-italic",
    "kind": "font",
    "uri": "/preview/font/Noto_Sans/NotoSans-200-Italic.ttf",
    "mimeType": "font/ttf",
    "family": "Noto Sans",
    "weight": 200,
    "style": "italic",
    "integrity": "sha256:f6e498dbf51a010a49b495532feb93fb4ac2d8657727934d08386af08c7e3e22"
  },
  {
    "id": "preview-font-noto-sans-300",
    "kind": "font",
    "uri": "/preview/font/Noto_Sans/NotoSans-300.ttf",
    "mimeType": "font/ttf",
    "family": "Noto Sans",
    "weight": 300,
    "style": "normal",
    "integrity": "sha256:5d8232c5e460b878c2f2f4f7343cbaf6a6e6be0d8d0422ab32e82e61f729caff"
  },
  {
    "id": "preview-font-noto-sans-300-italic",
    "kind": "font",
    "uri": "/preview/font/Noto_Sans/NotoSans-300-Italic.ttf",
    "mimeType": "font/ttf",
    "family": "Noto Sans",
    "weight": 300,
    "style": "italic",
    "integrity": "sha256:dabdc7d409109552b9058d8bde5d348fb14956a66c86a41e0b6ef2b6759d242e"
  },
  {
    "id": "preview-font-noto-sans-400",
    "kind": "font",
    "uri": "/preview/font/Noto_Sans/NotoSans-400.ttf",
    "mimeType": "font/ttf",
    "family": "Noto Sans",
    "weight": 400,
    "style": "normal",
    "integrity": "sha256:38941acff7619670b210051a93eaae1d03b1973a5bda5d64d58ab21bb69f551e"
  },
  {
    "id": "preview-font-noto-sans-400-italic",
    "kind": "font",
    "uri": "/preview/font/Noto_Sans/NotoSans-400-Italic.ttf",
    "mimeType": "font/ttf",
    "family": "Noto Sans",
    "weight": 400,
    "style": "italic",
    "integrity": "sha256:45454b4876d17797f07ecce9766af6bb3eae20c0fbba683afb0276bca1f4c43a"
  },
  {
    "id": "preview-font-noto-sans-500",
    "kind": "font",
    "uri": "/preview/font/Noto_Sans/NotoSans-500.ttf",
    "mimeType": "font/ttf",
    "family": "Noto Sans",
    "weight": 500,
    "style": "normal",
    "integrity": "sha256:74a6e378e7694192f760c5487903950a8dfbea45e7965072596bf660ed20bfc3"
  },
  {
    "id": "preview-font-noto-sans-500-italic",
    "kind": "font",
    "uri": "/preview/font/Noto_Sans/NotoSans-500-Italic.ttf",
    "mimeType": "font/ttf",
    "family": "Noto Sans",
    "weight": 500,
    "style": "italic",
    "integrity": "sha256:1553a1303c3f3c029adcedb98809164727b5c3903f1c76eb9506db9f26c91256"
  },
  {
    "id": "preview-font-noto-sans-600",
    "kind": "font",
    "uri": "/preview/font/Noto_Sans/NotoSans-600.ttf",
    "mimeType": "font/ttf",
    "family": "Noto Sans",
    "weight": 600,
    "style": "normal",
    "integrity": "sha256:e2cd619bf0b8e14178ee51d551b89abed6ec35f8e35aab31709d71d82818645c"
  },
  {
    "id": "preview-font-noto-sans-600-italic",
    "kind": "font",
    "uri": "/preview/font/Noto_Sans/NotoSans-600-Italic.ttf",
    "mimeType": "font/ttf",
    "family": "Noto Sans",
    "weight": 600,
    "style": "italic",
    "integrity": "sha256:5bb1b2c9dbfbfe15d203daf61f1aea86d814ad3fc03fdb2c0a8dfd41d0db396b"
  },
  {
    "id": "preview-font-noto-sans-700",
    "kind": "font",
    "uri": "/preview/font/Noto_Sans/NotoSans-700.ttf",
    "mimeType": "font/ttf",
    "family": "Noto Sans",
    "weight": 700,
    "style": "normal",
    "integrity": "sha256:7609a0dcf1b69a6e3378765e6c7b4e7e36ad7ea9ce83c06040f8416baf7e5c06"
  },
  {
    "id": "preview-font-noto-sans-700-italic",
    "kind": "font",
    "uri": "/preview/font/Noto_Sans/NotoSans-700-Italic.ttf",
    "mimeType": "font/ttf",
    "family": "Noto Sans",
    "weight": 700,
    "style": "italic",
    "integrity": "sha256:06a3bacc2aa7029985002b300e66e6049073ad9e8089f11a8d5e4f1edfbac50e"
  },
  {
    "id": "preview-font-noto-sans-800",
    "kind": "font",
    "uri": "/preview/font/Noto_Sans/NotoSans-800.ttf",
    "mimeType": "font/ttf",
    "family": "Noto Sans",
    "weight": 800,
    "style": "normal",
    "integrity": "sha256:6ab878d9df01c1e520e9020f6ebffa115ed114e44012f42a149f918b061c341a"
  },
  {
    "id": "preview-font-noto-sans-800-italic",
    "kind": "font",
    "uri": "/preview/font/Noto_Sans/NotoSans-800-Italic.ttf",
    "mimeType": "font/ttf",
    "family": "Noto Sans",
    "weight": 800,
    "style": "italic",
    "integrity": "sha256:e4afc12a13f666828f3c95c44c2204e56526fbee9a4ac16ff0d12fc5475db60b"
  },
  {
    "id": "preview-font-noto-sans-900",
    "kind": "font",
    "uri": "/preview/font/Noto_Sans/NotoSans-900.ttf",
    "mimeType": "font/ttf",
    "family": "Noto Sans",
    "weight": 900,
    "style": "normal",
    "integrity": "sha256:62cf90c0a22a6dd10696bffd970744f964e7d0a2c66a4dcd3d7fdd52bc8207b7"
  },
  {
    "id": "preview-font-noto-sans-900-italic",
    "kind": "font",
    "uri": "/preview/font/Noto_Sans/NotoSans-900-Italic.ttf",
    "mimeType": "font/ttf",
    "family": "Noto Sans",
    "weight": 900,
    "style": "italic",
    "integrity": "sha256:84c91a99094abef5be91c0690cb94a020dffea489d5763feaa4649a95964d70e"
  },
  {
    "id": "preview-font-noto-color-emoji",
    "kind": "font",
    "uri": "/preview/font/Noto_Color_Emoji/NotoColorEmoji-Regular.ttf",
    "mimeType": "font/ttf",
    "family": "Noto Color Emoji",
    "weight": 400,
    "style": "normal",
    "integrity": "sha256:7fb39738ab18f10612d6f4595e2e8e47a0afdf34738460442d99cd0c344a4d90"
  }
];

/** Generated from the exact files under public/preview/font. */
export const HTML_COMPILER_PREVIEW_FONT_ASSETS: HtmlCompilerFontAsset[] = HTML_COMPILER_PREVIEW_FONT_ASSETS_GENERATED;

export const HTML_COMPILER_PREVIEW_MEDIA_ASSETS: HtmlCompilerMediaAsset[] = [
  {
    "kind": "video",
    "uri": "/preview/video/demo-video.mp4",
    "mimeType": "video/mp4",
    "width": 1920,
    "height": 1080,
    "duration": 60500,
    "fps": 30
  },
  {
    "kind": "audio",
    "uri": "/preview/audio/bed.mp3",
    "mimeType": "audio/mpeg",
    "duration": 12000,
    "sampleRate": 48000,
    "channels": 2
  }
];

export const HTML_COMPILER_PHASE0_CASES: HtmlCompilerPreviewCase[] = [
  {
    "id": "html-compiler.tags.div-shape",
    "phase": "P0",
    "topic": "HTML tags",
    "label": "Tag / div → shape",
    "properties": [
      "div",
      "one object",
      "rectangle",
      "solid paint"
    ],
    "hint": "A leaf div is the smallest visual tag: the compiler lowers it to one Neonix JSON V2 rectangle shape layer.",
    "fixtureUrl": "/docs/html-compiler/fixtures/tags/div-shape.html",
    "composition": {
      "width": 1920,
      "height": 1080,
      "fps": 30,
      "background": "#081018",
      "colorSpace": "srgb"
    }
  },
  {
    "id": "html-compiler.tags.div-group",
    "phase": "P0",
    "topic": "HTML tags",
    "label": "Tag / div → group",
    "properties": [
      "div",
      "nested children",
      "group",
      "two shapes"
    ],
    "hint": "A div with children becomes a group; each child div becomes a rectangle layer parented to that group.",
    "fixtureUrl": "/docs/html-compiler/fixtures/tags/div-group.html",
    "composition": {
      "width": 1920,
      "height": 1080,
      "fps": 30,
      "background": "#081018",
      "colorSpace": "srgb"
    }
  },
  {
    "id": "html-compiler.tags.svg-path",
    "phase": "P0",
    "topic": "HTML tags",
    "label": "Tag / svg + path",
    "properties": [
      "svg",
      "path",
      "vector group",
      "cubic contour"
    ],
    "hint": "An svg container becomes a group and its path child lowers to a Neonix JSON V2 path with fill and stroke semantics.",
    "fixtureUrl": "/docs/html-compiler/fixtures/svg/path.html",
    "composition": {
      "width": 1920,
      "height": 1080,
      "fps": 30,
      "background": "#081018",
      "colorSpace": "srgb"
    }
  },
  {
    "id": "html-compiler.geometry.sizing-constraints",
    "phase": "P0",
    "topic": "Composition & geometry",
    "label": "Geometry / sizing constraints",
    "properties": [
      "width",
      "height",
      "min-width",
      "max-width",
      "min-height",
      "max-height",
      "aspect-ratio",
      "box-sizing"
    ],
    "hint": "Explicit width/height, the four min/max constraint longhands, and aspect-ratio combined with content-box vs border-box, all resolved before lowering to V2.",
    "fixtureUrl": "/docs/html-compiler/fixtures/geometry/sizing-constraints.html",
    "composition": {
      "width": 1920,
      "height": 1080,
      "fps": 30,
      "background": "#081018",
      "colorSpace": "srgb"
    }
  },
  {
    "id": "html-compiler.geometry.box-model-spacing",
    "phase": "P0",
    "topic": "Composition & geometry",
    "label": "Geometry / box-model spacing",
    "properties": [
      "margin",
      "padding",
      "shorthand forms",
      "longhands"
    ],
    "hint": "Margin and padding shorthand forms (all/YX/three-value) plus the four individual longhands, resolved into the final composition-space frame.",
    "fixtureUrl": "/docs/html-compiler/fixtures/geometry/box-model-spacing.html",
    "composition": {
      "width": 1920,
      "height": 1080,
      "fps": 30,
      "background": "#081018",
      "colorSpace": "srgb"
    }
  },
  {
    "id": "html-compiler.geometry.positioning",
    "phase": "P0",
    "topic": "Composition & geometry",
    "label": "Geometry / positioning",
    "properties": [
      "position: static",
      "position: relative",
      "position: absolute",
      "inset",
      "auto size"
    ],
    "hint": "Static/relative/absolute positioning modes, plus the inset shorthand resolving remaining width/height from opposite edges inside its containing block.",
    "fixtureUrl": "/docs/html-compiler/fixtures/geometry/positioning.html",
    "composition": {
      "width": 1920,
      "height": 1080,
      "fps": 30,
      "background": "#081018",
      "colorSpace": "srgb"
    }
  },
  {
    "id": "html-compiler.geometry.display-visibility",
    "phase": "P0",
    "topic": "Composition & geometry",
    "label": "Geometry / display + visibility",
    "properties": [
      "display: block",
      "display: contents",
      "display: none",
      "visibility: visible",
      "visibility: hidden"
    ],
    "hint": "Block creates a normal visual box, contents promotes its children into the parent flow, none removes the subtree, and hidden keeps geometry while disabling the emitted layer.",
    "fixtureUrl": "/docs/html-compiler/fixtures/geometry/display-visibility.html",
    "composition": {
      "width": 1920,
      "height": 1080,
      "fps": 30,
      "background": "#081018",
      "colorSpace": "srgb"
    }
  },
  {
    "id": "html-compiler.geometry.opacity-z-index-overflow",
    "phase": "P0",
    "topic": "Composition & geometry",
    "label": "Geometry / opacity + stacking + overflow",
    "properties": [
      "opacity",
      "z-index",
      "overflow: visible",
      "overflow: hidden",
      "clipPath"
    ],
    "hint": "Opacity lowers to layer alpha, numeric z-index controls sibling paint order, and overflow hidden creates a composition-space rectangular clip for descendants.",
    "fixtureUrl": "/docs/html-compiler/fixtures/geometry/opacity-z-index-overflow.html",
    "composition": {
      "width": 1920,
      "height": 1080,
      "fps": 30,
      "background": "#081018",
      "colorSpace": "srgb"
    }
  },
  {
    "id": "html-compiler.transform.functions",
    "phase": "P0",
    "topic": "Transform 2D",
    "label": "Transform / 2D functions",
    "properties": [
      "transform",
      "transform-origin",
      "translate",
      "scale",
      "rotate",
      "skew"
    ],
    "hint": "The transform list is preserved in source order and lowered to Neonix JSON V2 operations; transform-origin becomes the local anchor for the complete list.",
    "fixtureUrl": "/docs/html-compiler/fixtures/transform/functions.html",
    "composition": {
      "width": 1920,
      "height": 1080,
      "fps": 30,
      "background": "#081018",
      "colorSpace": "srgb"
    }
  },
  {
    "id": "html-compiler.transform.rotate-single",
    "phase": "P0",
    "topic": "Transform 2D",
    "label": "Transform / single rotate",
    "properties": [
      "one rectangle",
      "rotate",
      "transform-origin",
      "edge rasterization"
    ],
    "hint": "A single rectangle isolates transform geometry from multi-layer overlap so browser and native edge rasterization can be compared directly.",
    "fixtureUrl": "/docs/html-compiler/fixtures/transform/rotate-single.html",
    "composition": {
      "width": 1920,
      "height": 1080,
      "fps": 30,
      "background": "#081018",
      "colorSpace": "srgb"
    }
  },
  {
    "id": "html-compiler.paint.svg-fill",
    "phase": "P0",
    "topic": "Paint",
    "label": "Paint / SVG fill",
    "properties": [
      "fill",
      "fill-opacity",
      "fill-rule",
      "evenodd",
      "path"
    ],
    "hint": "SVG fill is lowered to path style, fill-opacity becomes alpha, and evenodd preserves the hole between nested contours.",
    "fixtureUrl": "/docs/html-compiler/fixtures/svg/fill.html",
    "composition": {
      "width": 1920,
      "height": 1080,
      "fps": 30,
      "background": "#081018",
      "colorSpace": "srgb"
    }
  },
  {
    "id": "html-compiler.paint.svg-stroke",
    "phase": "P0",
    "topic": "Paint",
    "label": "Paint / SVG stroke",
    "properties": [
      "stroke",
      "stroke-width",
      "stroke-opacity",
      "stroke-linejoin",
      "stroke-linecap"
    ],
    "hint": "An open SVG path isolates stroke paint, width, opacity, join and cap semantics without a fill pass.",
    "fixtureUrl": "/docs/html-compiler/fixtures/svg/stroke.html",
    "composition": {
      "width": 1920,
      "height": 1080,
      "fps": 30,
      "background": "#081018",
      "colorSpace": "srgb"
    }
  },
  {
    "id": "html-compiler.paint.svg-dash-order",
    "phase": "P0",
    "topic": "Paint",
    "label": "Paint / dash + paint-order",
    "properties": [
      "stroke-dasharray",
      "stroke-dashoffset",
      "paint-order",
      "fill",
      "stroke"
    ],
    "hint": "A closed path keeps dashed stroke geometry, dash offset and explicit stroke-before-fill paint order in the lowered path style.",
    "fixtureUrl": "/docs/html-compiler/fixtures/svg/dash-order.html",
    "composition": {
      "width": 1920,
      "height": 1080,
      "fps": 30,
      "background": "#081018",
      "colorSpace": "srgb"
    }
  },
  {
    "id": "html-compiler.media.object-fit-contain",
    "phase": "P0",
    "topic": "Media",
    "label": "Media / object-fit contain",
    "properties": [
      "img",
      "object-fit: contain",
      "object-position",
      "asset"
    ],
    "hint": "Contain preserves the image aspect ratio inside a fixed composition viewport and keeps the source centered.",
    "fixtureUrl": "/docs/html-compiler/fixtures/media/object-fit-contain.html",
    "composition": {
      "width": 1920,
      "height": 1080,
      "fps": 30,
      "background": "#081018",
      "colorSpace": "srgb"
    }
  },
  {
    "id": "html-compiler.media.object-fit-cover-position",
    "phase": "P0",
    "topic": "Media",
    "label": "Media / cover + position",
    "properties": [
      "img",
      "object-fit: cover",
      "object-position: right top",
      "clipping"
    ],
    "hint": "Cover fills the viewport, clips the overflow and uses object-position to choose the visible crop region.",
    "fixtureUrl": "/docs/html-compiler/fixtures/media/object-fit-cover-position.html",
    "composition": {
      "width": 1920,
      "height": 1080,
      "fps": 30,
      "background": "#081018",
      "colorSpace": "srgb"
    }
  },
  {
    "id": "html-compiler.media.object-fit-fill-rendering",
    "phase": "P0",
    "topic": "Media",
    "label": "Media / fill + pixelated",
    "properties": [
      "img",
      "object-fit: fill",
      "image-rendering: pixelated",
      "asset"
    ],
    "hint": "Fill maps to a non-uniform image viewport; pixelated is lowered to nearest-neighbor sampling where the renderer can guarantee it.",
    "fixtureUrl": "/docs/html-compiler/fixtures/media/object-fit-fill-rendering.html",
    "composition": {
      "width": 1920,
      "height": 1080,
      "fps": 30,
      "background": "#081018",
      "colorSpace": "srgb"
    }
  },
  {
    "id": "html-compiler.media.object-fit-none-clipping",
    "phase": "P0",
    "topic": "Media",
    "label": "Media / none + clipping",
    "properties": [
      "img",
      "object-fit: none",
      "object-position",
      "overflow: hidden"
    ],
    "hint": "None keeps the intrinsic image scale and relies on the image viewport plus its overflow-hidden parent for deterministic clipping.",
    "fixtureUrl": "/docs/html-compiler/fixtures/media/object-fit-none-clipping.html",
    "composition": {
      "width": 1920,
      "height": 1080,
      "fps": 30,
      "background": "#081018",
      "colorSpace": "srgb"
    }
  },
  {
    "id": "html-compiler.typography.text-align-values",
    "phase": "P0",
    "topic": "Typography",
    "label": "Typography / text-align values",
    "properties": [
      "text-align",
      "start",
      "end",
      "left",
      "right",
      "center",
      "justify",
      "match-parent",
      "justify-all"
    ],
    "hint": "Eight CSS text-align inputs are normalized into the Neonix JSON V2 text layout contract; match-parent resolves to left for the compiler's fixed LTR text and justify-all preserves its base justify alignment.",
    "fixtureUrl": "/docs/html-compiler/fixtures/typography/text-align-values.html",
    "composition": {
      "width": 1920,
      "height": 1080,
      "fps": 30,
      "background": "#081018",
      "colorSpace": "srgb"
    }
  },
  {
    "id": "html-compiler.typography.text-spacing-whitespace",
    "phase": "P0",
    "topic": "Typography",
    "label": "Typography / spacing and white-space",
    "properties": [
      "letter-spacing",
      "word-spacing",
      "white-space",
      "normal",
      "nowrap",
      "pre",
      "pre-wrap",
      "pre-line",
      "break-spaces"
    ],
    "hint": "CSS letter-spacing and word-spacing are lowered into text spans; white-space preserves or collapses source whitespace before runtime wrapping and shaping.",
    "fixtureUrl": "/docs/html-compiler/fixtures/typography/text-spacing-whitespace.html",
    "composition": {
      "width": 1920,
      "height": 1080,
      "fps": 30,
      "background": "#081018",
      "colorSpace": "srgb"
    }
  },
  {
    "id": "html-compiler.typography.direction-writing-decoration",
    "phase": "P0",
    "topic": "Typography",
    "label": "Typography / direction, writing-mode and decoration",
    "properties": [
      "direction",
      "ltr",
      "rtl",
      "writing-mode",
      "horizontal-tb",
      "vertical-rl",
      "vertical-lr",
      "text-decoration",
      "underline",
      "overline",
      "line-through"
    ],
    "hint": "CSS direction and writing-mode are emitted on the text source; text-decoration is lowered into Neonix JSON V2 decoration paints and thickness.",
    "fixtureUrl": "/docs/html-compiler/fixtures/typography/direction-writing-decoration.html",
    "composition": {
      "width": 1920,
      "height": 1080,
      "fps": 30,
      "background": "#081018",
      "colorSpace": "srgb"
    }
  },
  {
    "id": "html-compiler.typography.style-stretch",
    "phase": "P0",
    "topic": "Typography",
    "label": "Typography / style + stretch",
    "properties": [
      "font-style",
      "font-stretch",
      "italic",
      "condensed",
      "weight 400",
      "weight 700"
    ],
    "hint": "Style and stretch remain semantic span values; without a condensed asset in the refreshed Google catalog, the requested condensed lines deterministically fall back to the normal Roboto faces.",
    "fixtureUrl": "/docs/html-compiler/fixtures/typography/style-stretch.html",
    "composition": {
      "width": 1920,
      "height": 1080,
      "fps": 30,
      "background": "#081018",
      "colorSpace": "srgb"
    }
  },
  {
    "id": "html-compiler.paint.svg-stroke-dasharray-odd-count",
    "phase": "P0",
    "topic": "Paint",
    "label": "Paint / odd-length stroke-dasharray",
    "properties": [
      "stroke-dasharray",
      "odd length",
      "spec repeat"
    ],
    "hint": "An odd-length stroke-dasharray (3 values) is repeated once to become even-length per spec before reaching Skia's PathEffect.MakeDash, which otherwise throws on a raw odd-length array.",
    "fixtureUrl": "/docs/html-compiler/fixtures/svg/stroke-dasharray-odd-count.html",
    "composition": {
      "width": 1920,
      "height": 1080,
      "fps": 30,
      "background": "#081018",
      "colorSpace": "srgb"
    }
  }
];

export const HTML_COMPILER_TAG_LOWERING_CASES: HtmlCompilerPreviewCase[] = [
  {
    "id": "html-compiler.tags.document-shell-container",
    "phase": "P0",
    "category": "HTML tag lowering",
    "topic": "HTML tags",
    "label": "Tag lowering / document shell + containers",
    "properties": [
      "html",
      "head",
      "meta",
      "body",
      "section",
      "article",
      "div",
      "group"
    ],
    "hint": "The document shell is non-visual; section and article remain container aliases and lower through CSS into groups or shape layers.",
    "fixtureUrl": "/docs/html-compiler/fixtures/tags/document-shell-container.html",
    "composition": {
      "width": 1920,
      "height": 1080,
      "fps": 30,
      "background": "#081018",
      "colorSpace": "srgb"
    }
  },
  {
    "id": "html-compiler.tags.text-lowering",
    "phase": "P0",
    "category": "HTML tag lowering",
    "topic": "HTML tags",
    "label": "Tag lowering / text elements",
    "properties": [
      "h1",
      "p",
      "strong",
      "br",
      "text layer",
      "nested text"
    ],
    "hint": "Heading and paragraph tags lower to Protocol text layers; strong remains nested text content and br becomes a newline.",
    "fixtureUrl": "/docs/html-compiler/fixtures/tags/text-lowering.html",
    "composition": {
      "width": 1920,
      "height": 1080,
      "fps": 30,
      "background": "#081018",
      "colorSpace": "srgb"
    }
  },
  {
    "id": "html-compiler.tags.media-lowering",
    "phase": "P0",
    "category": "HTML tag lowering",
    "topic": "HTML tags",
    "label": "Tag lowering / image + video",
    "properties": [
      "img",
      "video",
      "image layer",
      "video layer",
      "asset registry"
    ],
    "hint": "Image and video tags select media layer lowering and register deterministic Protocol assets instead of becoming generic containers.",
    "fixtureUrl": "/docs/html-compiler/fixtures/tags/media-lowering.html",
    "composition": {
      "width": 1920,
      "height": 1080,
      "fps": 30,
      "background": "#081018",
      "colorSpace": "srgb"
    }
  },
  {
    "id": "html-compiler.tags.audio-lowering",
    "phase": "P0",
    "category": "HTML tag lowering",
    "topic": "HTML tags",
    "label": "Tag lowering / audio track",
    "properties": [
      "audio",
      "audio.tracks",
      "clip",
      "audio asset"
    ],
    "hint": "Audio is non-visual: the tag creates a root Protocol audio track and clip rather than a visual layer.",
    "fixtureUrl": "/docs/html-compiler/fixtures/tags/audio-lowering.html",
    "composition": {
      "width": 1920,
      "height": 1080,
      "fps": 30,
      "background": "#081018",
      "colorSpace": "srgb"
    }
  },
  {
    "id": "html-compiler.tags.svg-lowering",
    "phase": "P0",
    "category": "HTML tag lowering",
    "topic": "HTML tags",
    "label": "Tag lowering / SVG primitives",
    "properties": [
      "svg",
      "rect",
      "circle",
      "line",
      "polygon",
      "path layers"
    ],
    "hint": "SVG containers remain groups while visual primitives are normalized to canonical path layers.",
    "fixtureUrl": "/docs/html-compiler/fixtures/svg/lowering.html",
    "composition": {
      "width": 1920,
      "height": 1080,
      "fps": 30,
      "background": "#081018",
      "colorSpace": "srgb"
    }
  },
  {
    "id": "html-compiler.tags.container-aliases",
    "phase": "P0",
    "category": "HTML tag lowering",
    "topic": "HTML tags",
    "label": "Tag lowering / container aliases",
    "properties": [
      "main",
      "header",
      "nav",
      "aside",
      "figure",
      "figcaption",
      "footer",
      "groups"
    ],
    "hint": "Video composition containers share the CSS-driven group/shape lowering contract; their semantic names do not create browser-only layer types.",
    "fixtureUrl": "/docs/html-compiler/fixtures/tags/container-aliases.html",
    "composition": {
      "width": 1920,
      "height": 1080,
      "fps": 30,
      "background": "#081018",
      "colorSpace": "srgb"
    }
  },
  {
    "id": "html-compiler.tags.text-tag-matrix",
    "phase": "P0",
    "category": "HTML tag lowering",
    "topic": "HTML tags",
    "label": "Tag lowering / complete text matrix",
    "properties": [
      "h2-h6",
      "span",
      "b",
      "em",
      "i",
      "small",
      "blockquote",
      "pre",
      "code"
    ],
    "hint": "All supported text tags lower to semantic Protocol text layers while tag defaults and whitespace-sensitive tags remain visible in computed style.",
    "fixtureUrl": "/docs/html-compiler/fixtures/tags/text-tag-matrix.html",
    "composition": {
      "width": 1920,
      "height": 1080,
      "fps": 30,
      "background": "#081018",
      "colorSpace": "srgb"
    }
  },
  {
    "id": "html-compiler.tags.svg-primitive-matrix",
    "phase": "P0",
    "category": "HTML tag lowering",
    "topic": "HTML tags",
    "label": "Tag lowering / SVG path matrix",
    "properties": [
      "g",
      "path",
      "ellipse",
      "polyline",
      "nested group",
      "path layers"
    ],
    "hint": "Nested SVG groups preserve the parent coordinate space while path, ellipse and polyline primitives lower to independent Protocol path layers.",
    "fixtureUrl": "/docs/html-compiler/fixtures/svg/primitive-matrix.html",
    "composition": {
      "width": 1920,
      "height": 1080,
      "fps": 30,
      "background": "#081018",
      "colorSpace": "srgb"
    }
  }
];

export const HTML_COMPILER_TEXT_COMPILER_LAYOUT_CASES: HtmlCompilerPreviewCase[] = [
  {
    "id": "html-compiler.text.compiler.br-hard-break",
    "phase": "P0",
    "category": "Text compiler & layout",
    "topic": "Typography",
    "label": "Text compiler / br hard break",
    "properties": [
      "br",
      "source newline",
      "normal whitespace",
      "text layer"
    ],
    "hint": "The compiler must preserve a <br> as a semantic hard break while keeping normal whitespace collapsing available to the runtime.",
    "fixtureUrl": "/docs/html-compiler/fixtures/debug/compiler-br-hard-break.html",
    "composition": {
      "width": 1920,
      "height": 1080,
      "fps": 30,
      "background": "#081018",
      "colorSpace": "srgb"
    }
  },
  {
    "id": "html-compiler.text.compiler.nested-inline-content",
    "phase": "P0",
    "category": "Text compiler & layout",
    "topic": "Typography",
    "label": "Text compiler / nested inline content",
    "properties": [
      "p",
      "strong",
      "em",
      "style spans",
      "text layer"
    ],
    "hint": "Nested inline tags contribute text content to one semantic text layer while preserving source order, character ranges and per-span font semantics.",
    "fixtureUrl": "/docs/html-compiler/fixtures/debug/compiler-nested-inline-content.html",
    "composition": {
      "width": 1920,
      "height": 1080,
      "fps": 30,
      "background": "#081018",
      "colorSpace": "srgb"
    }
  },
  {
    "id": "html-compiler.text.compiler.whitespace-contract",
    "phase": "P0",
    "category": "Text compiler & layout",
    "topic": "Typography",
    "label": "Text compiler / whitespace contract",
    "properties": [
      "normal",
      "pre",
      "source whitespace",
      "wrap policy"
    ],
    "hint": "The compiler emits the source text and computed whitespace mode separately so normal and pre layout can be evaluated without conflating source newlines with hard breaks.",
    "fixtureUrl": "/docs/html-compiler/fixtures/debug/compiler-whitespace-contract.html",
    "composition": {
      "width": 1920,
      "height": 1080,
      "fps": 30,
      "background": "#081018",
      "colorSpace": "srgb"
    }
  },
  {
    "id": "html-compiler.text.layout.fixed-line-height",
    "phase": "P1.4",
    "category": "Text compiler & layout",
    "topic": "Layout",
    "label": "Text layout / fixed line-height",
    "properties": [
      "br",
      "fixed frame",
      "line-height",
      "baseline"
    ],
    "hint": "Explicit line-height and hard breaks produce deterministic line boxes inside a fixed text frame.",
    "fixtureUrl": "/docs/html-compiler/fixtures/debug/layout-fixed-line-height.html",
    "composition": {
      "width": 1920,
      "height": 1080,
      "fps": 30,
      "background": "#081018",
      "colorSpace": "srgb"
    }
  },
  {
    "id": "html-compiler.text.layout.wrap-width",
    "phase": "P1.4",
    "category": "Text compiler & layout",
    "topic": "Layout",
    "label": "Text layout / fixed width wrapping",
    "properties": [
      "fixed width",
      "word wrapping",
      "content width",
      "line count"
    ],
    "hint": "A constrained width creates multiple runtime line boxes while the Protocol frame remains the authored fixed width.",
    "fixtureUrl": "/docs/html-compiler/fixtures/debug/layout-wrap-width.html",
    "composition": {
      "width": 1920,
      "height": 1080,
      "fps": 30,
      "background": "#081018",
      "colorSpace": "srgb"
    }
  },
  {
    "id": "html-compiler.text.layout.auto-height",
    "phase": "P1.4",
    "category": "Text compiler & layout",
    "topic": "Layout",
    "label": "Text layout / auto-height wrapping",
    "properties": [
      "height:auto",
      "fixed-width-auto-height",
      "intrinsic height",
      "wrapping"
    ],
    "hint": "When width is authored but height is auto, compiler layout estimates the wrapped text height and emits a usable frame for runtime shaping.",
    "fixtureUrl": "/docs/html-compiler/fixtures/debug/layout-auto-height.html",
    "composition": {
      "width": 1920,
      "height": 1080,
      "fps": 30,
      "background": "#081018",
      "colorSpace": "srgb"
    }
  }
];

const debugTextGradient = (
  slug: string,
  label: string,
  properties: string[],
): HtmlCompilerPreviewCase => ({
  id: `html-compiler.debug.${slug}`,
  phase: "P2.9",
  category: "Text compiler & layout",
  topic: "Typography",
  label: `Debug text gradient / ${label}`,
  properties: ["background-clip: text", ...properties],
  hint: `Isolated ${label} probe for browser-to-CanvasKit analysis.`,
  fixtureUrl: `/docs/html-compiler/fixtures/debug/${slug}.html`,
  composition: { width: 1920, height: 1080, fps: 30, background: "#081018", colorSpace: "srgb" },
});

/** Each fixture varies one CSS gradient semantic for native-stage analysis. */
export const HTML_COMPILER_TEXT_GRADIENT_DEBUG_CASES: HtmlCompilerPreviewCase[] = [
  debugTextGradient("text-gradient-linear-angle", "linear angle + stops", ["linear-gradient", "angle", "explicit stops"]),
  debugTextGradient("text-gradient-linear-alpha", "linear alpha stops", ["linear-gradient", "rgba stops", "alpha interpolation"]),
  debugTextGradient("text-gradient-linear-hard-stop", "linear hard stop", ["linear-gradient", "multi-position stop", "discontinuity"]),
  debugTextGradient("text-gradient-radial-off-center", "radial off-center", ["radial-gradient", "off-center", "circle radius"]),
  debugTextGradient("text-gradient-radial-ellipse", "radial ellipse", ["radial-gradient", "ellipse", "explicit radii"]),
  debugTextGradient("text-gradient-conic-angle-center", "conic angle + center", ["conic-gradient", "start angle", "off-center"]),
  debugTextGradient("text-gradient-conic-seam", "conic seam", ["conic-gradient", "seam", "hard stops"]),
  debugTextGradient("text-gradient-multiline", "multiline box geometry", ["linear-gradient", "wrapping", "element coordinates"]),
  debugTextGradient("text-gradient-background-origin", "background origin", ["linear-gradient", "background-origin", "padding box"]),
  debugTextGradient("text-gradient-repeating-linear", "repeating linear", ["repeating-linear-gradient", "tile mode", "period"]),
];

/** Full local font-catalog probes for browser/CanvasKit typography comparison. */
export const HTML_COMPILER_FONT_CATALOG_CASES: HtmlCompilerPreviewCase[] = [
  {
    id: "html-compiler.typography.font-catalog-ui-body",
    phase: "P0",
    category: "Typography & media primitives",
    topic: "Typography",
    label: "Typography / UI and body font catalog",
    properties: ["45-family catalog", "UI/body families", "font-weight", "font-family"],
    hint: "Compares the bundled UI/body families with the same glyph run so browser and CanvasKit can be checked side by side.",
    fixtureUrl: "/docs/html-compiler/fixtures/typography/font-catalog-ui-body.html",
    composition: { width: 1920, height: 1080, fps: 30, background: "#081018", colorSpace: "srgb" },
  },
  {
    id: "html-compiler.typography.font-catalog-display",
    phase: "P0",
    category: "Typography & media primitives",
    topic: "Typography",
    label: "Typography / display font catalog",
    properties: ["display families", "font-weight", "letter-spacing", "font-family"],
    hint: "Compares the bundled display families and their metrics at fixed card geometry.",
    fixtureUrl: "/docs/html-compiler/fixtures/typography/font-catalog-display.html",
    composition: { width: 1920, height: 1080, fps: 30, background: "#120c1b", colorSpace: "srgb" },
  },
  {
    id: "html-compiler.typography.font-catalog-monospace",
    phase: "P0",
    category: "Typography & media primitives",
    topic: "Typography",
    label: "Typography / monospace font catalog",
    properties: ["monospace families", "code punctuation", "tabular rhythm", "font-weight"],
    hint: "Compares code-oriented families using identical operators, punctuation, digits and spacing.",
    fixtureUrl: "/docs/html-compiler/fixtures/typography/font-catalog-monospace.html",
    composition: { width: 1920, height: 1080, fps: 30, background: "#071713", colorSpace: "srgb" },
  },
  {
    id: "html-compiler.typography.font-catalog-editorial",
    phase: "P0",
    category: "Typography & media primitives",
    topic: "Typography",
    label: "Typography / editorial and multilingual catalog",
    properties: ["serif families", "italic", "Arabic shaping", "emoji fallback"],
    hint: "Compares serif metrics together with Arabic shaping and the explicit Noto Color Emoji family.",
    fixtureUrl: "/docs/html-compiler/fixtures/typography/font-catalog-editorial.html",
    composition: { width: 1920, height: 1080, fps: 30, background: "#17120d", colorSpace: "srgb" },
  },
];

export const HTML_COMPILER_ANCHOR_CASES: HtmlCompilerPreviewCase[] = [
  {
    "id": "html-compiler.layout.anchor-positioning",
    "phase": "P0",
    "category": "Layout primitives",
    "topic": "Layout",
    "label": "Layout / CSS anchor positioning",
    "properties": [
      "anchor-name",
      "position-anchor",
      "anchor()",
      "anchor-size()"
    ],
    "hint": "The label is positioned from the subject's right edge and inherits its width through compiler-side anchor resolution.",
    "fixtureUrl": "/docs/html-compiler/fixtures/layout/anchor-positioning.html",
    "composition": {
      "width": 1920,
      "height": 1080,
      "fps": 30,
      "background": "#081018",
      "colorSpace": "srgb"
    }
  }
];

export const HTML_COMPILER_PHASE1_1_CASES: HtmlCompilerPreviewCase[] = [
  {
    "id": "html-compiler.layout.flex-container",
    "phase": "P1.1",
    "topic": "Layout",
    "label": "Layout / flex container",
    "properties": [
      "flex-direction",
      "gap",
      "justify-content",
      "align-items",
      "align-self",
      "flex-grow/shrink"
    ],
    "hint": "Four flex-container primitives side by side: row vs. column axis, main-axis gap, justify/align distribution with an align-self override, and the flex shorthand's grow-ratio free-space split.",
    "fixtureUrl": "/docs/html-compiler/fixtures/layout/flex-container.html",
    "composition": {
      "width": 1920,
      "height": 1080,
      "fps": 30,
      "background": "#081018",
      "colorSpace": "srgb"
    }
  }
];

export const HTML_COMPILER_PHASE1_2_CASES: HtmlCompilerPreviewCase[] = [
  {
    "id": "html-compiler.layout.flex-wrapping",
    "phase": "P1.2",
    "topic": "Layout",
    "label": "Layout / flex wrapping",
    "properties": [
      "flex-wrap:wrap",
      "flex-wrap:wrap-reverse",
      "align-content",
      "row-gap",
      "column-gap"
    ],
    "hint": "Three multi-line wrap cases: align-content:space-between distributing cross-axis space between lines with a row-gap present, wrap-reverse flipping the cross-axis start to the bottom edge, and the flex-start baseline case.",
    "fixtureUrl": "/docs/html-compiler/fixtures/layout/flex-wrapping.html",
    "composition": {
      "width": 1920,
      "height": 1080,
      "fps": 30,
      "background": "#081018",
      "colorSpace": "srgb"
    }
  }
];

export const HTML_COMPILER_PHASE1_3_CASES: HtmlCompilerPreviewCase[] = [
  {
    "id": "html-compiler.layout.grid-explicit-columns",
    "phase": "P1.3",
    "topic": "Layout",
    "label": "Layout / grid columns",
    "properties": [
      "display:grid",
      "grid-template-columns",
      "px",
      "%",
      "fr"
    ],
    "hint": "Explicit px and fr columns resolve to fixed composition tracks; unassigned children use deterministic row-major placement.",
    "fixtureUrl": "/docs/html-compiler/fixtures/layout/grid-explicit-columns.html",
    "composition": {
      "width": 1920,
      "height": 1080,
      "fps": 30,
      "background": "#081018",
      "colorSpace": "srgb"
    }
  },
  {
    "id": "html-compiler.layout.grid-gap-alignment",
    "phase": "P1.3",
    "topic": "Layout",
    "label": "Layout / grid gap + alignment",
    "properties": [
      "gap",
      "place-items",
      "justify-content",
      "align-content"
    ],
    "hint": "Track gaps, track-area alignment and item alignment are resolved independently inside the composition content box.",
    "fixtureUrl": "/docs/html-compiler/fixtures/layout/grid-gap-alignment.html",
    "composition": {
      "width": 1920,
      "height": 1080,
      "fps": 30,
      "background": "#081018",
      "colorSpace": "srgb"
    }
  },
  {
    "id": "html-compiler.layout.grid-placement-span",
    "phase": "P1.3",
    "topic": "Layout",
    "label": "Layout / grid placement + spans",
    "properties": [
      "grid-column-start/end",
      "grid-row-start/end",
      "grid-column",
      "grid-row",
      "span"
    ],
    "hint": "Explicit longhand line placement side by side with the grid shorthand and span syntax, including a spanning item over fr tracks.",
    "fixtureUrl": "/docs/html-compiler/fixtures/layout/grid-placement-span.html",
    "composition": {
      "width": 1920,
      "height": 1080,
      "fps": 30,
      "background": "#081018",
      "colorSpace": "srgb"
    }
  }
];

export const HTML_COMPILER_PHASE1_4_CASES: HtmlCompilerPreviewCase[] = [
  {
    "id": "html-compiler.layout.item-ordering",
    "phase": "P1.4",
    "topic": "Layout",
    "label": "Layout / item ordering",
    "properties": [
      "order",
      "grid auto-placement",
      "min-width",
      "max-width",
      "flex distribution"
    ],
    "hint": "The order property reindexes visual placement in a flex row, feeds grid auto-placement directly, and combines with flex-grow and min/max clamping in a multi-pass free-space distribution.",
    "fixtureUrl": "/docs/html-compiler/fixtures/layout/item-ordering.html",
    "composition": {
      "width": 1920,
      "height": 1080,
      "fps": 30,
      "background": "#081018",
      "colorSpace": "srgb"
    }
  },
  {
    "id": "html-compiler.layout.containing-block-edge-cases",
    "phase": "P1.4",
    "topic": "Layout",
    "label": "Layout / containing block edge cases",
    "properties": [
      "absolute child",
      "flex containing block",
      "overflow:hidden",
      "display:contents",
      "position:relative",
      "non-collapsing margins"
    ],
    "hint": "A flex container establishes the absolute child's containing block off its padding box and clips overflow at that same padding box; a display:contents wrapper contributes no layer of its own; adjacent flex-item margins sum rather than collapse, and a relative offset applies after the flex slot is resolved.",
    "fixtureUrl": "/docs/html-compiler/fixtures/layout/containing-block-edge-cases.html",
    "composition": {
      "width": 1920,
      "height": 1080,
      "fps": 30,
      "background": "#081018",
      "colorSpace": "srgb"
    }
  },
  {
    "id": "html-compiler.layout.block-flow-margin-collapsing",
    "phase": "P1.4",
    "topic": "Layout",
    "label": "Layout / block-flow margin collapsing",
    "properties": [
      "margin-top",
      "margin-bottom",
      "padding-top",
      "overflow",
      "display:flex",
      "display:contents"
    ],
    "hint": "A parent's margin-top collapses with its first in-flow child's margin-top when nothing blocks it, and stays blocked by padding, overflow:hidden or a flex container; adjacent sibling margins take the max rather than summing, and a display:contents wrapper between parent and child does not stop the collapse from reaching the real child.",
    "fixtureUrl": "/docs/html-compiler/fixtures/layout/block-flow-margin-collapsing.html",
    "composition": {
      "width": 1920,
      "height": 1080,
      "fps": 30,
      "background": "#081018",
      "colorSpace": "srgb"
    }
  }
];

export const HTML_COMPILER_LAYOUT_TEXT_CASES: HtmlCompilerPreviewCase[] = [
  {
    "id": "html-compiler.layout.text-border-box-model",
    "phase": "P1.4",
    "topic": "Layout",
    "label": "Layout / text border box model",
    "properties": [
      "box-sizing:content-box",
      "box-sizing:border-box",
      "border-top/right/bottom/left",
      "padding",
      "border-radius",
      "content origin"
    ],
    "hint": "Six box-model variants on the same text block: content-box vs. border-box sizing side by side, a uniform border, four independent per-edge border widths that shift the content origin per side, a rounded border that changes the paint contour without changing the frame, and an asymmetric padding shorthand.",
    "fixtureUrl": "/docs/html-compiler/fixtures/layout/text-border-box-model.html",
    "composition": {
      "width": 1920,
      "height": 1080,
      "fps": 30,
      "background": "#081018",
      "colorSpace": "srgb"
    }
  },
  {
    "id": "html-compiler.layout.text-line-metrics",
    "phase": "P1.4",
    "topic": "Layout",
    "label": "Layout / text line-box metrics",
    "properties": [
      "line-height:normal",
      "line-height:88px",
      "font metrics",
      "line box",
      "baseline",
      "white-space:normal",
      "line wrapping"
    ],
    "hint": "line-height:normal resolves from the selected font's own metrics (a font-fallback-sensitive case, with and without a border), a fixed line-height gives the control baseline for comparison, and the last case wraps a long sentence across several lines inside a padded, bordered frame.",
    "fixtureUrl": "/docs/html-compiler/fixtures/layout/text-line-metrics.html",
    "composition": {
      "width": 1920,
      "height": 1080,
      "fps": 30,
      "background": "#081018",
      "colorSpace": "srgb"
    }
  }
];

export const HTML_COMPILER_PAINT_PHASE2_0_CASES: HtmlCompilerPreviewCase[] = [];

export const HTML_COMPILER_PAINT_PHASE2_9_CASES: HtmlCompilerPreviewCase[] = [
  {
    "id": "html-compiler.paint.color-srgb-primaries",
    "phase": "P2.9",
    "topic": "Paint",
    "label": "Paint / sRGB primaries, secondaries, gray, alpha and animated color",
    "properties": [
      "background",
      "rgba()",
      "display: grid",
      "animation-name (color)"
    ],
    "hint": "A CSS grid of solid-fill rects covers the full RGB primary/secondary set plus black, white and 50% gray for sRGB fidelity, one cell composites a 50%-alpha rect over a solid backdrop, and one cell animates background-color to exercise track-based color interpolation. Also exercises grid layout placement (11 cells, 4 columns).",
    "fixtureUrl": "/docs/html-compiler/fixtures/paint/color-srgb-primaries.html",
    "composition": {
      "width": 1920,
      "height": 1080,
      "fps": 30,
      "background": "#081018",
      "colorSpace": "srgb"
    }
  }
];

export const HTML_COMPILER_OPACITY_CASES: HtmlCompilerPreviewCase[] = [
  {
    "id": "html-compiler.opacity.image",
    "phase": "P2.0",
    "category": "Paint primitives",
    "topic": "Paint",
    "label": "Opacity / image",
    "properties": [
      "img",
      "opacity: 0.48",
      "source-over",
      "image asset"
    ],
    "hint": "A photographic image is composited over a solid card at fractional opacity so image alpha, sampling and source-over blending can be compared directly.",
    "fixtureUrl": "/docs/html-compiler/fixtures/opacity/image.html",
    "composition": {
      "width": 1920,
      "height": 1080,
      "fps": 30,
      "background": "#081018",
      "colorSpace": "srgb"
    }
  },
  {
    "id": "html-compiler.opacity.grid",
    "phase": "P2.0",
    "category": "Paint primitives",
    "topic": "Paint",
    "label": "Opacity / grid",
    "properties": [
      "display: grid",
      "repeating-linear-gradient",
      "opacity: 0.42",
      "child compositing"
    ],
    "hint": "A grid container and its child cells share one fractional opacity boundary, while thin repeating lines expose coverage and alpha differences.",
    "fixtureUrl": "/docs/html-compiler/fixtures/opacity/grid.html",
    "composition": {
      "width": 1920,
      "height": 1080,
      "fps": 30,
      "background": "#081018",
      "colorSpace": "srgb"
    }
  },
  {
    "id": "html-compiler.opacity.shape",
    "phase": "P2.0",
    "category": "Paint primitives",
    "topic": "Paint",
    "label": "Opacity / shape",
    "properties": [
      "rectangle",
      "ellipse",
      "border-radius",
      "independent opacity"
    ],
    "hint": "Overlapping rectangle and ellipse shapes use independent opacity values, making solid paint alpha and overlap compositing easy to inspect.",
    "fixtureUrl": "/docs/html-compiler/fixtures/opacity/shape.html",
    "composition": {
      "width": 1920,
      "height": 1080,
      "fps": 30,
      "background": "#081018",
      "colorSpace": "srgb"
    }
  }
];

/**
 * Kept as its own array purely so every basic gradient fixture (non-repeating
 * here, repeating in PHASE2_1 right after) sits together as one contiguous
 * run in the Paint dropdown, instead of being split across the far larger
 * PHASE0 catalog by unrelated background/image-function fixtures.
 */
export const HTML_COMPILER_PAINT_GRADIENT_CASES: HtmlCompilerPreviewCase[] = [];

export const HTML_COMPILER_PAINT_PHASE2_1_CASES: HtmlCompilerPreviewCase[] = [];

export const HTML_COMPILER_PAINT_PHASE2_2_CASES: HtmlCompilerPreviewCase[] = [];

export const HTML_COMPILER_PAINT_PHASE2_3_CASES: HtmlCompilerPreviewCase[] = [];

export const HTML_COMPILER_PAINT_PHASE2_4_CASES: HtmlCompilerPreviewCase[] = [];

// P2.5 (filter/effect single-value cases) fixtures were consolidated into
// the native-stage `effect` topic fixtures (blur, brightness, contrast,
// grayscale, sepia, invert, drop-shadow, filter-order) and removed.
export const HTML_COMPILER_PAINT_PHASE2_5_CASES: HtmlCompilerPreviewCase[] = [];

export const HTML_COMPILER_PAINT_PHASE2_6_CASES: HtmlCompilerPreviewCase[] = [];

export const HTML_COMPILER_PAINT_PHASE2_7_CASES: HtmlCompilerPreviewCase[] = [];

export const HTML_COMPILER_PAINT_PHASE2_8_CASES: HtmlCompilerPreviewCase[] = [];

export const HTML_COMPILER_MOTION_PHASE3_CASES: HtmlCompilerPreviewCase[] = [
  {
    "id": "html-compiler.motion.keyframes-basics",
    "phase": "P3",
    "topic": "Motion & animation",
    "label": "Motion / keyframes basics",
    "properties": [
      "@keyframes",
      "from/to",
      "0%/50%/100%",
      "animation-name",
      "duplicate offset"
    ],
    "hint": "Two-point and multi-stop keyframe tracks, a missing 0% holding the underlying value until its first explicit stop, two independent animation-name tracks on sibling elements, and a duplicate 50% offset where the later block wins.",
    "fixtureUrl": "/docs/html-compiler/fixtures/motion/keyframes-basics.html",
    "composition": { "width": 1920, "height": 1080, "fps": 30, "background": "#081018", "colorSpace": "srgb" }
  },
  {
    "id": "html-compiler.motion.delay-fill-mode",
    "phase": "P3",
    "topic": "Motion & animation",
    "label": "Motion / delay + fill-mode",
    "properties": [
      "animation-delay",
      "animation-fill-mode",
      "negative delay"
    ],
    "hint": "fill-mode none/backwards/forwards/both combined with a positive delay, plus a negative delay that starts the track partway through its timeline.",
    "fixtureUrl": "/docs/html-compiler/fixtures/motion/delay-fill-mode.html",
    "composition": { "width": 1920, "height": 1080, "fps": 30, "background": "#081018", "colorSpace": "srgb" }
  },
  {
    "id": "html-compiler.motion.iteration-play-state",
    "phase": "P3",
    "topic": "Motion & animation",
    "label": "Motion / iteration + play-state",
    "properties": [
      "animation-iteration-count",
      "fractional iteration",
      "infinite",
      "animation-play-state"
    ],
    "hint": "Integer, fractional and infinite iteration counts, plus animation-play-state: paused freezing the track at its current sample.",
    "fixtureUrl": "/docs/html-compiler/fixtures/motion/iteration-play-state.html",
    "composition": { "width": 1920, "height": 1080, "fps": 30, "background": "#081018", "colorSpace": "srgb" }
  },
  {
    "id": "html-compiler.motion.direction",
    "phase": "P3",
    "topic": "Motion & animation",
    "label": "Motion / direction",
    "properties": [
      "animation-direction",
      "normal",
      "reverse",
      "alternate",
      "alternate-reverse"
    ],
    "hint": "The four animation-direction keywords on the same opacity ramp, with alternate and alternate-reverse shown across two iterations to expose the flip.",
    "fixtureUrl": "/docs/html-compiler/fixtures/motion/direction.html",
    "composition": { "width": 1920, "height": 1080, "fps": 30, "background": "#081018", "colorSpace": "srgb" }
  },
  {
    "id": "html-compiler.motion.easing",
    "phase": "P3",
    "topic": "Motion & animation",
    "label": "Motion / easing and timing functions",
    "properties": [
      "linear",
      "ease",
      "cubic-bezier",
      "steps()",
      "jump-start/jump-end/jump-none/jump-both",
      "per-keyframe timing function"
    ],
    "hint": "The full timing-function vocabulary side by side: linear, the ease keyword, a cubic-bezier on transform, all four steps() jump terms, and a track that changes its timing function at each keyframe stop.",
    "fixtureUrl": "/docs/html-compiler/fixtures/motion/easing.html",
    "composition": { "width": 1920, "height": 1080, "fps": 30, "background": "#081018", "colorSpace": "srgb" }
  },
  {
    "id": "html-compiler.motion.animatable-properties",
    "phase": "P3",
    "topic": "Motion & animation",
    "label": "Motion / animatable property types",
    "properties": [
      "transform: scale",
      "transform: rotate",
      "transform-origin",
      "background-color (rgba)",
      "width/height",
      "box-sizing"
    ],
    "hint": "The range of value types the runtime tracks: scale and rotate with an off-center transform-origin, RGBA color interpolation including alpha, a stepped color track, and animated frame dimensions under border-box sizing.",
    "fixtureUrl": "/docs/html-compiler/fixtures/motion/animatable-properties.html",
    "composition": { "width": 1920, "height": 1080, "fps": 30, "background": "#081018", "colorSpace": "srgb" }
  },
  {
    "id": "html-compiler.motion.combo-transform-tracks",
    "phase": "P3",
    "topic": "Motion & animation",
    "label": "Motion / transform combined with other tracks",
    "properties": [
      "transform + opacity",
      "multiple animation-name",
      "transform-driven image pan",
      "overflow: hidden"
    ],
    "hint": "One animation driving two properties at once, two independent animation-name tracks with different easing on the same element, and a transform-driven image pan clipped by an overflow: hidden viewport.",
    "fixtureUrl": "/docs/html-compiler/fixtures/motion/combo-transform-tracks.html",
    "composition": { "width": 1920, "height": 1080, "fps": 30, "background": "#081018", "colorSpace": "srgb" }
  },
  {
    "id": "html-compiler.motion.combo-paint-interactions",
    "phase": "P3",
    "topic": "Motion & animation",
    "label": "Motion / animation combined with paint subsystems",
    "properties": [
      "filter: opacity()",
      "layer opacity",
      "border-color/border-width",
      "clip-path",
      "isolation",
      "mix-blend-mode"
    ],
    "hint": "Animation interacting with the paint pipeline: a CSS filter stacked with layer opacity, animated border paint under box-sizing: border-box, a static clip-path on an animated element, and an isolated group whose animated child blends with multiply.",
    "fixtureUrl": "/docs/html-compiler/fixtures/motion/combo-paint-interactions.html",
    "composition": { "width": 1920, "height": 1080, "fps": 30, "background": "#16324f", "colorSpace": "srgb" }
  },
  {
    "id": "html-compiler.motion-path.basics",
    "phase": "P3",
    "topic": "Motion & animation",
    "label": "Motion path / offset-path basics",
    "properties": [
      "offset-path",
      "offset-distance",
      "offset-rotate",
      "offset-anchor"
    ],
    "hint": "An element moving along a drawn path: a straight line with a fixed heading, a cubic curve with offset-rotate: auto turning to the tangent, a reversed heading anchored at the element's bottom edge, and a path that runs past the composition edge and gets clipped there. Dashed guide lines trace each track.",
    "fixtureUrl": "/docs/html-compiler/fixtures/motion/motion-path-basics.html",
    "composition": { "width": 1920, "height": 1080, "fps": 30, "background": "#081018", "colorSpace": "srgb" }
  },
  {
    "id": "html-compiler.motion-path.advanced",
    "phase": "P3",
    "topic": "Motion & animation",
    "label": "Motion path / closed loops, multi-segment paths and composition",
    "properties": [
      "offset-path: closed contour (Z)",
      "multi-segment polyline",
      "non-monotonic offset-distance",
      "offset-path + transform"
    ],
    "hint": "A closed rectangular loop that wraps seamlessly every cycle, a three-segment polyline, a track whose offset-distance moves forward then backward along the same path, and an element scaling with transform while it travels the path.",
    "fixtureUrl": "/docs/html-compiler/fixtures/motion/motion-path-advanced.html",
    "composition": { "width": 1920, "height": 1080, "fps": 30, "background": "#081018", "colorSpace": "srgb" }
  },
  {
    "id": "html-compiler.motion.keyframes-unknown-name",
    "phase": "P3",
    "topic": "Motion & animation",
    "label": "Motion / unknown animation diagnostic",
    "properties": [
      "animation-name",
      "diagnostic",
      "unsupported reference"
    ],
    "hint": "An animation-name without a matching @keyframes rule is a compiler diagnostic, never a silent no-op.",
    "fixtureUrl": "/docs/html-compiler/fixtures/debug/keyframes-unknown-name.html",
    "composition": { "width": 1920, "height": 1080, "fps": 30, "background": "#081018", "colorSpace": "srgb" }
  },
  {
    "id": "html-compiler.motion.easing-invalid",
    "phase": "P3",
    "topic": "Motion & animation",
    "label": "Motion / invalid easing diagnostic",
    "properties": [
      "steps(0)",
      "diagnostic",
      "no silent fallback"
    ],
    "hint": "Invalid step counts and cubic-bezier control points fail compilation with a specific diagnostic.",
    "fixtureUrl": "/docs/html-compiler/fixtures/debug/easing-invalid.html",
    "composition": { "width": 1920, "height": 1080, "fps": 30, "background": "#081018", "colorSpace": "srgb" }
  }
];

export const HTML_COMPILER_PERSPECTIVE_PHASE5_CASES: HtmlCompilerPreviewCase[] = [
  {
    "id": "html-compiler.perspective.group-translate-z",
    "phase": "P5",
    "topic": "Motion & animation",
    "label": "Perspective / group + translateZ",
    "properties": [
      "perspective",
      "perspective-origin",
      "translateZ",
      "Matrix4"
    ],
    "hint": "A parent perspective becomes a group render3d context while the child keeps translateZ in its ordered Matrix4 transform.",
    "fixtureUrl": "/docs/html-compiler/fixtures/perspective/group-translate-z.html",
    "composition": {
      "width": 1920,
      "height": 1080,
      "fps": 30,
      "background": "#081018",
      "colorSpace": "srgb"
    }
  },
  {
    "id": "html-compiler.perspective.rotate-x",
    "phase": "P5",
    "topic": "Motion & animation",
    "label": "Perspective / rotateX plane",
    "properties": [
      "perspective",
      "rotateX",
      "transform-origin"
    ],
    "hint": "The child plane rotates around its center in 3D; the compiler preserves the authored transform origin and parent camera context.",
    "fixtureUrl": "/docs/html-compiler/fixtures/perspective/rotate-x.html",
    "composition": {
      "width": 1920,
      "height": 1080,
      "fps": 30,
      "background": "#081018",
      "colorSpace": "srgb"
    }
  },
  {
    "id": "html-compiler.perspective.origin-offset",
    "phase": "P5",
    "topic": "Motion & animation",
    "label": "Perspective / off-center origin",
    "properties": [
      "perspective-origin",
      "rotateY",
      "translateZ"
    ],
    "hint": "An off-center perspective-origin changes the convergence point without changing the child's layout frame.",
    "fixtureUrl": "/docs/html-compiler/fixtures/perspective/origin-offset.html",
    "composition": {
      "width": 1920,
      "height": 1080,
      "fps": 30,
      "background": "#081018",
      "colorSpace": "srgb"
    }
  },
  {
    "id": "html-compiler.perspective.flat-preserve-3d",
    "phase": "P5",
    "topic": "Motion & animation",
    "label": "Perspective / flat vs preserve-3d",
    "properties": [
      "transform-style",
      "flat",
      "preserve-3d",
      "nested groups"
    ],
    "hint": "Two independent group contexts keep transform-style explicit in JSON so the runtime can apply the intended flattening boundary.",
    "fixtureUrl": "/docs/html-compiler/fixtures/perspective/flat-preserve-3d.html",
    "composition": {
      "width": 1920,
      "height": 1080,
      "fps": 30,
      "background": "#081018",
      "colorSpace": "srgb"
    }
  },
  {
    "id": "html-compiler.perspective.transform-function",
    "phase": "P5",
    "topic": "Motion & animation",
    "label": "Perspective / transform() function",
    "properties": [
      "transform: perspective()",
      "ordered operations",
      "rotateY"
    ],
    "hint": "transform: perspective() remains an ordered motion.perspective operation and is kept distinct from a parent perspective context.",
    "fixtureUrl": "/docs/html-compiler/fixtures/perspective/transform-function.html",
    "composition": {
      "width": 1920,
      "height": 1080,
      "fps": 30,
      "background": "#081018",
      "colorSpace": "srgb"
    }
  },
  {
    "id": "html-compiler.perspective.backface-hidden",
    "phase": "P5",
    "topic": "Motion & animation",
    "label": "Perspective / hidden backface",
    "properties": [
      "backface-visibility",
      "rotateY(180deg)",
      "layer state"
    ],
    "hint": "backface-visibility is preserved on the transformed layer; the runtime decides whether the reverse surface is paintable.",
    "fixtureUrl": "/docs/html-compiler/fixtures/perspective/backface-hidden.html",
    "composition": {
      "width": 1920,
      "height": 1080,
      "fps": 30,
      "background": "#081018",
      "colorSpace": "srgb"
    }
  },
  {
    "id": "html-compiler.perspective.near-far-clipping",
    "phase": "P5",
    "topic": "Motion & animation",
    "label": "Perspective / near and far clipping",
    "properties": [
      "perspective",
      "translateZ",
      "near/far clip"
    ],
    "hint": "The perspective context keeps the layer's authored frame while Runtime V2 clips projected geometry at the camera planes.",
    "fixtureUrl": "/docs/html-compiler/fixtures/perspective/near-far-clipping.html",
    "composition": {
      "width": 1920,
      "height": 1080,
      "fps": 30,
      "background": "#081018",
      "colorSpace": "srgb"
    }
  },
  {
    "id": "html-compiler.perspective.animated-3d",
    "phase": "P5",
    "topic": "Motion & animation",
    "label": "Perspective / animated translateZ + rotateY",
    "properties": [
      "@keyframes",
      "translateZ",
      "rotateY",
      "tracks"
    ],
    "hint": "3D transform keyframes lower to typed Matrix4 operations on the shared timeline; no CSS animation engine is introduced in Runtime V2.",
    "fixtureUrl": "/docs/html-compiler/fixtures/perspective/animated-3d.html",
    "composition": {
      "width": 1920,
      "height": 1080,
      "fps": 30,
      "background": "#081018",
      "colorSpace": "srgb"
    }
  },
  {
    "id": "html-compiler.perspective.atomic-transform-style-flat",
    "phase": "P5",
    "topic": "Motion & animation",
    "label": "Perspective atomic / transform-style flat",
    "properties": [
      "transform-style: flat",
      "single 3D child",
      "solid paint"
    ],
    "hint": "The parent establishes the minimum camera context while flat is tested without filters, masks, blending or animation.",
    "fixtureUrl": "/docs/html-compiler/fixtures/perspective/atomic-transform-style-flat.html",
    "composition": {
      "width": 1920,
      "height": 1080,
      "fps": 30,
      "background": "#081018",
      "colorSpace": "srgb"
    }
  },
  {
    "id": "html-compiler.perspective.atomic-transform-style-preserve-3d",
    "phase": "P5",
    "topic": "Motion & animation",
    "label": "Perspective atomic / transform-style preserve-3d",
    "properties": [
      "transform-style: preserve-3d",
      "single 3D child",
      "solid paint"
    ],
    "hint": "The same camera and child geometry as the flat fixture isolates the preserve-3d boundary contract.",
    "fixtureUrl": "/docs/html-compiler/fixtures/perspective/atomic-transform-style-preserve-3d.html",
    "composition": {
      "width": 1920,
      "height": 1080,
      "fps": 30,
      "background": "#081018",
      "colorSpace": "srgb"
    }
  },
  {
    "id": "html-compiler.perspective.atomic-backface-visible",
    "phase": "P5",
    "topic": "Motion & animation",
    "label": "Perspective atomic / backface visible",
    "properties": [
      "backface-visibility: visible",
      "rotateY(180deg)",
      "solid paint"
    ],
    "hint": "A reversed solid plane remains paintable when backface visibility is explicitly visible.",
    "fixtureUrl": "/docs/html-compiler/fixtures/perspective/atomic-backface-visible.html",
    "composition": {
      "width": 1920,
      "height": 1080,
      "fps": 30,
      "background": "#081018",
      "colorSpace": "srgb"
    }
  },
  {
    "id": "html-compiler.perspective.atomic-backface-hidden",
    "phase": "P5",
    "topic": "Motion & animation",
    "label": "Perspective atomic / backface hidden",
    "properties": [
      "backface-visibility: hidden",
      "rotateY(180deg)",
      "solid paint"
    ],
    "hint": "The same reversed plane becomes non-paintable only because its backface is explicitly hidden.",
    "fixtureUrl": "/docs/html-compiler/fixtures/perspective/atomic-backface-hidden.html",
    "composition": {
      "width": 1920,
      "height": 1080,
      "fps": 30,
      "background": "#081018",
      "colorSpace": "srgb"
    }
  },
  {
    "id": "html-compiler.perspective.matrix-functions",
    "phase": "P5",
    "topic": "Motion & animation",
    "label": "Transform / matrix and matrix3d",
    "properties": [
      "matrix()",
      "matrix3d()",
      "ordered transform atoms",
      "Matrix4"
    ],
    "hint": "CSS affine and projective matrix functions lower to the existing ordered V2 matrix atoms without a second transform path.",
    "fixtureUrl": "/docs/html-compiler/fixtures/perspective/matrix-functions.html",
    "composition": {
      "width": 1920,
      "height": 1080,
      "fps": 30,
      "background": "#081018",
      "colorSpace": "srgb"
    }
  }
];

export const HTML_COMPILER_PERSPECTIVE_PHASE6_CASES: HtmlCompilerPreviewCase[] = [
  {
    "id": "html-compiler.perspective.nested-distance",
    "phase": "P6",
    "topic": "Motion & animation",
    "label": "Perspective / nested distances",
    "properties": [
      "nested perspective",
      "distance",
      "Matrix4 chain"
    ],
    "hint": "Each nested group keeps its own perspective distance; Runtime composes both contexts instead of collapsing them into one camera.",
    "fixtureUrl": "/docs/html-compiler/fixtures/perspective/nested-distance.html",
    "composition": {
      "width": 1920,
      "height": 1080,
      "fps": 30,
      "background": "#081018",
      "colorSpace": "srgb"
    }
  },
  {
    "id": "html-compiler.perspective.nested-origins",
    "phase": "P6",
    "topic": "Motion & animation",
    "label": "Perspective / nested origins",
    "properties": [
      "perspective-origin",
      "nested origin",
      "rotateX",
      "rotateY"
    ],
    "hint": "Outer and inner perspective-origin values remain local to their own boxes, so convergence changes twice without changing layout frames.",
    "fixtureUrl": "/docs/html-compiler/fixtures/perspective/nested-origins.html",
    "composition": {
      "width": 1920,
      "height": 1080,
      "fps": 30,
      "background": "#081018",
      "colorSpace": "srgb"
    }
  },
  {
    "id": "html-compiler.perspective.nested-flat-boundary",
    "phase": "P6",
    "topic": "Motion & animation",
    "label": "Perspective / nested flat boundary",
    "properties": [
      "nested perspective",
      "transform-style: flat",
      "flatten boundary"
    ],
    "hint": "The inner group declares a flat boundary while its own perspective remains explicit for its direct child surface.",
    "fixtureUrl": "/docs/html-compiler/fixtures/perspective/nested-flat-boundary.html",
    "composition": {
      "width": 1920,
      "height": 1080,
      "fps": 30,
      "background": "#081018",
      "colorSpace": "srgb"
    }
  },
  {
    "id": "html-compiler.perspective.nested-preserve-depth",
    "phase": "P6",
    "topic": "Motion & animation",
    "label": "Perspective / nested preserve-3d depth",
    "properties": [
      "nested perspective",
      "preserve-3d",
      "sibling depth",
      "paint order"
    ],
    "hint": "Two descendants retain independent depth inside the nested preserve-3d context while their paint order remains deterministic.",
    "fixtureUrl": "/docs/html-compiler/fixtures/perspective/nested-preserve-depth.html",
    "composition": {
      "width": 1920,
      "height": 1080,
      "fps": 30,
      "background": "#081018",
      "colorSpace": "srgb"
    }
  },
  {
    "id": "html-compiler.perspective.nested-near-plane",
    "phase": "P6",
    "topic": "Motion & animation",
    "label": "Perspective / nested near-plane",
    "properties": [
      "nested perspective",
      "near-plane",
      "partial surface clip"
    ],
    "hint": "Only the inner perspective surface crosses its homogeneous camera plane; the outer surface remains visible and is not clipped as a whole.",
    "fixtureUrl": "/docs/html-compiler/fixtures/perspective/nested-near-plane.html",
    "composition": {
      "width": 1920,
      "height": 1080,
      "fps": 30,
      "background": "#081018",
      "colorSpace": "srgb"
    }
  },
  {
    "id": "html-compiler.perspective.nested-overflow-clip",
    "phase": "P6",
    "topic": "Motion & animation",
    "label": "Perspective / nested overflow clipping",
    "properties": [
      "nested perspective",
      "overflow: hidden",
      "composition clip"
    ],
    "hint": "The inner perspective result is clipped by its own overflow boundary and then by the composition edge without leaking outside either scope.",
    "fixtureUrl": "/docs/html-compiler/fixtures/perspective/nested-overflow-clip.html",
    "composition": {
      "width": 1920,
      "height": 1080,
      "fps": 30,
      "background": "#081018",
      "colorSpace": "srgb"
    }
  },
  {
    "id": "html-compiler.perspective.nested-backface",
    "phase": "P6",
    "topic": "Motion & animation",
    "label": "Perspective / nested backface",
    "properties": [
      "nested perspective",
      "backface-visibility",
      "rotateY(180deg)"
    ],
    "hint": "Backface visibility is evaluated after the accumulated nested Matrix4 transform, not at an isolated child transform.",
    "fixtureUrl": "/docs/html-compiler/fixtures/perspective/nested-backface.html",
    "composition": {
      "width": 1920,
      "height": 1080,
      "fps": 30,
      "background": "#081018",
      "colorSpace": "srgb"
    }
  },
  {
    "id": "html-compiler.perspective.nested-same-origin",
    "phase": "P6",
    "topic": "Motion & animation",
    "label": "Perspective / nested shared origin",
    "properties": [
      "nested perspective",
      "shared origin",
      "center convergence"
    ],
    "hint": "Matching percentage origins are resolved in each local box; equal percentages do not imply a shared absolute point.",
    "fixtureUrl": "/docs/html-compiler/fixtures/perspective/nested-same-origin.html",
    "composition": {
      "width": 1920,
      "height": 1080,
      "fps": 30,
      "background": "#081018",
      "colorSpace": "srgb"
    }
  },
  {
    "id": "html-compiler.perspective.nested-between-boundaries",
    "phase": "P6",
    "topic": "Motion & animation",
    "label": "Perspective / layer between boundaries",
    "properties": [
      "nested perspective",
      "intermediate layer",
      "stable ancestor order"
    ],
    "hint": "A direct child surface and a nested perspective subtree retain separate ancestor chains instead of inheriting the inner camera.",
    "fixtureUrl": "/docs/html-compiler/fixtures/perspective/nested-between-boundaries.html",
    "composition": {
      "width": 1920,
      "height": 1080,
      "fps": 30,
      "background": "#081018",
      "colorSpace": "srgb"
    }
  },
  {
    "id": "html-compiler.perspective.nested-clip-path",
    "phase": "P6",
    "topic": "Motion & animation",
    "label": "Perspective / nested clip-path",
    "properties": [
      "nested perspective",
      "clip-path",
      "overflow",
      "composition clip"
    ],
    "hint": "Geometric clip-path and nested overflow are intersected after the complete Matrix4 chain, before the composition edge clip.",
    "fixtureUrl": "/docs/html-compiler/fixtures/perspective/nested-clip-path.html",
    "composition": {
      "width": 1920,
      "height": 1080,
      "fps": 30,
      "background": "#081018",
      "colorSpace": "srgb"
    }
  },
  {
    "id": "html-compiler.perspective.parallax-three-depths",
    "phase": "P5",
    "topic": "Motion & animation",
    "label": "Perspective / slow stroke parallax camera shot",
    "properties": [
      "parallax video",
      "camera translateZ",
      "perspective",
      "slow depth zoom",
      "circle + triangle + rectangle stroke"
    ],
    "hint": "A slow looping camera shot travels through three flat stroke planes. The circle is nearest, the triangle is intermediate, and the rectangle is farthest, so their apparent scale changes at different rates.",
    "fixtureUrl": "/docs/html-compiler/fixtures/perspective/parallax-three-depths.html",
    "composition": {
      "width": 1920,
      "height": 1080,
      "fps": 30,
      "background": "#081018",
      "colorSpace": "srgb"
    }
  }
];

export const HTML_COMPILER_PERSPECTIVE_PHASE7_CASES: HtmlCompilerPreviewCase[] = [
  {
    "id": "html-compiler.perspective.animation-distance-linear",
    "phase": "P7",
    "topic": "Motion & animation",
    "label": "Perspective animation / distance linear",
    "properties": [
      "perspective",
      "@keyframes",
      "linear",
      "distance"
    ],
    "hint": "The group camera distance is a numeric render3d track; the child keeps translateZ while the perspective matrix is rebuilt per sample.",
    "fixtureUrl": "/docs/html-compiler/fixtures/perspective/animation-distance-linear.html",
    "composition": {
      "width": 1920,
      "height": 1080,
      "fps": 30,
      "background": "#081018",
      "colorSpace": "srgb"
    }
  },
  {
    "id": "html-compiler.perspective.animation-distance-cubic",
    "phase": "P7",
    "topic": "Motion & animation",
    "label": "Perspective animation / cubic-bezier",
    "properties": [
      "perspective",
      "cubic-bezier",
      "typed number track"
    ],
    "hint": "Cubic-bezier easing stays on the distance track segment and is evaluated by the shared Runtime V2 sampler.",
    "fixtureUrl": "/docs/html-compiler/fixtures/perspective/animation-distance-cubic.html",
    "composition": {
      "width": 1920,
      "height": 1080,
      "fps": 30,
      "background": "#081018",
      "colorSpace": "srgb"
    }
  },
  {
    "id": "html-compiler.perspective.animation-distance-steps",
    "phase": "P7",
    "topic": "Motion & animation",
    "label": "Perspective animation / steps distance",
    "properties": [
      "perspective",
      "steps(4, jump-start)",
      "discrete camera plateaus"
    ],
    "hint": "Steps easing creates deterministic discrete perspective distances without a separate CSS animation engine.",
    "fixtureUrl": "/docs/html-compiler/fixtures/perspective/animation-distance-steps.html",
    "composition": {
      "width": 1920,
      "height": 1080,
      "fps": 30,
      "background": "#081018",
      "colorSpace": "srgb"
    }
  },
  {
    "id": "html-compiler.perspective.animation-origin-corner",
    "phase": "P7",
    "topic": "Motion & animation",
    "label": "Perspective animation / center to corner",
    "properties": [
      "perspective-origin",
      "center",
      "right bottom",
      "vec2"
    ],
    "hint": "Perspective-origin animates as one typed vec2 track while X and Y resolve against the group's own frame.",
    "fixtureUrl": "/docs/html-compiler/fixtures/perspective/animation-origin-corner.html",
    "composition": {
      "width": 1920,
      "height": 1080,
      "fps": 30,
      "background": "#081018",
      "colorSpace": "srgb"
    }
  },
  {
    "id": "html-compiler.perspective.animation-origin-xy",
    "phase": "P7",
    "topic": "Motion & animation",
    "label": "Perspective animation / X + Y origin",
    "properties": [
      "perspective-origin",
      "percentage X",
      "percentage Y",
      "simultaneous interpolation"
    ],
    "hint": "Both origin coordinates interpolate independently, preserving local percentage resolution and the named object contract.",
    "fixtureUrl": "/docs/html-compiler/fixtures/perspective/animation-origin-xy.html",
    "composition": {
      "width": 1920,
      "height": 1080,
      "fps": 30,
      "background": "#081018",
      "colorSpace": "srgb"
    }
  },
  {
    "id": "html-compiler.perspective.animation-delay-backwards",
    "phase": "P7",
    "topic": "Motion & animation",
    "label": "Perspective animation / delay + backwards",
    "properties": [
      "perspective",
      "animation-delay",
      "backwards fill"
    ],
    "hint": "During the positive delay, backwards fill exposes the first camera distance through the shared playback metadata.",
    "fixtureUrl": "/docs/html-compiler/fixtures/perspective/animation-delay-backwards.html",
    "composition": {
      "width": 1920,
      "height": 1080,
      "fps": 30,
      "background": "#081018",
      "colorSpace": "srgb"
    }
  },
  {
    "id": "html-compiler.perspective.animation-alternate",
    "phase": "P7",
    "topic": "Motion & animation",
    "label": "Perspective animation / alternate iterations",
    "properties": [
      "perspective",
      "iteration-count",
      "alternate",
      "cycle boundary"
    ],
    "hint": "Alternate playback reverses the distance track on the second iteration while preserving the local perspective origin.",
    "fixtureUrl": "/docs/html-compiler/fixtures/perspective/animation-alternate.html",
    "composition": {
      "width": 1920,
      "height": 1080,
      "fps": 30,
      "background": "#081018",
      "colorSpace": "srgb"
    }
  },
  {
    "id": "html-compiler.perspective.animation-paused",
    "phase": "P7",
    "topic": "Motion & animation",
    "label": "Perspective animation / paused transport",
    "properties": [
      "perspective-origin",
      "animation-play-state",
      "paused",
      "transport"
    ],
    "hint": "The authored paused state remains playback metadata; the preview transport can still seek a deterministic sample.",
    "fixtureUrl": "/docs/html-compiler/fixtures/perspective/animation-paused.html",
    "composition": {
      "width": 1920,
      "height": 1080,
      "fps": 30,
      "background": "#081018",
      "colorSpace": "srgb"
    }
  },
  {
    "id": "html-compiler.perspective.animation-rotate",
    "phase": "P7",
    "topic": "Motion & animation",
    "label": "Perspective animation / distance + rotateY",
    "properties": [
      "perspective",
      "rotateY",
      "transform order",
      "combined tracks"
    ],
    "hint": "Camera distance and child rotateY remain independent typed tracks while the transform order is preserved.",
    "fixtureUrl": "/docs/html-compiler/fixtures/perspective/animation-rotate.html",
    "composition": {
      "width": 1920,
      "height": 1080,
      "fps": 30,
      "background": "#081018",
      "colorSpace": "srgb"
    }
  },
  {
    "id": "html-compiler.perspective.animation-nested-origin",
    "phase": "P7",
    "topic": "Motion & animation",
    "label": "Perspective animation / nested origin",
    "properties": [
      "nested perspective",
      "perspective-origin",
      "local track",
      "ancestor chain"
    ],
    "hint": "Only the inner camera origin animates; the outer perspective remains a separate ancestor context in the Matrix4 chain.",
    "fixtureUrl": "/docs/html-compiler/fixtures/perspective/animation-nested-origin.html",
    "composition": {
      "width": 1920,
      "height": 1080,
      "fps": 30,
      "background": "#081018",
      "colorSpace": "srgb"
    }
  },
  {
    "id": "html-compiler.perspective.animation-origin-outside",
    "phase": "P7",
    "topic": "Motion & animation",
    "label": "Perspective animation / origin outside box",
    "properties": [
      "perspective-origin",
      "negative length",
      "outside border-box",
      "no clamp"
    ],
    "hint": "Origin coordinates outside the border-box remain valid local camera coordinates and are not clamped during lowering.",
    "fixtureUrl": "/docs/html-compiler/fixtures/perspective/animation-origin-outside.html",
    "composition": {
      "width": 1920,
      "height": 1080,
      "fps": 30,
      "background": "#081018",
      "colorSpace": "srgb"
    }
  },
  {
    "id": "html-compiler.perspective.animation-sibling-tracks",
    "phase": "P7",
    "topic": "Motion & animation",
    "label": "Perspective animation / sibling camera tracks",
    "properties": [
      "two sibling groups",
      "perspective",
      "perspective-origin",
      "independent tracks"
    ],
    "hint": "Sibling perspective groups keep independent distance and origin tracks; no track is merged across layer scope.",
    "fixtureUrl": "/docs/html-compiler/fixtures/perspective/animation-sibling-tracks.html",
    "composition": {
      "width": 1920,
      "height": 1080,
      "fps": 30,
      "background": "#081018",
      "colorSpace": "srgb"
    }
  }
];

export const HTML_COMPILER_PERSPECTIVE_PHASE8_CASES: HtmlCompilerPreviewCase[] = [
  {
    "id": "html-compiler.texture.image-contain-rotate-y",
    "phase": "P8",
    "topic": "Motion & animation",
    "label": "Texture / image contain on rotateY",
    "properties": [
      "img",
      "object-fit: contain",
      "rotateY",
      "projective UV"
    ],
    "hint": "Contain resolves the source and destination rectangles before the image plane is projected by the accumulated Matrix4.",
    "fixtureUrl": "/docs/html-compiler/fixtures/texture/image-contain-rotate-y.html",
    "composition": {
      "width": 1920,
      "height": 1080,
      "fps": 30,
      "background": "#081018",
      "colorSpace": "srgb"
    }
  },
  {
    "id": "html-compiler.texture.image-cover-off-center",
    "phase": "P8",
    "topic": "Motion & animation",
    "label": "Texture / cover with off-center origin",
    "properties": [
      "img",
      "object-fit: cover",
      "object-position",
      "perspective-origin"
    ],
    "hint": "Cover cropping and object-position are resolved in image space; the cropped quad then follows the off-center perspective camera.",
    "fixtureUrl": "/docs/html-compiler/fixtures/texture/image-cover-off-center.html",
    "composition": {
      "width": 1920,
      "height": 1080,
      "fps": 30,
      "background": "#081018",
      "colorSpace": "srgb"
    }
  },
  {
    "id": "html-compiler.texture.image-alpha-tilt",
    "phase": "P8",
    "topic": "Motion & animation",
    "label": "Texture / alpha image on inclined plane",
    "properties": [
      "alpha PNG",
      "rotateX",
      "rotateY",
      "transparent texture"
    ],
    "hint": "Transparent pixels remain texture alpha on the projective surface instead of becoming a solid bounding rectangle.",
    "fixtureUrl": "/docs/html-compiler/fixtures/texture/image-alpha-tilt.html",
    "composition": {
      "width": 1920,
      "height": 1080,
      "fps": 30,
      "background": "#081018",
      "colorSpace": "srgb"
    }
  },
  {
    "id": "html-compiler.texture.video-projective-quad",
    "phase": "P8",
    "topic": "Motion & animation",
    "label": "Texture / video frame on projective quad",
    "properties": [
      "video",
      "frame source",
      "rotateY",
      "shared texture path"
    ],
    "hint": "Video uses the same projective textured-surface path as image; only the decoded frame source changes per playback timestamp.",
    "fixtureUrl": "/docs/html-compiler/fixtures/texture/video-projective-quad.html",
    "composition": {
      "width": 1920,
      "height": 1080,
      "fps": 30,
      "background": "#081018",
      "colorSpace": "srgb"
    }
  },
  {
    "id": "html-compiler.texture.media-object-position",
    "phase": "P8",
    "topic": "Motion & animation",
    "label": "Texture / image object-position",
    "properties": [
      "image",
      "object-position: left bottom",
      "UV crop",
      "projective plane"
    ],
    "hint": "Object-position changes UV crop selection without changing the projected layout frame.",
    "fixtureUrl": "/docs/html-compiler/fixtures/texture/media-object-position.html",
    "composition": {
      "width": 1920,
      "height": 1080,
      "fps": 30,
      "background": "#081018",
      "colorSpace": "srgb"
    }
  },
  {
    "id": "html-compiler.texture.image-composition-edge",
    "phase": "P8",
    "topic": "Motion & animation",
    "label": "Texture / composition edge clipping",
    "properties": [
      "image",
      "composition clip",
      "projective bounds",
      "edge"
    ],
    "hint": "The projected image is clipped at the composition edge after projective placement, without leaking pixels outside the frame.",
    "fixtureUrl": "/docs/html-compiler/fixtures/texture/image-composition-edge.html",
    "composition": {
      "width": 1920,
      "height": 1080,
      "fps": 30,
      "background": "#081018",
      "colorSpace": "srgb"
    }
  },
  {
    "id": "html-compiler.texture.image-clip-path",
    "phase": "P8",
    "topic": "Motion & animation",
    "label": "Texture / image with clip-path",
    "properties": [
      "image",
      "clip-path: polygon",
      "geometric clip",
      "projective UV"
    ],
    "hint": "A geometric clip remains a clip path intersected with the textured projective surface, not a sibling alpha image.",
    "fixtureUrl": "/docs/html-compiler/fixtures/texture/image-clip-path.html",
    "composition": {
      "width": 1920,
      "height": 1080,
      "fps": 30,
      "background": "#081018",
      "colorSpace": "srgb"
    }
  },
  {
    "id": "html-compiler.texture.video-opacity-blend",
    "phase": "P8",
    "topic": "Motion & animation",
    "label": "Texture / video opacity + blend",
    "properties": [
      "video",
      "opacity",
      "mix-blend-mode: screen",
      "offscreen"
    ],
    "hint": "Video texture is sampled first, then layer opacity and blend scope are applied to the rendered surface.",
    "fixtureUrl": "/docs/html-compiler/fixtures/texture/video-opacity-blend.html",
    "composition": {
      "width": 1920,
      "height": 1080,
      "fps": 30,
      "background": "#081018",
      "colorSpace": "srgb"
    }
  },
  {
    "id": "html-compiler.texture.image-animated-z",
    "phase": "P8",
    "topic": "Motion & animation",
    "label": "Texture / animated translateZ",
    "properties": [
      "image",
      "@keyframes",
      "translateZ",
      "typed texture track"
    ],
    "hint": "The texture stays attached to the image plane while translateZ changes over the shared Runtime V2 timeline.",
    "fixtureUrl": "/docs/html-compiler/fixtures/texture/image-animated-z.html",
    "composition": {
      "width": 1920,
      "height": 1080,
      "fps": 30,
      "background": "#081018",
      "colorSpace": "srgb"
    }
  },
  {
    "id": "html-compiler.texture.image-near-plane",
    "phase": "P8",
    "topic": "Motion & animation",
    "label": "Texture / near-plane partial clipping",
    "properties": [
      "image",
      "translateZ",
      "near-plane",
      "homogeneous clip"
    ],
    "hint": "Only the part of the image plane outside the near camera plane is removed before perspective division.",
    "fixtureUrl": "/docs/html-compiler/fixtures/texture/image-near-plane.html",
    "composition": {
      "width": 1920,
      "height": 1080,
      "fps": 30,
      "background": "#081018",
      "colorSpace": "srgb"
    }
  },
  {
    "id": "html-compiler.texture.nested-image-perspective",
    "phase": "P8",
    "topic": "Motion & animation",
    "label": "Texture / nested perspective",
    "properties": [
      "nested perspective",
      "image",
      "preserve-3d",
      "Matrix4 chain"
    ],
    "hint": "Nested cameras compose in order and the image receives the final projective transform as one textured surface.",
    "fixtureUrl": "/docs/html-compiler/fixtures/texture/nested-image-perspective.html",
    "composition": {
      "width": 1920,
      "height": 1080,
      "fps": 30,
      "background": "#081018",
      "colorSpace": "srgb"
    }
  },
  {
    "id": "html-compiler.texture.image-high-distortion",
    "phase": "P8",
    "topic": "Motion & animation",
    "label": "Texture / high projective distortion",
    "properties": [
      "image",
      "rotateX + rotateY",
      "subdivision",
      "seam check"
    ],
    "hint": "A strongly inclined plane exercises the projective texture path and its subdivision/seam contract.",
    "fixtureUrl": "/docs/html-compiler/fixtures/texture/image-high-distortion.html",
    "composition": {
      "width": 1920,
      "height": 1080,
      "fps": 30,
      "background": "#081018",
      "colorSpace": "srgb"
    }
  }
];

export const HTML_COMPILER_PERSPECTIVE_PHASE9_CASES: HtmlCompilerPreviewCase[] = [
  {
    "id": "html-compiler.perspective.mask-alpha-near-plane",
    "phase": "P9",
    "classification": "combined",
    "classificationLabel": "Combined pipeline",
    "topic": "Motion & animation",
    "label": "Mask/filter / alpha mask near-plane",
    "properties": [
      "mask-image",
      "alpha",
      "near-plane",
      "homogeneous clip"
    ],
    "hint": "The alpha mask follows the projective surface and remains partially visible across the near camera plane.",
    "fixtureUrl": "/docs/html-compiler/fixtures/perspective/mask-alpha-near-plane.html",
    "composition": {
      "width": 1920,
      "height": 1080,
      "fps": 30,
      "background": "#081018",
      "colorSpace": "srgb"
    }
  },
  {
    "id": "html-compiler.perspective.mask-luminance-near-plane",
    "phase": "P9",
    "classification": "combined",
    "classificationLabel": "Combined pipeline",
    "topic": "Motion & animation",
    "label": "Mask/filter / luminance mask near-plane",
    "properties": [
      "mask-image",
      "luminance",
      "asset URL",
      "near-plane"
    ],
    "hint": "Luminance coverage is sampled from the projective image mask and converted to deterministic alpha.",
    "fixtureUrl": "/docs/html-compiler/fixtures/perspective/mask-luminance-near-plane.html",
    "composition": {
      "width": 1920,
      "height": 1080,
      "fps": 30,
      "background": "#081018",
      "colorSpace": "srgb"
    }
  },
  {
    "id": "html-compiler.perspective.mask-add-intersect-near-plane",
    "phase": "P9",
    "classification": "combined",
    "classificationLabel": "Combined pipeline",
    "topic": "Motion & animation",
    "label": "Mask/filter / add then intersect",
    "properties": [
      "two mask layers",
      "add",
      "intersect",
      "near-plane"
    ],
    "hint": "Mask sources remain ordered: the first establishes coverage and the second intersects it on the projective plane.",
    "fixtureUrl": "/docs/html-compiler/fixtures/perspective/mask-add-intersect-near-plane.html",
    "composition": {
      "width": 1920,
      "height": 1080,
      "fps": 30,
      "background": "#081018",
      "colorSpace": "srgb"
    }
  },
  {
    "id": "html-compiler.perspective.mask-subtract-composition-edge",
    "phase": "P9",
    "classification": "combined",
    "classificationLabel": "Combined pipeline",
    "topic": "Motion & animation",
    "label": "Mask/filter / subtract at composition edge",
    "properties": [
      "mask-composite",
      "subtract",
      "composition clip",
      "private surface"
    ],
    "hint": "Subtract is evaluated on the private mask surface before the layer is clipped at the composition boundary.",
    "fixtureUrl": "/docs/html-compiler/fixtures/perspective/mask-subtract-composition-edge.html",
    "composition": {
      "width": 1920,
      "height": 1080,
      "fps": 30,
      "background": "#081018",
      "colorSpace": "srgb"
    }
  },
  {
    "id": "html-compiler.perspective.mask-exclude-inclined",
    "phase": "P9",
    "classification": "combined",
    "classificationLabel": "Combined pipeline",
    "topic": "Motion & animation",
    "label": "Mask/filter / exclude on inclined surface",
    "properties": [
      "mask-composite",
      "exclude",
      "rotateX",
      "rotateY"
    ],
    "hint": "Exclude preserves the symmetric difference of two coverage sources while the visible surface is inclined.",
    "fixtureUrl": "/docs/html-compiler/fixtures/perspective/mask-exclude-inclined.html",
    "composition": {
      "width": 1920,
      "height": 1080,
      "fps": 30,
      "background": "#081018",
      "colorSpace": "srgb"
    }
  },
  {
    "id": "html-compiler.perspective.filter-blur-near-plane",
    "phase": "P9",
    "classification": "combined",
    "classificationLabel": "Combined pipeline",
    "topic": "Motion & animation",
    "label": "Mask/filter / blur source near-plane",
    "properties": [
      "filter",
      "blur",
      "near-plane",
      "offscreen surface"
    ],
    "hint": "Blur is applied to the projectively clipped source surface and cannot leak outside the composition edge.",
    "fixtureUrl": "/docs/html-compiler/fixtures/perspective/filter-blur-near-plane.html",
    "composition": {
      "width": 1920,
      "height": 1080,
      "fps": 30,
      "background": "#081018",
      "colorSpace": "srgb"
    }
  },
  {
    "id": "html-compiler.perspective.filter-drop-shadow-after-blur-near-plane",
    "phase": "P9",
    "classification": "combined",
    "classificationLabel": "Combined pipeline",
    "topic": "Motion & animation",
    "label": "Mask/filter / drop-shadow after blur",
    "properties": [
      "blur",
      "drop-shadow",
      "ordered effects",
      "near-plane"
    ],
    "hint": "The drop-shadow samples the preceding blurred source, preserving CSS filter order.",
    "fixtureUrl": "/docs/html-compiler/fixtures/perspective/filter-drop-shadow-after-blur-near-plane.html",
    "composition": {
      "width": 1920,
      "height": 1080,
      "fps": 30,
      "background": "#081018",
      "colorSpace": "srgb"
    }
  },
  {
    "id": "html-compiler.perspective.filter-mask-clip-path",
    "phase": "P9",
    "classification": "combined",
    "classificationLabel": "Combined pipeline",
    "topic": "Motion & animation",
    "label": "Mask/filter / mask + clip-path",
    "properties": [
      "mask-image",
      "clip-path",
      "filter",
      "intersected coverage"
    ],
    "hint": "Geometric clip coverage is intersected with the mask before the filtered projective surface is composited.",
    "fixtureUrl": "/docs/html-compiler/fixtures/perspective/filter-mask-clip-path.html",
    "composition": {
      "width": 1920,
      "height": 1080,
      "fps": 30,
      "background": "#081018",
      "colorSpace": "srgb"
    }
  },
  {
    "id": "html-compiler.perspective.isolated-mask-filter-projective",
    "phase": "P9",
    "classification": "combined",
    "classificationLabel": "Combined pipeline",
    "topic": "Motion & animation",
    "label": "Mask/filter / isolated projective group",
    "properties": [
      "isolation",
      "mask",
      "filter",
      "projective group"
    ],
    "hint": "The isolated group owns its mask and filter offscreen surface; its child blend remains inside that boundary.",
    "fixtureUrl": "/docs/html-compiler/fixtures/perspective/isolated-mask-filter-projective.html",
    "composition": {
      "width": 1920,
      "height": 1080,
      "fps": 30,
      "background": "#081018",
      "colorSpace": "srgb"
    }
  },
  {
    "id": "html-compiler.perspective.mask-different-perspective-boundary",
    "phase": "P9",
    "classification": "combined",
    "classificationLabel": "Combined pipeline",
    "topic": "Motion & animation",
    "label": "Mask/filter / nested mask camera",
    "properties": [
      "nested perspective",
      "mask source",
      "different boundary",
      "Matrix4 chain"
    ],
    "hint": "The mask source is resolved in the element box while the visible child inherits a different nested perspective context.",
    "fixtureUrl": "/docs/html-compiler/fixtures/perspective/mask-different-perspective-boundary.html",
    "composition": {
      "width": 1920,
      "height": 1080,
      "fps": 30,
      "background": "#081018",
      "colorSpace": "srgb"
    }
  },
  {
    "id": "html-compiler.perspective.filter-far-plane-bounds",
    "phase": "P9",
    "classification": "combined",
    "classificationLabel": "Combined pipeline",
    "topic": "Motion & animation",
    "label": "Mask/filter / filter bounds at far-plane",
    "properties": [
      "filter",
      "far-plane",
      "expanded bounds",
      "composition clip"
    ],
    "hint": "The filtered surface keeps expanded offscreen bounds while far-plane and composition clipping remain deterministic.",
    "fixtureUrl": "/docs/html-compiler/fixtures/perspective/filter-far-plane-bounds.html",
    "composition": {
      "width": 1920,
      "height": 1080,
      "fps": 30,
      "background": "#081018",
      "colorSpace": "srgb"
    }
  },
  {
    "id": "html-compiler.perspective.mask-one-corner-near-plane",
    "phase": "P9",
    "classification": "combined",
    "classificationLabel": "Combined pipeline",
    "topic": "Motion & animation",
    "label": "Mask/filter / one-corner near-plane cut",
    "properties": [
      "mask-image",
      "one corner",
      "rotateX + rotateY",
      "partial source clip"
    ],
    "hint": "Only one corner of the mask source crosses the near plane; remaining coverage is retained without alpha inversion.",
    "fixtureUrl": "/docs/html-compiler/fixtures/perspective/mask-one-corner-near-plane.html",
    "composition": {
      "width": 1920,
      "height": 1080,
      "fps": 30,
      "background": "#081018",
      "colorSpace": "srgb"
    }
  },
  {
    "id": "html-compiler.perspective.backdrop-filter-blur",
    "phase": "P9",
    "classification": "combined",
    "classificationLabel": "Combined pipeline",
    "topic": "Motion & animation",
    "label": "Backdrop / blur over colored layers",
    "properties": [
      "backdrop-filter",
      "blur",
      "backdrop surface",
      "layer opacity"
    ],
    "hint": "The backdrop is captured before the translucent card is painted; blur affects the colored backdrop only and remains separate from the card's own filter.",
    "fixtureUrl": "/docs/html-compiler/fixtures/perspective/backdrop-filter-blur.html",
    "composition": {
      "width": 1920,
      "height": 1080,
      "fps": 30,
      "background": "#081018",
      "colorSpace": "srgb"
    }
  },
  {
    "id": "html-compiler.perspective.backdrop-filter-order",
    "phase": "P9",
    "classification": "combined",
    "classificationLabel": "Combined pipeline",
    "topic": "Motion & animation",
    "label": "Backdrop / ordered blur and contrast",
    "properties": [
      "backdrop-filter",
      "blur",
      "contrast",
      "ordered effects"
    ],
    "hint": "Backdrop effects retain CSS token order and never become a visible sibling or a source filter on the translucent panel.",
    "fixtureUrl": "/docs/html-compiler/fixtures/perspective/backdrop-filter-order.html",
    "composition": {
      "width": 1920,
      "height": 1080,
      "fps": 30,
      "background": "#081018",
      "colorSpace": "srgb"
    }
  }
];

export const HTML_COMPILER_DEFAULT_CASE_ID = HTML_COMPILER_PHASE0_CASES[0].id;

const HTML_COMPILER_ALL_CASES: HtmlCompilerPreviewCase[] = [
  ...HTML_COMPILER_PHASE0_CASES,
  ...HTML_COMPILER_TAG_LOWERING_CASES,
  ...HTML_COMPILER_TEXT_COMPILER_LAYOUT_CASES,
  ...HTML_COMPILER_FONT_CATALOG_CASES,
  ...HTML_COMPILER_TEXT_GRADIENT_DEBUG_CASES,
  ...HTML_COMPILER_ANCHOR_CASES,
  ...HTML_COMPILER_PHASE1_1_CASES,
  ...HTML_COMPILER_PHASE1_2_CASES,
  ...HTML_COMPILER_PHASE1_3_CASES,
  ...HTML_COMPILER_PHASE1_4_CASES,
  ...HTML_COMPILER_LAYOUT_TEXT_CASES,
  ...HTML_COMPILER_PAINT_PHASE2_0_CASES,
  ...HTML_COMPILER_PAINT_PHASE2_9_CASES,
  ...HTML_COMPILER_OPACITY_CASES,
  ...HTML_COMPILER_PAINT_GRADIENT_CASES,
  ...HTML_COMPILER_PAINT_PHASE2_1_CASES,
  ...HTML_COMPILER_PAINT_PHASE2_2_CASES,
  ...HTML_COMPILER_PAINT_PHASE2_3_CASES,
  ...HTML_COMPILER_PAINT_PHASE2_4_CASES,
  ...HTML_COMPILER_PAINT_PHASE2_5_CASES,
  ...HTML_COMPILER_PAINT_PHASE2_6_CASES,
  ...HTML_COMPILER_PAINT_PHASE2_7_CASES,
  ...HTML_COMPILER_PAINT_PHASE2_8_CASES,
  ...HTML_COMPILER_MOTION_PHASE3_CASES,
  ...HTML_COMPILER_PERSPECTIVE_PHASE5_CASES,
  ...HTML_COMPILER_PERSPECTIVE_PHASE6_CASES,
  ...HTML_COMPILER_PERSPECTIVE_PHASE7_CASES,
  ...HTML_COMPILER_PERSPECTIVE_PHASE8_CASES,
  ...HTML_COMPILER_PERSPECTIVE_PHASE9_CASES,
];

const HTML_COMPILER_PREVIEW_CATEGORY_ORDER: HtmlCompilerPreviewCategory[] = [
  "HTML tag lowering",
  "Text compiler & layout",
  "Layout primitives",
  "Paint primitives",
  "Effect primitives",
  "Transform & 3D primitives",
  "Typography & media primitives",
  "Animation & keyframe primitives",
  "Combined pipeline cases",
];

export type CategorizedHtmlCompilerPreviewCase = HtmlCompilerPreviewCase & {
  category: HtmlCompilerPreviewCategory;
};

function categoryForCase(item: HtmlCompilerPreviewCase): HtmlCompilerPreviewCategory {
  if (item.category !== undefined) return item.category;
  if (item.classification === "combined") return "Combined pipeline cases";
  if (item.phase === "P0") {
    if (item.topic === "Paint") return "Paint primitives";
    if (item.topic === "Transform 2D") return "Transform & 3D primitives";
    if (item.topic === "Typography" || item.topic === "Media") return "Typography & media primitives";
    return "Layout primitives";
  }
  if (item.topic === "Layout") return "Layout primitives";
  if (["P2.4", "P2.5", "P2.6", "P2.7", "P2.8"].includes(item.phase)) {
    return item.id.includes("mask-clip-path-isolation") ? "Combined pipeline cases" : "Effect primitives";
  }
  if (["P2.0", "P2.1", "P2.2", "P2.3"].includes(item.phase)) return "Paint primitives";
  if (item.phase === "P3" || item.phase === "P7" || item.id.includes("animated-translate-z")) return "Animation & keyframe primitives";
  if (item.phase === "P5" && !item.id.includes("slow-stroke")) return "Transform & 3D primitives";
  return "Combined pipeline cases";
}

function categorizedCase(item: HtmlCompilerPreviewCase): CategorizedHtmlCompilerPreviewCase {
  const category = categoryForCase(item);
  const classification = item.classification ?? (category === "Combined pipeline cases" ? "combined" : "primitive");
  return {
    ...item,
    category,
    classification,
    classificationLabel: item.classificationLabel ?? (classification === "combined" ? "Combined pipeline" : "Primitive"),
  };
}

export const HTML_COMPILER_PREVIEW_CASES: CategorizedHtmlCompilerPreviewCase[] = HTML_COMPILER_ALL_CASES.map(categorizedCase);

export function htmlCompilerPreviewGroups(): Array<{ category: HtmlCompilerPreviewCategory; cases: CategorizedHtmlCompilerPreviewCase[] }> {
  const groups = new Map<HtmlCompilerPreviewCategory, CategorizedHtmlCompilerPreviewCase[]>();
  for (const item of HTML_COMPILER_PREVIEW_CASES) {
    const cases = groups.get(item.category) ?? [];
    cases.push(item);
    groups.set(item.category, cases);
  }
  return HTML_COMPILER_PREVIEW_CATEGORY_ORDER
    .filter((category) => groups.has(category))
    .map((category) => ({ category, cases: groups.get(category)! }));
}

export function htmlCompilerPreviewCaseById(id: string | null | undefined): CategorizedHtmlCompilerPreviewCase {
  return HTML_COMPILER_PREVIEW_CASES.find((item) => item.id === id) ?? categorizedCase(HTML_COMPILER_PHASE0_CASES[0]);
}

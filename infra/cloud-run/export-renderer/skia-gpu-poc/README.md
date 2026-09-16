# Native Skia Vulkan POC image

This image compiles the pinned Skia revision with Ganesh/Vulkan and packages
`neonix-skia-gpu-backend`. Cloud Build is the expected build environment; the
local Windows Docker daemon is not required.

The executable accepts:

```text
--width 1280 --height 720 --frames 1 --output /tmp/frame.ppm
```

It emits one JSON metrics line and exits non-zero if Vulkan, the Skia context,
the GPU surface, or readback cannot be created. A successful line must contain
`actualBackend=skia-ganesh-vulkan`, `surfaceKind=vulkan`, and
`softwareRenderer=false`.

This is P2.1 only. It proves the native GPU host and readback path. It does
not claim full Neonix command parity until the versioned
`PaintCommandBuffer` replay protocol is implemented and compared against the
CPU/browser goldens.

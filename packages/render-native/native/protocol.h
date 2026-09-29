#pragma once

// The `NXSKIA02` wire protocol: every struct TypeScript's
// `packages/render-native/src/render/native-protocol.ts` encodes into, the
// `Reader` that decodes it byte-for-byte, and the small shared math
// (matrix/color) helpers used on both the paint and effect side of the
// backend. This is a positional binary protocol, not a self-describing one —
// every `read_*` function here must match its TS `write*` counterpart
// exactly, and every wire struct here must match the value it decodes into.

#include "include/core/SkColor.h"
#include "include/core/SkMatrix.h"
#include "include/core/SkPath.h"

#include <cstdint>
#include <istream>
#include <string>
#include <vector>

namespace neonix {

struct Matrix4 {
    double value[16]{};
};

struct Color {
    double red = 0;
    double green = 0;
    double blue = 0;
    double alpha = 1;
};

// Native text paint subset. Type 0 means the command's solid color is used;
// 1/2/3 are linear/radial/sweep gradients respectively.
struct PaintSpec {
    uint8_t type = 0;
    double values[14]{};
    uint8_t spread = 0;
    uint8_t units = 0;
    bool hasTransform = false;
    double transform[6]{};
    std::vector<Color> colors;
    std::vector<double> offsets;
    std::vector<double> stopOpacity;
};

// --- beginLayer.effectProgram / backdropEffectProgram wire structs ---
//
// Wire opcode for `EffectOp::kind` (1..11). Must match `effectOpCode` in
// native-protocol.ts exactly (positional protocol).
struct EffectOp {
    uint8_t kind = 0;
    std::string output;
    std::string input;
    std::string source;    // inner-alpha
    std::string blurred;   // inner-alpha
    std::string backdrop;  // composite
    double brightness = 0, contrast = 0, saturation = 0, hueRotate = 0;  // color-adjust
    std::vector<double> matrix;  // color-matrix (20 values)
    double amount = 0;           // alpha
    double radius = 0;           // blur, morphology
    uint8_t alphaMaskSource = 0;    // 0=unspecified, 1=alpha, 2=box
    uint8_t morphologyOperator = 0; // 0=erode, 1=dilate
    Color tintColor;
    double tintOpacity = 0;
    double offsetX = 0, offsetY = 0;
    double noiseScale = 0, noiseAmount = 0, noiseOpacity = 0;
    uint32_t noiseSeed = 0;
};

struct EffectProgram {
    std::vector<EffectOp> ops;
    std::string output;
};

/** Runtime-only geometry source for box effects (CSS box-shadow's silhouette
 * comes from the element's box geometry, not its rendered alpha). Mirrors
 * PaintCommand's `beginLayer.effectBox`. */
struct EffectBoxSpec {
    bool present = false;
    double width = 0;
    double height = 0;
    bool hasCornerRadius = false;
    double cornerRadius = 0;
    Matrix4 matrix{};
};

class Reader {
public:
    explicit Reader(std::istream& input) : input_(input) {}

    bool bytes(void* destination, size_t size) {
        input_.read(static_cast<char*>(destination), static_cast<std::streamsize>(size));
        return input_.gcount() == static_cast<std::streamsize>(size);
    }

    template <typename T>
    bool value(T& destination) {
        return bytes(&destination, sizeof(T));
    }

private:
    std::istream& input_;
};

Matrix4 identity_matrix();

/** Composes projection/world/canvas-clip matrices into one SkMatrix; shared
 * by main()'s per-command transform and effects.cpp's box-shadow overlay
 * placement. */
SkMatrix to_canvas_matrix(const Matrix4& projection, const Matrix4& world, int width, int height);

SkColor4f color_with_alpha(const Color& color, double multiplier);

bool read_matrix(Reader& reader, Matrix4& matrix);
bool read_color(Reader& reader, Color& color);
bool read_paint(Reader& reader, PaintSpec& paint);
bool read_string(Reader& reader, std::string& value);
bool read_path(Reader& reader, SkPath& path);
bool read_effect_op(Reader& reader, EffectOp& op);
/** `hasProgram` mirrors PaintCommand's optional `effectProgram`/`backdropEffectProgram`. */
bool read_effect_program(Reader& reader, bool& hasProgram, EffectProgram& program);
bool read_effect_box(Reader& reader, EffectBoxSpec& box);

}  // namespace neonix

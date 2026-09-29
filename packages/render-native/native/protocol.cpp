#include "neonix/protocol.h"

#include "include/core/SkPathBuilder.h"

#include <algorithm>
#include <cstring>

namespace neonix {

namespace {

Matrix4 multiply(const Matrix4& left, const Matrix4& right) {
    Matrix4 result{};
    for (int column = 0; column < 4; ++column) {
        for (int row = 0; row < 4; ++row) {
            double sum = 0;
            for (int index = 0; index < 4; ++index) {
                sum += left.value[index * 4 + row] * right.value[column * 4 + index];
            }
            result.value[column * 4 + row] = sum;
        }
    }
    return result;
}

}  // namespace

Matrix4 identity_matrix() {
    Matrix4 result{};
    result.value[0] = 1;
    result.value[5] = 1;
    result.value[10] = 1;
    result.value[15] = 1;
    return result;
}

SkMatrix to_canvas_matrix(const Matrix4& projection, const Matrix4& world, int width, int height) {
    Matrix4 clip = identity_matrix();
    clip.value[0] = static_cast<double>(width) / 2.0;
    clip.value[5] = -static_cast<double>(height) / 2.0;
    clip.value[12] = static_cast<double>(width) / 2.0;
    clip.value[13] = static_cast<double>(height) / 2.0;
    const Matrix4 projected = multiply(projection, world);
    const Matrix4 canvas = multiply(clip, projected);
    SkMatrix result;
    result.setAll(
        static_cast<SkScalar>(canvas.value[0]),
        static_cast<SkScalar>(canvas.value[4]),
        static_cast<SkScalar>(canvas.value[12]),
        static_cast<SkScalar>(canvas.value[1]),
        static_cast<SkScalar>(canvas.value[5]),
        static_cast<SkScalar>(canvas.value[13]),
        static_cast<SkScalar>(canvas.value[3]),
        static_cast<SkScalar>(canvas.value[7]),
        static_cast<SkScalar>(canvas.value[15]));
    return result;
}

SkColor4f color_with_alpha(const Color& color, double multiplier) {
    const auto clamp = [](double value) { return std::max(0.0, std::min(1.0, value)); };
    return {
        static_cast<float>(clamp(color.red)),
        static_cast<float>(clamp(color.green)),
        static_cast<float>(clamp(color.blue)),
        static_cast<float>(clamp(color.alpha * multiplier)),
    };
}

bool read_matrix(Reader& reader, Matrix4& matrix) {
    return reader.bytes(matrix.value, sizeof(matrix.value));
}

bool read_color(Reader& reader, Color& color) {
    return reader.value(color.red) && reader.value(color.green) &&
           reader.value(color.blue) && reader.value(color.alpha);
}

bool read_paint(Reader& reader, PaintSpec& paint) {
    uint8_t type = 0;
    if (!reader.value(type)) return false;
    paint = PaintSpec{};
    paint.type = type;
    if (type == 0) return true;
    if (type > 3) return false;
    for (double& value : paint.values) if (!reader.value(value)) return false;
    if (!reader.value(paint.spread) || !reader.value(paint.units) || !reader.value(paint.hasTransform)) return false;
    if (paint.hasTransform) for (double& value : paint.transform) if (!reader.value(value)) return false;
    uint32_t stopCount = 0;
    if (!reader.value(stopCount) || stopCount > 64) return false;
    paint.colors.resize(stopCount);
    paint.offsets.resize(stopCount);
    paint.stopOpacity.resize(stopCount);
    for (uint32_t index = 0; index < stopCount; ++index) {
        if (!reader.value(paint.offsets[index]) || !read_color(reader, paint.colors[index]) || !reader.value(paint.stopOpacity[index])) return false;
    }
    return true;
}

bool read_string(Reader& reader, std::string& value) {
    uint32_t length = 0;
    if (!reader.value(length) || length > 16U * 1024U * 1024U) return false;
    value.resize(length);
    return length == 0 || reader.bytes(value.data(), length);
}

bool read_path(Reader& reader, SkPath& path) {
    SkPathBuilder builder;
    uint32_t contourCount = 0;
    if (!reader.value(contourCount) || contourCount > 100000) return false;
    for (uint32_t contourIndex = 0; contourIndex < contourCount; ++contourIndex) {
        double startX = 0;
        double startY = 0;
        uint32_t segmentCount = 0;
        uint8_t closed = 0;
        if (!reader.value(startX) || !reader.value(startY) || !reader.value(segmentCount) ||
            segmentCount > 100000 || !reader.value(closed)) return false;
        builder.moveTo(static_cast<SkScalar>(startX), static_cast<SkScalar>(startY));
        for (uint32_t segmentIndex = 0; segmentIndex < segmentCount; ++segmentIndex) {
            uint8_t kind = 0;
            if (!reader.value(kind)) return false;
            if (kind == 1) {
                double x = 0, y = 0;
                if (!reader.value(x) || !reader.value(y)) return false;
                builder.lineTo(static_cast<SkScalar>(x), static_cast<SkScalar>(y));
            } else if (kind == 2) {
                double controlX = 0, controlY = 0, x = 0, y = 0;
                if (!reader.value(controlX) || !reader.value(controlY) || !reader.value(x) || !reader.value(y)) return false;
                builder.quadTo(static_cast<SkScalar>(controlX), static_cast<SkScalar>(controlY),
                               static_cast<SkScalar>(x), static_cast<SkScalar>(y));
            } else if (kind == 3) {
                double control1X = 0, control1Y = 0, control2X = 0, control2Y = 0, x = 0, y = 0;
                if (!reader.value(control1X) || !reader.value(control1Y) || !reader.value(control2X) ||
                    !reader.value(control2Y) || !reader.value(x) || !reader.value(y)) return false;
                builder.cubicTo(static_cast<SkScalar>(control1X), static_cast<SkScalar>(control1Y),
                                static_cast<SkScalar>(control2X), static_cast<SkScalar>(control2Y),
                                static_cast<SkScalar>(x), static_cast<SkScalar>(y));
            } else if (kind == 4) {
                double radiusX = 0, radiusY = 0, rotation = 0, x = 0, y = 0;
                uint8_t largeArc = 0, sweep = 0;
                if (!reader.value(radiusX) || !reader.value(radiusY) || !reader.value(rotation) ||
                    !reader.value(largeArc) || !reader.value(sweep) || !reader.value(x) || !reader.value(y)) return false;
                builder.arcTo({static_cast<SkScalar>(radiusX), static_cast<SkScalar>(radiusY)},
                              static_cast<SkScalar>(rotation),
                              largeArc ? SkPathBuilder::kLarge_ArcSize : SkPathBuilder::kSmall_ArcSize,
                              sweep ? SkPathDirection::kCW : SkPathDirection::kCCW,
                              {static_cast<SkScalar>(x), static_cast<SkScalar>(y)});
            } else {
                return false;
            }
        }
        if (closed) builder.close();
    }
    path = builder.detach();
    return true;
}

bool read_effect_op(Reader& reader, EffectOp& op) {
    if (!reader.value(op.kind) || !read_string(reader, op.output)) return false;
    switch (op.kind) {
        case 1:  // color-adjust
            return read_string(reader, op.input) && reader.value(op.brightness) && reader.value(op.contrast)
                && reader.value(op.saturation) && reader.value(op.hueRotate);
        case 2:  // color-matrix
            if (!read_string(reader, op.input)) return false;
            op.matrix.resize(20);
            for (double& value : op.matrix) if (!reader.value(value)) return false;
            return true;
        case 3:  // alpha
            return read_string(reader, op.input) && reader.value(op.amount);
        case 4:  // blur
            return read_string(reader, op.input) && reader.value(op.radius);
        case 5:  // alpha-mask
            return read_string(reader, op.input) && reader.value(op.alphaMaskSource);
        case 6:  // morphology
            return read_string(reader, op.input) && reader.value(op.morphologyOperator) && reader.value(op.radius);
        case 7:  // inner-alpha
            return read_string(reader, op.source) && read_string(reader, op.blurred);
        case 8:  // tint
            return read_string(reader, op.input) && read_color(reader, op.tintColor) && reader.value(op.tintOpacity);
        case 9:  // offset
            return read_string(reader, op.input) && reader.value(op.offsetX) && reader.value(op.offsetY);
        case 10:  // noise
            return read_string(reader, op.input) && reader.value(op.noiseScale) && reader.value(op.noiseAmount)
                && reader.value(op.noiseOpacity) && reader.value(op.noiseSeed);
        case 11:  // composite
            return read_string(reader, op.backdrop) && read_string(reader, op.source);
        default:
            return false;
    }
}

bool read_effect_program(Reader& reader, bool& hasProgram, EffectProgram& program) {
    uint8_t has = 0;
    if (!reader.value(has)) return false;
    hasProgram = has != 0;
    if (!hasProgram) return true;
    uint32_t count = 0;
    if (!reader.value(count) || count > 256) return false;
    program.ops.resize(count);
    for (EffectOp& op : program.ops) if (!read_effect_op(reader, op)) return false;
    return read_string(reader, program.output);
}

bool read_effect_box(Reader& reader, EffectBoxSpec& box) {
    uint8_t has = 0;
    if (!reader.value(has)) return false;
    box.present = has != 0;
    if (!box.present) return true;
    uint8_t hasRadius = 0;
    if (!reader.value(box.width) || !reader.value(box.height) || !reader.value(hasRadius)) return false;
    box.hasCornerRadius = hasRadius != 0;
    if (box.hasCornerRadius && !reader.value(box.cornerRadius)) return false;
    return read_matrix(reader, box.matrix);
}

}  // namespace neonix

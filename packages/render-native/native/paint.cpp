#include "neonix/paint.h"

#include "include/core/SkRect.h"
#include "include/effects/SkGradient.h"

#include <algorithm>
#include <cmath>
#include <utility>

namespace neonix {

namespace {

// Forward declaration: shared by draw_shape/draw_path (below) and text glyph
// painting (apply_text_paint, further down); the full definition lives near
// its other gradient helpers (paint_tile_mode/paint_value).
sk_sp<SkShader> make_gradient_shader(const PaintSpec& paint, double width, double height);

}  // namespace

bool draw_shape(SkCanvas* canvas, uint8_t shape, double width, double height,
                double corner_radius, const Color& fill, bool has_fill, const PaintSpec& fill_paint,
                double fill_opacity, const Color& stroke, bool has_stroke, const PaintSpec& stroke_paint,
                double stroke_width, double stroke_opacity, double transform_alpha,
                bool anti_alias) {
    if (has_fill) {
        SkPaint paint;
        paint.setAntiAlias(anti_alias);
        paint.setStyle(SkPaint::kFill_Style);
        paint.setColor4f(color_with_alpha(fill, transform_alpha * fill_opacity));
        if (auto shader = make_gradient_shader(fill_paint, width, height)) paint.setShader(std::move(shader));
        if (shape == 1) {
            const SkRect rect = SkRect::MakeWH(static_cast<SkScalar>(width), static_cast<SkScalar>(height));
            if (corner_radius > 0) {
                canvas->drawRoundRect(rect, static_cast<SkScalar>(corner_radius), static_cast<SkScalar>(corner_radius), paint);
            } else {
                canvas->drawRect(rect, paint);
            }
        } else if (shape == 2) {
            canvas->drawOval(SkRect::MakeWH(static_cast<SkScalar>(width), static_cast<SkScalar>(height)), paint);
        } else {
            return false;
        }
    }
    if (has_stroke) {
        SkPaint paint;
        paint.setAntiAlias(true);
        paint.setStyle(SkPaint::kStroke_Style);
        paint.setStrokeWidth(static_cast<SkScalar>(stroke_width));
        paint.setColor4f(color_with_alpha(stroke, transform_alpha * stroke_opacity));
        if (auto shader = make_gradient_shader(stroke_paint, width, height)) paint.setShader(std::move(shader));
        if (shape == 1) {
            if (corner_radius > 0) {
                canvas->drawRoundRect(
                    SkRect::MakeWH(static_cast<SkScalar>(width), static_cast<SkScalar>(height)),
                    static_cast<SkScalar>(corner_radius), static_cast<SkScalar>(corner_radius), paint);
            } else {
                canvas->drawRect(SkRect::MakeWH(static_cast<SkScalar>(width), static_cast<SkScalar>(height)), paint);
            }
        } else if (shape == 2) {
            canvas->drawOval(SkRect::MakeWH(static_cast<SkScalar>(width), static_cast<SkScalar>(height)), paint);
        } else {
            return false;
        }
    }
    return true;
}

namespace {

SkTileMode paint_tile_mode(uint8_t spread) {
    if (spread == 1) return SkTileMode::kMirror;
    if (spread == 2) return SkTileMode::kRepeat;
    return SkTileMode::kClamp;
}

double paint_value(const PaintSpec& paint, size_t index, double fallback) {
    return index < 14 && std::isfinite(paint.values[index]) ? paint.values[index] : fallback;
}

struct MaterializedStop {
    double offset = 0;
    Color color;
    double stopOpacity = 1;
};

double clamp01(double value) {
    return std::max(0.0, std::min(1.0, value));
}

Color interpolate_color(const Color& left, const Color& right, double amount) {
    return {
        left.red + (right.red - left.red) * amount,
        left.green + (right.green - left.green) * amount,
        left.blue + (right.blue - left.blue) * amount,
        left.alpha + (right.alpha - left.alpha) * amount,
    };
}

/** Port of `sampleGradientStop` in packages/canvaskit-preview/src/paint.ts. `stops` must be offset-ascending. */
MaterializedStop sample_gradient_stop(const std::vector<MaterializedStop>& stops, double offset) {
    const MaterializedStop& first = stops.front();
    const MaterializedStop& last = stops.back();
    if (offset <= first.offset) { MaterializedStop result = first; result.offset = offset; return result; }
    if (offset >= last.offset) { MaterializedStop result = last; result.offset = offset; return result; }
    for (size_t index = 1; index < stops.size(); ++index) {
        const MaterializedStop& right = stops[index];
        const MaterializedStop& left = stops[index - 1];
        if (offset > right.offset) continue;
        const double span = right.offset - left.offset;
        if (span <= 0) { MaterializedStop result = right; result.offset = offset; return result; }
        const double amount = (offset - left.offset) / span;
        MaterializedStop result;
        result.offset = offset;
        result.color = interpolate_color(left.color, right.color, amount);
        result.stopOpacity = left.stopOpacity + (right.stopOpacity - left.stopOpacity) * amount;
        return result;
    }
    MaterializedStop result = last;
    result.offset = offset;
    return result;
}

/**
 * Port of `resolveGradient` in packages/canvaskit-preview/src/paint.ts. Skia's
 * native repeat tile mode is not reliable for a short (< 1.0) stop period —
 * CanvasKit works around this by explicitly enumerating every visible cycle
 * as literal "pad" stops instead of relying on `SkTileMode::kRepeat`, and
 * this must match exactly or native and CanvasKit render different bands.
 * Returns true (with `outStops` filled) when materialization applied;
 * `paint.spread` should then be treated as clamp/pad, not repeat.
 */
bool materialize_repeating_gradient(const PaintSpec& paint, std::vector<MaterializedStop>& outStops) {
    if (paint.spread != 2 || paint.colors.size() < 2) return false;
    const double start = paint.offsets.front();
    const double period = paint.offsets.back() - start;
    if (!std::isfinite(period) || period <= 0 || period >= 1) return false;

    std::vector<MaterializedStop> baseStops;
    baseStops.reserve(paint.colors.size());
    for (size_t index = 0; index < paint.colors.size(); ++index) {
        baseStops.push_back({ paint.offsets[index] - start, paint.colors[index], paint.stopOpacity[index] });
    }

    std::vector<MaterializedStop> stops;
    const int cycles = static_cast<int>(std::ceil(1.0 / period));
    const double terminalEpsilon = std::min(period * 0.5, 1e-7);
    const double terminalOffset = 1.0 - terminalEpsilon;
    for (int cycle = 0; cycle <= cycles; ++cycle) {
        for (const MaterializedStop& stop : baseStops) {
            const double offset = cycle * period + stop.offset;
            if (offset >= -1e-9 && offset < 1.0 - 1e-9) {
                MaterializedStop placed = stop;
                placed.offset = clamp01(offset);
                stops.push_back(placed);
            }
        }
    }

    const double rawTerminalPhase = std::fmod(std::fmod(1.0, period) + period, period);
    const double phaseTolerance = std::min(1e-5, period * 1e-3);
    const double terminalPhase = (rawTerminalPhase < phaseTolerance || period - rawTerminalPhase < phaseTolerance) ? 0.0 : rawTerminalPhase;
    const double phaseEpsilon = std::min(1e-7, period * 1e-4);
    const double preTerminalPhase = terminalPhase == 0.0 ? std::max(0.0, period - phaseEpsilon) : std::max(0.0, terminalPhase - phaseEpsilon);

    std::vector<MaterializedStop> interiorStops;
    for (const MaterializedStop& stop : stops) {
        if (stop.offset < terminalOffset - 1e-9) interiorStops.push_back(stop);
    }
    MaterializedStop preTerminalStop = sample_gradient_stop(baseStops, preTerminalPhase);
    preTerminalStop.offset = terminalOffset;
    interiorStops.push_back(preTerminalStop);
    MaterializedStop terminalStop = sample_gradient_stop(baseStops, terminalPhase);
    terminalStop.offset = 1.0;
    interiorStops.push_back(terminalStop);

    outStops = std::move(interiorStops);
    return true;
}

sk_sp<SkShader> make_gradient_shader(const PaintSpec& paint, double width, double height) {
    if (paint.type < 1 || paint.type > 3 || paint.colors.size() < 2) return nullptr;
    std::vector<MaterializedStop> materialized;
    const bool didMaterialize = materialize_repeating_gradient(paint, materialized);
    const size_t stopCount = didMaterialize ? materialized.size() : paint.colors.size();
    std::vector<SkColor4f> colors;
    std::vector<SkScalar> offsets;
    colors.reserve(stopCount);
    offsets.reserve(stopCount);
    for (size_t index = 0; index < stopCount; ++index) {
        const double red = didMaterialize ? materialized[index].color.red : paint.colors[index].red;
        const double green = didMaterialize ? materialized[index].color.green : paint.colors[index].green;
        const double blue = didMaterialize ? materialized[index].color.blue : paint.colors[index].blue;
        const double rawAlpha = didMaterialize ? materialized[index].color.alpha : paint.colors[index].alpha;
        const double stopOpacity = didMaterialize ? materialized[index].stopOpacity : paint.stopOpacity[index];
        const double alpha = std::max(0.0, std::min(1.0, rawAlpha * stopOpacity));
        colors.push_back({
            static_cast<float>(std::max(0.0, std::min(1.0, red))),
            static_cast<float>(std::max(0.0, std::min(1.0, green))),
            static_cast<float>(std::max(0.0, std::min(1.0, blue))),
            static_cast<float>(alpha),
        });
        offsets.push_back(static_cast<SkScalar>(didMaterialize ? materialized[index].offset : paint.offsets[index]));
    }
    const auto x = [&](double value, double extent, double fallback) {
        return static_cast<SkScalar>(paint.units == 0 ? value * extent : value);
    };
    SkMatrix localMatrix;
    const SkMatrix* localMatrixPtr = nullptr;
    if (paint.hasTransform) {
        localMatrix.setAll(
            static_cast<SkScalar>(paint.transform[0]), static_cast<SkScalar>(paint.transform[2]), static_cast<SkScalar>(paint.transform[4]),
            static_cast<SkScalar>(paint.transform[1]), static_cast<SkScalar>(paint.transform[3]), static_cast<SkScalar>(paint.transform[5]),
            0, 0, 1);
        localMatrixPtr = &localMatrix;
    }
    const SkGradient gradient(
        SkGradient::Colors(
            SkSpan<const SkColor4f>(colors.data(), colors.size()),
            SkSpan<const float>(offsets.data(), offsets.size()),
            didMaterialize ? SkTileMode::kClamp : paint_tile_mode(paint.spread)),
        SkGradient::Interpolation());
    if (paint.type == 1) {
        const double angle = paint_value(paint, 4, 0) * 3.14159265358979323846 / 180.0;
        const double defaultX1 = 0.5 - std::cos(angle) * 0.5;
        const double defaultY1 = 0.5 - std::sin(angle) * 0.5;
        const double defaultX2 = 0.5 + std::cos(angle) * 0.5;
        const double defaultY2 = 0.5 + std::sin(angle) * 0.5;
        const SkPoint points[2] = {
            {x(paint_value(paint, 0, defaultX1), width, defaultX1), x(paint_value(paint, 1, defaultY1), height, defaultY1)},
            {x(paint_value(paint, 2, defaultX2), width, defaultX2), x(paint_value(paint, 3, defaultY2), height, defaultY2)},
        };
        return SkShaders::LinearGradient(points, gradient, localMatrixPtr);
    }
    const SkScalar cx = x(paint_value(paint, 6, 0.5), width, 0.5);
    const SkScalar cy = x(paint_value(paint, 7, 0.5), height, 0.5);
    if (paint.type == 2) {
        const double defaultRadius = paint_value(paint, 8, 0.5);
        const SkScalar radius = static_cast<SkScalar>(paint.units == 0 ? defaultRadius * std::min(width, height) : defaultRadius);
        return SkShaders::RadialGradient(SkPoint::Make(cx, cy), radius, gradient, localMatrixPtr);
    }
    // `from` is wire index 5 (index 4 is the *linear* gradient's `angle` —
    // conic gradients carry their own separate field). Skia's SweepGradient
    // angle-range overload is not reliable across raster/GPU builds (see
    // CanvasKit's `conicLocalMatrix` in packages/canvaskit-preview/src/paint.ts,
    // which hits the same issue), so mirror that exact workaround here:
    // keep the sweep fixed at 0->360 and rotate the shader's local matrix
    // around the gradient center instead, by the negated CSS start angle.
    const double fromDegrees = paint_value(paint, 5, 0);
    SkMatrix rotation;
    rotation.setRotate(static_cast<SkScalar>(-fromDegrees), cx, cy);
    if (localMatrixPtr) rotation.preConcat(*localMatrixPtr);
    return SkShaders::SweepGradient(SkPoint::Make(cx, cy), 0, 360, gradient, &rotation);
}

}  // namespace

void apply_text_paint(SkPaint& paint, const Color& fallback, const PaintSpec& paintSpec, double alpha, double width, double height) {
    paint.setColor4f(color_with_alpha(fallback, alpha));
    if (auto shader = make_gradient_shader(paintSpec, width, height)) paint.setShader(std::move(shader));
}

bool draw_path(SkCanvas* canvas, SkPath& path, const Color& fill, bool hasFill,
               double fillOpacity, const PaintSpec& fillPaint, const Color& stroke, bool hasStroke,
               double strokeWidth, double strokeOpacity, const PaintSpec& strokePaint, double transformAlpha,
               uint8_t fillRule, bool antiAlias, double width, double height) {
    path.setFillType(fillRule == 1 ? SkPathFillType::kEvenOdd : SkPathFillType::kWinding);
    if (hasFill) {
        SkPaint paint;
        paint.setAntiAlias(antiAlias);
        paint.setStyle(SkPaint::kFill_Style);
        paint.setColor4f(color_with_alpha(fill, transformAlpha * fillOpacity));
        if (auto shader = make_gradient_shader(fillPaint, width, height)) paint.setShader(std::move(shader));
        canvas->drawPath(path, paint);
    }
    if (hasStroke) {
        SkPaint paint;
        paint.setAntiAlias(true);
        paint.setStyle(SkPaint::kStroke_Style);
        paint.setStrokeWidth(static_cast<SkScalar>(std::max(0.0, strokeWidth)));
        paint.setColor4f(color_with_alpha(stroke, transformAlpha * strokeOpacity));
        if (auto shader = make_gradient_shader(strokePaint, width, height)) paint.setShader(std::move(shader));
        canvas->drawPath(path, paint);
    }
    return hasFill || hasStroke;
}

SkMatrix text_glyph_matrix(double x, double y, double pathScale, double outlineX,
                           double outlineY, double rotation, double scaleX) {
    const double sx = pathScale * scaleX;
    const double sy = -pathScale;
    const double baseE = x - outlineX * sx;
    const double baseF = y + outlineY * pathScale;
    const double radians = rotation * 3.14159265358979323846 / 180.0;
    const double cosine = std::cos(radians);
    const double sine = std::sin(radians);
    SkMatrix result;
    if (std::abs(radians) < 1e-12) {
        result.setAll(static_cast<SkScalar>(sx), 0, static_cast<SkScalar>(baseE),
                      0, static_cast<SkScalar>(sy), static_cast<SkScalar>(baseF), 0, 0, 1);
        return result;
    }
    result.setAll(
        static_cast<SkScalar>(cosine * sx), static_cast<SkScalar>(-sine * sy),
        static_cast<SkScalar>(x - cosine * x + sine * y + cosine * baseE - sine * baseF),
        static_cast<SkScalar>(sine * sx), static_cast<SkScalar>(cosine * sy),
        static_cast<SkScalar>(y - sine * x - cosine * y + sine * baseE + cosine * baseF),
        0, 0, 1);
    return result;
}

}  // namespace neonix

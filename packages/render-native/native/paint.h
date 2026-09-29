#pragma once

// Shape/path/text painting: fills gradients/solids onto an SkCanvas from the
// PaintSpec/Color wire structs decoded by protocol.h.

#include "include/core/SkCanvas.h"
#include "include/core/SkMatrix.h"
#include "include/core/SkPaint.h"
#include "include/core/SkPath.h"

#include "neonix/protocol.h"

namespace neonix {

bool draw_shape(SkCanvas* canvas, uint8_t shape, double width, double height,
                double corner_radius, const Color& fill, bool has_fill, const PaintSpec& fill_paint,
                double fill_opacity, const Color& stroke, bool has_stroke, const PaintSpec& stroke_paint,
                double stroke_width, double stroke_opacity, double transform_alpha,
                bool anti_alias);

bool draw_path(SkCanvas* canvas, SkPath& path, const Color& fill, bool hasFill,
               double fillOpacity, const PaintSpec& fillPaint, const Color& stroke, bool hasStroke,
               double strokeWidth, double strokeOpacity, const PaintSpec& strokePaint, double transformAlpha,
               uint8_t fillRule, bool antiAlias, double width = 1, double height = 1);

void apply_text_paint(SkPaint& paint, const Color& fallback, const PaintSpec& paintSpec, double alpha, double width, double height);

SkMatrix text_glyph_matrix(double x, double y, double pathScale, double outlineX,
                           double outlineY, double rotation, double scaleX);

}  // namespace neonix

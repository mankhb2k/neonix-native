#include "neonix/effects.h"

#include "include/core/SkColorFilter.h"
#include "include/core/SkColorSpace.h"
#include "include/core/SkImage.h"
#include "include/core/SkImageInfo.h"
#include "include/core/SkPaint.h"
#include "include/core/SkRect.h"
#include "include/core/SkSamplingOptions.h"
#include "include/core/SkSurface.h"
#include "include/effects/SkImageFilters.h"

#include <algorithm>
#include <array>
#include <cmath>
#include <utility>

namespace neonix {

namespace {

double css_blur_radius_to_skia_sigma(double radius) {
    // Mirrors cssBlurRadiusToSkiaSigma in packages/canvaskit-preview/src/command/effects.ts.
    return radius == 0 ? 0.5 : radius;
}

double css_shadow_blur_radius_to_skia_sigma(double radius) {
    // Mirrors cssShadowBlurRadiusToSkiaSigma in the same TS file.
    return radius == 0 ? 0.5 : 0.5 * radius + 0.5;
}

using ColorMatrix = std::array<double, 20>;

ColorMatrix identity_color_matrix() {
    return { 1, 0, 0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 1, 0 };
}

/** Port of `multiplyColorMatrices` in effects.ts: compose two 4x5 matrices, the right one runs first. */
ColorMatrix multiply_color_matrices(const ColorMatrix& left, const ColorMatrix& right) {
    ColorMatrix result{};
    for (int row = 0; row < 4; ++row) {
        for (int column = 0; column < 4; ++column) {
            double sum = 0;
            for (int inner = 0; inner < 4; ++inner) sum += left[row * 5 + inner] * right[inner * 5 + column];
            result[row * 5 + column] = sum;
        }
        double sum = left[row * 5 + 4];
        for (int inner = 0; inner < 4; ++inner) sum += left[row * 5 + inner] * right[inner * 5 + 4];
        result[row * 5 + 4] = sum;
    }
    return result;
}

/** Port of `colorAdjustMatrix` in effects.ts. */
ColorMatrix color_adjust_matrix(const EffectOp& op) {
    const double saturation = op.saturation;
    const double lumR = 0.2126, lumG = 0.7152, lumB = 0.0722;
    ColorMatrix matrix = multiply_color_matrices({
        lumR * (1 - saturation) + saturation, lumG * (1 - saturation), lumB * (1 - saturation), 0, 0,
        lumR * (1 - saturation), lumG * (1 - saturation) + saturation, lumB * (1 - saturation), 0, 0,
        lumR * (1 - saturation), lumG * (1 - saturation), lumB * (1 - saturation) + saturation, 0, 0,
        0, 0, 0, 1, 0,
    }, identity_color_matrix());
    const double angle = op.hueRotate * 3.14159265358979323846 / 180.0;
    const double cosine = std::cos(angle);
    const double sine = std::sin(angle);
    matrix = multiply_color_matrices({
        lumR + cosine * (1 - lumR) - sine * lumR, lumG * (1 - cosine) - sine * lumG, lumB * (1 - cosine) + sine * (1 - lumB), 0, 0,
        lumR * (1 - cosine) + sine * 0.143, lumG + cosine * (1 - lumG) + sine * 0.140, lumB * (1 - cosine) - sine * 0.283, 0, 0,
        lumR * (1 - cosine) - sine * (1 - lumR), lumG * (1 - cosine) + sine * lumG, lumB + cosine * (1 - lumB) + sine * lumB, 0, 0,
        0, 0, 0, 1, 0,
    }, matrix);
    const double contrast = op.contrast;
    matrix = multiply_color_matrices({
        contrast, 0, 0, 0, 0.5 * (1 - contrast),
        0, contrast, 0, 0, 0.5 * (1 - contrast),
        0, 0, contrast, 0, 0.5 * (1 - contrast),
        0, 0, 0, 1, 0,
    }, matrix);
    return multiply_color_matrices({
        1, 0, 0, 0, op.brightness,
        0, 1, 0, 0, op.brightness,
        0, 0, 1, 0, op.brightness,
        0, 0, 0, 1, 0,
    }, matrix);
}

sk_sp<SkColorFilter> make_color_matrix_filter(const ColorMatrix& matrix) {
    float values[20];
    for (int index = 0; index < 20; ++index) values[index] = static_cast<float>(matrix[index]);
    return SkColorFilters::Matrix(values);
}

SkColor sk_color_from(const Color& color, double opacityMultiplier) {
    const auto clamp = [](double value) { return static_cast<uint8_t>(std::max(0.0, std::min(1.0, value)) * 255.0 + 0.5); };
    return SkColorSetARGB(clamp(color.alpha * opacityMultiplier), clamp(color.red), clamp(color.green), clamp(color.blue));
}

bool is_linear_color_spatial_op(uint8_t kind) {
    // color-adjust=1, color-matrix=2, alpha=3, blur=4.
    return kind == 1 || kind == 2 || kind == 3 || kind == 4;
}

/**
 * Port of `buildLinearColorSpatialFilter` in effects.ts: chain blur /
 * color-adjust / color-matrix / alpha ops (in wire order) into one
 * SkImageFilter.
 */
sk_sp<SkImageFilter> build_linear_color_spatial_filter(const std::vector<const EffectOp*>& ops) {
    sk_sp<SkImageFilter> filter;
    for (const EffectOp* op : ops) {
        if (op->kind == 4) {  // blur
            const double sigma = css_blur_radius_to_skia_sigma(op->radius);
            filter = SkImageFilters::Blur(static_cast<SkScalar>(sigma), static_cast<SkScalar>(sigma), SkTileMode::kDecal, filter);
            continue;
        }
        ColorMatrix matrix;
        if (op->kind == 2) {
            if (op->matrix.size() != 20) return nullptr;
            std::copy(op->matrix.begin(), op->matrix.end(), matrix.begin());
        } else if (op->kind == 3) {  // alpha
            matrix = { 1, 0, 0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 1, 0, 0, 0, 0, 0, op->amount, 0 };
        } else {  // color-adjust
            matrix = color_adjust_matrix(*op);
        }
        sk_sp<SkColorFilter> colorFilter = make_color_matrix_filter(matrix);
        if (!colorFilter) return nullptr;
        filter = SkImageFilters::ColorFilter(std::move(colorFilter), filter);
    }
    return filter;
}

}  // namespace

/**
 * Port of a narrow, high-value subset of `effectFilterFor` in effects.ts:
 * a pure linear color/spatial chain (blur/color-adjust/color-matrix/alpha,
 * covering plain CSS `filter: blur()/contrast()/saturate()/hue-rotate()`
 * and grayscale/sepia/invert), plus a single alpha-based shadow or glow
 * (`filter: drop-shadow()`, single outer/inner glow — not a box-shadow,
 * which CanvasKit itself routes through a separate compositor, not a plain
 * ImageFilter, and not multi-shadow lists or spread/inset combinations).
 * Anything else fails closed (returns nullptr with `supported=false`) rather
 * than silently rendering a partial or wrong effect.
 */
EffectFilterResult build_effect_filter(bool hasProgram, const EffectProgram& program) {
    if (!hasProgram || program.ops.empty()) return { nullptr, true };
    const std::vector<EffectOp>& ops = program.ops;

    bool allLinear = true;
    for (size_t index = 0; index < ops.size(); ++index) {
        const EffectOp& op = ops[index];
        const std::string expectedInput = index == 0 ? "source" : ops[index - 1].output;
        if (!is_linear_color_spatial_op(op.kind) || op.input != expectedInput) { allLinear = false; break; }
    }
    if (allLinear && ops.back().output == program.output) {
        std::vector<const EffectOp*> refs;
        refs.reserve(ops.size());
        for (const EffectOp& op : ops) refs.push_back(&op);
        sk_sp<SkImageFilter> filter = build_linear_color_spatial_filter(refs);
        return { filter, filter != nullptr };
    }

    // Multi-shadow list (alpha-mask.source != box): N>=2 chained 5-op blocks,
    // each reading the ORIGINAL "source" (not the previous block's output).
    // Port of `shadowBlocks` + the DropShadow/DropShadowOnly/Blend chain in
    // effectFilterFor (effects.ts), for `filter: drop-shadow() drop-shadow()`.
    if (ops.size() >= 10 && ops.size() % 5 == 0) {
        bool blocksMatch = true;
        for (size_t base = 0; base < ops.size() && blocksMatch; base += 5) {
            const EffectOp& a = ops[base];
            const EffectOp& b = ops[base + 1];
            const EffectOp& t = ops[base + 2];
            const EffectOp& o = ops[base + 3];
            const EffectOp& c = ops[base + 4];
            if (a.kind != 5 || a.input != "source" || a.alphaMaskSource == 2
                || b.kind != 4 || b.input != a.output
                || t.kind != 8 || t.input != b.output
                || o.kind != 9 || o.input != t.output
                || c.kind != 11 || c.backdrop != o.output) {
                blocksMatch = false;
            }
        }
        if (blocksMatch) {
            sk_sp<SkImageFilter> filter;
            for (size_t base = 0; base < ops.size(); base += 5) {
                const EffectOp& blur = ops[base + 1];
                const EffectOp& tint = ops[base + 2];
                const EffectOp& offset = ops[base + 3];
                const double sigma = css_shadow_blur_radius_to_skia_sigma(blur.radius);
                const SkColor color = sk_color_from(tint.tintColor, tint.tintOpacity);
                const bool only = base != 0;
                sk_sp<SkImageFilter> next = only
                    ? SkImageFilters::DropShadowOnly(static_cast<SkScalar>(offset.offsetX), static_cast<SkScalar>(offset.offsetY), static_cast<SkScalar>(sigma), static_cast<SkScalar>(sigma), color, nullptr)
                    : SkImageFilters::DropShadow(static_cast<SkScalar>(offset.offsetX), static_cast<SkScalar>(offset.offsetY), static_cast<SkScalar>(sigma), static_cast<SkScalar>(sigma), color, nullptr);
                if (!next) return { nullptr, false };
                if (!filter) { filter = next; continue; }
                // Keep the source-bearing (first) branch in the foreground so it
                // is never darkened by an earlier shadow-only branch behind it.
                filter = SkImageFilters::Blend(SkBlendMode::kSrcOver, next, filter);
                if (!filter) return { nullptr, false };
            }
            return { filter, filter != nullptr };
        }
    }

    // Box-shadow spread inserts a morphology op between the silhouette and
    // the blur: ["alpha-mask","morphology","blur","tint","offset","composite"].
    // Spread only applies to box-shadow (alphaMaskSource==2), never to
    // filter: drop-shadow(). Port of the matching branch in effectFilterFor.
    if (ops.size() == 6
        && ops[0].kind == 5 && ops[0].input == "source" && ops[0].alphaMaskSource == 2
        && ops[1].kind == 6
        && ops[2].kind == 4 && ops[2].input == ops[1].output
        && ops[3].kind == 8 && ops[3].input == ops[2].output
        && ops[4].kind == 9 && ops[4].input == ops[3].output
        && ops[5].kind == 11 && ops[5].backdrop == ops[4].output && ops[5].source == "source") {
        const EffectOp& morphology = ops[1];
        const EffectOp& blur = ops[2];
        const EffectOp& tint = ops[3];
        const EffectOp& offset = ops[4];
        sk_sp<SkImageFilter> morphed;
        if (morphology.radius != 0) {
            const SkScalar r = static_cast<SkScalar>(morphology.radius);
            morphed = morphology.morphologyOperator == 1 ? SkImageFilters::Dilate(r, r, nullptr) : SkImageFilters::Erode(r, r, nullptr);
        }
        const double sigma = css_shadow_blur_radius_to_skia_sigma(blur.radius);
        const SkColor color = sk_color_from(tint.tintColor, tint.tintOpacity);
        // DropShadow with a non-null `input` both computes the shadow from
        // and redraws `input` as the foreground — feeding it the dilated
        // silhouette directly would visibly enlarge the box itself (proven
        // empirically: a 4px border rendered 28px wide and shifted outward
        // by exactly the spread radius). Use DropShadowOnly to keep just the
        // halo, then blend it behind the UNDILATED original content.
        sk_sp<SkImageFilter> shadowOnly = SkImageFilters::DropShadowOnly(
            static_cast<SkScalar>(offset.offsetX), static_cast<SkScalar>(offset.offsetY),
            static_cast<SkScalar>(sigma), static_cast<SkScalar>(sigma), color, morphed);
        sk_sp<SkImageFilter> filter = shadowOnly ? SkImageFilters::Blend(SkBlendMode::kSrcOver, shadowOnly, nullptr) : nullptr;
        return { filter, filter != nullptr };
    }

    // Single alpha-based shadow/glow: ["alpha-mask","blur","tint","offset","composite"]
    // or without the offset: ["alpha-mask","blur","tint","composite"].
    const bool hasOffset = ops.size() == 5;
    const bool shapeMatches = (ops.size() == 5 || ops.size() == 4)
        && ops[0].kind == 5 && ops[0].input == "source"
        && ops[1].kind == 4 && ops[1].input == ops[0].output
        && ops[2].kind == 8 && ops[2].input == ops[1].output
        && (hasOffset
            // composite = {backdrop, source}: the shadow paints as the
            // backdrop (behind), the original content as `source` (in
            // front) — matching CSS drop-shadow painting the shadow behind
            // the shape, not the other way around.
            ? (ops[3].kind == 9 && ops[3].input == ops[2].output && ops[4].kind == 11 && ops[4].backdrop == ops[3].output && ops[4].source == "source")
            : (ops[3].kind == 11 && ops[3].backdrop == ops[2].output && ops[3].source == "source"));
    if (shapeMatches) {
        const EffectOp& blur = ops[1];
        const EffectOp& tint = ops[2];
        // Mirrors effectFilterFor's per-shape sigma choice: `filter:
        // drop-shadow()` (alphaMaskSource==1, 5-op form) or an unspecified
        // source on the 4-op form uses the outer-glow/plain-blur profile;
        // every other case (box-shadow's own single-shadow shape included)
        // uses the box-shadow blur profile.
        const bool useOuterGlowSigma = hasOffset ? ops[0].alphaMaskSource == 1 : ops[0].alphaMaskSource == 0;
        const double sigma = useOuterGlowSigma
            ? css_blur_radius_to_skia_sigma(blur.radius)
            : css_shadow_blur_radius_to_skia_sigma(blur.radius);
        const double dx = hasOffset ? ops[3].offsetX : 0;
        const double dy = hasOffset ? ops[3].offsetY : 0;
        const SkColor color = sk_color_from(tint.tintColor, tint.tintOpacity);
        sk_sp<SkImageFilter> filter = SkImageFilters::DropShadow(
            static_cast<SkScalar>(dx), static_cast<SkScalar>(dy),
            static_cast<SkScalar>(sigma), static_cast<SkScalar>(sigma),
            color, nullptr);
        return { filter, filter != nullptr };
    }

    // CSS filter order: blur/color*(...) drop-shadow(...) — e.g.
    // `filter: blur(8px) drop-shadow(...)`. The prefix operators reshape the
    // owner first; the shadow then reads that filtered silhouette, and the
    // filtered owner (not the raw layer content) is what stays visible in
    // front of it. Port of the matching branch in effectFilterFor.
    if (ops.size() >= 6) {
        // ops.size() >= 6 guarantees shadowStart >= 1, so there is always at
        // least one prefix op and `ops[shadowStart - 1]` never underflows.
        const size_t shadowStart = ops.size() - 5;
        bool prefixValid = true;
        for (size_t index = 0; index < shadowStart && prefixValid; ++index) {
            const EffectOp& op = ops[index];
            const std::string expectedInput = index == 0 ? "source" : ops[index - 1].output;
            if (!is_linear_color_spatial_op(op.kind) || op.input != expectedInput) prefixValid = false;
        }
        const EffectOp& shadowAlpha = ops[shadowStart];
        const EffectOp& shadowBlur = ops[shadowStart + 1];
        const EffectOp& shadowTint = ops[shadowStart + 2];
        const EffectOp& shadowOffset = ops[shadowStart + 3];
        const EffectOp& shadowComposite = ops[shadowStart + 4];
        const std::string& prefixOutput = ops[shadowStart - 1].output;
        if (prefixValid
            && shadowAlpha.kind == 5 && shadowAlpha.input == prefixOutput
            && shadowBlur.kind == 4 && shadowBlur.input == shadowAlpha.output
            && shadowTint.kind == 8 && shadowTint.input == shadowBlur.output
            && shadowOffset.kind == 9 && shadowOffset.input == shadowTint.output
            && shadowComposite.kind == 11
            && shadowComposite.backdrop == shadowOffset.output
            && shadowComposite.source == prefixOutput
            && shadowComposite.output == program.output) {
            std::vector<const EffectOp*> prefixRefs;
            prefixRefs.reserve(shadowStart);
            for (size_t index = 0; index < shadowStart; ++index) prefixRefs.push_back(&ops[index]);
            sk_sp<SkImageFilter> filteredSource = build_linear_color_spatial_filter(prefixRefs);
            if (filteredSource) {
                const double sigma = css_shadow_blur_radius_to_skia_sigma(shadowBlur.radius);
                const SkColor color = sk_color_from(shadowTint.tintColor, shadowTint.tintOpacity);
                sk_sp<SkImageFilter> shadowOnly = SkImageFilters::DropShadowOnly(
                    static_cast<SkScalar>(shadowOffset.offsetX), static_cast<SkScalar>(shadowOffset.offsetY),
                    static_cast<SkScalar>(sigma), static_cast<SkScalar>(sigma), color, filteredSource);
                sk_sp<SkImageFilter> filter = shadowOnly
                    ? SkImageFilters::Blend(SkBlendMode::kSrcOver, shadowOnly, filteredSource)
                    : nullptr;
                return { filter, filter != nullptr };
            }
        }
    }

    return { nullptr, false };
}

/**
 * Port of `boxShadowOverlayBranches` in replay.ts: parse the ordered CSS
 * box-shadow / white-glow op-graph into per-shadow branches. Every alpha-mask
 * here reads the box's own geometry (`source === "box"`, alphaMaskSource==2),
 * not the layer's rendered alpha, so it can never be represented as a plain
 * SkImageFilter on the layer's content — it is drawn as a direct raster
 * overlay by `draw_box_effect` instead.
 */
bool parse_box_shadow_branches(const EffectProgram& program, std::vector<BoxShadowBranch>& branches) {
    const std::vector<EffectOp>& ops = program.ops;
    size_t index = 0;
    while (index < ops.size()) {
        const EffectOp& alpha = ops[index];
        if (alpha.kind != 5 || alpha.input != "source" || alpha.alphaMaskSource != 2) return false;
        size_t cursor = index + 1;
        const bool hasPreOffset = cursor < ops.size() && ops[cursor].kind == 9;
        double preOffsetX = 0, preOffsetY = 0;
        if (hasPreOffset) {
            preOffsetX = ops[cursor].offsetX;
            preOffsetY = ops[cursor].offsetY;
            cursor += 1;
        }
        if (cursor >= ops.size() || ops[cursor].kind != 4) return false;
        const EffectOp& blur = ops[cursor];
        cursor += 1;
        if (cursor < ops.size() && ops[cursor].kind == 7) {
            const EffectOp& inner = ops[cursor];
            if (inner.source != alpha.output || inner.blurred != blur.output) return false;
            cursor += 1;
            if (cursor >= ops.size() || ops[cursor].kind != 8) return false;
            const EffectOp& tint = ops[cursor];
            cursor += 1;
            if (cursor >= ops.size() || ops[cursor].kind != 11 || ops[cursor].source != tint.output) return false;
            cursor += 1;
            BoxShadowBranch branch;
            branch.inner = true;
            branch.blurRadius = blur.radius;
            branch.tintColor = tint.tintColor;
            branch.tintOpacity = tint.tintOpacity;
            branch.offsetX = preOffsetX;
            branch.offsetY = preOffsetY;
            branches.push_back(branch);
            index = cursor;
            continue;
        }
        if (cursor >= ops.size() || ops[cursor].kind != 8) return false;
        const EffectOp& tint = ops[cursor];
        cursor += 1;
        double offsetX = preOffsetX, offsetY = preOffsetY;
        if (!hasPreOffset) {
            if (cursor >= ops.size() || ops[cursor].kind != 9) return false;
            offsetX = ops[cursor].offsetX;
            offsetY = ops[cursor].offsetY;
            cursor += 1;
        }
        if (cursor >= ops.size() || ops[cursor].kind != 11) return false;
        cursor += 1;
        BoxShadowBranch branch;
        branch.inner = false;
        branch.blurRadius = blur.radius;
        branch.tintColor = tint.tintColor;
        branch.tintOpacity = tint.tintOpacity;
        branch.offsetX = offsetX;
        branch.offsetY = offsetY;
        branches.push_back(branch);
        index = cursor;
    }
    return !branches.empty();
}

bool program_has_box_alpha_mask(const EffectProgram& program) {
    for (const EffectOp& op : program.ops) {
        if (op.kind == 5 && op.alphaMaskSource == 2) return true;
    }
    return false;
}

/**
 * Draw one or more box-shadow/glow branches as isolated raster overlays.
 * Port of the box-branch path of `drawBoxEffect` in replay.ts: each branch
 * reads a synthetic box silhouette (not the layer's actual alpha), so it is
 * masked, blurred, tinted and offset in its own offscreen surface, then
 * composited onto `canvas` with a hole (outer) or ring (inner) punched out
 * so it never paints over the box's own footprint. Branches are drawn in
 * reverse CSS-list order so the first-listed shadow ends up on top.
 */
bool draw_box_effect(SkCanvas* canvas, const std::vector<BoxShadowBranch>& branches,
                      const EffectBoxSpec& box, const Matrix4& projection,
                      uint32_t frameWidth, uint32_t frameHeight) {
    if (branches.empty() || !box.present) return true;
    double blurPad = 0, offsetPad = 0;
    for (const BoxShadowBranch& branch : branches) {
        const double sigma = css_shadow_blur_radius_to_skia_sigma(branch.blurRadius);
        blurPad = std::max(blurPad, std::ceil(sigma * 3 + 1));
        offsetPad = std::max(offsetPad, std::ceil(std::max(std::fabs(branch.offsetX), std::fabs(branch.offsetY))));
    }
    const double pad = blurPad + offsetPad;
    const double localWidth = box.width + pad * 2;
    const double localHeight = box.height + pad * 2;
    const int surfaceWidth = std::max(1, static_cast<int>(std::ceil(localWidth)));
    const int surfaceHeight = std::max(1, static_cast<int>(std::ceil(localHeight)));
    const SkImageInfo overlayInfo = SkImageInfo::Make(surfaceWidth, surfaceHeight, kRGBA_8888_SkColorType,
        kPremul_SkAlphaType, SkColorSpace::MakeSRGB());

    sk_sp<SkSurface> maskSurface = SkSurfaces::Raster(overlayInfo);
    if (!maskSurface) return false;
    SkCanvas* maskCanvas = maskSurface->getCanvas();
    maskCanvas->clear(SK_ColorTRANSPARENT);
    SkPaint maskPaint;
    maskPaint.setAntiAlias(true);
    maskPaint.setColor(SK_ColorWHITE);
    const double radius = box.hasCornerRadius
        ? std::max(0.0, std::min(box.cornerRadius, std::min(box.width, box.height) / 2))
        : 0;
    const SkRect boxRect = SkRect::MakeXYWH(static_cast<SkScalar>(pad), static_cast<SkScalar>(pad),
        static_cast<SkScalar>(box.width), static_cast<SkScalar>(box.height));
    if (radius > 0) maskCanvas->drawRoundRect(boxRect, static_cast<SkScalar>(radius), static_cast<SkScalar>(radius), maskPaint);
    else maskCanvas->drawRect(boxRect, maskPaint);
    sk_sp<SkImage> maskImage = maskSurface->makeImageSnapshot();
    if (!maskImage) return false;

    const SkMatrix placement = to_canvas_matrix(projection, box.matrix, static_cast<int>(frameWidth), static_cast<int>(frameHeight));
    const SkSamplingOptions sampling;

    for (size_t index = branches.size(); index-- > 0;) {
        const BoxShadowBranch& branch = branches[index];
        const double sigma = css_shadow_blur_radius_to_skia_sigma(branch.blurRadius);

        sk_sp<SkSurface> blurSurface = SkSurfaces::Raster(overlayInfo);
        if (!blurSurface) return false;
        SkCanvas* blurCanvas = blurSurface->getCanvas();
        blurCanvas->clear(SK_ColorTRANSPARENT);
        SkPaint blurPaint;
        blurPaint.setAntiAlias(true);
        blurPaint.setImageFilter(SkImageFilters::Blur(
            static_cast<SkScalar>(sigma), static_cast<SkScalar>(sigma), SkTileMode::kDecal, nullptr));
        blurCanvas->save();
        if (branch.offsetX != 0 || branch.offsetY != 0) {
            blurCanvas->translate(static_cast<SkScalar>(branch.offsetX), static_cast<SkScalar>(branch.offsetY));
        }
        blurCanvas->drawImage(maskImage.get(), 0, 0, sampling, &blurPaint);
        blurCanvas->restore();
        sk_sp<SkImage> blurImage = blurSurface->makeImageSnapshot();
        if (!blurImage) return false;

        sk_sp<SkSurface> branchSurface = SkSurfaces::Raster(overlayInfo);
        if (!branchSurface) return false;
        SkCanvas* branchCanvas = branchSurface->getCanvas();
        branchCanvas->clear(SK_ColorTRANSPARENT);
        SkPaint branchPaint;
        branchPaint.setAntiAlias(true);
        if (branch.inner) {
            // Inset shadow: keep the box interior, then subtract the
            // offset+blurred mask, leaving a ring hugging the inside edge.
            branchCanvas->drawImage(maskImage.get(), 0, 0, sampling, &branchPaint);
            branchPaint.setBlendMode(SkBlendMode::kDstOut);
            branchCanvas->drawImage(blurImage.get(), 0, 0, sampling, &branchPaint);
        } else {
            // Outer shadow: take the offset+blurred halo, then subtract the
            // box's own (unblurred, unoffset) silhouette so it never shows
            // through the opaque box itself.
            branchCanvas->drawImage(blurImage.get(), 0, 0, sampling, &branchPaint);
            branchPaint.setBlendMode(SkBlendMode::kDstOut);
            branchCanvas->drawImage(maskImage.get(), 0, 0, sampling, &branchPaint);
        }
        sk_sp<SkImage> branchImage = branchSurface->makeImageSnapshot();
        if (!branchImage) return false;

        sk_sp<SkSurface> tintedSurface = SkSurfaces::Raster(overlayInfo);
        if (!tintedSurface) return false;
        SkCanvas* tintedCanvas = tintedSurface->getCanvas();
        tintedCanvas->clear(SK_ColorTRANSPARENT);
        SkPaint plainPaint;
        plainPaint.setAntiAlias(true);
        tintedCanvas->drawImage(branchImage.get(), 0, 0, sampling, &plainPaint);
        tintedCanvas->drawColor(sk_color_from(branch.tintColor, branch.tintOpacity), SkBlendMode::kSrcIn);
        sk_sp<SkImage> tintedImage = tintedSurface->makeImageSnapshot();
        if (!tintedImage) return false;

        SkPaint compositePaint;
        compositePaint.setAntiAlias(true);
        canvas->save();
        canvas->concat(placement);
        canvas->drawImage(tintedImage.get(), static_cast<SkScalar>(-pad), static_cast<SkScalar>(-pad), sampling, &compositePaint);
        canvas->restore();
    }
    return true;
}

}  // namespace neonix

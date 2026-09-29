// Native Skia CPU command-buffer render host.
//
// This process deliberately owns only the raster/replay side of the export
// pipeline. TypeScript (packages/render-native/src/render/native-command.ts)
// evaluates the canonical RuntimeProjectV3 per frame and streams a versioned
// binary subset of its PaintCommandBuffer (native-protocol.ts) over stdin;
// unsupported commands fail closed instead of being silently approximated.
//
// The implementation is split by concern: neonix/protocol.* decodes the wire
// format and holds shared matrix/color math, neonix/paint.* fills
// shapes/paths/text, neonix/effects.* interprets CSS filter/box-shadow
// programs into Skia filters or overlay draws, and neonix/encoder.* owns the
// in-process FFmpeg mux. This file is left with only what doesn't belong in
// any of those: CLI parsing, the per-command opcode dispatch loop, and the
// final metrics/JSON report.

#include "include/core/SkBlendMode.h"
#include "include/core/SkCanvas.h"
#include "include/core/SkColorSpace.h"
#include "include/core/SkImageInfo.h"
#include "include/core/SkPaint.h"
#include "include/core/SkPath.h"
#include "include/core/SkPathBuilder.h"
#include "include/core/SkRect.h"
#include "include/core/SkSurface.h"
#include "include/utils/SkParsePath.h"

#include "neonix/effects.h"
#include "neonix/encoder.h"
#include "neonix/paint.h"
#include "neonix/protocol.h"
#include "neonix/util.h"

#include <algorithm>
#include <cmath>
#include <cstdint>
#include <cstdio>
#include <cstdlib>
#include <cstring>
#include <fstream>
#include <iostream>
#include <limits>
#include <string>
#include <utility>
#include <vector>

using namespace neonix;

namespace {

void print_error(const char* phase, const char* message) {
    std::fprintf(stderr, "{\"ok\":false,\"phase\":\"%s\",\"error\":\"%s\"}\n", phase,
                 message);
}

bool write_ppm(const std::string& path, const std::vector<uint8_t>& pixels, int width, int height) {
    if (path.empty()) return true;
    std::ofstream output(path, std::ios::binary);
    if (!output) return false;
    output << "P6\n" << width << " " << height << "\n255\n";
    for (size_t index = 0; index + 3 < pixels.size(); index += 4) {
        output.put(static_cast<char>(pixels[index + 0]));
        output.put(static_cast<char>(pixels[index + 1]));
        output.put(static_cast<char>(pixels[index + 2]));
    }
    return static_cast<bool>(output);
}

enum class SurfaceMode {
    CopyReadback,
    DirectRaster,
};

const char* surface_mode_name(SurfaceMode mode) {
    return mode == SurfaceMode::DirectRaster ? "direct-raster" : "copy-readback";
}

struct Transform {
    Matrix4 matrix{};
    double alpha = 1;
    bool visible = true;
    bool present = false;
};

struct TextGlyph {
    SkPath path;
    double x = 0;
    double y = 0;
    double pathScale = 1;
    double outlineX = 0;
    double outlineY = 0;
    double rotation = 0;
    double scaleX = 1;
    bool hasFill = false;
    Color fill;
    bool hasFillPaint = false;
    PaintSpec fillPaint;
    bool hasStroke = false;
    Color stroke;
    double strokeWidth = 0;
    double strokeOpacity = 1;
};

}  // namespace

int main(int argc, char** argv) {
    std::string outputPath;
    std::string inputPath;
    bool rawOutput = true;
    bool inProcessEncoding = false;
    bool compareColor = false;
#ifdef NEONIX_LIBYUV_ONLY
    ColorConverter colorConverter = ColorConverter::Libyuv;
#else
    ColorConverter colorConverter = ColorConverter::Swscale;
#endif
#ifndef NEONIX_LIBYUV_ONLY
    int swsFilter = SWS_BILINEAR;
#else
    int swsFilter = 0;
#endif
    SurfaceMode surfaceMode = SurfaceMode::CopyReadback;
    for (int index = 1; index < argc; ++index) {
        if (std::strcmp(argv[index], "--input-file") == 0 && index + 1 < argc) {
            inputPath = argv[++index];
        } else if (std::strcmp(argv[index], "--output") == 0 && index + 1 < argc) {
            outputPath = argv[++index];
        } else if (std::strcmp(argv[index], "--no-raw") == 0) {
            rawOutput = false;
        } else if (std::strcmp(argv[index], "--raw") == 0) {
            rawOutput = true;
        } else if (std::strcmp(argv[index], "--in-process") == 0) {
            inProcessEncoding = true;
            rawOutput = false;
        } else if (std::strcmp(argv[index], "--compare-color") == 0) {
            compareColor = true;
        } else if (std::strcmp(argv[index], "--sws-filter") == 0 && index + 1 < argc) {
#ifdef NEONIX_LIBYUV_ONLY
            print_error("encoder", "sws_filter_is_sandbox_only");
            return 54;
#else
            const std::string value = argv[++index];
            if (value == "area") {
                swsFilter = SWS_AREA;
            } else if (value == "bilinear") {
                swsFilter = SWS_BILINEAR;
            } else if (value == "fast-bilinear") {
                swsFilter = SWS_FAST_BILINEAR;
            } else if (value == "point") {
                swsFilter = SWS_POINT;
            } else {
                print_error("encoder", "unsupported_sws_filter");
                return 54;
            }
#endif
        } else if (std::strcmp(argv[index], "--converter") == 0 && index + 1 < argc) {
            const std::string value = argv[++index];
            if (value == "swscale" || value == "libswscale") {
                colorConverter = ColorConverter::Swscale;
            } else if (value == "libyuv") {
                colorConverter = ColorConverter::Libyuv;
            } else {
                print_error("encoder", "unsupported_color_converter");
                return 52;
            }
        } else if (std::strcmp(argv[index], "--surface-mode") == 0 && index + 1 < argc) {
            const std::string value = argv[++index];
            if (value == "copy" || value == "copy-readback") {
                surfaceMode = SurfaceMode::CopyReadback;
            } else if (value == "direct-raster") {
                surfaceMode = SurfaceMode::DirectRaster;
            } else {
                print_error("surface", "unsupported_surface_mode");
                return 53;
            }
        }
    }

    const auto totalStart = Clock::now();
    std::ifstream inputFile;
    std::istream* input = &std::cin;
    if (!inputPath.empty()) {
        inputFile.open(inputPath, std::ios::binary);
        if (!inputFile) {
            print_error("protocol", "input_file_open_failed");
            return 19;
        }
        input = &inputFile;
    }
    Reader reader(*input);
    const char expectedMagic[8] = {'N', 'X', 'S', 'K', 'I', 'A', '0', '2'};
    char magic[8]{};
    if (!reader.bytes(magic, sizeof(magic)) || std::memcmp(magic, expectedMagic, sizeof(magic)) != 0) {
        print_error("protocol", "invalid_magic");
        return 20;
    }

    uint32_t width = 0;
    uint32_t height = 0;
    uint32_t expectedFrames = 0;
    if (!reader.value(width) || !reader.value(height) || !reader.value(expectedFrames) ||
        width == 0 || height == 0 || expectedFrames == 0) {
        print_error("protocol", "invalid_dimensions");
        return 21;
    }
    if (inProcessEncoding && outputPath.empty()) {
        print_error("encoder", "in_process_output_path_required");
        return 48;
    }
    const SkImageInfo imageInfo = SkImageInfo::Make(
        static_cast<int>(width), static_cast<int>(height), kRGBA_8888_SkColorType,
        kOpaque_SkAlphaType, SkColorSpace::MakeSRGB());
    const size_t rowBytes = static_cast<size_t>(width) * 4;
    std::vector<uint8_t> pixels(static_cast<size_t>(width) * static_cast<size_t>(height) * 4);
    sk_sp<SkSurface> surface = surfaceMode == SurfaceMode::DirectRaster
        ? SkSurfaces::WrapPixels(imageInfo, pixels.data(), rowBytes)
        : SkSurfaces::Raster(imageInfo);
    if (!surface) {
        print_error("create_surface", surfaceMode == SurfaceMode::DirectRaster
            ? "SkSurfaces_WrapPixels_failed" : "SkSurfaces_Raster_failed");
        return 22;
    }
    InProcessEncoder encoder;
    if (inProcessEncoding) {
        std::string encoderError;
        if (!encoder.open(outputPath, static_cast<int>(width), static_cast<int>(height), 30,
                          expectedFrames, colorConverter, compareColor, swsFilter, encoderError)) {
            std::fprintf(stderr, "{\"ok\":false,\"phase\":\"encoder_open\",\"error\":\"%s\"}\n", encoderError.c_str());
            return 49;
        }
    }
    Matrix4 projection = identity_matrix();
    Transform transform;
    uint64_t frames = 0;
    uint64_t bytesWritten = 0;
    uint32_t rawSampleHashes[3] = {2166136261U, 2166136261U, 2166136261U};
    const uint32_t sampleFrames[3] = {0, expectedFrames / 2, expectedFrames - 1};
    double renderMilliseconds = 0;
    double compositeMilliseconds = 0;
    double readbackMilliseconds = 0;
    double rawWriteMilliseconds = 0;
    uint32_t layerDepth = 0;
    struct PendingLayerEffect {
        bool hasBoxEffect = false;
        std::vector<BoxShadowBranch> boxBranches;
        EffectBoxSpec box;
    };
    std::vector<PendingLayerEffect> layerEffectStack;
    bool ended = false;
    bool alphaSamplesOpaque = true;

    while (true) {
        uint8_t frameMarker = 0;
        if (!reader.value(frameMarker)) break;
        if (frameMarker == 0) {
            ended = true;
            break;
        }
        if (frameMarker != 0xF1) {
            print_error("protocol", "invalid_frame_marker");
            return 23;
        }
        uint32_t frameIndex = 0;
        uint32_t commandCount = 0;
        if (!reader.value(frameIndex) || !reader.value(commandCount) || commandCount == 0) {
            print_error("protocol", "invalid_frame_header");
            return 24;
        }
        (void)frameIndex;
        bool sawEndFrame = false;
        for (uint32_t commandIndex = 0; commandIndex < commandCount; ++commandIndex) {
            uint8_t opcode = 0;
            if (!reader.value(opcode)) {
                print_error("protocol", "truncated_command");
                return 25;
            }
            if (opcode == 1) {  // beginFrame
                uint32_t commandWidth = 0;
                uint32_t commandHeight = 0;
                Color background;
                uint8_t hasBackground = 0;
                if (!reader.value(commandWidth) || !reader.value(commandHeight) ||
                    !reader.value(hasBackground) || (hasBackground && !read_color(reader, background)) ||
                    !read_matrix(reader, projection)) {
                    print_error("protocol", "truncated_begin_frame");
                    return 26;
                }
                if (commandWidth != width || commandHeight != height) {
                    print_error("protocol", "frame_dimensions_mismatch");
                    return 27;
                }
                const auto renderStart = Clock::now();
                SkCanvas* canvas = surface->getCanvas();
                // Exported video frames are opaque. Initialize every pixel
                // before drawing so transparent scene pixels cannot leak
                // undefined alpha into the RGBA-to-YUV conversion.
                if (hasBackground && background.alpha >= 0.999999) {
                    canvas->clear(color_with_alpha(background, 1));
                } else {
                    canvas->clear(SK_ColorBLACK);
                    if (hasBackground && background.alpha > 0) {
                        SkPaint backgroundPaint;
                        backgroundPaint.setAntiAlias(false);
                        backgroundPaint.setColor4f(color_with_alpha(background, 1));
                        canvas->drawRect(SkRect::MakeWH(static_cast<SkScalar>(width),
                                                        static_cast<SkScalar>(height)),
                                         backgroundPaint);
                    }
                }
                renderMilliseconds += milliseconds(renderStart, Clock::now());
                transform.present = false;
                layerDepth = 0;
                layerEffectStack.clear();
            } else if (opcode == 2) {  // setTransform
                if (!read_matrix(reader, transform.matrix) || !reader.value(transform.alpha)) {
                    print_error("protocol", "truncated_transform");
                    return 28;
                }
                uint8_t visible = 0;
                if (!reader.value(visible)) {
                    print_error("protocol", "truncated_transform_visibility");
                    return 29;
                }
                transform.visible = visible != 0;
                transform.present = true;
            } else if (opcode == 3) {  // drawShape
                uint8_t shape = 0;
                uint8_t hasFill = 0;
                uint8_t hasCornerRadius = 0;
                uint8_t hasStroke = 0;
                double shapeWidth = 0;
                double shapeHeight = 0;
                double cornerRadius = 0;
                double fillOpacity = 1;
                double strokeWidth = 0;
                double strokeOpacity = 1;
                Color fill;
                Color stroke;
                PaintSpec fillPaint;
                PaintSpec strokePaint;
                if (!reader.value(shape) || !reader.value(shapeWidth) || !reader.value(shapeHeight) ||
                    !reader.value(hasFill) || (hasFill && !read_color(reader, fill)) ||
                    !reader.value(fillOpacity) || !read_paint(reader, fillPaint) || !reader.value(hasCornerRadius) ||
                    (hasCornerRadius && !reader.value(cornerRadius)) || !reader.value(hasStroke) ||
                    (hasStroke && !read_color(reader, stroke)) || !reader.value(strokeWidth) ||
                    !reader.value(strokeOpacity) || !read_paint(reader, strokePaint)) {
                    print_error("protocol", "truncated_shape");
                    return 30;
                }
                uint32_t pointCount = 0;
                if (!reader.value(pointCount) || pointCount > 100000) {
                    print_error("protocol", "truncated_shape_points");
                    return 30;
                }
                std::vector<SkPoint> points;
                points.reserve(pointCount);
                for (uint32_t pointIndex = 0; pointIndex < pointCount; ++pointIndex) {
                    double pointX = 0;
                    double pointY = 0;
                    if (!reader.value(pointX) || !reader.value(pointY)) {
                        print_error("protocol", "truncated_shape_point");
                        return 30;
                    }
                    points.push_back({static_cast<SkScalar>(pointX), static_cast<SkScalar>(pointY)});
                }
                if (!transform.present || !transform.visible || transform.alpha <= 0) continue;
                const auto renderStart = Clock::now();
                SkCanvas* canvas = surface->getCanvas();
                canvas->save();
                canvas->concat(to_canvas_matrix(projection, transform.matrix, static_cast<int>(width), static_cast<int>(height)));
                const bool antiAlias = !(shape == 1 && !hasCornerRadius &&
                    std::abs(transform.matrix.value[0] - 1) < 1e-9 &&
                    std::abs(transform.matrix.value[5] - 1) < 1e-9);
                bool drawn = false;
                if (shape == 3 && points.size() >= 3) {
                    SkPathBuilder polygonBuilder;
                    polygonBuilder.addPolygon(points, true);
                    SkPath polygon = polygonBuilder.detach();
                    drawn = draw_path(canvas, polygon, fill, hasFill, fillOpacity, fillPaint, stroke, hasStroke,
                                      strokeWidth, strokeOpacity, strokePaint, transform.alpha, 0, antiAlias,
                                      shapeWidth, shapeHeight);
                } else {
                    drawn = draw_shape(canvas, shape, shapeWidth, shapeHeight,
                        hasCornerRadius ? cornerRadius : 0, fill, hasFill, fillPaint, fillOpacity,
                        stroke, hasStroke, strokePaint, strokeWidth, strokeOpacity, transform.alpha, antiAlias);
                }
                canvas->restore();
                renderMilliseconds += milliseconds(renderStart, Clock::now());
                if (!drawn) {
                    print_error("replay", "unsupported_shape");
                    return 31;
                }
            } else if (opcode == 4 || opcode == 6) {  // beginGroup/endGroup: transform is carried by setTransform
                continue;
            } else if (opcode == 5) {  // drawPath
                SkPath path;
                Color fill;
                Color stroke;
                PaintSpec fillPaint;
                PaintSpec strokePaint;
                uint8_t hasFill = 0;
                uint8_t hasStroke = 0;
                uint8_t fillRule = 0;
                double fillOpacity = 1;
                double strokeWidth = 0;
                double strokeOpacity = 1;
                double pathWidth = 1;
                double pathHeight = 1;
                if (!read_path(reader, path) || !reader.value(hasFill) ||
                    (hasFill && !read_color(reader, fill)) || !reader.value(fillOpacity) ||
                    !read_paint(reader, fillPaint) ||
                    !reader.value(hasStroke) || (hasStroke && !read_color(reader, stroke)) ||
                    !reader.value(strokeWidth) || !reader.value(strokeOpacity) ||
                    !read_paint(reader, strokePaint) || !reader.value(fillRule) ||
                    !reader.value(pathWidth) || !reader.value(pathHeight)) {
                    print_error("protocol", "truncated_path");
                    return 40;
                }
                if (!transform.present || !transform.visible || transform.alpha <= 0) continue;
                const auto renderStart = Clock::now();
                SkCanvas* canvas = surface->getCanvas();
                canvas->save();
                canvas->concat(to_canvas_matrix(projection, transform.matrix, static_cast<int>(width), static_cast<int>(height)));
                const bool drawn = draw_path(canvas, path, fill, hasFill, fillOpacity, fillPaint, stroke, hasStroke,
                                              strokeWidth, strokeOpacity, strokePaint, transform.alpha, fillRule, true,
                                              pathWidth, pathHeight);
                canvas->restore();
                renderMilliseconds += milliseconds(renderStart, Clock::now());
                if (!drawn) {
                    print_error("replay", "empty_path_paint");
                    return 41;
                }
            } else if (opcode == 7) {  // drawText using Runtime-shaped SVG glyph outlines
                uint32_t glyphCount = 0;
                Color commandFill;
                PaintSpec commandFillPaint;
                if (!reader.value(glyphCount) || glyphCount > 100000 || !read_color(reader, commandFill) || !read_paint(reader, commandFillPaint)) {
                    print_error("protocol", "truncated_text_header");
                    return 42;
                }
                if (!transform.present || !transform.visible || transform.alpha <= 0) {
                    for (uint32_t glyphIndex = 0; glyphIndex < glyphCount; ++glyphIndex) {
                        std::string ignoredPath;
                        uint8_t ignored = 0;
                        if (!read_string(reader, ignoredPath)) return 42;
                        for (int valueIndex = 0; valueIndex < 7; ++valueIndex) { double value = 0; if (!reader.value(value)) return 42; }
                        if (!reader.value(ignored)) return 42;
                        if (ignored && !read_color(reader, commandFill)) return 42;
                        PaintSpec ignoredPaint;
                        if (!read_paint(reader, ignoredPaint)) return 42;
                        if (!reader.value(ignored)) return 42;
                        if (ignored && !read_color(reader, commandFill)) return 42;
                        double value = 0; if (!reader.value(value) || !reader.value(value)) return 42;
                    }
                    continue;
                }
                std::vector<TextGlyph> glyphs;
                glyphs.reserve(glyphCount);
                for (uint32_t glyphIndex = 0; glyphIndex < glyphCount; ++glyphIndex) {
                    TextGlyph glyph;
                    uint8_t hasFill = 0, hasStroke = 0;
                    std::string pathData;
                    if (!read_string(reader, pathData) || !reader.value(glyph.x) || !reader.value(glyph.y) ||
                        !reader.value(glyph.pathScale) || !reader.value(glyph.outlineX) || !reader.value(glyph.outlineY) ||
                        !reader.value(glyph.rotation) || !reader.value(glyph.scaleX) || !reader.value(hasFill) ||
                        (hasFill && !read_color(reader, glyph.fill)) || !read_paint(reader, glyph.fillPaint) || !reader.value(hasStroke) ||
                        (hasStroke && !read_color(reader, glyph.stroke)) || !reader.value(glyph.strokeWidth) ||
                        !reader.value(glyph.strokeOpacity)) {
                        print_error("protocol", "truncated_text_glyph");
                        return 43;
                    }
                    glyph.hasFill = hasFill != 0;
                    glyph.hasFillPaint = glyph.fillPaint.type != 0;
                    glyph.hasStroke = hasStroke != 0;
                    if (!SkParsePath::FromSVGString(pathData.c_str(), &glyph.path)) {
                        print_error("replay", "invalid_glyph_path");
                        return 44;
                    }
                    glyphs.push_back(std::move(glyph));
                }
                const auto renderStart = Clock::now();
                SkCanvas* canvas = surface->getCanvas();
                canvas->save();
                canvas->concat(to_canvas_matrix(projection, transform.matrix, static_cast<int>(width), static_cast<int>(height)));
                for (const TextGlyph& glyph : glyphs) {
                    const Color& fillColor = glyph.hasFill ? glyph.fill : commandFill;
                    const PaintSpec& fillPaint = glyph.hasFillPaint ? glyph.fillPaint : commandFillPaint;
                    SkPaint paint;
                    paint.setAntiAlias(true);
                    paint.setStyle(SkPaint::kFill_Style);
                    apply_text_paint(paint, fillColor, fillPaint, transform.alpha, static_cast<double>(width), static_cast<double>(height));
                    canvas->save();
                    canvas->concat(text_glyph_matrix(glyph.x, glyph.y, glyph.pathScale, glyph.outlineX, glyph.outlineY, glyph.rotation, glyph.scaleX));
                    canvas->drawPath(glyph.path, paint);
                    if (glyph.hasStroke && glyph.strokeWidth > 0) {
                        SkPaint strokePaint;
                        strokePaint.setAntiAlias(true);
                        strokePaint.setStyle(SkPaint::kStroke_Style);
                        strokePaint.setStrokeWidth(static_cast<SkScalar>(glyph.strokeWidth / std::max(0.0001, glyph.pathScale)));
                        strokePaint.setColor4f(color_with_alpha(glyph.stroke, transform.alpha * glyph.strokeOpacity));
                        canvas->drawPath(glyph.path, strokePaint);
                    }
                    canvas->restore();
                }
                canvas->restore();
                renderMilliseconds += milliseconds(renderStart, Clock::now());
            } else if (opcode == 8) {  // beginLayer
                uint8_t offscreen = 0;
                double compositeAlpha = 1;
                uint8_t blendModeCode = 0;
                if (!reader.value(offscreen) || !reader.value(compositeAlpha) || !reader.value(blendModeCode)) {
                    print_error("protocol", "truncated_layer");
                    return 45;
                }
                bool hasEffectProgram = false;
                EffectProgram effectProgram;
                bool hasBackdropProgram = false;
                EffectProgram backdropProgram;
                EffectBoxSpec effectBox;
                if (!read_effect_program(reader, hasEffectProgram, effectProgram)
                    || !read_effect_program(reader, hasBackdropProgram, backdropProgram)
                    || !read_effect_box(reader, effectBox)) {
                    print_error("protocol", "truncated_layer_effect_program");
                    return 56;
                }
                // backdrop-filter needs SkCanvas's dedicated backdrop-image-filter
                // saveLayer overload, not a plain layer paint — out of scope for
                // this pass. Fail closed instead of silently dropping it.
                if (hasBackdropProgram && !backdropProgram.ops.empty()) {
                    print_error("replay", "unsupported_backdrop_effect");
                    return 57;
                }
                // A single OUTER box-shadow branch reads the same silhouette
                // a plain content-alpha DropShadow filter already produces
                // (the box's real rendered alpha matches its geometry for
                // ordinary filled content), so it is left to build_effect_filter
                // below — exactly like CanvasKit's effectFilterFor, which only
                // routes to its overlay compositor for a genuine multi-shadow
                // list or a single INSET branch. Only those two shapes read
                // box geometry instead of rendered alpha and can never be a
                // plain SkImageFilter on the layer content.
                PendingLayerEffect pendingEffect;
                bool effectIsBoxShadow = false;
                if (hasEffectProgram && program_has_box_alpha_mask(effectProgram)) {
                    std::vector<BoxShadowBranch> boxBranches;
                    const bool parsed = parse_box_shadow_branches(effectProgram, boxBranches);
                    const bool needsOverlay = parsed
                        && (boxBranches.size() > 1 || (boxBranches.size() == 1 && boxBranches[0].inner));
                    if (needsOverlay) {
                        if (!effectBox.present) {
                            print_error("replay", "unsupported_box_effect");
                            return 59;
                        }
                        pendingEffect.hasBoxEffect = true;
                        pendingEffect.boxBranches = std::move(boxBranches);
                        pendingEffect.box = effectBox;
                        effectIsBoxShadow = true;
                    }
                }
                EffectFilterResult effectResult;
                if (!effectIsBoxShadow) {
                    effectResult = build_effect_filter(hasEffectProgram, effectProgram);
                    if (!effectResult.supported) {
                        print_error("replay", "unsupported_effect_program");
                        return 58;
                    }
                }
                const bool hasEffect = effectResult.filter != nullptr;
                // Wire order for blendModeCode must match NATIVE_BLEND_MODES in
                // native-protocol.ts exactly (positional protocol, not
                // self-describing).
                static const SkBlendMode kBlendModes[] = {
                    SkBlendMode::kSrcOver,     // normal
                    SkBlendMode::kDarken,
                    SkBlendMode::kMultiply,
                    SkBlendMode::kColorBurn,
                    SkBlendMode::kLighten,
                    SkBlendMode::kScreen,
                    SkBlendMode::kColorDodge,
                    SkBlendMode::kOverlay,
                    SkBlendMode::kSoftLight,
                    SkBlendMode::kHardLight,
                    SkBlendMode::kDifference,
                    SkBlendMode::kExclusion,
                    SkBlendMode::kHue,
                    SkBlendMode::kSaturation,
                    SkBlendMode::kColor,
                    SkBlendMode::kLuminosity,
                };
                if (blendModeCode >= 16) {
                    print_error("protocol", "invalid_blend_mode");
                    return 55;
                }
                const bool hasBlend = blendModeCode > 0;
                SkPaint layerPaint;
                layerPaint.setAlphaf(static_cast<SkScalar>(std::max(0.0, std::min(1.0, compositeAlpha))));
                if (hasBlend) layerPaint.setBlendMode(kBlendModes[blendModeCode]);
                if (hasEffect) layerPaint.setImageFilter(effectResult.filter);
                const auto compositeStart = Clock::now();
                // A non-normal blend mode or an effect filter only takes effect
                // through saveLayer: it is applied to layerPaint when the layer
                // composites back onto its parent at restore(); a plain save()
                // has no paint and would silently drop both, same failure mode
                // the missing blendMode wire field had before that fix.
                if (offscreen || compositeAlpha < 0.999999 || hasBlend || hasEffect || effectIsBoxShadow) {
                    surface->getCanvas()->saveLayer(nullptr, &layerPaint);
                } else {
                    surface->getCanvas()->save();
                }
                const double compositeElapsed = milliseconds(compositeStart, Clock::now());
                compositeMilliseconds += compositeElapsed;
                renderMilliseconds += compositeElapsed;
                layerDepth += 1;
                layerEffectStack.push_back(std::move(pendingEffect));
            } else if (opcode == 9) {  // endLayer
                if (layerDepth == 0) {
                    print_error("replay", "layer_underflow");
                    return 46;
                }
                const auto compositeStart = Clock::now();
                if (!layerEffectStack.empty()) {
                    const PendingLayerEffect& pendingEffect = layerEffectStack.back();
                    if (pendingEffect.hasBoxEffect) {
                        draw_box_effect(surface->getCanvas(), pendingEffect.boxBranches, pendingEffect.box,
                            projection, width, height);
                    }
                    layerEffectStack.pop_back();
                }
                surface->getCanvas()->restore();
                const double compositeElapsed = milliseconds(compositeStart, Clock::now());
                compositeMilliseconds += compositeElapsed;
                renderMilliseconds += compositeElapsed;
                layerDepth -= 1;
            } else if (opcode == 10) {  // drawSolid
                Color fill;
                double solidWidth = 0, solidHeight = 0;
                if (!read_color(reader, fill) || !reader.value(solidWidth) || !reader.value(solidHeight)) {
                    print_error("protocol", "truncated_solid");
                    return 47;
                }
                if (!transform.present || !transform.visible || transform.alpha <= 0) continue;
                const auto renderStart = Clock::now();
                SkCanvas* canvas = surface->getCanvas();
                canvas->save();
                canvas->concat(to_canvas_matrix(projection, transform.matrix, static_cast<int>(width), static_cast<int>(height)));
                SkPaint paint;
                paint.setAntiAlias(false);
                paint.setColor4f(color_with_alpha(fill, transform.alpha));
                canvas->drawRect(SkRect::MakeWH(static_cast<SkScalar>(solidWidth), static_cast<SkScalar>(solidHeight)), paint);
                canvas->restore();
                renderMilliseconds += milliseconds(renderStart, Clock::now());
            } else if (opcode == 0xFF) {  // endFrame
                sawEndFrame = true;
                if (surfaceMode == SurfaceMode::CopyReadback) {
                    const auto readbackStart = Clock::now();
                    if (!surface->readPixels(imageInfo, pixels.data(), rowBytes, 0, 0)) {
                        print_error("readback", "SkSurface_readPixels_failed");
                        return 32;
                    }
                    readbackMilliseconds += milliseconds(readbackStart, Clock::now());
                }
                const uint32_t currentFrame = static_cast<uint32_t>(frames);
                for (int sample = 0; sample < 3; ++sample) {
                    if (currentFrame != sampleFrames[sample]) continue;
                    for (size_t pixel = 0; pixel + 3 < pixels.size(); pixel += 4) {
                        rawSampleHashes[sample] ^= static_cast<uint32_t>(pixels[pixel + 0]);
                        rawSampleHashes[sample] *= 16777619U;
                        rawSampleHashes[sample] ^= static_cast<uint32_t>(pixels[pixel + 1]);
                        rawSampleHashes[sample] *= 16777619U;
                        rawSampleHashes[sample] ^= static_cast<uint32_t>(pixels[pixel + 2]);
                        rawSampleHashes[sample] *= 16777619U;
                        rawSampleHashes[sample] ^= static_cast<uint32_t>(pixels[pixel + 3]);
                        rawSampleHashes[sample] *= 16777619U;
                        if (pixels[pixel + 3] != 255) alphaSamplesOpaque = false;
                    }
                }
                if (rawOutput) {
                    const auto writeStart = Clock::now();
                    const size_t expected = pixels.size();
                    const size_t written = std::fwrite(pixels.data(), 1, expected, stdout);
                    rawWriteMilliseconds += milliseconds(writeStart, Clock::now());
                    if (written != expected) {
                        print_error("raw_output", "stdout_write_failed");
                        return 33;
                    }
                    bytesWritten += written;
                }
                if (inProcessEncoding) {
                    std::string encoderError;
                    if (!encoder.submit(pixels, frames, encoderError)) {
                        std::fprintf(stderr, "{\"ok\":false,\"phase\":\"encoder_submit\",\"error\":\"%s\"}\n", encoderError.c_str());
                        return 50;
                    }
                }
                frames += 1;
            } else {
                print_error("protocol", "unsupported_opcode");
                return 34;
            }
        }
        if (!sawEndFrame) {
            print_error("protocol", "missing_end_frame");
            return 35;
        }
    }

    if (!ended || frames == 0) {
        print_error("protocol", "missing_end_stream_or_frames");
        return 36;
    }
    if (inProcessEncoding) {
        std::string encoderError;
        if (!encoder.finish(encoderError)) {
            std::fprintf(stderr, "{\"ok\":false,\"phase\":\"encoder_finalize\",\"error\":\"%s\"}\n", encoderError.c_str());
            return 51;
        }
    }
    if (!inProcessEncoding) {
        if (!write_ppm(outputPath, pixels, static_cast<int>(width), static_cast<int>(height))) {
            print_error("write_output", "PPM_write_failed");
            return 37;
        }
    }
    std::fflush(stdout);
    const auto totalReady = Clock::now();
    const double totalProcessMilliseconds = milliseconds(totalStart, totalReady);
    // These stages execute serially in the current in-process path. The
    // residual is protocol/setup/output overhead; unlike the old
    // protocolDecode timer it does not include color conversion or encoding.
    const double accountedMilliseconds = renderMilliseconds + readbackMilliseconds +
        rawWriteMilliseconds + encoder.conversion_milliseconds() +
        encoder.encode_milliseconds() + encoder.finalize_milliseconds();
    const double protocolOverheadMilliseconds =
        std::max(0.0, totalProcessMilliseconds - accountedMilliseconds);
    std::fprintf(stderr,
        "{\"ok\":true,\"requestedBackend\":\"skia-cpu-command-buffer\",\"actualBackend\":\"skia-native-raster\",\"surfaceKind\":\"%s\",\"surfaceMode\":\"%s\",\"softwareRenderer\":true,\"inProcessEncoding\":%s,\"colorConverter\":\"%s\",\"surfaceAlphaType\":\"opaque\",\"surfaceColorSpace\":\"srgb\",\"videoColorSpace\":\"bt709\",\"videoColorRange\":\"limited\",\"alphaSamplesOpaque\":%s,\"width\":%u,\"height\":%u,\"frames\":%llu,\"bytesWritten\":%llu,\"rawSampleHashFnv1a32\":{\"frame0\":\"%08x\",\"frameMid\":\"%08x\",\"frameLast\":\"%08x\"},\"yuvSampleHashFnv1a32\":{\"frame0\":\"%08x\",\"frameMid\":\"%08x\",\"frameLast\":\"%08x\"},\"colorComparison\":{\"enabled\":%s,\"referenceConverter\":\"%s\",\"samples\":%llu,\"exactSamples\":%llu,\"within1Samples\":%llu,\"within2Samples\":%llu,\"maxAbsDiff\":%u,\"meanAbsDiff\":%.6f,\"milliseconds\":%.3f},\"colorComparisonByPlane\":[{\"plane\":\"Y\",\"samples\":%llu,\"exactSamples\":%llu,\"within1Samples\":%llu,\"within2Samples\":%llu,\"meanAbsDiff\":%.6f,\"maxAbsDiff\":%u},{\"plane\":\"U\",\"samples\":%llu,\"exactSamples\":%llu,\"within1Samples\":%llu,\"within2Samples\":%llu,\"meanAbsDiff\":%.6f,\"maxAbsDiff\":%u},{\"plane\":\"V\",\"samples\":%llu,\"exactSamples\":%llu,\"within1Samples\":%llu,\"within2Samples\":%llu,\"meanAbsDiff\":%.6f,\"maxAbsDiff\":%u}],\"timingsMs\":{\"protocolOverhead\":%.3f,\"render\":%.3f,\"composite\":%.3f,\"readback\":%.3f,\"rawWrite\":%.3f,\"colorConvert\":%.3f,\"encode\":%.3f,\"mux\":%.3f,\"finalize\":%.3f,\"totalProcess\":%.3f}}\n",
        surfaceMode == SurfaceMode::DirectRaster ? "raster-direct" : "raster",
        surface_mode_name(surfaceMode),
        inProcessEncoding ? "true" : "false", encoder.converter_name(), alphaSamplesOpaque ? "true" : "false", width, height, static_cast<unsigned long long>(frames), static_cast<unsigned long long>(bytesWritten),
        rawSampleHashes[0], rawSampleHashes[1], rawSampleHashes[2],
        encoder.yuv_sample_hash(0), encoder.yuv_sample_hash(1), encoder.yuv_sample_hash(2),
        encoder.comparison_enabled() ? "true" : "false", encoder.reference_converter_name(),
        static_cast<unsigned long long>(encoder.comparison_total_samples()),
        static_cast<unsigned long long>(encoder.comparison_exact_samples()),
        static_cast<unsigned long long>(encoder.comparison_within1_samples()),
        static_cast<unsigned long long>(encoder.comparison_within2_samples()),
        encoder.comparison_max_abs_diff(), encoder.comparison_mean_abs_diff(), encoder.comparison_milliseconds(),
        static_cast<unsigned long long>(encoder.comparison_plane_total(0)),
        static_cast<unsigned long long>(encoder.comparison_plane_exact(0)),
        static_cast<unsigned long long>(encoder.comparison_plane_within1(0)),
        static_cast<unsigned long long>(encoder.comparison_plane_within2(0)),
        encoder.comparison_plane_mean_abs_diff(0), encoder.comparison_plane_max_abs_diff(0),
        static_cast<unsigned long long>(encoder.comparison_plane_total(1)),
        static_cast<unsigned long long>(encoder.comparison_plane_exact(1)),
        static_cast<unsigned long long>(encoder.comparison_plane_within1(1)),
        static_cast<unsigned long long>(encoder.comparison_plane_within2(1)),
        encoder.comparison_plane_mean_abs_diff(1), encoder.comparison_plane_max_abs_diff(1),
        static_cast<unsigned long long>(encoder.comparison_plane_total(2)),
        static_cast<unsigned long long>(encoder.comparison_plane_exact(2)),
        static_cast<unsigned long long>(encoder.comparison_plane_within1(2)),
        static_cast<unsigned long long>(encoder.comparison_plane_within2(2)),
        encoder.comparison_plane_mean_abs_diff(2), encoder.comparison_plane_max_abs_diff(2),
        protocolOverheadMilliseconds, renderMilliseconds, compositeMilliseconds, readbackMilliseconds, rawWriteMilliseconds,
        encoder.conversion_milliseconds(), encoder.encode_milliseconds(), encoder.mux_milliseconds(), encoder.finalize_milliseconds(),
        totalProcessMilliseconds);
    return 0;
}

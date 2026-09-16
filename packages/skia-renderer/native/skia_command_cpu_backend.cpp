// Native Skia CPU command-buffer benchmark host.
//
// This process deliberately owns only the raster/replay side of the native
// benchmark. TypeScript evaluates the canonical RuntimeProjectV3 and sends a
// versioned binary subset of its PaintCommandBuffer. The subset is sufficient
// for the benchmark fixture (beginFrame, setTransform, drawShape, endFrame);
// unsupported commands fail closed instead of being silently approximated.

#include "include/core/SkCanvas.h"
#include "include/core/SkColor.h"
#include "include/core/SkImageInfo.h"
#include "include/core/SkMatrix.h"
#include "include/core/SkPaint.h"
#include "include/core/SkRect.h"
#include "include/core/SkSurface.h"

#include <algorithm>
#include <chrono>
#include <cmath>
#include <cstdint>
#include <cstdio>
#include <cstdlib>
#include <cstring>
#include <fstream>
#include <iostream>
#include <string>
#include <vector>

namespace {

using Clock = std::chrono::steady_clock;

double milliseconds(Clock::time_point start, Clock::time_point end) {
    return std::chrono::duration<double, std::milli>(end - start).count();
}

void print_error(const char* phase, const char* message) {
    std::fprintf(stderr, "{\"ok\":false,\"phase\":\"%s\",\"error\":\"%s\"}\n", phase,
                 message);
}

struct Matrix4 {
    double value[16]{};
};

struct Color {
    double red = 0;
    double green = 0;
    double blue = 0;
    double alpha = 1;
};

struct Transform {
    Matrix4 matrix{};
    double alpha = 1;
    bool visible = true;
    bool present = false;
};

Matrix4 identity_matrix() {
    Matrix4 result{};
    result.value[0] = 1;
    result.value[5] = 1;
    result.value[10] = 1;
    result.value[15] = 1;
    return result;
}

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

bool read_matrix(Reader& reader, Matrix4& matrix) {
    return reader.bytes(matrix.value, sizeof(matrix.value));
}

bool read_color(Reader& reader, Color& color) {
    return reader.value(color.red) && reader.value(color.green) &&
           reader.value(color.blue) && reader.value(color.alpha);
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

bool draw_shape(SkCanvas* canvas, uint8_t shape, double width, double height,
                double corner_radius, const Color& fill, bool has_fill,
                double fill_opacity, const Color& stroke, bool has_stroke,
                double stroke_width, double stroke_opacity, double transform_alpha,
                bool anti_alias) {
    if (has_fill) {
        SkPaint paint;
        paint.setAntiAlias(anti_alias);
        paint.setStyle(SkPaint::kFill_Style);
        paint.setColor4f(color_with_alpha(fill, transform_alpha * fill_opacity));
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

}  // namespace

int main(int argc, char** argv) {
    std::string outputPath;
    bool rawOutput = true;
    for (int index = 1; index < argc; ++index) {
        if (std::strcmp(argv[index], "--output") == 0 && index + 1 < argc) {
            outputPath = argv[++index];
        } else if (std::strcmp(argv[index], "--no-raw") == 0) {
            rawOutput = false;
        } else if (std::strcmp(argv[index], "--raw") == 0) {
            rawOutput = true;
        }
    }

    const auto totalStart = Clock::now();
    Reader reader(std::cin);
    const char expectedMagic[8] = {'N', 'X', 'S', 'K', 'I', 'A', '0', '1'};
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
    const SkImageInfo imageInfo = SkImageInfo::Make(
        static_cast<int>(width), static_cast<int>(height), kRGBA_8888_SkColorType, kPremul_SkAlphaType);
    sk_sp<SkSurface> surface = SkSurfaces::Raster(imageInfo);
    if (!surface) {
        print_error("create_surface", "SkSurfaces_Raster_failed");
        return 22;
    }
    std::vector<uint8_t> pixels(static_cast<size_t>(width) * static_cast<size_t>(height) * 4);
    Matrix4 projection = identity_matrix();
    Transform transform;
    uint64_t frames = 0;
    uint64_t bytesWritten = 0;
    uint32_t rawSampleHashes[3] = {2166136261U, 2166136261U, 2166136261U};
    const uint32_t sampleFrames[3] = {0, expectedFrames / 2, expectedFrames - 1};
    double protocolMilliseconds = 0;
    double renderMilliseconds = 0;
    double readbackMilliseconds = 0;
    double rawWriteMilliseconds = 0;
    bool ended = false;

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
        const auto frameProtocolStart = Clock::now();
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
                if (hasBackground) {
                    surface->getCanvas()->clear(color_with_alpha(background, 1));
                } else {
                    surface->getCanvas()->clear(SK_ColorTRANSPARENT);
                }
                renderMilliseconds += milliseconds(renderStart, Clock::now());
                transform.present = false;
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
                if (!reader.value(shape) || !reader.value(shapeWidth) || !reader.value(shapeHeight) ||
                    !reader.value(hasFill) || (hasFill && !read_color(reader, fill)) ||
                    !reader.value(fillOpacity) || !reader.value(hasCornerRadius) ||
                    (hasCornerRadius && !reader.value(cornerRadius)) || !reader.value(hasStroke) ||
                    (hasStroke && !read_color(reader, stroke)) || !reader.value(strokeWidth) ||
                    !reader.value(strokeOpacity)) {
                    print_error("protocol", "truncated_shape");
                    return 30;
                }
                if (!transform.present || !transform.visible || transform.alpha <= 0) continue;
                const auto renderStart = Clock::now();
                SkCanvas* canvas = surface->getCanvas();
                canvas->save();
                canvas->concat(to_canvas_matrix(projection, transform.matrix, static_cast<int>(width), static_cast<int>(height)));
                const bool antiAlias = !(shape == 1 && !hasCornerRadius &&
                    std::abs(transform.matrix.value[0] - 1) < 1e-9 &&
                    std::abs(transform.matrix.value[5] - 1) < 1e-9);
                const bool drawn = draw_shape(canvas, shape, shapeWidth, shapeHeight,
                    hasCornerRadius ? cornerRadius : 0, fill, hasFill, fillOpacity,
                    stroke, hasStroke, strokeWidth, strokeOpacity, transform.alpha, antiAlias);
                canvas->restore();
                renderMilliseconds += milliseconds(renderStart, Clock::now());
                if (!drawn) {
                    print_error("replay", "unsupported_shape");
                    return 31;
                }
            } else if (opcode == 0xFF) {  // endFrame
                sawEndFrame = true;
                const auto readbackStart = Clock::now();
                if (!surface->readPixels(imageInfo, pixels.data(), static_cast<size_t>(width) * 4, 0, 0)) {
                    print_error("readback", "SkSurface_readPixels_failed");
                    return 32;
                }
                readbackMilliseconds += milliseconds(readbackStart, Clock::now());
                if (rawOutput) {
                    const uint32_t currentFrame = static_cast<uint32_t>(frames);
                    for (int sample = 0; sample < 3; ++sample) {
                        if (currentFrame != sampleFrames[sample]) continue;
                        for (const uint8_t byte : pixels) {
                            rawSampleHashes[sample] ^= static_cast<uint32_t>(byte);
                            rawSampleHashes[sample] *= 16777619U;
                        }
                    }
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
        protocolMilliseconds += milliseconds(frameProtocolStart, Clock::now());
    }

    if (!ended || frames == 0) {
        print_error("protocol", "missing_end_stream_or_frames");
        return 36;
    }
    if (!write_ppm(outputPath, pixels, static_cast<int>(width), static_cast<int>(height))) {
        print_error("write_output", "PPM_write_failed");
        return 37;
    }
    std::fflush(stdout);
    const auto totalReady = Clock::now();
    std::fprintf(stderr,
        "{\"ok\":true,\"requestedBackend\":\"skia-cpu-command-buffer\",\"actualBackend\":\"skia-native-raster\",\"surfaceKind\":\"raster\",\"softwareRenderer\":true,\"width\":%u,\"height\":%u,\"frames\":%llu,\"bytesWritten\":%llu,\"rawSampleHashFnv1a32\":{\"frame0\":\"%08x\",\"frameMid\":\"%08x\",\"frameLast\":\"%08x\"},\"timingsMs\":{\"protocolDecode\":%.3f,\"render\":%.3f,\"readback\":%.3f,\"rawWrite\":%.3f,\"totalProcess\":%.3f}}\n",
        width, height, static_cast<unsigned long long>(frames), static_cast<unsigned long long>(bytesWritten),
        rawSampleHashes[0], rawSampleHashes[1], rawSampleHashes[2],
        protocolMilliseconds, renderMilliseconds, readbackMilliseconds, rawWriteMilliseconds,
        milliseconds(totalStart, totalReady));
    return 0;
}

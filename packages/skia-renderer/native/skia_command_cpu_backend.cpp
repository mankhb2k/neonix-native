// Native Skia CPU command-buffer benchmark host.
//
// This process deliberately owns only the raster/replay side of the native
// benchmark. TypeScript evaluates the canonical RuntimeProjectV3 and sends a
// versioned binary subset of its PaintCommandBuffer. The subset is sufficient
// for the benchmark fixture (beginFrame, setTransform, drawShape, endFrame);
// unsupported commands fail closed instead of being silently approximated.

#include "include/core/SkCanvas.h"
#include "include/core/SkColor.h"
#include "include/core/SkColorSpace.h"
#include "include/core/SkImageInfo.h"
#include "include/core/SkMatrix.h"
#include "include/core/SkPaint.h"
#include "include/core/SkPath.h"
#include "include/core/SkPathBuilder.h"
#include "include/core/SkRect.h"
#include "include/core/SkSurface.h"
#include "include/utils/SkParsePath.h"

extern "C" {
#include <libavcodec/avcodec.h>
#include <libavformat/avformat.h>
#include <libavutil/avutil.h>
#include <libavutil/error.h>
#include <libavutil/imgutils.h>
#include <libavutil/opt.h>
#include <libswscale/swscale.h>
}

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
#include <utility>
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
    bool hasStroke = false;
    Color stroke;
    double strokeWidth = 0;
    double strokeOpacity = 1;
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

std::string ffmpeg_error(int error) {
    char buffer[AV_ERROR_MAX_STRING_SIZE]{};
    av_strerror(error, buffer, sizeof(buffer));
    return std::string(buffer);
}

class InProcessEncoder {
public:
    ~InProcessEncoder() {
        close(false);
    }

    bool open(const std::string& path, int width, int height, int fps, std::string& error) {
        width_ = width;
        height_ = height;
        fps_ = fps;
        int result = avformat_alloc_output_context2(&formatContext_, nullptr, "mp4", path.c_str());
        if (result < 0 || !formatContext_) {
            error = "avformat_alloc_output_context2: " + ffmpeg_error(result);
            return false;
        }

        const AVCodec* codec = avcodec_find_encoder_by_name("libx264");
        if (!codec) {
            error = "libx264 encoder is unavailable";
            return false;
        }
        stream_ = avformat_new_stream(formatContext_, nullptr);
        codecContext_ = avcodec_alloc_context3(codec);
        if (!stream_ || !codecContext_) {
            error = "could not allocate FFmpeg stream/context";
            return false;
        }
        codecContext_->codec_id = codec->id;
        codecContext_->codec_type = AVMEDIA_TYPE_VIDEO;
        codecContext_->width = width_;
        codecContext_->height = height_;
        codecContext_->time_base = AVRational{1, fps_};
        codecContext_->framerate = AVRational{fps_, 1};
        codecContext_->pix_fmt = AV_PIX_FMT_YUV420P;
        codecContext_->color_range = AVCOL_RANGE_MPEG;
        codecContext_->color_primaries = AVCOL_PRI_BT709;
        codecContext_->color_trc = AVCOL_TRC_BT709;
        codecContext_->colorspace = AVCOL_SPC_BT709;
        codecContext_->chroma_sample_location = AVCHROMA_LOC_CENTER;
        codecContext_->gop_size = fps_ * 2;
        codecContext_->max_b_frames = 2;
        av_opt_set(codecContext_->priv_data, "preset", "veryfast", 0);
        av_opt_set(codecContext_->priv_data, "crf", "23", 0);
        if (formatContext_->oformat->flags & AVFMT_GLOBALHEADER) {
            codecContext_->flags |= AV_CODEC_FLAG_GLOBAL_HEADER;
        }
        result = avcodec_open2(codecContext_, codec, nullptr);
        if (result < 0) {
            error = "avcodec_open2: " + ffmpeg_error(result);
            return false;
        }
        result = avcodec_parameters_from_context(stream_->codecpar, codecContext_);
        if (result < 0) {
            error = "avcodec_parameters_from_context: " + ffmpeg_error(result);
            return false;
        }
        stream_->time_base = codecContext_->time_base;
        if (!(formatContext_->oformat->flags & AVFMT_NOFILE)) {
            result = avio_open(&formatContext_->pb, path.c_str(), AVIO_FLAG_WRITE);
            if (result < 0) {
                error = "avio_open: " + ffmpeg_error(result);
                return false;
            }
        }
        result = avformat_write_header(formatContext_, nullptr);
        if (result < 0) {
            error = "avformat_write_header: " + ffmpeg_error(result);
            return false;
        }
        frame_ = av_frame_alloc();
        packet_ = av_packet_alloc();
        if (!frame_ || !packet_) {
            error = "could not allocate AVFrame/AVPacket";
            return false;
        }
        frame_->format = codecContext_->pix_fmt;
        frame_->width = width_;
        frame_->height = height_;
        frame_->color_range = codecContext_->color_range;
        frame_->color_primaries = codecContext_->color_primaries;
        frame_->color_trc = codecContext_->color_trc;
        frame_->colorspace = codecContext_->colorspace;
        frame_->chroma_location = codecContext_->chroma_sample_location;
        result = av_frame_get_buffer(frame_, 32);
        if (result < 0) {
            error = "av_frame_get_buffer: " + ffmpeg_error(result);
            return false;
        }
        swsContext_ = sws_getContext(
            width_, height_, AV_PIX_FMT_RGBA,
            width_, height_, AV_PIX_FMT_YUV420P,
            SWS_BILINEAR, nullptr, nullptr, nullptr);
        if (!swsContext_) {
            error = "sws_getContext failed";
            return false;
        }
        opened_ = true;
        return true;
    }

    bool submit(const std::vector<uint8_t>& rgba, uint64_t frameIndex, std::string& error) {
        if (!opened_ || rgba.size() < static_cast<size_t>(width_) * static_cast<size_t>(height_) * 4) {
            error = "invalid encoder input frame";
            return false;
        }
        int result = av_frame_make_writable(frame_);
        if (result < 0) {
            error = "av_frame_make_writable: " + ffmpeg_error(result);
            return false;
        }
        const auto conversionStart = Clock::now();
        const uint8_t* source[] = {rgba.data()};
        const int sourceStride[] = {width_ * 4};
        if (sws_scale(swsContext_, source, sourceStride, 0, height_, frame_->data, frame_->linesize) <= 0) {
            error = "sws_scale failed";
            return false;
        }
        conversionMilliseconds_ += milliseconds(conversionStart, Clock::now());
        frame_->pts = static_cast<int64_t>(frameIndex);
        const auto encodeStart = Clock::now();
        result = avcodec_send_frame(codecContext_, frame_);
        if (result < 0) {
            error = "avcodec_send_frame: " + ffmpeg_error(result);
            return false;
        }
        if (!drain(error)) return false;
        encodeMilliseconds_ += milliseconds(encodeStart, Clock::now());
        return true;
    }

    bool finish(std::string& error) {
        if (!opened_ || finished_) return true;
        const auto finalizeStart = Clock::now();
        int result = avcodec_send_frame(codecContext_, nullptr);
        if (result < 0 && result != AVERROR_EOF) {
            error = "avcodec_send_frame(flush): " + ffmpeg_error(result);
            return false;
        }
        if (!drain(error)) return false;
        result = av_write_trailer(formatContext_);
        if (result < 0) {
            error = "av_write_trailer: " + ffmpeg_error(result);
            return false;
        }
        finalizeMilliseconds_ = milliseconds(finalizeStart, Clock::now());
        finished_ = true;
        return true;
    }

    double conversion_milliseconds() const { return conversionMilliseconds_; }
    double encode_milliseconds() const { return encodeMilliseconds_; }
    double mux_milliseconds() const { return muxMilliseconds_; }
    double finalize_milliseconds() const { return finalizeMilliseconds_; }

private:
    bool drain(std::string& error) {
        while (true) {
            const auto muxStart = Clock::now();
            const int result = avcodec_receive_packet(codecContext_, packet_);
            if (result == AVERROR(EAGAIN) || result == AVERROR_EOF) return true;
            if (result < 0) {
                error = "avcodec_receive_packet: " + ffmpeg_error(result);
                return false;
            }
            av_packet_rescale_ts(packet_, codecContext_->time_base, stream_->time_base);
            packet_->stream_index = stream_->index;
            const int muxResult = av_interleaved_write_frame(formatContext_, packet_);
            muxMilliseconds_ += milliseconds(muxStart, Clock::now());
            av_packet_unref(packet_);
            if (muxResult < 0) {
                error = "av_interleaved_write_frame: " + ffmpeg_error(muxResult);
                return false;
            }
        }
    }

    void close(bool) {
        if (formatContext_ && !finished_) {
            av_write_trailer(formatContext_);
        }
        if (swsContext_) sws_freeContext(swsContext_);
        if (packet_) av_packet_free(&packet_);
        if (frame_) av_frame_free(&frame_);
        if (codecContext_) avcodec_free_context(&codecContext_);
        if (formatContext_) {
            if (!(formatContext_->oformat->flags & AVFMT_NOFILE) && formatContext_->pb) avio_closep(&formatContext_->pb);
            avformat_free_context(formatContext_);
        }
        formatContext_ = nullptr;
        codecContext_ = nullptr;
        stream_ = nullptr;
        swsContext_ = nullptr;
        frame_ = nullptr;
        packet_ = nullptr;
    }

    AVFormatContext* formatContext_ = nullptr;
    AVCodecContext* codecContext_ = nullptr;
    AVStream* stream_ = nullptr;
    SwsContext* swsContext_ = nullptr;
    AVFrame* frame_ = nullptr;
    AVPacket* packet_ = nullptr;
    int width_ = 0;
    int height_ = 0;
    int fps_ = 0;
    bool opened_ = false;
    bool finished_ = false;
    double conversionMilliseconds_ = 0;
    double encodeMilliseconds_ = 0;
    double muxMilliseconds_ = 0;
    double finalizeMilliseconds_ = 0;
};

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

bool draw_path(SkCanvas* canvas, SkPath& path, const Color& fill, bool hasFill,
               double fillOpacity, const Color& stroke, bool hasStroke,
               double strokeWidth, double strokeOpacity, double transformAlpha,
               uint8_t fillRule, bool antiAlias) {
    path.setFillType(fillRule == 1 ? SkPathFillType::kEvenOdd : SkPathFillType::kWinding);
    if (hasFill) {
        SkPaint paint;
        paint.setAntiAlias(antiAlias);
        paint.setStyle(SkPaint::kFill_Style);
        paint.setColor4f(color_with_alpha(fill, transformAlpha * fillOpacity));
        canvas->drawPath(path, paint);
    }
    if (hasStroke) {
        SkPaint paint;
        paint.setAntiAlias(true);
        paint.setStyle(SkPaint::kStroke_Style);
        paint.setStrokeWidth(static_cast<SkScalar>(std::max(0.0, strokeWidth)));
        paint.setColor4f(color_with_alpha(stroke, transformAlpha * strokeOpacity));
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

}  // namespace

int main(int argc, char** argv) {
    std::string outputPath;
    std::string inputPath;
    bool rawOutput = true;
    bool inProcessEncoding = false;
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
    if (inProcessEncoding && outputPath.empty()) {
        print_error("encoder", "in_process_output_path_required");
        return 48;
    }
    const SkImageInfo imageInfo = SkImageInfo::Make(
        static_cast<int>(width), static_cast<int>(height), kRGBA_8888_SkColorType,
        kOpaque_SkAlphaType, SkColorSpace::MakeSRGB());
    sk_sp<SkSurface> surface = SkSurfaces::Raster(imageInfo);
    if (!surface) {
        print_error("create_surface", "SkSurfaces_Raster_failed");
        return 22;
    }
    InProcessEncoder encoder;
    if (inProcessEncoding) {
        std::string encoderError;
        if (!encoder.open(outputPath, static_cast<int>(width), static_cast<int>(height), 30, encoderError)) {
            std::fprintf(stderr, "{\"ok\":false,\"phase\":\"encoder_open\",\"error\":\"%s\"}\n", encoderError.c_str());
            return 49;
        }
    }
    std::vector<uint8_t> pixels(static_cast<size_t>(width) * static_cast<size_t>(height) * 4);
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
                    drawn = draw_path(canvas, polygon, fill, hasFill, fillOpacity, stroke, hasStroke,
                                      strokeWidth, strokeOpacity, transform.alpha, 0, antiAlias);
                } else {
                    drawn = draw_shape(canvas, shape, shapeWidth, shapeHeight,
                        hasCornerRadius ? cornerRadius : 0, fill, hasFill, fillOpacity,
                        stroke, hasStroke, strokeWidth, strokeOpacity, transform.alpha, antiAlias);
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
                uint8_t hasFill = 0;
                uint8_t hasStroke = 0;
                uint8_t fillRule = 0;
                double fillOpacity = 1;
                double strokeWidth = 0;
                double strokeOpacity = 1;
                if (!read_path(reader, path) || !reader.value(hasFill) ||
                    (hasFill && !read_color(reader, fill)) || !reader.value(fillOpacity) ||
                    !reader.value(hasStroke) || (hasStroke && !read_color(reader, stroke)) ||
                    !reader.value(strokeWidth) || !reader.value(strokeOpacity) || !reader.value(fillRule)) {
                    print_error("protocol", "truncated_path");
                    return 40;
                }
                if (!transform.present || !transform.visible || transform.alpha <= 0) continue;
                const auto renderStart = Clock::now();
                SkCanvas* canvas = surface->getCanvas();
                canvas->save();
                canvas->concat(to_canvas_matrix(projection, transform.matrix, static_cast<int>(width), static_cast<int>(height)));
                const bool drawn = draw_path(canvas, path, fill, hasFill, fillOpacity, stroke, hasStroke,
                                              strokeWidth, strokeOpacity, transform.alpha, fillRule, true);
                canvas->restore();
                renderMilliseconds += milliseconds(renderStart, Clock::now());
                if (!drawn) {
                    print_error("replay", "empty_path_paint");
                    return 41;
                }
            } else if (opcode == 7) {  // drawText using Runtime-shaped SVG glyph outlines
                uint32_t glyphCount = 0;
                Color commandFill;
                if (!reader.value(glyphCount) || glyphCount > 100000 || !read_color(reader, commandFill)) {
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
                        (hasFill && !read_color(reader, glyph.fill)) || !reader.value(hasStroke) ||
                        (hasStroke && !read_color(reader, glyph.stroke)) || !reader.value(glyph.strokeWidth) ||
                        !reader.value(glyph.strokeOpacity)) {
                        print_error("protocol", "truncated_text_glyph");
                        return 43;
                    }
                    glyph.hasFill = hasFill != 0;
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
                    SkPaint paint;
                    paint.setAntiAlias(true);
                    paint.setStyle(SkPaint::kFill_Style);
                    paint.setColor4f(color_with_alpha(fillColor, transform.alpha));
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
                if (!reader.value(offscreen) || !reader.value(compositeAlpha)) {
                    print_error("protocol", "truncated_layer");
                    return 45;
                }
                SkPaint layerPaint;
                layerPaint.setAlphaf(static_cast<SkScalar>(std::max(0.0, std::min(1.0, compositeAlpha))));
                const auto compositeStart = Clock::now();
                if (offscreen || compositeAlpha < 0.999999) surface->getCanvas()->saveLayer(nullptr, &layerPaint);
                else surface->getCanvas()->save();
                const double compositeElapsed = milliseconds(compositeStart, Clock::now());
                compositeMilliseconds += compositeElapsed;
                renderMilliseconds += compositeElapsed;
                layerDepth += 1;
            } else if (opcode == 9) {  // endLayer
                if (layerDepth == 0) {
                    print_error("replay", "layer_underflow");
                    return 46;
                }
                const auto compositeStart = Clock::now();
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
                const auto readbackStart = Clock::now();
                if (!surface->readPixels(imageInfo, pixels.data(), static_cast<size_t>(width) * 4, 0, 0)) {
                    print_error("readback", "SkSurface_readPixels_failed");
                    return 32;
                }
                readbackMilliseconds += milliseconds(readbackStart, Clock::now());
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
        "{\"ok\":true,\"requestedBackend\":\"skia-cpu-command-buffer\",\"actualBackend\":\"skia-native-raster\",\"surfaceKind\":\"raster\",\"softwareRenderer\":true,\"inProcessEncoding\":%s,\"surfaceAlphaType\":\"opaque\",\"surfaceColorSpace\":\"srgb\",\"videoColorSpace\":\"bt709\",\"videoColorRange\":\"limited\",\"alphaSamplesOpaque\":%s,\"width\":%u,\"height\":%u,\"frames\":%llu,\"bytesWritten\":%llu,\"rawSampleHashFnv1a32\":{\"frame0\":\"%08x\",\"frameMid\":\"%08x\",\"frameLast\":\"%08x\"},\"timingsMs\":{\"protocolOverhead\":%.3f,\"render\":%.3f,\"composite\":%.3f,\"readback\":%.3f,\"rawWrite\":%.3f,\"colorConvert\":%.3f,\"encode\":%.3f,\"mux\":%.3f,\"finalize\":%.3f,\"totalProcess\":%.3f}}\n",
        inProcessEncoding ? "true" : "false", alphaSamplesOpaque ? "true" : "false", width, height, static_cast<unsigned long long>(frames), static_cast<unsigned long long>(bytesWritten),
        rawSampleHashes[0], rawSampleHashes[1], rawSampleHashes[2],
        protocolOverheadMilliseconds, renderMilliseconds, compositeMilliseconds, readbackMilliseconds, rawWriteMilliseconds,
        encoder.conversion_milliseconds(), encoder.encode_milliseconds(), encoder.mux_milliseconds(), encoder.finalize_milliseconds(),
        totalProcessMilliseconds);
    return 0;
}

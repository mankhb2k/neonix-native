// Native Skia CPU benchmark host.
//
// This intentionally renders the same three-layer benchmark composition as
// createNativeExportSmokeProject(), but uses SkSurface::MakeRaster directly.
// It is a measurement harness for Cloud Run CPU workers, not yet the full
// PaintCommandBuffer replay bridge.

#include "include/core/SkCanvas.h"
#include "include/core/SkColor.h"
#include "include/core/SkImageInfo.h"
#include "include/core/SkPaint.h"
#include "include/core/SkRect.h"
#include "include/core/SkSurface.h"

#include <algorithm>
#include <chrono>
#include <cstdint>
#include <cstdio>
#include <cstdlib>
#include <fstream>
#include <sstream>
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

bool parse_bool(const std::string& value) {
    return value == "1" || value == "true" || value == "yes";
}

}  // namespace

int main(int argc, char** argv) {
    int width = 1920;
    int height = 1080;
    int frames = 30;
    std::string outputPath;
    bool rawOutput = false;
    std::vector<std::string> arguments;
    for (int index = 1; index < argc; ++index) {
        std::istringstream stream(argv[index]);
        std::string token;
        while (stream >> token) arguments.push_back(token);
    }
    for (size_t index = 0; index < arguments.size(); ++index) {
        const std::string& token = arguments[index];
        const size_t equals = token.find('=');
        const std::string name = equals == std::string::npos ? token : token.substr(0, equals);
        const std::string value = equals == std::string::npos && index + 1 < arguments.size()
                                      ? arguments[++index]
                                      : (equals == std::string::npos ? "" : token.substr(equals + 1));
        if (name == "--width") width = std::max(1, std::atoi(value.c_str()));
        else if (name == "--height") height = std::max(1, std::atoi(value.c_str()));
        else if (name == "--frames") frames = std::max(1, std::atoi(value.c_str()));
        else if (name == "--output") outputPath = value;
        else if (name == "--raw") rawOutput = value.empty() || parse_bool(value);
    }

    const auto totalStart = Clock::now();
    const SkImageInfo imageInfo =
            SkImageInfo::Make(width, height, kRGBA_8888_SkColorType, kPremul_SkAlphaType);
    sk_sp<SkSurface> surface = SkSurfaces::Raster(imageInfo);
    if (!surface) {
        print_error("create_surface", "SkSurfaces_Raster_failed");
        return 10;
    }
    const auto surfaceReady = Clock::now();
    std::vector<uint8_t> pixels(static_cast<size_t>(width) * static_cast<size_t>(height) * 4);
    double renderMilliseconds = 0;
    double readbackMilliseconds = 0;
    size_t bytesWritten = 0;
    int completedFrames = 0;

    for (int frame = 0; frame < frames; ++frame) {
        const auto renderStart = Clock::now();
        const float progress = frames == 1 ? 0.5f : static_cast<float>(frame) / (frames - 1);
        SkCanvas* canvas = surface->getCanvas();
        canvas->clear(SkColorSetARGB(255, 16, 24, 39));

        SkPaint accent;
        accent.setAntiAlias(true);
        accent.setColor4f({0.1333f, 0.8275f, 0.9333f, 0.9f});
        canvas->drawOval(SkRect::MakeXYWH(168.0f + progress * 120.0f, 192.0f, 576.0f, 576.0f), accent);

        SkPaint panel;
        panel.setAntiAlias(true);
        panel.setColor4f({0.0902f, 0.1451f, 0.3294f, 0.92f});
        canvas->drawRoundRect(SkRect::MakeXYWH(492.0f, 348.0f, 1080.0f, 384.0f), 72.0f, 72.0f, panel);
        panel.setStyle(SkPaint::kStroke_Style);
        panel.setStrokeWidth(12.0f);
        panel.setColor4f({0.3765f, 0.6471f, 0.9804f, 0.92f});
        canvas->drawRoundRect(SkRect::MakeXYWH(492.0f, 348.0f, 1080.0f, 384.0f), 72.0f, 72.0f, panel);
        const auto renderReady = Clock::now();
        renderMilliseconds += milliseconds(renderStart, renderReady);

        const auto readbackStart = Clock::now();
        if (!surface->readPixels(imageInfo, pixels.data(), static_cast<size_t>(width) * 4, 0, 0)) {
            print_error("readback", "SkSurface_readPixels_failed");
            return 11;
        }
        const auto readbackReady = Clock::now();
        readbackMilliseconds += milliseconds(readbackStart, readbackReady);

        if (rawOutput) {
            const size_t written = std::fwrite(pixels.data(), 1, pixels.size(), stdout);
            if (written != pixels.size()) {
                print_error("raw_output", "stdout_write_failed");
                return 12;
            }
            bytesWritten += written;
        }
        completedFrames += 1;
    }

    if (!write_ppm(outputPath, pixels, width, height)) {
        print_error("write_output", "PPM_write_failed");
        return 13;
    }
    std::fflush(stdout);
    const auto totalReady = Clock::now();
    std::fprintf(stderr,
                 "{\"ok\":true,\"requestedBackend\":\"skia-cpu\",\"actualBackend\":\"skia-native-raster\",\"surfaceKind\":\"raster\",\"softwareRenderer\":true,\"width\":%d,\"height\":%d,\"frames\":%d,\"bytesWritten\":%zu,\"timingsMs\":{\"surfaceCreate\":%.3f,\"render\":%.3f,\"readback\":%.3f,\"totalProcess\":%.3f}}\n",
                 width, height, completedFrames, bytesWritten, milliseconds(totalStart, surfaceReady),
                 renderMilliseconds, readbackMilliseconds, milliseconds(totalStart, totalReady));
    return 0;
}

extern "C" {
#include <libavutil/frame.h>
#include <libswscale/swscale.h>
}
#include <libyuv/convert.h>
#include <libyuv/convert_from_argb.h>

#include <algorithm>
#include <cmath>
#include <cstdint>
#include <cstdio>
#include <cstring>
#include <iomanip>
#include <iostream>
#include <limits>
#include <string>
#include <vector>

namespace {

constexpr int kWidth = 256;
constexpr int kHeight = 128;

struct PlaneStats {
    uint64_t samples = 0;
    uint64_t exact = 0;
    uint64_t within1 = 0;
    uint64_t within2 = 0;
    uint64_t sum = 0;
    uint32_t max = 0;
    std::vector<uint32_t> differences;

    void add(uint32_t difference) {
        samples += 1;
        exact += difference == 0 ? 1 : 0;
        within1 += difference <= 1 ? 1 : 0;
        within2 += difference <= 2 ? 1 : 0;
        sum += difference;
        max = std::max(max, difference);
        differences.push_back(difference);
    }

    double percentage(uint64_t value) const {
        return samples == 0 ? 100.0 : static_cast<double>(value) * 100.0 / samples;
    }

    double mean() const {
        return samples == 0 ? 0.0 : static_cast<double>(sum) / samples;
    }

    uint32_t percentile(double fraction) {
        if (differences.empty()) return 0;
        const size_t index = static_cast<size_t>(std::floor(fraction * (differences.size() - 1)));
        std::nth_element(differences.begin(), differences.begin() + index, differences.end());
        return differences[index];
    }
};

struct TestStats {
    PlaneStats planes[3];
    uint64_t rangeFailures = 0;
    uint64_t channelFailures = 0;
};

struct Color {
    uint8_t r;
    uint8_t g;
    uint8_t b;
    const char* name;
};

const Color kSolidColors[] = {
    {0, 0, 0, "black"},
    {255, 255, 255, "white"},
    {128, 128, 128, "gray"},
    {255, 0, 0, "red"},
    {0, 255, 0, "green"},
    {0, 0, 255, "blue"},
    {0, 255, 255, "cyan"},
    {255, 0, 255, "magenta"},
    {255, 255, 0, "yellow"},
};

std::vector<uint8_t> make_rgba(const Color* solid, int padding) {
    const int stride = kWidth * 4 + padding;
    std::vector<uint8_t> result(static_cast<size_t>(stride) * kHeight, 0);
    for (int y = 0; y < kHeight; ++y) {
        for (int x = 0; x < kWidth; ++x) {
            const size_t index = static_cast<size_t>(y) * stride + x * 4;
            if (solid) {
                result[index + 0] = solid->r;
                result[index + 1] = solid->g;
                result[index + 2] = solid->b;
            } else {
                // Includes ramps, saturated edges and non-trivial chroma. The
                // deterministic pattern makes this suitable for CI and repeats.
                result[index + 0] = static_cast<uint8_t>((x * 13 + y * 7 + (x ^ y)) & 255);
                result[index + 1] = static_cast<uint8_t>((x * 3 + y * 19 + 41) & 255);
                result[index + 2] = static_cast<uint8_t>(((x * 29) ^ (y * 11) ^ 173) & 255);
            }
            result[index + 3] = 255;
        }
    }
    return result;
}

void reset_frame(AVFrame* frame) {
    av_frame_make_writable(frame);
    for (int plane = 0; plane < 3; ++plane) {
        const int height = plane == 0 ? kHeight : kHeight / 2;
        std::memset(frame->data[plane], 0, static_cast<size_t>(frame->linesize[plane]) * height);
    }
}

void compare_plane(const uint8_t* selected, int selectedStride,
                   const uint8_t* reference, int referenceStride,
                   int width, int height, PlaneStats& stats) {
    for (int row = 0; row < height; ++row) {
        for (int column = 0; column < width; ++column) {
            const uint32_t left = selected[column];
            const uint32_t right = reference[column];
            stats.add(left > right ? left - right : right - left);
        }
        selected += selectedStride;
        reference += referenceStride;
    }
}

void observe_contract(const AVFrame* frame, const Color* color, TestStats& stats) {
    if (!color) return;
    int expectedY = -1;
    int expectedU = -1;
    int expectedV = -1;
    if (color->r == 0 && color->g == 0 && color->b == 0) {
        expectedY = 16; expectedU = 128; expectedV = 128;
    } else if (color->r == 255 && color->g == 255 && color->b == 255) {
        expectedY = 235; expectedU = 128; expectedV = 128;
    } else if (color->r == 255 && color->g == 0 && color->b == 0) {
        expectedY = 63; expectedU = 102; expectedV = 240;
    } else if (color->r == 0 && color->g == 255 && color->b == 0) {
        expectedY = 173; expectedU = 42; expectedV = 26;
    } else if (color->r == 0 && color->g == 0 && color->b == 255) {
        expectedY = 32; expectedU = 240; expectedV = 118;
    }
    if (expectedY < 0) return;
    const int y = frame->data[0][0];
    const int u = frame->data[1][0];
    const int v = frame->data[2][0];
    if (std::abs(y - expectedY) > 2) stats.rangeFailures += 1;
    if (std::abs(u - expectedU) > 2 || std::abs(v - expectedV) > 2) stats.channelFailures += 1;
}

void print_plane(const char* name, const PlaneStats& stats, uint32_t p95, uint32_t p99) {
    std::cout << "{\"plane\":\"" << name << "\",\"samples\":" << stats.samples
              << ",\"exactPercent\":" << std::fixed << std::setprecision(6)
              << stats.percentage(stats.exact) << ",\"within1Percent\":"
              << stats.percentage(stats.within1) << ",\"within2Percent\":"
              << stats.percentage(stats.within2) << ",\"meanAbsDiff\":" << stats.mean()
              << ",\"p95AbsDiff\":" << p95 << ",\"p99AbsDiff\":" << p99
              << ",\"maxAbsDiff\":" << stats.max << "}";
}

}  // namespace

int main(int argc, char** argv) {
    bool enforceParity = false;
    // libyuv's 4:2:0 chroma path is an area-like 2x2 reduction. Use the
    // equivalent libswscale reference by default; bilinear remains available
    // as an explicit control with --sws-filter bilinear.
    int swsFlags = SWS_AREA;
    const char* swsFilter = "area";
    for (int index = 1; index < argc; ++index) {
        if (std::strcmp(argv[index], "--enforce-parity") == 0) enforceParity = true;
        if (std::strcmp(argv[index], "--sws-filter") == 0 && index + 1 < argc) {
            const std::string value = argv[++index];
            if (value == "point") { swsFlags = SWS_POINT; swsFilter = "point"; }
            else if (value == "fast-bilinear") { swsFlags = SWS_FAST_BILINEAR; swsFilter = "fast-bilinear"; }
            else if (value == "bilinear") { swsFlags = SWS_BILINEAR; swsFilter = "bilinear"; }
            else if (value == "area") { swsFlags = SWS_AREA; swsFilter = "area"; }
            else {
                std::cerr << "{\"ok\":false,\"error\":\"unsupported sws filter\"}\n";
                return 9;
            }
        }
    }

    SwsContext* sws = sws_getContext(
        kWidth, kHeight, AV_PIX_FMT_RGBA,
        kWidth, kHeight, AV_PIX_FMT_YUV420P,
        swsFlags, nullptr, nullptr, nullptr);
    if (!sws) {
        std::cerr << "{\"ok\":false,\"error\":\"sws_getContext failed\"}\n";
        return 10;
    }
    if (sws_setColorspaceDetails(
            sws, sws_getCoefficients(SWS_CS_ITU709), 1,
            sws_getCoefficients(SWS_CS_ITU709), 0, 0, 1 << 16, 1 << 16) < 0) {
        std::cerr << "{\"ok\":false,\"error\":\"sws_setColorspaceDetails failed\"}\n";
        sws_freeContext(sws);
        return 11;
    }

    AVFrame* libyuvFrame = av_frame_alloc();
    AVFrame* swscaleFrame = av_frame_alloc();
    if (!libyuvFrame || !swscaleFrame) {
        std::cerr << "{\"ok\":false,\"error\":\"frame allocation failed\"}\n";
        if (libyuvFrame) av_frame_free(&libyuvFrame);
        if (swscaleFrame) av_frame_free(&swscaleFrame);
        sws_freeContext(sws);
        return 12;
    }
    for (AVFrame* frame : {libyuvFrame, swscaleFrame}) {
        frame->format = AV_PIX_FMT_YUV420P;
        frame->width = kWidth;
        frame->height = kHeight;
        if (av_frame_get_buffer(frame, 32) < 0) {
            std::cerr << "{\"ok\":false,\"error\":\"frame buffer allocation failed\"}\n";
            av_frame_free(&libyuvFrame);
            av_frame_free(&swscaleFrame);
            sws_freeContext(sws);
            return 13;
        }
    }

    TestStats total;
    uint64_t cases = 0;
    for (const Color& color : kSolidColors) {
        for (int padding : {0, 13}) {
            const int sourceStride = kWidth * 4 + padding;
            const std::vector<uint8_t> rgba = make_rgba(&color, padding);
            reset_frame(libyuvFrame);
            reset_frame(swscaleFrame);
            const uint8_t* source[] = {rgba.data()};
            const int sourceStrides[] = {sourceStride};
            if (sws_scale(sws, source, sourceStrides, 0, kHeight,
                          swscaleFrame->data, swscaleFrame->linesize) <= 0) {
                std::cerr << "{\"ok\":false,\"error\":\"sws_scale failed\"}\n";
                return 14;
            }
            if (libyuv::ARGBToI420Matrix(
                    rgba.data(), sourceStride,
                    libyuvFrame->data[0], libyuvFrame->linesize[0],
                    libyuvFrame->data[1], libyuvFrame->linesize[1],
                    libyuvFrame->data[2], libyuvFrame->linesize[2],
                    &libyuv::kAbgrH709Constants, kWidth, kHeight) != 0) {
                std::cerr << "{\"ok\":false,\"error\":\"libyuv conversion failed\"}\n";
                return 15;
            }
            compare_plane(libyuvFrame->data[0], libyuvFrame->linesize[0], swscaleFrame->data[0], swscaleFrame->linesize[0], kWidth, kHeight, total.planes[0]);
            compare_plane(libyuvFrame->data[1], libyuvFrame->linesize[1], swscaleFrame->data[1], swscaleFrame->linesize[1], kWidth / 2, kHeight / 2, total.planes[1]);
            compare_plane(libyuvFrame->data[2], libyuvFrame->linesize[2], swscaleFrame->data[2], swscaleFrame->linesize[2], kWidth / 2, kHeight / 2, total.planes[2]);
            observe_contract(libyuvFrame, &color, total);
            cases += 1;
        }
    }
    for (int padding : {0, 7, 31}) {
        const int sourceStride = kWidth * 4 + padding;
        const std::vector<uint8_t> rgba = make_rgba(nullptr, padding);
        reset_frame(libyuvFrame);
        reset_frame(swscaleFrame);
        const uint8_t* source[] = {rgba.data()};
        const int sourceStrides[] = {sourceStride};
        if (sws_scale(sws, source, sourceStrides, 0, kHeight,
                      swscaleFrame->data, swscaleFrame->linesize) <= 0 ||
            libyuv::ARGBToI420Matrix(
                rgba.data(), sourceStride,
                libyuvFrame->data[0], libyuvFrame->linesize[0],
                libyuvFrame->data[1], libyuvFrame->linesize[1],
                libyuvFrame->data[2], libyuvFrame->linesize[2],
                &libyuv::kAbgrH709Constants, kWidth, kHeight) != 0) {
            std::cerr << "{\"ok\":false,\"error\":\"pattern conversion failed\"}\n";
            return 16;
        }
        compare_plane(libyuvFrame->data[0], libyuvFrame->linesize[0], swscaleFrame->data[0], swscaleFrame->linesize[0], kWidth, kHeight, total.planes[0]);
        compare_plane(libyuvFrame->data[1], libyuvFrame->linesize[1], swscaleFrame->data[1], swscaleFrame->linesize[1], kWidth / 2, kHeight / 2, total.planes[1]);
        compare_plane(libyuvFrame->data[2], libyuvFrame->linesize[2], swscaleFrame->data[2], swscaleFrame->linesize[2], kWidth / 2, kHeight / 2, total.planes[2]);
        cases += 1;
    }

    const uint32_t y95 = total.planes[0].percentile(0.95);
    const uint32_t y99 = total.planes[0].percentile(0.99);
    const uint32_t u95 = total.planes[1].percentile(0.95);
    const uint32_t u99 = total.planes[1].percentile(0.99);
    const uint32_t v95 = total.planes[2].percentile(0.95);
    const uint32_t v99 = total.planes[2].percentile(0.99);
    const uint64_t samples = total.planes[0].samples + total.planes[1].samples + total.planes[2].samples;
    const uint64_t within1 = total.planes[0].within1 + total.planes[1].within1 + total.planes[2].within1;
    const double aggregateWithin1 = samples == 0 ? 100.0 : static_cast<double>(within1) * 100.0 / samples;
    const bool parityPass = aggregateWithin1 >= 99.9 && total.planes[0].within1 * 100.0 / total.planes[0].samples >= 99.9 && total.planes[1].within1 * 100.0 / total.planes[1].samples >= 99.9 && total.planes[2].within1 * 100.0 / total.planes[2].samples >= 99.9;
    const bool contractPass = total.rangeFailures == 0 && total.channelFailures == 0;
    const bool ok = contractPass && (!enforceParity || parityPass);

    std::cout << "{\"ok\":" << (ok ? "true" : "false")
              << ",\"test\":\"libyuv-vs-libswscale-color-contract\""
              << ",\"width\":" << kWidth << ",\"height\":" << kHeight
              << ",\"cases\":" << cases << ",\"swsFilter\":\"" << swsFilter << "\",\"matrix\":\"bt709\",\"range\":\"limited\""
              << ",\"inputLayout\":\"rgba-bytes-r-g-b-a\",\"stridePadding\":\"0,7,13,31\""
              << ",\"contractPass\":" << (contractPass ? "true" : "false")
              << ",\"parityPass99_9\":" << (parityPass ? "true" : "false")
              << ",\"rangeFailures\":" << total.rangeFailures
              << ",\"channelFailures\":" << total.channelFailures
              << ",\"aggregateSamples\":" << samples
              << ",\"aggregateWithin1Percent\":" << std::fixed << std::setprecision(6) << aggregateWithin1
              << ",\"planes\":[";
    print_plane("Y", total.planes[0], y95, y99);
    std::cout << ",";
    print_plane("U", total.planes[1], u95, u99);
    std::cout << ",";
    print_plane("V", total.planes[2], v95, v99);
    std::cout << "]}\n";

    av_frame_free(&libyuvFrame);
    av_frame_free(&swscaleFrame);
    sws_freeContext(sws);
    return ok ? 0 : 20;
}

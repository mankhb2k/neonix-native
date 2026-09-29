#pragma once

// In-process FFmpeg muxer: takes RGBA frames, converts to YUV420P (libyuv in
// the production libyuv-only build; libswscale in the sandbox/comparison
// build), and muxes an H.264 MP4 directly - no separate ffmpeg subprocess.

#include <cstdint>
#include <string>
#include <vector>

extern "C" {
#include <libavcodec/avcodec.h>
#include <libavformat/avformat.h>
#ifndef NEONIX_LIBYUV_ONLY
#include <libswscale/swscale.h>
#endif
}

namespace neonix {

enum class ColorConverter {
    Swscale,
    Libyuv,
};

const char* color_converter_name(ColorConverter converter);

class InProcessEncoder {
public:
    InProcessEncoder() = default;
    ~InProcessEncoder();

    bool open(const std::string& path, int width, int height, int fps, uint64_t expectedFrames,
              ColorConverter converter, bool compareColor, int swsFilter, std::string& error);
    bool submit(const std::vector<uint8_t>& rgba, uint64_t frameIndex, std::string& error);
    bool finish(std::string& error);

    double conversion_milliseconds() const { return conversionMilliseconds_; }
    double encode_milliseconds() const { return encodeMilliseconds_; }
    double mux_milliseconds() const { return muxMilliseconds_; }
    double finalize_milliseconds() const { return finalizeMilliseconds_; }
    double comparison_milliseconds() const { return comparisonMilliseconds_; }
    uint32_t yuv_sample_hash(int index) const { return yuvSampleHashes_[index]; }
    uint64_t comparison_total_samples() const { return comparisonTotalSamples_; }
    uint64_t comparison_exact_samples() const { return comparisonExactSamples_; }
    uint64_t comparison_within1_samples() const { return comparisonWithin1Samples_; }
    uint64_t comparison_within2_samples() const { return comparisonWithin2Samples_; }
    uint64_t comparison_sum_abs_diff() const { return comparisonSumAbsDiff_; }
    uint32_t comparison_max_abs_diff() const { return comparisonMaxAbsDiff_; }
    double comparison_mean_abs_diff() const {
        return comparisonTotalSamples_ == 0
            ? 0.0 : static_cast<double>(comparisonSumAbsDiff_) / comparisonTotalSamples_;
    }
    uint64_t comparison_plane_total(int plane) const { return comparisonPlaneTotalSamples_[plane]; }
    uint64_t comparison_plane_exact(int plane) const { return comparisonPlaneExactSamples_[plane]; }
    uint64_t comparison_plane_within1(int plane) const { return comparisonPlaneWithin1Samples_[plane]; }
    uint64_t comparison_plane_within2(int plane) const { return comparisonPlaneWithin2Samples_[plane]; }
    uint64_t comparison_plane_sum_abs_diff(int plane) const { return comparisonPlaneSumAbsDiff_[plane]; }
    uint32_t comparison_plane_max_abs_diff(int plane) const { return comparisonPlaneMaxAbsDiff_[plane]; }
    double comparison_plane_mean_abs_diff(int plane) const {
        return comparisonPlaneTotalSamples_[plane] == 0
            ? 0.0 : static_cast<double>(comparisonPlaneSumAbsDiff_[plane]) /
                comparisonPlaneTotalSamples_[plane];
    }
    const char* converter_name() const { return color_converter_name(converter_); }
    const char* reference_converter_name() const { return color_converter_name(referenceConverter_); }
    bool comparison_enabled() const { return compareColor_; }

private:
    int sample_index(uint32_t frameIndex) const;
    bool convert(const std::vector<uint8_t>& rgba, AVFrame* destination, ColorConverter converter, std::string& error);
    void hash_plane(const uint8_t* data, int stride, int width, int height, uint32_t& hash) const;
    void hash_frame(const AVFrame* source, uint32_t& hash) const;
#ifdef NEONIX_ENABLE_LIBYUV
    void compare_plane(const uint8_t* selected, int selectedStride,
                       const uint8_t* reference, int referenceStride,
                       int width, int height, int plane);
    void compare_frame(const AVFrame* selected, const AVFrame* reference);
#endif
    bool drain(std::string& error);
    void close(bool);

    AVFormatContext* formatContext_ = nullptr;
    AVCodecContext* codecContext_ = nullptr;
    AVStream* stream_ = nullptr;
#ifndef NEONIX_LIBYUV_ONLY
    SwsContext* swsContext_ = nullptr;
    int swsFilter_ = SWS_BILINEAR;
#endif
    AVFrame* frame_ = nullptr;
    AVFrame* referenceFrame_ = nullptr;
    AVPacket* packet_ = nullptr;
    int width_ = 0;
    int height_ = 0;
    int fps_ = 0;
    uint64_t expectedFrames_ = 0;
#ifdef NEONIX_LIBYUV_ONLY
    ColorConverter converter_ = ColorConverter::Libyuv;
#else
    ColorConverter converter_ = ColorConverter::Swscale;
#endif
    ColorConverter referenceConverter_ = ColorConverter::Swscale;
    bool compareColor_ = false;
    bool opened_ = false;
    bool finished_ = false;
    double conversionMilliseconds_ = 0;
    double encodeMilliseconds_ = 0;
    double muxMilliseconds_ = 0;
    double finalizeMilliseconds_ = 0;
    double comparisonMilliseconds_ = 0;
    uint32_t yuvSampleHashes_[3] = {2166136261U, 2166136261U, 2166136261U};
    uint64_t comparisonTotalSamples_ = 0;
    uint64_t comparisonExactSamples_ = 0;
    uint64_t comparisonWithin1Samples_ = 0;
    uint64_t comparisonWithin2Samples_ = 0;
    uint64_t comparisonSumAbsDiff_ = 0;
    uint32_t comparisonMaxAbsDiff_ = 0;
    uint64_t comparisonPlaneTotalSamples_[3] = {0, 0, 0};
    uint64_t comparisonPlaneExactSamples_[3] = {0, 0, 0};
    uint64_t comparisonPlaneWithin1Samples_[3] = {0, 0, 0};
    uint64_t comparisonPlaneWithin2Samples_[3] = {0, 0, 0};
    uint64_t comparisonPlaneSumAbsDiff_[3] = {0, 0, 0};
    uint32_t comparisonPlaneMaxAbsDiff_[3] = {0, 0, 0};
};

}  // namespace neonix

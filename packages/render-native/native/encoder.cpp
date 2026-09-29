#include "neonix/encoder.h"

#include "neonix/util.h"

extern "C" {
#include <libavutil/avutil.h>
#include <libavutil/error.h>
#include <libavutil/imgutils.h>
#include <libavutil/opt.h>
}

#ifdef NEONIX_ENABLE_LIBYUV
#include <libyuv/convert.h>
#include <libyuv/convert_from_argb.h>
#endif

#include <algorithm>
#include <cstdlib>

namespace neonix {

namespace {

std::string ffmpeg_error(int error) {
    char buffer[AV_ERROR_MAX_STRING_SIZE]{};
    av_strerror(error, buffer, sizeof(buffer));
    return std::string(buffer);
}

}  // namespace

const char* color_converter_name(ColorConverter converter) {
    return converter == ColorConverter::Libyuv ? "libyuv" : "libswscale";
}

InProcessEncoder::~InProcessEncoder() {
    close(false);
}

bool InProcessEncoder::open(const std::string& path, int width, int height, int fps, uint64_t expectedFrames,
          ColorConverter converter, bool compareColor, int swsFilter, std::string& error) {
    width_ = width;
    height_ = height;
    fps_ = fps;
    expectedFrames_ = expectedFrames;
    converter_ = converter;
    compareColor_ = compareColor;
#ifndef NEONIX_LIBYUV_ONLY
    swsFilter_ = swsFilter;
#endif
    if ((width_ & 1) != 0 || (height_ & 1) != 0) {
        error = "yuv420p requires even width and height";
        return false;
    }
#ifndef NEONIX_ENABLE_LIBYUV
    if (converter_ == ColorConverter::Libyuv || compareColor_) {
        error = "libyuv is available only in the sandbox binary";
        return false;
    }
#endif
#ifdef NEONIX_LIBYUV_ONLY
    if (converter_ != ColorConverter::Libyuv) {
        error = "this binary is libyuv-only; libswscale is sandbox-only";
        return false;
    }
    if (compareColor_) {
        error = "color comparison requires the libswscale sandbox reference";
        return false;
    }
#endif
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
    const char* requestedCrf = std::getenv("NEONIX_X264_CRF");
    av_opt_set(codecContext_->priv_data, "crf",
               requestedCrf && requestedCrf[0] != '\0' ? requestedCrf : "23", 0);
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
#ifndef NEONIX_LIBYUV_ONLY
    swsContext_ = sws_getContext(
        width_, height_, AV_PIX_FMT_RGBA,
        width_, height_, AV_PIX_FMT_YUV420P,
        swsFilter_, nullptr, nullptr, nullptr);
    if (!swsContext_) {
        error = "sws_getContext failed";
        return false;
    }
#ifdef NEONIX_EXPLICIT_COLOR_CONTRACT
    const int colorDetails = sws_setColorspaceDetails(
        swsContext_, sws_getCoefficients(SWS_CS_ITU709), 1,
        sws_getCoefficients(SWS_CS_ITU709), 0, 0, 1 << 16, 1 << 16);
    if (colorDetails < 0) {
        error = "sws_setColorspaceDetails failed";
        return false;
    }
#endif
#endif
#ifdef NEONIX_ENABLE_LIBYUV
#ifndef NEONIX_LIBYUV_ONLY
    if (compareColor_) {
        referenceFrame_ = av_frame_alloc();
        if (!referenceFrame_) {
            error = "could not allocate reference AVFrame";
            return false;
        }
        referenceFrame_->format = codecContext_->pix_fmt;
        referenceFrame_->width = width_;
        referenceFrame_->height = height_;
        referenceFrame_->color_range = codecContext_->color_range;
        referenceFrame_->color_primaries = codecContext_->color_primaries;
        referenceFrame_->color_trc = codecContext_->color_trc;
        referenceFrame_->colorspace = codecContext_->colorspace;
        referenceFrame_->chroma_location = codecContext_->chroma_sample_location;
        result = av_frame_get_buffer(referenceFrame_, 32);
        if (result < 0) {
            error = "reference av_frame_get_buffer: " + ffmpeg_error(result);
            return false;
        }
        referenceConverter_ = converter_ == ColorConverter::Libyuv
            ? ColorConverter::Swscale : ColorConverter::Libyuv;
    }
#endif
#endif
    opened_ = true;
    return true;
}

bool InProcessEncoder::submit(const std::vector<uint8_t>& rgba, uint64_t frameIndex, std::string& error) {
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
    if (!convert(rgba, frame_, converter_, error)) return false;
    conversionMilliseconds_ += milliseconds(conversionStart, Clock::now());
    const uint32_t currentFrame = static_cast<uint32_t>(frameIndex);
    if (currentFrame == 0 || currentFrame == expectedFrames_ / 2 || currentFrame == expectedFrames_ - 1) {
        hash_frame(frame_, yuvSampleHashes_[sample_index(currentFrame)]);
#ifdef NEONIX_ENABLE_LIBYUV
        if (compareColor_) {
            result = av_frame_make_writable(referenceFrame_);
            if (result < 0) {
                error = "reference av_frame_make_writable: " + ffmpeg_error(result);
                return false;
            }
            const auto compareStart = Clock::now();
            if (!convert(rgba, referenceFrame_, referenceConverter_, error)) return false;
            compare_frame(frame_, referenceFrame_);
            comparisonMilliseconds_ += milliseconds(compareStart, Clock::now());
        }
#endif
    }
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

bool InProcessEncoder::finish(std::string& error) {
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

int InProcessEncoder::sample_index(uint32_t frameIndex) const {
    if (frameIndex == 0) return 0;
    if (frameIndex == expectedFrames_ / 2) return 1;
    return 2;
}

bool InProcessEncoder::convert(const std::vector<uint8_t>& rgba, AVFrame* destination,
             ColorConverter converter, std::string& error) {
#ifndef NEONIX_LIBYUV_ONLY
    if (converter == ColorConverter::Swscale) {
        const uint8_t* source[] = {rgba.data()};
        const int sourceStride[] = {width_ * 4};
        if (sws_scale(swsContext_, source, sourceStride, 0, height_,
                      destination->data, destination->linesize) <= 0) {
            error = "sws_scale failed";
            return false;
        }
        return true;
    }
#endif
#ifdef NEONIX_ENABLE_LIBYUV
    const int result = libyuv::ARGBToI420Matrix(
        rgba.data(), width_ * 4,
        destination->data[0], destination->linesize[0],
        destination->data[1], destination->linesize[1],
        destination->data[2], destination->linesize[2],
        &libyuv::kAbgrH709Constants, width_, height_);
    if (result != 0) {
        error = "libyuv ARGBToI420Matrix failed: " + std::to_string(result);
        return false;
    }
    return true;
#else
    error = "libyuv converter is unavailable";
    return false;
#endif
}

void InProcessEncoder::hash_plane(const uint8_t* data, int stride, int width, int height, uint32_t& hash) const {
    for (int row = 0; row < height; ++row) {
        for (int column = 0; column < width; ++column) {
            hash ^= static_cast<uint32_t>(data[column]);
            hash *= 16777619U;
        }
        data += stride;
    }
}

void InProcessEncoder::hash_frame(const AVFrame* source, uint32_t& hash) const {
    hash_plane(source->data[0], source->linesize[0], width_, height_, hash);
    hash_plane(source->data[1], source->linesize[1], width_ / 2, height_ / 2, hash);
    hash_plane(source->data[2], source->linesize[2], width_ / 2, height_ / 2, hash);
}

#ifdef NEONIX_ENABLE_LIBYUV
void InProcessEncoder::compare_plane(const uint8_t* selected, int selectedStride,
                   const uint8_t* reference, int referenceStride,
                   int width, int height, int plane) {
    for (int row = 0; row < height; ++row) {
        for (int column = 0; column < width; ++column) {
            const uint32_t left = selected[column];
            const uint32_t right = reference[column];
            const uint32_t difference = left > right ? left - right : right - left;
            comparisonTotalSamples_ += 1;
            comparisonSumAbsDiff_ += difference;
            comparisonMaxAbsDiff_ = std::max(comparisonMaxAbsDiff_, difference);
            comparisonPlaneTotalSamples_[plane] += 1;
            comparisonPlaneSumAbsDiff_[plane] += difference;
            comparisonPlaneMaxAbsDiff_[plane] = std::max(comparisonPlaneMaxAbsDiff_[plane], difference);
            if (difference == 0) comparisonExactSamples_ += 1;
            if (difference == 0) comparisonPlaneExactSamples_[plane] += 1;
            if (difference <= 1) {
                comparisonWithin1Samples_ += 1;
                comparisonPlaneWithin1Samples_[plane] += 1;
            }
            if (difference <= 2) {
                comparisonWithin2Samples_ += 1;
                comparisonPlaneWithin2Samples_[plane] += 1;
            }
        }
        selected += selectedStride;
        reference += referenceStride;
    }
}

void InProcessEncoder::compare_frame(const AVFrame* selected, const AVFrame* reference) {
    compare_plane(selected->data[0], selected->linesize[0], reference->data[0], reference->linesize[0], width_, height_, 0);
    compare_plane(selected->data[1], selected->linesize[1], reference->data[1], reference->linesize[1], width_ / 2, height_ / 2, 1);
    compare_plane(selected->data[2], selected->linesize[2], reference->data[2], reference->linesize[2], width_ / 2, height_ / 2, 2);
}
#endif

bool InProcessEncoder::drain(std::string& error) {
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

void InProcessEncoder::close(bool) {
    if (formatContext_ && !finished_) {
        av_write_trailer(formatContext_);
    }
#ifndef NEONIX_LIBYUV_ONLY
    if (swsContext_) sws_freeContext(swsContext_);
#endif
    if (packet_) av_packet_free(&packet_);
    if (frame_) av_frame_free(&frame_);
    if (referenceFrame_) av_frame_free(&referenceFrame_);
    if (codecContext_) avcodec_free_context(&codecContext_);
    if (formatContext_) {
        if (!(formatContext_->oformat->flags & AVFMT_NOFILE) && formatContext_->pb) avio_closep(&formatContext_->pb);
        avformat_free_context(formatContext_);
    }
    formatContext_ = nullptr;
    codecContext_ = nullptr;
    stream_ = nullptr;
#ifndef NEONIX_LIBYUV_ONLY
    swsContext_ = nullptr;
#endif
    frame_ = nullptr;
    referenceFrame_ = nullptr;
    packet_ = nullptr;
}

}  // namespace neonix

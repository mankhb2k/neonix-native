#pragma once

// Tiny helpers shared across every translation unit in this backend
// (main.cpp's own render/readback timers and encoder.cpp's InProcessEncoder
// timers both need the same clock and the same millisecond conversion).

#include <chrono>

namespace neonix {

using Clock = std::chrono::steady_clock;

inline double milliseconds(Clock::time_point start, Clock::time_point end) {
    return std::chrono::duration<double, std::milli>(end - start).count();
}

}  // namespace neonix

#pragma once

// CSS filter/effect-program interpretation: turns a decoded EffectProgram
// (protocol.h) into either a plain SkImageFilter (build_effect_filter, for
// anything that can be expressed as a filter on the layer's own rendered
// content) or a box-shadow overlay compositor (draw_box_effect, for the two
// shapes — multi-shadow lists and inset shadows — that read the box's own
// geometry instead and can never be a plain SkImageFilter).

#include "include/core/SkCanvas.h"
#include "include/core/SkImageFilter.h"

#include "neonix/protocol.h"

#include <cstdint>
#include <vector>

namespace neonix {

struct EffectFilterResult {
    sk_sp<SkImageFilter> filter;
    bool supported = false;
};

EffectFilterResult build_effect_filter(bool hasProgram, const EffectProgram& program);

struct BoxShadowBranch {
    bool inner = false;
    double blurRadius = 0;
    Color tintColor;
    double tintOpacity = 1;
    double offsetX = 0;
    double offsetY = 0;
};

bool parse_box_shadow_branches(const EffectProgram& program, std::vector<BoxShadowBranch>& branches);
bool program_has_box_alpha_mask(const EffectProgram& program);

bool draw_box_effect(SkCanvas* canvas, const std::vector<BoxShadowBranch>& branches,
                      const EffectBoxSpec& box, const Matrix4& projection,
                      uint32_t frameWidth, uint32_t frameHeight);

}  // namespace neonix

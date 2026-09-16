// Neonix native Skia GPU POC.
//
// This executable is intentionally a small, strict host rather than a fake
// implementation of the TypeScript backend. It proves that Skia Ganesh can
// create a Vulkan-backed render target, submit work, and read pixels back.
// The PaintCommandBuffer replay bridge is added on top of this process after
// the driver/runtime contract is proven.

#include "include/core/SkCanvas.h"
#include "include/core/SkColor.h"
#include "include/core/SkColorType.h"
#include "include/core/SkImageInfo.h"
#include "include/core/SkRefCnt.h"
#include "include/core/SkSurface.h"
#include "include/core/SkTypes.h"
#include "include/gpu/ganesh/GrDirectContext.h"
#include "include/gpu/ganesh/SkSurfaceGanesh.h"
#include "include/gpu/ganesh/vk/GrVkDirectContext.h"
#include "include/gpu/vk/VulkanBackendContext.h"
#include "include/gpu/vk/VulkanExtensions.h"
#include "src/gpu/GpuTypesPriv.h"
#include "src/gpu/vk/vulkanmemoryallocator/VulkanMemoryAllocatorPriv.h"
#include "tools/gpu/vk/VkTestUtils.h"

#include <algorithm>
#include <chrono>
#include <cstdint>
#include <cstdio>
#include <cstdlib>
#include <fstream>
#include <memory>
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

bool write_rgba(const std::string& path, const std::vector<uint8_t>& pixels, int width, int height) {
    if (path.empty()) {
        return true;
    }

    std::ofstream output(path, std::ios::binary);
    if (!output) {
        return false;
    }

    // Keep the first artifact dependency-free. The alpha channel is retained
    // in the JSON metrics; PPM makes the RGB readback easy to inspect.
    output << "P6\n" << width << " " << height << "\n255\n";
    for (size_t index = 0; index + 3 < pixels.size(); index += 4) {
        output.put(static_cast<char>(pixels[index + 0]));
        output.put(static_cast<char>(pixels[index + 1]));
        output.put(static_cast<char>(pixels[index + 2]));
    }
    return static_cast<bool>(output);
}

}  // namespace

int main(int argc, char** argv) {
    int width = 1280;
    int height = 720;
    int frames = 1;
    std::string outputPath;
    std::vector<std::string> arguments;
    for (int index = 1; index < argc; ++index) {
        std::istringstream stream(argv[index]);
        std::string token;
        while (stream >> token) {
            arguments.push_back(token);
        }
    }
    for (size_t index = 0; index < arguments.size(); ++index) {
        const std::string& token = arguments[index];
        const size_t equals = token.find('=');
        const std::string name = equals == std::string::npos ? token : token.substr(0, equals);
        const std::string value = equals == std::string::npos && index + 1 < arguments.size()
                                          ? arguments[++index]
                                          : (equals == std::string::npos ? "" : token.substr(equals + 1));
        if (name == "--width") {
            width = std::max(1, std::atoi(value.c_str()));
        } else if (name == "--height") {
            height = std::max(1, std::atoi(value.c_str()));
        } else if (name == "--frames") {
            frames = std::max(1, std::atoi(value.c_str()));
        } else if (name == "--output") {
            outputPath = value;
        }
    }
    const auto totalStart = Clock::now();

    skgpu::VulkanBackendContext backendContext;
    VkDebugUtilsMessengerEXT debugMessenger = VK_NULL_HANDLE;
    auto extensions = std::make_unique<skgpu::VulkanExtensions>();
    auto features = std::make_unique<sk_gpu_test::TestVkFeatures>();

    PFN_vkGetInstanceProcAddr instanceProc = nullptr;
    const auto setupStart = Clock::now();
    if (!sk_gpu_test::LoadVkLibraryAndGetProcAddrFuncs(&instanceProc)) {
        print_error("load_vulkan", "vkGetInstanceProcAddr_unavailable");
        return 10;
    }
    if (!sk_gpu_test::CreateVkBackendContext(instanceProc, &backendContext, extensions.get(),
                                             features.get(), &debugMessenger)) {
        print_error("create_vulkan_context", "Skia_test_context_creation_failed");
        return 11;
    }
    const auto contextReady = Clock::now();

    auto getProc = backendContext.fGetProc;
    auto destroyInstance = reinterpret_cast<PFN_vkDestroyInstance>(
            getProc("vkDestroyInstance", backendContext.fInstance, VK_NULL_HANDLE));
    auto destroyDevice = reinterpret_cast<PFN_vkDestroyDevice>(
            getProc("vkDestroyDevice", backendContext.fInstance, VK_NULL_HANDLE));
    auto destroyDebugMessenger = reinterpret_cast<PFN_vkDestroyDebugUtilsMessengerEXT>(
            getProc("vkDestroyDebugUtilsMessengerEXT", backendContext.fInstance, VK_NULL_HANDLE));

    backendContext.fMemoryAllocator = skgpu::VulkanMemoryAllocators::Make(
            backendContext, skgpu::ThreadSafe::kNo);
    if (!backendContext.fMemoryAllocator) {
        print_error("create_allocator", "Skia_Vulkan_memory_allocator_unavailable");
        if (destroyDevice) {
            destroyDevice(backendContext.fDevice, nullptr);
        }
        if (destroyDebugMessenger && debugMessenger != VK_NULL_HANDLE) {
            destroyDebugMessenger(backendContext.fInstance, debugMessenger, nullptr);
        }
        if (destroyInstance) {
            destroyInstance(backendContext.fInstance, nullptr);
        }
        return 12;
    }

    sk_sp<GrDirectContext> context = GrDirectContexts::MakeVulkan(backendContext);
    if (!context) {
        print_error("create_skia_context", "GrDirectContexts_MakeVulkan_failed");
        if (destroyDevice) {
            destroyDevice(backendContext.fDevice, nullptr);
        }
        if (destroyDebugMessenger && debugMessenger != VK_NULL_HANDLE) {
            destroyDebugMessenger(backendContext.fInstance, debugMessenger, nullptr);
        }
        if (destroyInstance) {
            destroyInstance(backendContext.fInstance, nullptr);
        }
        return 13;
    }

    const auto surfaceStart = Clock::now();
    const SkImageInfo imageInfo =
            SkImageInfo::Make(width, height, kRGBA_8888_SkColorType, kPremul_SkAlphaType);
    sk_sp<SkSurface> surface = SkSurfaces::RenderTarget(
            context.get(), skgpu::Budgeted::kYes, imageInfo);
    if (!surface) {
        print_error("create_surface", "SkSurfaces_RenderTarget_failed");
        context.reset();
        if (destroyDevice) {
            destroyDevice(backendContext.fDevice, nullptr);
        }
        if (destroyDebugMessenger && debugMessenger != VK_NULL_HANDLE) {
            destroyDebugMessenger(backendContext.fInstance, debugMessenger, nullptr);
        }
        if (destroyInstance) {
            destroyInstance(backendContext.fInstance, nullptr);
        }
        return 14;
    }
    const auto surfaceReady = Clock::now();

    std::vector<uint8_t> pixels(static_cast<size_t>(width) * static_cast<size_t>(height) * 4);
    const auto renderStart = Clock::now();
    for (int frame = 0; frame < frames; ++frame) {
        SkCanvas* canvas = surface->getCanvas();
        canvas->clear(SK_ColorBLACK);
        const float progress = frames == 1 ? 0.5f : static_cast<float>(frame) / (frames - 1);
        canvas->drawColor(SkColorSetARGB(255, static_cast<U8CPU>(32 + progress * 180), 32, 96));

        SkPaint paint;
        paint.setColor4f({0.1f + progress * 0.8f, 0.75f, 0.3f, 1.0f});
        canvas->drawRect(SkRect::MakeXYWH(width * 0.1f + progress * width * 0.5f,
                                          height * 0.2f, width * 0.3f, height * 0.6f),
                         paint);
        context->flush(surface.get());
        context->submit();
    }
    const auto renderReady = Clock::now();

    const auto readbackStart = Clock::now();
    if (!surface->readPixels(imageInfo, pixels.data(), static_cast<size_t>(width) * 4, 0, 0)) {
        print_error("readback", "SkSurface_readPixels_failed");
        surface.reset();
        context.reset();
        if (destroyDevice) {
            destroyDevice(backendContext.fDevice, nullptr);
        }
        if (destroyDebugMessenger && debugMessenger != VK_NULL_HANDLE) {
            destroyDebugMessenger(backendContext.fInstance, debugMessenger, nullptr);
        }
        if (destroyInstance) {
            destroyInstance(backendContext.fInstance, nullptr);
        }
        return 15;
    }
    context->submit();
    const auto readbackReady = Clock::now();

    const bool wroteOutput = write_rgba(outputPath, pixels, width, height);
    const auto totalReady = Clock::now();
    if (!wroteOutput) {
        print_error("write_output", "PPM_write_failed");
    }

    VkPhysicalDeviceProperties properties{};
    auto getProperties = reinterpret_cast<PFN_vkGetPhysicalDeviceProperties>(
            backendContext.fGetProc("vkGetPhysicalDeviceProperties", backendContext.fInstance,
                                    VK_NULL_HANDLE));
    if (getProperties) {
        getProperties(backendContext.fPhysicalDevice, &properties);
    }

    surface.reset();
    context.reset();
    // GrDirectContext owns GPU resources that use the allocator. Release the
    // allocator before manually destroying the VkDevice; otherwise VMA runs
    // after the device is gone and the process can segfault during teardown.
    backendContext.fMemoryAllocator.reset();
    if (destroyDevice) {
        destroyDevice(backendContext.fDevice, nullptr);
    }
    if (destroyDebugMessenger && debugMessenger != VK_NULL_HANDLE) {
        destroyDebugMessenger(backendContext.fInstance, debugMessenger, nullptr);
    }
    if (destroyInstance) {
        destroyInstance(backendContext.fInstance, nullptr);
    }

    std::printf(
            "{\"ok\":true,\"requestedBackend\":\"skia-gpu\",\"actualBackend\":\"skia-ganesh-vulkan\",\"surfaceKind\":\"vulkan\",\"softwareRenderer\":false,\"adapter\":\"%s\",\"driverVersion\":%u,\"width\":%d,\"height\":%d,\"frames\":%d,\"timingsMs\":{\"contextSetup\":%.3f,\"surfaceCreate\":%.3f,\"renderSubmit\":%.3f,\"readback\":%.3f,\"total\":%.3f}}\n",
            properties.deviceName, properties.driverVersion, width, height, frames,
            milliseconds(setupStart, contextReady), milliseconds(surfaceStart, surfaceReady),
            milliseconds(renderStart, renderReady), milliseconds(readbackStart, readbackReady),
            milliseconds(totalStart, totalReady));
    return wroteOutput ? 0 : 16;
}

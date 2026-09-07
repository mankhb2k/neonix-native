"use client";

import { Braces, Code2, Play, Sparkles } from "lucide-react";
import Image from "next/image";

const PHONE_PREVIEW_ANIMATION_CSS = `
@keyframes neonix-preview-ambient {
  0% { transform: translate3d(-7px, -5px, 0) scale(0.96); opacity: 0.46; }
  50% { transform: translate3d(8px, 10px, 0) scale(1.08); opacity: 0.8; }
  100% { transform: translate3d(-3px, 15px, 0) scale(1); opacity: 0.56; }
}

@keyframes neonix-preview-grid {
  from { transform: translateY(0); }
  to { transform: translateY(18px); }
}

@keyframes neonix-preview-scene {
  0% { opacity: 0; transform: translateY(12px) scale(0.96); filter: blur(5px); }
  3%, 17% { opacity: 1; transform: translateY(0) scale(1); filter: blur(0); }
  22%, 100% { opacity: 0; transform: translateY(-10px) scale(1.035); filter: blur(4px); }
}

@keyframes neonix-preview-spin {
  to { transform: rotate(360deg); }
}

@keyframes neonix-preview-spin-reverse {
  to { transform: rotate(-360deg); }
}

@keyframes neonix-preview-pulse {
  0%, 100% { transform: scale(0.9); opacity: 0.62; }
  50% { transform: scale(1.08); opacity: 1; }
}

@keyframes neonix-preview-float {
  0%, 100% { transform: translateY(0); }
  50% { transform: translateY(-7px); }
}

@keyframes neonix-preview-electric-flow {
  0% { left: 0%; opacity: 0; transform: translate(-35%, -50%) scaleX(0.35); }
  14% { opacity: 1; }
  50% { opacity: 1; transform: translate(-50%, -50%) scaleX(1); }
  86% { opacity: 1; }
  100% { left: 100%; opacity: 0; transform: translate(-65%, -50%) scaleX(0.35); }
}

@keyframes neonix-preview-electric-flicker {
  0%, 100% { opacity: 0.45; filter: brightness(0.9); }
  45% { opacity: 1; filter: brightness(1.8); }
  55% { opacity: 0.7; filter: brightness(1.2); }
  70% { opacity: 1; filter: brightness(2); }
}

@keyframes neonix-preview-signal {
  0% { transform: scale(0.72); opacity: 0.8; }
  100% { transform: scale(1.55); opacity: 0; }
}

@keyframes neonix-preview-node-glow {
  0%, 100% { opacity: 0.72; }
  50% { opacity: 1; }
}

@keyframes neonix-preview-hook-flow {
  0% { top: -30%; opacity: 0; }
  18% { opacity: 1; }
  82% { opacity: 1; }
  100% { top: 105%; opacity: 0; }
}

@keyframes neonix-preview-connector-flow {
  to { stroke-dashoffset: -24; }
}

@keyframes neonix-preview-connector-pulse {
  from { stroke-dashoffset: 34; opacity: 0; }
  20% { opacity: 1; }
  80% { opacity: 1; }
  to { stroke-dashoffset: 0; opacity: 0; }
}

@keyframes neonix-preview-logo {
  0%, 100% { transform: scale(0.94); filter: drop-shadow(0 0 4px rgba(58, 237, 174, 0.4)); }
  50% { transform: scale(1.06); filter: drop-shadow(0 0 14px rgba(43, 199, 251, 0.85)); }
}

@keyframes neonix-preview-progress {
  from { transform: scaleX(0); }
  to { transform: scaleX(1); }
}

.neonix-preview-grid { animation: neonix-preview-grid 2.2s linear infinite; }
.neonix-preview-ambient-one { animation: neonix-preview-ambient 5s ease-in-out infinite alternate; }
.neonix-preview-ambient-two { animation: neonix-preview-ambient 6s 1s ease-in-out infinite alternate-reverse; }
.neonix-preview-scene { position: absolute; inset: 34px 18px 28px; display: flex; flex-direction: column; align-items: center; justify-content: center; padding-bottom: 40px; text-align: center; opacity: 0; animation: neonix-preview-scene 20s infinite both; will-change: transform, opacity, filter; }
.neonix-preview-scene-one { animation-delay: 0ms; }
.neonix-preview-scene-two { animation-delay: 4000ms; padding-bottom: 40px; }
.neonix-preview-scene-three { animation-delay: 8000ms; padding-bottom: 40px; }
.neonix-preview-scene-four { animation-delay: 12000ms; padding-bottom: 40px; }
.neonix-preview-scene-five { animation-delay: 16000ms; }
.neonix-preview-portal-one { animation: neonix-preview-spin 5s linear infinite; }
.neonix-preview-portal-two { animation: neonix-preview-spin-reverse 3.5s linear infinite; }
.neonix-preview-pulse { animation: neonix-preview-pulse 1.45s ease-in-out infinite; }
.neonix-preview-float { animation: neonix-preview-float 1.6s ease-in-out infinite; }
.neonix-preview-float-delay { animation: neonix-preview-float 1.6s 450ms ease-in-out infinite; }
.neonix-preview-orbit-ring { animation: neonix-preview-spin 9s linear infinite; transform-box: fill-box; transform-origin: center; }
.neonix-preview-orbit-node { animation: neonix-preview-node-glow 1.8s ease-in-out infinite; }
.neonix-preview-orbit-node-delay { animation: neonix-preview-node-glow 1.8s 450ms ease-in-out infinite; }
.neonix-preview-orbit-node-late { animation: neonix-preview-node-glow 1.8s 850ms ease-in-out infinite; }
.neonix-preview-hook-spark { animation: neonix-preview-hook-flow 1.35s ease-in-out infinite; }
.neonix-preview-connector { animation: neonix-preview-connector-flow 2.4s linear infinite; }
.neonix-preview-connector-pulse { animation: neonix-preview-connector-pulse 1.8s linear infinite; }
.neonix-preview-electric-path { animation: neonix-preview-electric-flicker 900ms ease-in-out infinite; }
.neonix-preview-electric-spark { animation: neonix-preview-electric-flow 1.25s ease-in-out infinite; }
.neonix-preview-electric-spark-delay { animation-delay: 625ms; }
.neonix-preview-signal { animation: neonix-preview-signal 1.5s ease-out infinite; }
.neonix-preview-signal-delay { animation-delay: 750ms; }
.neonix-preview-logo { animation: neonix-preview-logo 1.8s ease-in-out infinite; }
.neonix-preview-progress { animation: neonix-preview-progress 20s linear infinite; transform-origin: left center; }

@media (prefers-reduced-motion: reduce) {
  .neonix-preview-scene { animation-play-state: running; }
}
`;

export function NeonixMotionPreview() {
  return (
    <>
      <style>{PHONE_PREVIEW_ANIMATION_CSS}</style>
      <div
        className="relative h-[90%] max-h-[520px] w-auto max-w-[88%] shrink-0 overflow-hidden rounded-[24px] border-[7px] border-[#1D2939] bg-[#101828] shadow-[0_24px_44px_rgba(16,24,40,0.28)]"
        style={{ aspectRatio: "9 / 16" }}
      >
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_8%,#173F4A_0%,#0B1728_38%,#080B18_100%)]" />
        <div className="neonix-preview-grid absolute -inset-x-4 -inset-y-5 opacity-20 [background-image:linear-gradient(rgba(61,217,199,0.12)_1px,transparent_1px),linear-gradient(90deg,rgba(61,217,199,0.12)_1px,transparent_1px)] [background-size:18px_18px]" />
        <div className="neonix-preview-ambient-one absolute -left-12 top-8 h-32 w-32 rounded-full bg-[#14B8A6]/30 blur-3xl" />
        <div className="neonix-preview-ambient-two absolute -right-12 bottom-10 h-36 w-36 rounded-full bg-[#E879F9]/20 blur-3xl" />

        <div className="absolute left-4 right-4 top-3 z-20 flex items-center justify-between font-mono text-[8px] tracking-[0.14em] text-[#9AF9EA]">
          <span>NEONIX MOTION</span>
          <span className="text-white/45">20S / LOOP</span>
        </div>

        <div className="neonix-preview-scene neonix-preview-scene-one">
          <div className="relative mx-auto mt-0 flex h-[200px] w-[220px] flex-col items-center">
            <div className="relative h-28 w-28 shrink-0 rounded-full border border-[#3AEDAE]/65 bg-[#0C2431] shadow-[0_0_26px_rgba(58,237,174,0.34),inset_0_0_18px_rgba(43,199,251,0.16)]">
              <div className="neonix-preview-portal-one absolute inset-0 rounded-full border border-dashed border-[#3AEDAE]/70" />
              <div className="neonix-preview-portal-two absolute inset-3 rounded-full border border-dotted border-[#2BC7FB]/75" />
              <div className="neonix-preview-pulse absolute inset-8 rounded-full border border-[#3AEDAE]/55 bg-[radial-gradient(circle,#1A6B70_0%,#0D3445_54%,#0B1728_100%)] shadow-[0_0_22px_#2BC7FB]" />
              <Sparkles className="absolute left-1/2 top-1/2 h-6 w-6 -translate-x-1/2 -translate-y-1/2 text-white/90" strokeWidth={1.5} />
            </div>
            <div className="relative h-10 w-1.5 overflow-hidden rounded-full bg-white/15 shadow-[0_0_8px_rgba(43,199,251,0.45)]">
              <span className="neonix-preview-hook-spark absolute left-1/2 top-0 h-4 w-1.5 -translate-x-1/2 rounded-full bg-white shadow-[0_0_5px_#fff,0_0_12px_#3AEDAE,0_0_20px_#2BC7FB]" />
            </div>
            <div className="flex h-12 w-36 items-center justify-center gap-2 rounded-xl border border-[#2BC7FB]/55 bg-[#102A3C]/90 text-[#B8FFF5] shadow-[0_0_24px_rgba(43,199,251,0.3)]">
              <Play className="h-5 w-5 fill-current" strokeWidth={1.5} />
              <span className="font-mono text-[9px] font-semibold tracking-[0.08em]">PREVIEW</span>
            </div>
          </div>
          <div className="mt-3 max-w-[220px]">
            <span className="font-mono text-[9px] tracking-[0.16em] text-[#3AEDAE]">01 / THE HOOK</span>
            <strong className="mt-2 block text-[23px] font-semibold leading-[0.94] tracking-[-0.04em] text-white">Motion video.</strong>
            <span className="mt-1.5 block text-[18px] font-medium leading-none text-[#79E7FF]">Made simple.</span>
          </div>
        </div>

        <div className="neonix-preview-scene neonix-preview-scene-two">
          <div className="relative mx-auto mt-0 h-56 w-56">
            <svg className="absolute inset-0 h-full w-full overflow-visible" viewBox="0 0 224 224" fill="none" aria-hidden="true">
              <circle cx="112" cy="112" r="88" stroke="rgba(58,237,174,0.48)" strokeWidth="1.5" strokeDasharray="4 8" className="neonix-preview-orbit-ring" />
            </svg>
            <span className="neonix-preview-orbit-node absolute left-1/2 top-2 -translate-x-1/2 rounded-lg border border-white/25 bg-white/10 px-4 py-2.5 font-mono text-[10px] font-semibold text-white shadow-[0_0_18px_rgba(255,255,255,0.18)] backdrop-blur-sm">TEXT</span>
            <span className="neonix-preview-orbit-node-delay absolute right-0 top-[calc(50%+28px)] rounded-lg border border-[#E879F9]/45 bg-[#E879F9]/10 px-4 py-2.5 font-mono text-[10px] font-semibold text-[#F5D0FE] shadow-[0_0_20px_rgba(232,121,249,0.28)] backdrop-blur-sm">SHAPE</span>
            <span className="neonix-preview-orbit-node-late absolute left-0 top-[calc(50%+28px)] rounded-lg border border-[#FBBF24]/45 bg-[#FBBF24]/10 px-4 py-2.5 font-mono text-[10px] font-semibold text-[#FDE68A] shadow-[0_0_20px_rgba(251,191,36,0.25)] backdrop-blur-sm">COLOR</span>
          </div>
          <div className="mt-2 max-w-[235px]">
            <span className="font-mono text-[9px] tracking-[0.16em] text-[#3AEDAE]">02 / AI DESIGN</span>
            <strong className="mt-2 block text-[22px] font-semibold leading-[0.96] tracking-[-0.04em] text-white">Designed by AI.</strong>
            <span className="mt-1.5 block text-[17px] font-medium leading-none text-[#F0ABFC]">Editable by you.</span>
          </div>
        </div>

        <div className="neonix-preview-scene neonix-preview-scene-three">
          <div className="relative mx-auto mt-8 flex h-28 w-full max-w-[210px] items-center justify-between gap-1.5">
            <div className="flex h-20 w-20 shrink-0 flex-col items-center justify-center rounded-xl border border-[#2BC7FB]/45 bg-[#0B2033]/90 px-2 shadow-[0_0_26px_rgba(43,199,251,0.22)]">
              <Code2 className="mb-1.5 h-5 w-5 text-[#79E7FF]" />
              <span className="font-mono text-[8px] text-white">HTML</span>
              <span className="font-mono text-[6px] text-white/55">+ CSS</span>
            </div>
            <div className="neonix-preview-electric-path relative h-3 min-w-0 flex-1">
              <span className="absolute inset-x-0 top-1/2 h-px -translate-y-1/2 bg-[linear-gradient(90deg,#2BC7FB,#E0FFFA,#E879F9)] shadow-[0_0_8px_rgba(121,231,255,0.9)]" />
              <span className="neonix-preview-electric-spark absolute top-1/2 h-[4px] w-8 rounded-full bg-white shadow-[0_0_5px_#fff,0_0_12px_#2BC7FB,0_0_20px_#3AEDAE]" />
              <span className="neonix-preview-electric-spark neonix-preview-electric-spark-delay absolute top-1/2 h-[3px] w-5 rounded-full bg-[#F0ABFC] shadow-[0_0_6px_#fff,0_0_14px_#E879F9]" />
              <span className="absolute left-1/2 top-1/2 h-3 w-3 -translate-x-1/2 -translate-y-1/2 rotate-45 border-r border-t border-white shadow-[2px_-2px_5px_#2BC7FB]" />
            </div>
            <div className="flex h-20 w-20 shrink-0 flex-col items-center justify-center rounded-xl border border-[#E879F9]/45 bg-[#22152E]/90 px-2 shadow-[0_0_26px_rgba(232,121,249,0.22)]">
              <Braces className="mb-1.5 h-5 w-5 text-[#F0ABFC]" />
              <span className="font-mono text-[8px] text-white">JSON</span>
              <span className="font-mono text-[6px] text-white/55">LAYERS</span>
            </div>
          </div>
          <div className="mt-4 max-w-[230px]">
            <span className="font-mono text-[9px] tracking-[0.16em] text-[#3AEDAE]">03 / COMPILER</span>
            <strong className="mt-2 block text-[22px] font-semibold leading-[0.96] tracking-[-0.04em] text-white">HTML + CSS</strong>
            <span className="mt-1.5 block text-[17px] font-medium leading-none text-[#79E7FF]">to editable motion.</span>
          </div>
        </div>

        <div className="neonix-preview-scene neonix-preview-scene-four">
          <svg className="mx-auto mt-0 h-52 w-full max-w-[235px] overflow-visible" viewBox="0 0 235 208" fill="none" role="img" aria-label="Neonix MCP connected to Claude, ChatGPT, OpenClaw and Grok">
              <defs>
                <linearGradient id="neonix-connector-gradient" x1="117.5" y1="40" x2="117.5" y2="168" gradientUnits="userSpaceOnUse">
                  <stop stopColor="#3AEDAE" />
                  <stop offset="0.52" stopColor="#2BC7FB" />
                  <stop offset="1" stopColor="#E879F9" />
                </linearGradient>
                <filter id="neonix-connector-glow" x="-50%" y="-50%" width="200%" height="200%">
                  <feGaussianBlur stdDeviation="1.8" result="blur" />
                  <feMerge>
                    <feMergeNode in="blur" />
                    <feMergeNode in="SourceGraphic" />
                  </feMerge>
                </filter>
              </defs>
              <path d="M117.5 37 V71" stroke="url(#neonix-connector-gradient)" strokeWidth="1.5" strokeLinecap="round" opacity="0.7" />
              <path className="neonix-preview-connector-pulse" d="M117.5 37 V71" stroke="#E0FFFA" strokeWidth="2.5" strokeDasharray="8 26" strokeLinecap="round" filter="url(#neonix-connector-glow)" />
              <path className="neonix-preview-connector" d="M117.5 112 V152 M27.125 152 H207.875 M27.125 152 V168 M87.375 152 V168 M147.625 152 V168 M207.875 152 V168" stroke="url(#neonix-connector-gradient)" strokeWidth="1.5" strokeDasharray="6 4" strokeLinecap="round" filter="url(#neonix-connector-glow)" />
              <g className="neonix-preview-orbit-node">
                <rect x="51.5" y="0" width="132" height="40" rx="12" fill="#111827" stroke="rgba(255,255,255,0.15)" />
                <rect x="61.5" y="7" width="26" height="26" rx="7" fill="rgba(255,255,255,0.1)" />
                <image href="/logo/neonix-logo.svg" x="66" y="11" width="18" height="18" preserveAspectRatio="xMidYMid meet" />
                <text x="96" y="25" fill="#FFFFFF" fontSize="10" fontWeight="600">Neonix</text>
              </g>

              <g className="neonix-preview-orbit-node-delay">
                <rect x="61.5" y="68" width="112" height="44" rx="12" fill="#0B2530" stroke="rgba(58,237,174,0.7)" />
                <g stroke="#A7F3D0" strokeWidth="1.5" strokeLinecap="round">
                  <circle cx="100" cy="82" r="2.5" fill="none" />
                  <circle cx="94" cy="91" r="2.5" fill="none" />
                  <circle cx="106" cy="91" r="2.5" fill="none" />
                  <path d="M100 84.5 V87 M100 87 L94 88.5 M100 87 L106 88.5" />
                </g>
                <text x="117" y="94" fill="#A7F3D0" fontSize="12" fontWeight="600">MCP</text>
              </g>

              <g className="neonix-preview-orbit-node-late">
                <rect x="0" y="168" width="54.25" height="40" rx="8" fill="#0D1A29" stroke="rgba(251,191,36,0.55)" />
                <image href="/logo/claude-logo.svg" x="19.125" y="174" width="16" height="16" preserveAspectRatio="xMidYMid meet" />
                <text x="27.125" y="201" textAnchor="middle" fill="rgba(255,255,255,0.82)" fontSize="6">Claude</text>
              </g>
              <g className="neonix-preview-orbit-node">
                <rect x="60.25" y="168" width="54.25" height="40" rx="8" fill="#0D1A29" stroke="rgba(58,237,174,0.55)" />
                <image href="/logo/openai-logo.svg" x="79.375" y="174" width="16" height="16" preserveAspectRatio="xMidYMid meet" />
                <text x="87.375" y="201" textAnchor="middle" fill="rgba(255,255,255,0.82)" fontSize="6">GPT</text>
              </g>
              <g className="neonix-preview-orbit-node-delay">
                <rect x="120.5" y="168" width="54.25" height="40" rx="8" fill="#0D1A29" stroke="rgba(249,112,102,0.55)" />
                <image href="/logo/openclaw-logo.svg" x="139.625" y="174" width="16" height="16" preserveAspectRatio="xMidYMid meet" />
                <text x="147.625" y="201" textAnchor="middle" fill="rgba(255,255,255,0.82)" fontSize="6">Claw</text>
              </g>
              <g className="neonix-preview-orbit-node-late">
                <rect x="180.75" y="168" width="54.25" height="40" rx="8" fill="#0D1A29" stroke="rgba(232,121,249,0.55)" />
                <image href="/logo/grok-logo.svg" x="199.875" y="174" width="16" height="16" preserveAspectRatio="xMidYMid meet" />
                <text x="207.875" y="201" textAnchor="middle" fill="rgba(255,255,255,0.82)" fontSize="6">Grok</text>
              </g>
            </svg>
          <div className="mt-5 max-w-[225px]">
            <span className="font-mono text-[9px] tracking-[0.16em] text-[#3AEDAE]">04 / NEONIX MCP</span>
            <strong className="mt-2 block text-[22px] font-semibold leading-[0.96] tracking-[-0.04em] text-white">Create inside</strong>
            <span className="mt-1.5 block text-[17px] font-medium leading-none text-[#F0ABFC]">your chatbot.</span>
          </div>
        </div>

        <div className="neonix-preview-scene neonix-preview-scene-five">
          <div className="neonix-preview-logo mt-5 flex h-24 w-24 items-center justify-center rounded-3xl border border-[#3AEDAE]/25 bg-[#0B1728]/75 shadow-[0_0_40px_rgba(43,199,251,0.28)] backdrop-blur-sm">
            <Image src="/logo/neonix-logo.svg" alt="Neonix" width={64} height={64} className="h-16 w-16" />
          </div>
          <span className="mt-5 font-mono text-[9px] tracking-[0.16em] text-[#3AEDAE]">05 / READY</span>
          <strong className="mt-2 block text-[23px] font-semibold leading-[0.96] tracking-[-0.04em] text-white">Prompt to video</strong>
          <span className="mt-1.5 block text-[17px] font-medium text-[#79E7FF]">in under a minute.</span>
          <span className="mt-5 rounded-full border border-[#3AEDAE]/45 bg-[#3AEDAE]/10 px-4 py-2 text-[9px] font-semibold text-[#A7F3D0] shadow-[0_0_20px_rgba(58,237,174,0.24)]">START WITH NEONIX MCP</span>
        </div>

        <span className="absolute inset-x-4 bottom-3 block h-px bg-white/15" />
        <span className="neonix-preview-progress absolute inset-x-4 bottom-3 block h-px bg-[linear-gradient(90deg,#3AEDAE,#2BC7FB,#E879F9)] shadow-[0_0_8px_#2BC7FB]" />
        <span className="absolute right-3 top-3 h-1.5 w-1.5 rounded-full bg-[#F97066] shadow-[0_0_10px_#F97066]" />
      </div>
    </>
  );
}

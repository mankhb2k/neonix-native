import { expect, test } from "@playwright/test";

type AudioProbe = {
  contextStates: string[];
  sourceCount: number;
  playingElements: number;
  rms: number;
};

test.describe("real Web Audio mix output", () => {
  test("renders non-silent video embedded audio plus music through the output graph", async ({ page }) => {
    await page.addInitScript(() => {
      const scope = window as typeof window & {
        __neonixAudioProbe?: {
          contexts: Set<AudioContext>;
          sources: Set<MediaElementAudioSourceNode>;
          elements: Set<HTMLAudioElement>;
          analysers: AnalyserNode[];
        };
      };
      const probe = {
        contexts: new Set<AudioContext>(),
        sources: new Set<MediaElementAudioSourceNode>(),
        elements: new Set<HTMLAudioElement>(),
        analysers: [] as AnalyserNode[],
      };
      scope.__neonixAudioProbe = probe;

      const AudioContextCtor = window.AudioContext;
      if (!AudioContextCtor) return;
      const originalCreate = AudioContextCtor.prototype.createMediaElementSource;
      AudioContextCtor.prototype.createMediaElementSource = function (element: HTMLAudioElement) {
        const source = originalCreate.call(this, element);
        const analyser = this.createAnalyser();
        analyser.fftSize = 2048;
        source.connect(analyser);
        // Keep the probe branch in the rendered graph without adding audible gain.
        const silent = this.createGain();
        silent.gain.value = 0;
        analyser.connect(silent);
        silent.connect(this.destination);
        probe.contexts.add(this);
        probe.sources.add(source);
        probe.elements.add(element);
        probe.analysers.push(analyser);
        return source;
      };
    });

    await page.goto("/docs/preview?case=audio.mix.video-plus-music");
    await expect(page.getByTestId("audio-fixture-preview")).toBeVisible();
    await expect(page.getByTestId("audio-mix-topology")).toContainText("2 independent inputs");

    const play = page.getByTestId("audio-clip-play-toggle");
    await expect(play).toBeVisible();
    await play.click();

    await expect.poll(
      () => page.evaluate<AudioProbe>(() => {
        const probe = (window as typeof window & { __neonixAudioProbe?: { contexts: Set<AudioContext>; sources: Set<MediaElementAudioSourceNode>; elements: Set<HTMLAudioElement>; analysers: AnalyserNode[] } }).__neonixAudioProbe;
        if (!probe) return { contextStates: [], sourceCount: 0, playingElements: 0, rms: 0 };
        let sum = 0;
        let count = 0;
        for (const analyser of probe.analysers) {
          const data = new Uint8Array(analyser.fftSize);
          analyser.getByteTimeDomainData(data);
          for (const value of data) {
            const sample = (value - 128) / 128;
            sum += sample * sample;
            count += 1;
          }
        }
        return {
          contextStates: [...probe.contexts].map((context) => context.state),
          sourceCount: probe.sources.size,
          playingElements: [...probe.elements].filter((element) => !element.paused && element.currentTime > 0).length,
          rms: count ? Math.sqrt(sum / count) : 0,
        };
      }),
      { timeout: 20_000, intervals: [100, 250, 500] },
    ).toMatchObject({ sourceCount: 2, playingElements: 2 });

    await expect.poll(
      () => page.evaluate(() => {
        const probe = (window as typeof window & { __neonixAudioProbe?: { analysers: AnalyserNode[] } }).__neonixAudioProbe;
        if (!probe?.analysers.length) return 0;
        let sum = 0;
        let count = 0;
        for (const analyser of probe.analysers) {
          const data = new Uint8Array(analyser.fftSize);
          analyser.getByteTimeDomainData(data);
          for (const value of data) {
            const sample = (value - 128) / 128;
            sum += sample * sample;
            count += 1;
          }
        }
        return count ? Math.sqrt(sum / count) : 0;
      }),
      { timeout: 20_000, intervals: [100, 250, 500] },
    ).toBeGreaterThan(0.01);
  });
});

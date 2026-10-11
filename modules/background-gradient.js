// One fixed background for every route; load the GPU engine only when motion is allowed.
export function createBackgroundGradient(host, loadShader = () => import("../vendor/shaders/shaders-4.0.3.js")) {
  const motion = window.matchMedia("(prefers-reduced-motion: reduce)");
  let shader = null;
  let generation = 0;
  let mounted = false;
  let disabled = false;
  let ready = false;
  let recovering = false;
  let deadline = 0;
  let monitorFrame = 0;
  let emphasized = false;
  let emphasis = 0;
  let emphasisFrame = 0;

  function mixColor(from, to) {
    const channels = [1, 3, 5].map((offset) => {
      const start = parseInt(from.slice(offset, offset + 2), 16);
      const end = parseInt(to.slice(offset, offset + 2), 16);
      return Math.round(start + (end - start) * emphasis).toString(16).padStart(2, "0");
    });
    return `#${channels.join("")}`;
  }

  function palette() {
    const dark = document.documentElement.dataset.theme === "dark";
    return dark
      ? { colorA: "#111d31", colorB: mixColor("#2463bd", "#347de3"), colorC: mixColor("#172b49", "#16437d"), colorD: "#111d31" }
      : { colorA: "#ffffff", colorB: mixColor("#0d6bff", "#064dcc"), colorC: mixColor("#e6f0ff", "#91baff"), colorD: "#ffffff" };
  }

  function effectProps() {
    return { ...palette(), speed: 0.6 + emphasis * 0.55, distortion: 1.35 + emphasis * 0.5 };
  }

  function destroy(instance) {
    // Cleanup must not prevent the CSS background from taking over.
    try { instance?.destroy(); } catch { /* The device may already be gone. */ }
  }

  function fallback(reason) {
    disabled = true;
    stop();
    host.dataset.state = "fallback";
    host.dataset.reason = reason;
  }

  function updateShader() {
    if (!shader || recovering || disabled) return;
    try { shader.update("background-flow", effectProps()); }
    catch { fallback("update-failed"); }
  }

  function cancelFrames() {
    cancelAnimationFrame(emphasisFrame);
    cancelAnimationFrame(monitorFrame);
    emphasisFrame = monitorFrame = 0;
  }

  function armDeadline() {
    clearTimeout(deadline);
    deadline = 0;
    if (ready || disabled || document.hidden) return;
    const current = generation;
    deadline = setTimeout(() => {
      if (current === generation) fallback(recovering ? "recovery-timeout" : "initialization-timeout");
    }, 10000);
  }

  function monitorPerformance() {
    cancelAnimationFrame(monitorFrame);
    monitorFrame = 0;
    if (!shader || !ready || recovering || document.hidden || motion.matches) return;
    const current = generation;
    // Measure visible-page frame cadence, including compositing the blurred canvas.
    // Ignore warmup and require three slow 2s windows to avoid isolated stalls.
    const warmupUntil = performance.now() + 3000;
    let windowStart = 0;
    let frames = 0;
    let slowWindows = 0;
    function sample(now) {
      monitorFrame = 0;
      if (current !== generation || !ready || recovering || document.hidden) return;
      if (now < warmupUntil) {
        monitorFrame = requestAnimationFrame(sample);
        return;
      }
      if (!windowStart) windowStart = now;
      else frames += 1;
      const elapsed = now - windowStart;
      if (elapsed >= 2000) {
        slowWindows = frames * 1000 / elapsed < 24 ? slowWindows + 1 : 0;
        if (slowWindows >= 3) {
          fallback("low-frame-rate");
          return;
        }
        windowStart = now;
        frames = 0;
      }
      monitorFrame = requestAnimationFrame(sample);
    }
    monitorFrame = requestAnimationFrame(sample);
  }

  function animateEmphasis() {
    cancelAnimationFrame(emphasisFrame);
    emphasisFrame = 0;
    const target = emphasized ? 1 : 0;
    if (!shader || recovering || disabled || document.hidden || motion.matches) {
      emphasis = target;
      updateShader();
      return;
    }
    if (emphasis === target) return;
    let previous = performance.now();
    const current = generation;
    function step(now) {
      emphasisFrame = 0;
      if (current !== generation || !shader || recovering || disabled) return;
      const delta = Math.min(now - previous, 80);
      previous = now;
      emphasis += (target - emphasis) * (1 - Math.exp(-delta / 180));
      if (Math.abs(target - emphasis) < 0.002) emphasis = target;
      updateShader();
      if (current === generation && emphasis !== target) emphasisFrame = requestAnimationFrame(step);
    }
    emphasisFrame = requestAnimationFrame(step);
  }

  function setEmphasis(active) {
    if (active === emphasized) return;
    emphasized = active;
    host?.classList.toggle("is-emphasized", active);
    animateEmphasis();
  }

  function syncAnimation() {
    armDeadline();
    if (!shader) return;
    // The library owns device rebuilding; touching its old renderer can interrupt it.
    if (recovering) {
      cancelFrames();
      return;
    }
    try {
      if (document.hidden || motion.matches) shader.pause();
      else shader.resume();
    } catch {
      fallback("animation-failed");
      return;
    }
    animateEmphasis();
    monitorPerformance();
  }

  function stop() {
    generation += 1;
    cancelFrames();
    clearTimeout(deadline);
    deadline = 0;
    ready = recovering = false;
    document.removeEventListener("visibilitychange", syncAnimation);
    const instance = shader;
    shader = null;
    destroy(instance);
    host?.replaceChildren();
    if (host) host.dataset.state = "static";
  }

  async function start() {
    if (!host || !mounted) return;
    if (disabled) {
      host.dataset.state = "fallback";
      return;
    }
    if (motion.matches || !navigator.gpu) {
      host.dataset.state = motion.matches ? "static" : "fallback";
      host.dataset.reason = motion.matches ? "reduced-motion" : "webgpu-unavailable";
      return;
    }
    const current = ++generation;
    const active = () => current === generation;
    ready = recovering = false;
    delete host.dataset.reason;
    host.dataset.state = "loading";
    document.addEventListener("visibilitychange", syncAnimation);
    armDeadline();
    try {
      const { createShader } = await loadShader();
      if (!active()) return;
      // Each initialization owns a canvas, including live reduced-motion changes.
      const canvas = document.createElement("canvas");
      canvas.style.width = "100%";
      canvas.style.height = "100%";
      host.replaceChildren(canvas);
      const instance = await createShader(canvas, {
        components: [{
          type: "FlowingGradient",
          id: "background-flow",
          props: { ...effectProps(), seed: 7, colorSpace: "oklab" }
        }]
      }, {
        disableTelemetry: true,
        onReady() {
          if (!active()) return;
          ready = true;
          recovering = false;
          clearTimeout(deadline);
          deadline = 0;
          host.dataset.state = "ready";
          // onReady can precede the createShader promise resolving.
          if (shader) {
            updateShader();
            if (active()) syncAnimation();
          }
        },
        onError() {
          if (!active()) return;
          // Shaders 4.0.3 reports device loss with a null failure reason while
          // rebuilding, and a non-null reason for terminal initialization/render errors.
          if (shader && shader.getFailureReason() === null) {
            ready = false;
            recovering = true;
            host.dataset.state = "recovering";
            cancelFrames();
            armDeadline();
          } else fallback("gpu-error");
        }
      });
      if (!active()) {
        destroy(instance);
        return;
      }
      shader = instance;
      updateShader();
      if (!active()) return;
      syncAnimation();
    } catch {
      if (active()) {
        fallback("initialization-failed");
      }
    }
  }

  function mount() {
    if (!host || mounted) return;
    mounted = true;
    void start();
  }

  motion.addEventListener("change", () => {
    stop();
    if (!motion.matches) void start();
  });
  window.addEventListener("pagehide", stop);
  window.addEventListener("pageshow", (event) => {
    if (event.persisted) void start();
  });

  return { mount, setEmphasis, updateTheme: updateShader };
}

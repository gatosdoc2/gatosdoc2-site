// Decorative only (decision 0035): cat eyes follow the pointer and blink now and then.
// No data collected, no network, nothing breaks without it. Off with "reduzir movimento" or "Pausar animações".
(() => {
  const reduz = matchMedia("(prefers-reduced-motion: reduce)");
  const parado = () => reduz.matches || document.getElementById("pausar-animacoes")?.checked;
  const pupilas = [...document.querySelectorAll(".espiao .pupilas, .olhar .pupilas")];
  if (!pupilas.length) return;
  document.documentElement.classList.add("olhos-js");
  let x = 0, y = 0, quadro = 0;
  const mexe = () => {
    quadro = 0;
    if (parado()) return;
    for (const p of pupilas) {
      const r = p.closest("svg").getBoundingClientRect();
      const dx = x - (r.left + r.width / 2), dy = y - (r.top + r.height / 2), d = Math.hypot(dx, dy) || 1, k = Math.min(1, d / 200) * 3;
      p.style.transform = `translate(${((dx / d) * k).toFixed(2)}px, ${((dy / d) * k).toFixed(2)}px)`;
    }
  };
  addEventListener("pointermove", (e) => { x = e.clientX; y = e.clientY; if (!quadro) quadro = requestAnimationFrame(mexe); }, { passive: true });
  const pisca = () => {
    if (!parado()) for (const g of document.querySelectorAll(".espiao, .olhar")) { g.classList.add("pisca"); setTimeout(() => g.classList.remove("pisca"), 350); }
    setTimeout(pisca, 3500 + Math.random() * 4000);
  };
  setTimeout(pisca, 2500);
})();

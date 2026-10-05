/* Texturas procedurais (canvas): nada é baixado da internet. */
import * as THREE from "three";

function canvasTex(w: number, h: number, draw: (g: CanvasRenderingContext2D) => void, repeat?: [number, number], color = true) {
  const c = document.createElement("canvas"); c.width = w; c.height = h;
  draw(c.getContext("2d")!);
  const t = new THREE.CanvasTexture(c);
  if (color) t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 8;
  if (repeat) { t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(...repeat); }
  return t;
}

/** banda de rodagem: blocos em "V" (usada como cor e relevo) */
export function treadTexture() {
  return canvasTex(256, 128, (g) => {
    g.fillStyle = "#2a2d31"; g.fillRect(0, 0, 256, 128);
    g.strokeStyle = "#08090a"; g.lineWidth = 10; g.lineCap = "square";
    for (let x = -64; x < 320; x += 32) {
      g.beginPath(); g.moveTo(x, 0); g.lineTo(x + 26, 64); g.lineTo(x, 128); g.stroke();
    }
    g.fillStyle = "#08090a"; g.fillRect(0, 30, 256, 6); g.fillRect(0, 92, 256, 6);
  }, [18, 1], false);
}

/** pneu (lateral): anel com leve textura */
export function sidewallTexture() {
  return canvasTex(256, 256, (g) => {
    g.fillStyle = "#16181b"; g.fillRect(0, 0, 256, 256);
    g.strokeStyle = "#202327"; g.lineWidth = 2;
    for (let r = 70; r < 128; r += 6) { g.beginPath(); g.arc(128, 128, r, 0, Math.PI * 2); g.stroke(); }
    g.fillStyle = "#2a2e33"; g.font = "700 15px system-ui"; g.textAlign = "center";
    for (let i = 0; i < 4; i++) { g.save(); g.translate(128, 128); g.rotate((i * Math.PI) / 2); g.fillText("205/50 R17", 0, -104); g.restore(); }
  });
}

/** grade inferior em colmeia */
export function honeycombTexture() {
  return canvasTex(256, 128, (g) => {
    g.fillStyle = "#050607"; g.fillRect(0, 0, 256, 128);
    g.strokeStyle = "#2b3036"; g.lineWidth = 2.2;
    const r = 9, h = r * Math.sqrt(3);
    for (let y = 0, row = 0; y < 140; y += h / 2, row++)
      for (let x = row % 2 ? r * 1.5 : 0; x < 270; x += r * 3) {
        g.beginPath();
        for (let k = 0; k < 6; k++) { const a = (k / 6) * Math.PI * 2; g.lineTo(x + r * Math.cos(a), y + r * Math.sin(a)); }
        g.closePath(); g.stroke();
      }
  }, [3, 1]);
}

/** couro perfurado/costurado dos bancos */
export function seatTexture(base = "#3a4048") {
  return canvasTex(256, 256, (g) => {
    g.fillStyle = base; g.fillRect(0, 0, 256, 256);
    g.fillStyle = "rgba(0,0,0,.35)";
    for (let y = 8; y < 256; y += 14) for (let x = (y / 14) % 2 ? 8 : 15; x < 256; x += 14) { g.beginPath(); g.arc(x, y, 1.6, 0, 7); g.fill(); }
    g.strokeStyle = "rgba(0,0,0,.45)"; g.lineWidth = 4;
    for (let y = 0; y < 256; y += 64) { g.beginPath(); g.moveTo(0, y); g.lineTo(256, y); g.stroke(); }
    g.strokeStyle = "rgba(47,211,192,.55)"; g.lineWidth = 1.5; g.setLineDash([5, 4]);
    for (let y = 6; y < 256; y += 64) { g.beginPath(); g.moveTo(0, y); g.lineTo(256, y); g.stroke(); }
  }, [1, 1]);
}

/** carpete */
export function carpetTexture() {
  return canvasTex(256, 256, (g) => {
    g.fillStyle = "#1b1e22"; g.fillRect(0, 0, 256, 256);
    const img = g.getImageData(0, 0, 256, 256);
    for (let i = 0; i < img.data.length; i += 4) { const n = (Math.random() - 0.5) * 22; img.data[i] += n; img.data[i + 1] += n; img.data[i + 2] += n; }
    g.putImageData(img, 0, 0);
  }, [6, 4]);
}

/** tela de alto-falante */
export function speakerTexture() {
  return canvasTex(128, 128, (g) => {
    g.fillStyle = "#0e1013"; g.fillRect(0, 0, 128, 128);
    g.fillStyle = "#2a2f35";
    for (let y = 4; y < 128; y += 7) for (let x = 4; x < 128; x += 7) { g.beginPath(); g.arc(x, y, 1.6, 0, 7); g.fill(); }
  });
}

/** quadro de instrumentos */
export function clusterTexture() {
  return canvasTex(512, 192, (g) => {
    g.fillStyle = "#06090c"; g.fillRect(0, 0, 512, 192);
    g.fillStyle = "#e9f2f1"; g.font = "700 84px system-ui, sans-serif"; g.textAlign = "center"; g.fillText("0", 256, 112);
    g.font = "500 22px system-ui, sans-serif"; g.fillStyle = "#8fa0a8"; g.fillText("km/h", 256, 146);
    g.textAlign = "left"; g.fillStyle = "#2fd3c0"; g.font = "700 30px system-ui, sans-serif"; g.fillText("P", 40, 108);
    g.textAlign = "right"; g.fillStyle = "#e9f2f1"; g.font = "600 30px system-ui, sans-serif"; g.fillText("38%", 470, 92);
    g.fillStyle = "#8fa0a8"; g.font = "500 20px system-ui, sans-serif"; g.fillText("148 km", 470, 124);
    g.fillStyle = "#1e9e5a"; g.fillRect(360, 150, 110 * 0.38, 8); g.strokeStyle = "#3a4650"; g.strokeRect(360, 150, 110, 8);
  });
}

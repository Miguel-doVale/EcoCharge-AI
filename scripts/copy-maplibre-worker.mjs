/* Copia o worker do MapLibre para public/ (o bundler do Next não resolve o worker
   sozinho). Roda antes de `npm run dev` e `npm run build`; mantém a versão sempre
   igual à do pacote instalado. */
import { copyFileSync, mkdirSync } from "node:fs";

mkdirSync("public/maplibre", { recursive: true });
copyFileSync("node_modules/maplibre-gl/dist/maplibre-gl-worker.mjs", "public/maplibre/maplibre-gl-worker.mjs");

export const fmtDist = (m: number) =>
  m < 1000 ? `${Math.max(10, Math.round(m / 10) * 10)} m` : `${(m / 1000).toFixed(1).replace(".", ",")} km`;

export const fmtMin = (s: number) => {
  const m = Math.max(1, Math.round(s / 60));
  return m < 60 ? `${m} min` : `${Math.floor(m / 60)} h ${m % 60} min`;
};

export const fmtKw = (k: number) => `${String(k).replace(".", ",")} kW`;

export const clock = (sec: number) =>
  new Date(Date.now() + sec * 1000).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });

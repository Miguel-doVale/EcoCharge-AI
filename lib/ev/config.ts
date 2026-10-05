/* =========================================================
   CONFIGURAÇÃO GERAL DO NAVEGADOR (editar aqui)
   ========================================================= */
export const CFG = {
  seed: 20260925, // muda a cidade gerada
  quadra: 150, // tamanho da quadra em metros
  colunas: 26,
  linhas: 22, // tamanho da malha urbana
  qtdCarregadores: 15,
  qtdEVs: 70,
  veiculo: {
    nome: "BYD Dolphin",
    bateriaKWh: 60.48,
    consumoKWhKm: 0.155,
    bateriaInicial: 38,
  },
  velocidadeSimulacao: 42, // m/s do carro na navegação simulada (acelerada)
  velocidadeMedia: 8.3, // m/s usada no tempo estimado (~30 km/h)
  aceleracaoRecarga: 25, // multiplica a velocidade da recarga simulada
  intervaloAoVivo: 2600, // ms entre atualizações de status dos conectores
  reservaMin: 15, // minutos que uma reserva segura o conector
  zoomMin: 0.12,
  zoomMax: 3.2,
  zoomInicial: 0.9,
  zoomNavegacao: 1.25,
  zoomAgruparEVs: 0.55, // abaixo disso, EVs viram grupos
} as const;

export type Palette = {
  land: string; park: string; water: string; waterLabel: string;
  bldg: string; bldgEdge: string; bldgTop: string; bldgWall: string;
  minor: string; minorCase: string; major: string; majorCase: string;
  label: string; halo: string; parkLabel: string;
  route: string; routeCase: string; ev: string;
};

export const PALETA_DIA: Palette = {
  land: "#EEEEE9", park: "#CFE6C4", water: "#A7C8EC", waterLabel: "#3F6FA3",
  bldg: "#E2E1DA", bldgEdge: "#D3D2CB", bldgTop: "#F3F2EC", bldgWall: "#CBC9C0",
  minor: "#FFFFFF", minorCase: "#D8D7D0", major: "#FFE7A1", majorCase: "#E0BE66",
  label: "#474C54", halo: "rgba(255,255,255,.95)", parkLabel: "#3E7B45",
  route: "#2F6FE4", routeCase: "#1B4FB5", ev: "#12907F",
};

export const PALETA_NOITE: Palette = {
  land: "#161A20", park: "#1B2E22", water: "#0D2740", waterLabel: "#7FA9D4",
  bldg: "#20252D", bldgEdge: "#2A3039", bldgTop: "#2B323C", bldgWall: "#1A1E24",
  minor: "#353C47", minorCase: "#22272E", major: "#6B5B36", majorCase: "#4A3F27",
  label: "#B9BFC8", halo: "rgba(20,23,29,.95)", parkLabel: "#7DB889",
  route: "#5B92FF", routeCase: "#2D5DC4", ev: "#2FC0AA",
};

export const COR_STATUS = {
  ok: "#1E9E5A",
  warn: "#D99A04",
  full: "#D83A2E",
  off: "#8B9199",
} as const;

export const NOMES_AV_V: Record<number, string> = {
  0: "Av. Norte-Sul", 5: "Av. Paulo Freire", 10: "Av. Tecnológica",
  15: "Av. Santos Dumont", 20: "Av. das Palmeiras", 25: "Av. Litorânea",
};
export const NOMES_AV_H: Record<number, string> = {
  0: "Av. das Nações", 4: "Av. Central", 8: "Av. Brasil",
  12: "Av. Beira-Rio", 16: "Av. dos Ipês", 20: "Av. Sul",
};
export const NOMES_RUAS = [
  "Rua das Acácias", "Rua do Sol", "Rua da Paz", "Rua Tupinambás", "Rua dos Cravos",
  "Rua Grajaú", "Rua do Egito", "Rua Aurora", "Rua das Hortas", "Rua Formosa",
  "Rua da Estrela", "Rua dos Ferreiros", "Rua Oswaldo Cruz", "Rua do Norte",
  "Rua das Flores", "Rua Santa Rita", "Rua dos Remédios", "Rua do Giz", "Rua da Palma",
  "Rua das Mangueiras", "Rua Cândido Ribeiro", "Rua dos Afogados", "Rua do Passeio",
  "Rua São Pantaleão", "Rua do Mocambo", "Rua dos Prazeres", "Rua da Saudade",
  "Rua do Alecrim", "Rua Afonso Pena", "Rua do Coqueiro", "Rua das Laranjeiras",
  "Rua do Machado", "Rua dos Craveiros", "Rua do Cajueiro", "Rua Rio Branco",
  "Rua das Violetas", "Rua do Riachuelo", "Rua da Cascata", "Rua dos Pinheiros",
  "Rua Silva Jardim",
];
export const NOMES_CARREGADORES = [
  "Hub Beira-Rio", "Shopping Rio Claro", "Posto Central", "Mercado das Palmeiras",
  "Estacionamento Norte", "Hotel Atlântico", "Campus Tecnológico", "Hub Santos Dumont",
  "Praça dos Ipês", "Garagem Sul", "Supermercado Nações", "Centro Empresarial",
  "Posto Litorânea", "Arena Municipal", "Hub Paulo Freire",
];
export const OPERADORAS = ["Voltra", "EletroPonto", "Carga Norte", "Recarga Já", "Ponto Verde"];
export const COMODIDADES = ["Café", "Banheiro", "Wi-Fi", "Coberto", "Loja", "Restaurante", "Segurança 24h"];
export const MODELOS_EV = [
  "BYD Dolphin", "BYD Seal", "BYD Yuan Plus", "BYD Dolphin Mini", "Volvo EX30",
  "GWM Ora 03", "Renault Kwid E-Tech", "BMW iX1", "Peugeot e-2008", "Chevrolet Bolt",
];
export const NOME_RIO = "Rio Claro";
export const NOME_PARQUE = "Parque das Mangueiras";

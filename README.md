# EcoCharge AI

Site + navegador automotivo para carros elétricos. Mapa estilo Google Maps com carregadores, disponibilidade por conector ao vivo, rota até o posto, navegação e recarga simulada.

**Stack:** Next.js 16 (App Router) · React 19 · Tailwind CSS 4 · GSAP (ScrollTrigger, SplitText) · Three.js (React Three Fiber + drei) · Spline · Lenis · Motion (Framer Motion)

## Rodar

```bash
npm install
npm run dev        # http://localhost:3000
npm run build      # build de produção
```

## Rotas

| Rota          | O que é                                                                 |
| ------------- | ----------------------------------------------------------------------- |
| `/`           | Landing: hero 3D, "como funciona" com scroll fixado, carro 3D, recursos |
| `/navegador`  | O navegador EV em tela cheia                                            |

## Onde cada biblioteca é usada

| Biblioteca | Onde |
| --- | --- |
| **Three.js / R3F** | `components/landing/HeroScene.tsx`: cidade 3D gerada com o **mesmo mundo** do navegador (prédios, ruas, rio, carregadores como faróis coloridos, EVs circulando, seu carro seguindo a rota) |
| **GSAP** | Título com SplitText e parallax do hero (`Hero.tsx`), seção fixada que monta o mapa camada por camada (`HowItWorks.tsx`), linha da arquitetura (`Architecture.tsx`) e ícone de curva (`components/nav/Navigator.tsx`) |
| **MapLibre GL** | `lib/ev/engine.ts`: mapa real de São Luís (tiles do OpenFreeMap/OpenStreetMap, sem chave), inclinado e girando com o carro na navegação |
| **Lenis** | `components/landing/SmoothScroll.tsx`: scroll suave sincronizado com o ticker do GSAP |
| **Motion** | Painel inferior arrastável, transição entre telas do painel, lista que se reordena ao vivo, números animados, gráfico de ocupação, anel de recarga, toasts, contadores, bento e botão magnético |
| **Three.js (carro)** | `components/landing/car/`: hatch elétrico 3D com porta clicável. A câmera entra pela porta, senta no banco e para de frente para a central, onde o navegador real (`/navegador`) roda num iframe |
| **Spline** | `components/landing/SplineStage.tsx`: opcional. Só aparece no lugar do carro se `NEXT_PUBLIC_SPLINE_SCENE` estiver definida |

## Navegador: o que faz

- **Mapa real de São Luís** (Ponta d'Areia, São Francisco, Renascença, Cohafuma, Calhau) com arrastar, pinça, roda do mouse, duplo toque e teclado.
- Prédios em 3D quando o zoom está próximo.
- 16 carregadores **simulados** em pontos reais da região (UNDB, Tropical Shopping, Lagoa da Jansen, Litorânea…), com número de vagas livres e cor de status. O marcador pulsa quando o status muda.
- EVs circulando pelas ruas reais (respeitando mão única), agrupados em clusters ao afastar o zoom.
- Card do posto: conectores totais/livres/ocupados/kW, cada conector com previsão de liberação, gráfico de **ocupação típica por hora**, comodidades, preço e nota.
- **Reserva de conector** por 15 min, com contagem regressiva. Ao chegar, a recarga começa no conector reservado.
- Rota pelas ruas reais (mão única respeitada) com tempo, chegada, **bateria na chegada** e instruções com o nome da rua, incluindo retornos. Postos fora do alcance são sinalizados.
- Navegação com o mapa **inclinado e girando com o carro** e faixa verde de instrução.
- Recarga simulada com potência efetiva, kWh adicionados, custo em R$ e queda de potência acima de 80%.
- Filtros, busca, modo dia/noite (salvo no navegador) e layout de painel lateral em telas largas.

## EcoCharge AI: recomendação de posto

O núcleo do produto, simulado de ponta a ponta no navegador (`lib/ev/recommend.ts`).

**O que ela prevê.** Para cada posto, o estado **no horário em que você chegaria**:
1. conectores compatíveis com o seu carro e quando cada um libera;
2. os carros da rede EcoCharge que já estão indo para lá, ocupando os conectores na ordem de chegada;
3. carros de fora da rede, pela ocupação típica daquele horário (chegadas aleatórias, modelo de Poisson).

O resultado é a **chance de vaga na chegada** e a **espera prevista**.

**Regras de serviço** (valores em `CFG.ia`, `lib/ev/config.ts`):
- Só conectores compatíveis com o carro, com a potência limitada pelo que o carro aceita (BYD Dolphin: CCS2 até 88 kW, Tipo 2 até 7 kW).
- Reserva de segurança: só indica postos onde se chega com pelo menos 10%. Em **bateria crítica** (nenhum posto respeita a reserva), aceita até 3% e escolhe o caminho mais curto.
- Descarta postos com chance de vaga abaixo de 50% **e** espera acima de 15 min, ou espera acima de 15 min.
- **Coordenação da rede:** ao iniciar a navegação, a chegada prevista do carro entra na rede; as próximas recomendações (de qualquer carro) já contam com ela. Assim a IA não manda dois carros para a mesma tomada. A vaga prevista expira 10 min após o horário de chegada.
- Pedidos simultâneos: quem tem menos bateria é atendido primeiro.
- Critério: menor tempo até sair carregado (trajeto + espera + recarga até 80%); empate, o mais barato.
- Durante a viagem, se o destino passar a lotar, sugere trocar quando o ganho passa de 3 min. Se o motorista recusar, não insiste para o mesmo destino.
- Alerta automático abaixo de 25% de bateria.

**Frota simulada.** Os outros EVs gastam bateria, pedem recomendação à mesma IA abaixo de 18%, vão até o posto pelas ruas reais (setas âmbar), ocupam um conector, carregam e voltam a circular. Toque numa seta âmbar para ver para onde ela está indo.

**Demonstração.** Toque no chip de bateria (topo) para simular outro nível e ver a recomendação mudar. O carro já abre com 22%.

## Estrutura

```
app/
  layout.tsx            fontes (Hanken Grotesk, Unbounded) e metadados
  globals.css           tokens Tailwind 4 e tema claro/escuro do navegador
  page.tsx              landing
  navegador/page.tsx    navegador
components/
  landing/              seções da landing
  nav/                  UI do navegador em React
lib/ev/
  config.ts             ⚙️  configuração: carro, bateria, quantidades, velocidades, cores, nomes
  realworld.ts          malha viária real, carregadores em lugares reais, EVs, rota e instruções
  recommend.ts          EcoCharge AI: previsão de vaga na chegada e ranking de postos
  world.ts              cidade gerada usada na cena 3D da landing + perfil dos carregadores
  engine.ts             simulação, mapa (MapLibre), camada própria em canvas e store da UI
  format.ts             formatação de distância, tempo, kW e horário
public/data/
  saoluis-roads.json    malha viária extraída do OpenStreetMap (gerada, não editar à mão)
scripts/
  build-saoluis-map.mjs        gera o saoluis-roads.json (`npm run map:data`)
  copy-maplibre-worker.mjs     copia o worker do MapLibre para public/ antes do dev/build
```

## Ajustes comuns

- **Carro, bateria e consumo:** `CFG.veiculo` em `lib/ev/config.ts`.
- **Quantidade de carregadores/EVs, velocidade da simulação, tempo de reserva:** `CFG` no mesmo arquivo.
- **Cores do mapa:** `PALETA_DIA` / `PALETA_NOITE`. **Cores de status:** `COR_STATUS`.
- **Nomes de ruas, postos e operadoras:** listas no fim de `config.ts`.
- **Lugares dos carregadores:** lista `PLACES` em `lib/ev/realworld.ts` (nome, lat/lon, bairro). Ponto de partida do carro: `START`.
- **Recorte do mapa:** `BBOX` em `scripts/build-saoluis-map.mjs`; depois rode `npm run map:data`.
- **Cidade da cena 3D da landing:** troque `CFG.seed`.
- **Carro 3D:** formas, cores e posições em `components/landing/car/CarModel.tsx` (`CAR` guarda dobradiça da porta, posição da tela e do olho do motorista). Cores da pintura: `#eef1f0` (cima) e `uLower` (baixo). Câmera e animação de entrada/saída: `components/landing/car/CarScene.tsx`.
- **Spline (opcional):** se um dia houver uma cena publicada, crie `.env.local` com `NEXT_PUBLIC_SPLINE_SCENE=https://prod.spline.design/SEU_ID/scene.splinecode` e a seção passa a usar o Spline no lugar do carro.

## Limitação e caminho para produção

O mapa e as ruas são reais (OpenStreetMap); carregadores, status, EVs e o trajeto do carro são simulados. A UI em React só conversa com o `EVEngine` (`lib/ev/engine.ts`) por ações (`selectCharger`, `planRoute`, `startNav`, `reserve`, `startCharge`...) e pelo store de estado. Para migrar:

1. **Mapa:** ✅ feito (MapLibre + OpenFreeMap). Em produção com muito tráfego, vale hospedar os próprios tiles ou usar um provedor com SLA.
2. **Carregadores:** trocar `createRealWorld().chargers` por dados OCPI 2.2 (`Locations` → `EVSEs` → `Connectors`), com status por webhook ou polling no lugar de `tickLive()`.
3. **Rota:** hoje é Dijkstra sobre a malha real da região. Para a ilha toda ou trânsito ao vivo, trocar `buildRoute` por um roteador (OSRM, Valhalla) e manter o cálculo de bateria na chegada.
4. **Telemetria:** alimentar `car` (posição, rumo, bateria) a partir do veículo em vez da simulação.

Dados de mapa © [OpenStreetMap](https://www.openstreetmap.org/copyright) contributors (ODbL), tiles por [OpenFreeMap](https://openfreemap.org).

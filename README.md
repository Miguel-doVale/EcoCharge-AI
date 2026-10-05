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
| **GSAP** | Título com SplitText e parallax do hero (`Hero.tsx`), seção fixada que monta o mapa camada por camada (`HowItWorks.tsx`), linha da arquitetura (`Architecture.tsx`), inclinação 3D do mapa ao navegar e ícone de curva (`components/nav/Navigator.tsx`) |
| **Lenis** | `components/landing/SmoothScroll.tsx`: scroll suave sincronizado com o ticker do GSAP |
| **Motion** | Painel inferior arrastável, transição entre telas do painel, lista que se reordena ao vivo, números animados, gráfico de ocupação, anel de recarga, toasts, contadores, bento e botão magnético |
| **Three.js (carro)** | `components/landing/car/`: hatch elétrico 3D com porta clicável. A câmera entra pela porta, senta no banco e para de frente para a central, onde o navegador real (`/navegador`) roda num iframe |
| **Spline** | `components/landing/SplineStage.tsx`: opcional. Só aparece no lugar do carro se `NEXT_PUBLIC_SPLINE_SCENE` estiver definida |

## Navegador: o que faz

- Mapa com arrastar, inércia, pinça, roda do mouse, duplo toque e teclado (`+`, `-`, `Esc`).
- Prédios em 2.5D quando o zoom está próximo.
- Carregadores com número de vagas livres e cor de status. O marcador pulsa quando o status muda.
- EVs como setas, agrupados em clusters ao afastar o zoom.
- Card do posto: conectores totais/livres/ocupados/kW, cada conector com previsão de liberação, gráfico de **ocupação típica por hora**, comodidades, preço e nota.
- **Reserva de conector** por 15 min, com contagem regressiva. Ao chegar, a recarga começa no conector reservado.
- Rota pelas ruas com tempo, chegada, **bateria na chegada** e lista de instruções. Postos fora do alcance são sinalizados.
- Navegação com a câmera **inclinada em perspectiva** e faixa verde de instrução.
- Recarga simulada com potência efetiva, kWh adicionados, custo em R$ e queda de potência acima de 80%.
- Filtros, busca, modo dia/noite (salvo no navegador) e layout de painel lateral em telas largas.

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
  world.ts              geração da cidade, carregadores, EVs, roteamento (Dijkstra)
  engine.ts             simulação, desenho no canvas, câmera, gestos e store da UI
  format.ts             formatação de distância, tempo, kW e horário
```

## Ajustes comuns

- **Carro, bateria e consumo:** `CFG.veiculo` em `lib/ev/config.ts`.
- **Quantidade de carregadores/EVs, velocidade da simulação, tempo de reserva:** `CFG` no mesmo arquivo.
- **Cores do mapa:** `PALETA_DIA` / `PALETA_NOITE`. **Cores de status:** `COR_STATUS`.
- **Nomes de ruas, postos e operadoras:** listas no fim de `config.ts`.
- **Cidade diferente:** troque `CFG.seed`.
- **Carro 3D:** formas, cores e posições em `components/landing/car/CarModel.tsx` (`CAR` guarda dobradiça da porta, posição da tela e do olho do motorista). Cores da pintura: `#eef1f0` (cima) e `uLower` (baixo). Câmera e animação de entrada/saída: `components/landing/car/CarScene.tsx`.
- **Spline (opcional):** se um dia houver uma cena publicada, crie `.env.local` com `NEXT_PUBLIC_SPLINE_SCENE=https://prod.spline.design/SEU_ID/scene.splinecode` e a seção passa a usar o Spline no lugar do carro.

## Limitação e caminho para produção

A cidade é gerada no código; não é um mapa geográfico real. A UI em React só conversa com o `EVEngine` (`lib/ev/engine.ts`) por ações (`selectCharger`, `planRoute`, `startNav`, `reserve`, `startCharge`...) e pelo store de estado. Para migrar:

1. **Mapa:** substituir o desenho em canvas por MapLibre GL (tiles vetoriais, estilo dia/noite, `pitch` para a perspectiva de navegação). Os marcadores viram uma camada `symbol`/`circle` com cluster nativo.
2. **Carregadores:** trocar `createWorld().chargers` por dados OCPI 2.2 (`Locations` → `EVSEs` → `Connectors`), com status por webhook ou polling no lugar de `tickLive()`.
3. **Rota:** trocar `buildRoute` por um roteador (OSRM, Valhalla ou Mapbox Directions) e manter o cálculo de bateria na chegada.
4. **Telemetria:** alimentar `car` (posição, rumo, bateria) a partir do veículo em vez da simulação.

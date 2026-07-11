# 🕯️ Detector de Velas Japonesas

Aplicación web que **detecta patrones de velas japonesas en cripto**, los **visualiza en un gráfico tipo TradingView** (con RSI y tooltips), da un **veredicto alcista / bajista / neutral** con explicación en lenguaje natural por IA, y trae un **juego de entrenamiento** para aprender a reconocer patrones.

**▶️ Demo en vivo: https://detector-velas.vercel.app**

- **Stack:** Next.js (App Router) + React 19 + TypeScript
- **Datos:** endpoint público de **Binance** (`data-api.binance.vision`) — sin API key
- **Gráfico:** `lightweight-charts` v5 (el motor de TradingView) con panel de **RSI(14)** y tooltip por vela
- **Detección:** motor por reglas en `lib/patterns.ts` (preciso, determinístico, gratis)
- **IA:** **Vercel AI SDK** (`streamText`) redacta el veredicto y las lecciones en **streaming** (no decide el patrón, solo lo explica)
- **Robustez:** validación con **Zod**, rate-limiting y caché en las rutas de API

---

## Cómo funciona

```
Binance ──► /api/candles ──► detectPatterns() ──► gráfico + RSI + veredicto
                                   │
                      (patrones + sesgo) ──► /api/analyze ──► IA ──► explicación (stream)
```

1. El backend baja las velas OHLC de Binance.
2. `lib/patterns.ts` analiza cada vela con reglas y detecta patrones.
3. Se calcula un **sesgo global** ponderando los patrones más recientes.
4. El gráfico muestra las velas con **flechas** en cada patrón y un **panel de RSI**; al pasar el cursor (o tocar) una vela se ve su OHLC y el patrón.
5. Al pulsar **"Veredicto con IA"**, la IA redacta la conclusión en español, token a token.

### Patrones que detecta

| Tipo | Patrones |
|------|----------|
| 1 vela | Doji, Martillo, Hombre colgado, Estrella fugaz, Martillo invertido, Marubozu alcista/bajista |
| 2 velas | Envolvente alcista/bajista, Línea penetrante, Nube oscura, Harami alcista/bajista |
| 3 velas | Estrella de la mañana, Estrella del atardecer, Tres soldados blancos, Tres cuervos negros |

### 🎮 Juego de patrones

Modo de entrenamiento: se muestra un tramo real de velas con un patrón marcado y adivinas cuál es entre 4 opciones. Feedback inmediato con la explicación, **puntaje y racha**. Si fallas, un botón **"¿Quieres repasar este patrón con IA?"** genera una mini-lección didáctica para aprender de forma autodidacta.

---

## Puesta en marcha

### 1. Instalar dependencias

```bash
npm install
```

### 2. Configurar la clave de OpenAI

Copia el ejemplo y agrega tu clave (de https://platform.openai.com/api-keys):

```bash
cp .env.example .env.local
```

```env
OPENAI_API_KEY=sk-tu-clave-aqui
OPENAI_MODEL=gpt-4o-mini   # opcional
```

> El gráfico, la detección, el RSI y el juego funcionan **sin** clave. La clave solo se necesita para el veredicto y las lecciones con IA.

### 3. Ejecutar

```bash
npm run dev       # desarrollo → http://localhost:3000
npm run build     # compilar para producción
npm run start     # servir la build
```

---

## Estructura

```
app/
  layout.tsx            Layout raíz
  page.tsx              Interfaz (pestañas: Analizador / Juego)
  globals.css           Estilos
  api/
    candles/route.ts    Binance + detección de patrones
    analyze/route.ts    Veredicto con IA (streaming)
    game/route.ts       Ronda del juego
    lesson/route.ts     Repaso con IA del patrón fallado
components/
  CandleChart.tsx       Gráfico de velas + RSI + tooltip
  GameChart.tsx         Gráfico del juego
  PatternGame.tsx       Lógica y UI del juego
  Markdown.tsx          Renderizador Markdown mínimo y seguro
lib/
  types.ts              Tipos compartidos
  binance.ts            Cliente de Binance (con caché)
  patterns.ts           Motor de detección + catálogo
  indicators.ts         RSI (Wilder)
  schemas.ts            Validación con Zod
  rate-limit.ts         Rate limiting en memoria
```

---

## Despliegue

Desplegado en **Vercel**. Recuerda agregar `OPENAI_API_KEY` en las variables de entorno del proyecto (Settings → Environment Variables), nunca en el código.

> Nota: se usa `data-api.binance.vision` en lugar de `api.binance.com` porque este último bloquea las IPs de EE. UU., donde corren los servidores de Vercel.

---

## ⚠️ Aviso

Esta herramienta es educativa y **no es asesoría financiera**. Los patrones de velas son señales probabilísticas: confírmalos siempre con volumen, soportes/resistencias y contexto del mercado antes de operar.

---

© 2026 Xentris LLC · Los Tres Dioses. Todos los derechos reservados.

# 🕯️ Detector de Velas Japonesas

Aplicación web que **detecta patrones de velas japonesas en cripto**, los **visualiza en un gráfico tipo TradingView** y da un **veredicto alcista / bajista / neutral**, con una explicación en lenguaje natural generada por **OpenAI**.

- **Stack:** Next.js (App Router) + React + TypeScript
- **Datos:** API pública de **Binance** (klines) — sin API key, gratis
- **Gráfico:** `lightweight-charts` v5 (el motor de gráficos de TradingView)
- **Detección:** motor por reglas en `lib/patterns.ts` (preciso, determinístico, gratis)
- **IA:** SDK de **OpenAI** redacta el veredicto (no decide el patrón, solo lo explica)

---

## Cómo funciona

```
Binance API ──► /api/candles ──► detectPatterns() ──► gráfico + veredicto
                                       │
                          (patrones + sesgo) ──► /api/analyze ──► OpenAI ──► explicación
```

1. El backend baja las velas OHLC de Binance.
2. `lib/patterns.ts` analiza cada vela con reglas y detecta patrones.
3. Se calcula un **sesgo global** ponderando los patrones más recientes.
4. El gráfico muestra las velas con **flechas** en cada patrón detectado.
5. Al pulsar **“Veredicto IA”**, OpenAI redacta la conclusión en español.

### Patrones que detecta

| Tipo | Patrones |
|------|----------|
| 1 vela | Doji, Martillo, Hombre colgado, Estrella fugaz, Martillo invertido, Marubozu alcista/bajista |
| 2 velas | Envolvente alcista/bajista, Línea penetrante, Nube oscura, Harami alcista/bajista |
| 3 velas | Estrella de la mañana, Estrella del atardecer, Tres soldados blancos, Tres cuervos negros |

---

## Puesta en marcha

### 1. Instalar dependencias

```bash
npm install
```

### 2. Configurar la clave de OpenAI

Copia el ejemplo y agrega tu clave (consíguela en https://platform.openai.com/api-keys):

```bash
cp .env.example .env.local
```

```env
OPENAI_API_KEY=sk-tu-clave-aqui
OPENAI_MODEL=gpt-4o-mini   # opcional
```

> El gráfico y la detección funcionan **sin** clave. La clave solo se necesita para el botón “Veredicto IA”.

### 3. Ejecutar

```bash
npm run dev       # desarrollo → http://localhost:3000
npm run build     # compilar para producción
npm run start     # servir la build
```

---

## Uso

1. Escribe un símbolo de Binance (`BTCUSDT`, `ETHUSDT`, `SOLUSDT`, …).
2. Elige el intervalo (`1m` … `1w`).
3. Pulsa **Analizar** → se cargan las velas y los patrones.
4. Pulsa **🤖 Veredicto IA** para la explicación con OpenAI.

---

## Estructura

```
app/
  layout.tsx            Layout raíz
  page.tsx              Interfaz principal (cliente)
  globals.css           Estilos
  api/
    candles/route.ts    Binance + detección de patrones
    analyze/route.ts    Veredicto con OpenAI
components/
  CandleChart.tsx       Gráfico de velas (lightweight-charts v5)
lib/
  types.ts              Tipos compartidos
  binance.ts            Cliente de la API de Binance
  patterns.ts           Motor de detección de patrones
```

---

## Despliegue

Lista para **Vercel**: importa el repo, agrega la variable de entorno `OPENAI_API_KEY` en el panel del proyecto y despliega.

---

## ⚠️ Aviso

Esta herramienta es educativa y **no es asesoría financiera**. Los patrones de velas son señales probabilísticas: confírmalos siempre con volumen, soportes/resistencias y contexto del mercado antes de operar.

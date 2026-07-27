"use client";

import {
  createChart,
  CandlestickSeries,
  HistogramSeries,
  LineSeries,
  createSeriesMarkers,
  type IChartApi,
  type ISeriesApi,
  type IPriceLine,
  type CandlestickData,
  type HistogramData,
  type LineData,
  type UTCTimestamp,
  type SeriesMarker,
  type ISeriesMarkersPluginApi,
  type Time,
  type MouseEventParams,
} from "lightweight-charts";
import { useEffect, useRef, useState } from "react";
import type { Candle, Pattern } from "@/lib/types";
import { computeRSI, computeSMA } from "@/lib/indicators";

interface Props {
  candles: Candle[];
  patterns: Pattern[];
}

// Medias móviles a dibujar sobre el precio (rápida y lenta).
const MA_FAST = { period: 20, color: "#42a5f5" }; // azul
const MA_SLOW = { period: 50, color: "#ffa726" }; // ámbar

// Color del marcador segun el sesgo del patron.
function markerColor(bias: Pattern["bias"]) {
  if (bias === "alcista") return "#26a69a";
  if (bias === "bajista") return "#ef5350";
  return "#b0bec5";
}

// Estado del tooltip flotante.
interface TipState {
  visible: boolean;
  left: number;
  top: number;
  time: number;
  open: number;
  high: number;
  low: number;
  close: number;
  bull: boolean;
  pattern: Pattern | null;
  maFast: number | null;
  maSlow: number | null;
}

const EMPTY_TIP: TipState = {
  visible: false,
  left: 0,
  top: 0,
  time: 0,
  open: 0,
  high: 0,
  low: 0,
  close: 0,
  bull: true,
  pattern: null,
  maFast: null,
  maSlow: null,
};

// Formatea un precio con una cantidad razonable de decimales segun su magnitud.
function fmtPrice(v: number) {
  if (v >= 1000) return v.toLocaleString("es", { maximumFractionDigits: 2 });
  if (v >= 1) return v.toFixed(2);
  return v.toPrecision(4);
}

function fmtDate(sec: number) {
  return new Date(sec * 1000).toLocaleString("es", {
    dateStyle: "medium",
    timeStyle: "short",
  });
}

export default function CandleChart({ candles, patterns }: Props) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const chartRef = useRef<IChartApi | null>(null);
  const candleSeriesRef = useRef<ISeriesApi<"Candlestick"> | null>(null);
  const volumeSeriesRef = useRef<ISeriesApi<"Histogram"> | null>(null);
  const rsiSeriesRef = useRef<ISeriesApi<"Line"> | null>(null);
  const rsiLinesRef = useRef<IPriceLine[]>([]);
  const maFastSeriesRef = useRef<ISeriesApi<"Line"> | null>(null);
  const maSlowSeriesRef = useRef<ISeriesApi<"Line"> | null>(null);
  const markersRef = useRef<ISeriesMarkersPluginApi<Time> | null>(null);

  // Mapa time -> patron para el tooltip (se actualiza con los patrones).
  const patternByTime = useRef<Map<number, Pattern>>(new Map());
  // Mapas time -> valor de cada media móvil (para el tooltip).
  const maFastByTime = useRef<Map<number, number>>(new Map());
  const maSlowByTime = useRef<Map<number, number>>(new Map());

  const [tip, setTip] = useState<TipState>(EMPTY_TIP);
  const [showMA, setShowMA] = useState(true);

  // Crear el chart una sola vez.
  useEffect(() => {
    if (!containerRef.current) return;

    const chart = createChart(containerRef.current, {
      autoSize: true,
      layout: {
        background: { color: "#0a1b33" },
        textColor: "#c4cfe4",
        panes: { separatorColor: "#23385a", separatorHoverColor: "#3a5178" },
      },
      grid: {
        vertLines: { color: "#152a49" },
        horzLines: { color: "#152a49" },
      },
      timeScale: {
        timeVisible: true,
        secondsVisible: false,
        borderColor: "#23385a",
      },
      rightPriceScale: { borderColor: "#23385a" },
      crosshair: { mode: 1 },
    });

    // --- Pane 0: velas + volumen (overlay) ---
    const candleSeries = chart.addSeries(CandlestickSeries, {
      upColor: "#26a69a",
      downColor: "#ef5350",
      borderUpColor: "#26a69a",
      borderDownColor: "#ef5350",
      wickUpColor: "#26a69a",
      wickDownColor: "#ef5350",
    });

    const volumeSeries = chart.addSeries(
      HistogramSeries,
      { priceFormat: { type: "volume" }, priceScaleId: "" },
      0
    );
    volumeSeries.priceScale().applyOptions({
      scaleMargins: { top: 0.8, bottom: 0 },
    });

    // Medias móviles sobre el precio (mismo eje que las velas).
    const maCommon = {
      priceScaleId: "right" as const,
      lineWidth: 2 as const,
      priceLineVisible: false,
      lastValueVisible: false,
      crosshairMarkerVisible: false,
    };
    const maFastSeries = chart.addSeries(
      LineSeries,
      { ...maCommon, color: MA_FAST.color, title: `MA${MA_FAST.period}` },
      0
    );
    const maSlowSeries = chart.addSeries(
      LineSeries,
      { ...maCommon, color: MA_SLOW.color, title: `MA${MA_SLOW.period}` },
      0
    );

    // --- Pane 1: RSI ---
    const rsiSeries = chart.addSeries(
      LineSeries,
      {
        color: "#4aa3ff",
        lineWidth: 2,
        priceScaleId: "right",
        priceFormat: { type: "price", precision: 1, minMove: 0.1 },
        lastValueVisible: true,
        priceLineVisible: false,
      },
      1
    );
    // Lineas de referencia de sobrecompra (70) y sobreventa (30).
    rsiLinesRef.current = [
      rsiSeries.createPriceLine({
        price: 70,
        color: "rgba(239,83,80,0.5)",
        lineWidth: 1,
        lineStyle: 2,
        axisLabelVisible: true,
        title: "70",
      }),
      rsiSeries.createPriceLine({
        price: 30,
        color: "rgba(38,166,154,0.5)",
        lineWidth: 1,
        lineStyle: 2,
        axisLabelVisible: true,
        title: "30",
      }),
    ];

    // El pane del RSI mas bajo que el principal.
    const panes = chart.panes();
    if (panes[1]) panes[1].setHeight(110);

    chartRef.current = chart;
    candleSeriesRef.current = candleSeries;
    volumeSeriesRef.current = volumeSeries;
    rsiSeriesRef.current = rsiSeries;
    maFastSeriesRef.current = maFastSeries;
    maSlowSeriesRef.current = maSlowSeries;
    markersRef.current = createSeriesMarkers(candleSeries, []);

    // --- Tooltip: seguir el crosshair ---
    const onMove = (param: MouseEventParams<Time>) => {
      const cont = containerRef.current;
      if (
        !cont ||
        param.time === undefined ||
        !param.point ||
        param.point.x < 0 ||
        param.point.y < 0
      ) {
        setTip((t) => (t.visible ? { ...t, visible: false } : t));
        return;
      }
      const bar = param.seriesData.get(candleSeries) as
        | CandlestickData<Time>
        | undefined;
      if (!bar || typeof bar.open !== "number") {
        setTip((t) => (t.visible ? { ...t, visible: false } : t));
        return;
      }

      const timeSec = param.time as number;
      const w = cont.clientWidth;
      const tipW = 210;
      // Voltear a la izquierda si esta cerca del borde derecho.
      const left =
        param.point.x + tipW + 24 > w
          ? param.point.x - tipW - 16
          : param.point.x + 16;
      const top = Math.max(8, param.point.y - 10);

      setTip({
        visible: true,
        left,
        top,
        time: timeSec,
        open: bar.open,
        high: bar.high,
        low: bar.low,
        close: bar.close,
        bull: bar.close >= bar.open,
        pattern: patternByTime.current.get(timeSec) ?? null,
        maFast: maFastByTime.current.get(timeSec) ?? null,
        maSlow: maSlowByTime.current.get(timeSec) ?? null,
      });
    };
    chart.subscribeCrosshairMove(onMove);

    return () => {
      chart.unsubscribeCrosshairMove(onMove);
      markersRef.current = null;
      candleSeriesRef.current = null;
      volumeSeriesRef.current = null;
      rsiSeriesRef.current = null;
      rsiLinesRef.current = [];
      maFastSeriesRef.current = null;
      maSlowSeriesRef.current = null;
      chartRef.current = null;
      chart.remove();
    };
  }, []);

  // Actualizar datos cuando cambian las velas.
  useEffect(() => {
    const candleSeries = candleSeriesRef.current;
    const volumeSeries = volumeSeriesRef.current;
    const rsiSeries = rsiSeriesRef.current;
    const maFastSeries = maFastSeriesRef.current;
    const maSlowSeries = maSlowSeriesRef.current;
    if (!candleSeries || !volumeSeries || !rsiSeries) return;

    const candleData: CandlestickData<Time>[] = candles.map((c) => ({
      time: c.time as UTCTimestamp,
      open: c.open,
      high: c.high,
      low: c.low,
      close: c.close,
    }));

    const volumeData: HistogramData<Time>[] = candles.map((c) => ({
      time: c.time as UTCTimestamp,
      value: c.volume,
      color:
        c.close >= c.open
          ? "rgba(38,166,154,0.4)"
          : "rgba(239,83,80,0.4)",
    }));

    const rsiData: LineData<Time>[] = computeRSI(candles, 14).map((p) => ({
      time: p.time as UTCTimestamp,
      value: p.value,
    }));

    const maFast = computeSMA(candles, MA_FAST.period);
    const maSlow = computeSMA(candles, MA_SLOW.period);
    const maFastData: LineData<Time>[] = maFast.map((p) => ({
      time: p.time as UTCTimestamp,
      value: p.value,
    }));
    const maSlowData: LineData<Time>[] = maSlow.map((p) => ({
      time: p.time as UTCTimestamp,
      value: p.value,
    }));
    maFastByTime.current = new Map(maFast.map((p) => [p.time, p.value]));
    maSlowByTime.current = new Map(maSlow.map((p) => [p.time, p.value]));

    candleSeries.setData(candleData);
    volumeSeries.setData(volumeData);
    rsiSeries.setData(rsiData);
    maFastSeries?.setData(maFastData);
    maSlowSeries?.setData(maSlowData);
    chartRef.current?.timeScale().fitContent();
  }, [candles]);

  // Mostrar u ocultar las medias móviles.
  useEffect(() => {
    maFastSeriesRef.current?.applyOptions({ visible: showMA });
    maSlowSeriesRef.current?.applyOptions({ visible: showMA });
  }, [showMA]);

  // Actualizar marcadores y el mapa de patrones cuando cambian los patrones.
  useEffect(() => {
    patternByTime.current = new Map(patterns.map((p) => [p.time, p]));
    if (!markersRef.current) return;

    // Solo flechas (sin texto): marcan DONDE hay patron sin saturar el grafico.
    // El nombre del patron se muestra en el tooltip al pasar el cursor o tocar.
    const markers: SeriesMarker<Time>[] = patterns.map((p) => ({
      time: p.time as UTCTimestamp,
      position: p.bias === "bajista" ? "aboveBar" : "belowBar",
      color: markerColor(p.bias),
      shape: p.bias === "bajista" ? "arrowDown" : "arrowUp",
    }));

    markersRef.current.setMarkers(markers);
  }, [patterns]);

  return (
    <div style={{ position: "relative", width: "100%", height: "100%" }}>
      <button
        type="button"
        className={`ma-toggle ${showMA ? "on" : ""}`}
        onClick={() => setShowMA((v) => !v)}
        aria-pressed={showMA}
        title="Mostrar u ocultar medias móviles"
      >
        <span className="ma-dot" style={{ background: MA_FAST.color }} />
        <span className="ma-dot" style={{ background: MA_SLOW.color }} />
        Medias móviles
      </button>
      <div
        ref={containerRef}
        style={{ width: "100%", height: "100%" }}
        aria-label="Grafico de velas japonesas con RSI y medias moviles"
      />
      {tip.visible && (
        <div
          className="chart-tip"
          style={{ left: tip.left, top: tip.top }}
          role="tooltip"
        >
          <div className="chart-tip-date">{fmtDate(tip.time)}</div>
          <div className="chart-tip-ohlc">
            <span>A</span><b>{fmtPrice(tip.open)}</b>
            <span>M</span><b>{fmtPrice(tip.high)}</b>
            <span>m</span><b>{fmtPrice(tip.low)}</b>
            <span>C</span>
            <b className={tip.bull ? "up" : "down"}>{fmtPrice(tip.close)}</b>
          </div>
          {showMA && (tip.maFast !== null || tip.maSlow !== null) && (
            <div className="chart-tip-ma">
              {tip.maFast !== null && (
                <span style={{ color: MA_FAST.color }}>
                  MA{MA_FAST.period} {fmtPrice(tip.maFast)}
                </span>
              )}
              {tip.maSlow !== null && (
                <span style={{ color: MA_SLOW.color }}>
                  MA{MA_SLOW.period} {fmtPrice(tip.maSlow)}
                </span>
              )}
            </div>
          )}
          {tip.pattern && (
            <div className={`chart-tip-pat ${tip.pattern.bias}`}>
              {tip.pattern.name} · {tip.pattern.strength}/100
            </div>
          )}
        </div>
      )}
    </div>
  );
}

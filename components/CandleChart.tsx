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
import { computeRSI } from "@/lib/indicators";

interface Props {
  candles: Candle[];
  patterns: Pattern[];
}

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
  const markersRef = useRef<ISeriesMarkersPluginApi<Time> | null>(null);

  // Mapa time -> patron para el tooltip (se actualiza con los patrones).
  const patternByTime = useRef<Map<number, Pattern>>(new Map());

  const [tip, setTip] = useState<TipState>(EMPTY_TIP);

  // Crear el chart una sola vez.
  useEffect(() => {
    if (!containerRef.current) return;

    const chart = createChart(containerRef.current, {
      autoSize: true,
      layout: {
        background: { color: "#0e1116" },
        textColor: "#d1d4dc",
        panes: { separatorColor: "#2a2f3a", separatorHoverColor: "#3a4150" },
      },
      grid: {
        vertLines: { color: "#1c2230" },
        horzLines: { color: "#1c2230" },
      },
      timeScale: {
        timeVisible: true,
        secondsVisible: false,
        borderColor: "#2a2f3a",
      },
      rightPriceScale: { borderColor: "#2a2f3a" },
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

    // --- Pane 1: RSI ---
    const rsiSeries = chart.addSeries(
      LineSeries,
      {
        color: "#a78bfa",
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
      chartRef.current = null;
      chart.remove();
    };
  }, []);

  // Actualizar datos cuando cambian las velas.
  useEffect(() => {
    const candleSeries = candleSeriesRef.current;
    const volumeSeries = volumeSeriesRef.current;
    const rsiSeries = rsiSeriesRef.current;
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

    candleSeries.setData(candleData);
    volumeSeries.setData(volumeData);
    rsiSeries.setData(rsiData);
    chartRef.current?.timeScale().fitContent();
  }, [candles]);

  // Actualizar marcadores y el mapa de patrones cuando cambian los patrones.
  useEffect(() => {
    patternByTime.current = new Map(patterns.map((p) => [p.time, p]));
    if (!markersRef.current) return;

    const markers: SeriesMarker<Time>[] = patterns.map((p) => ({
      time: p.time as UTCTimestamp,
      position: p.bias === "bajista" ? "aboveBar" : "belowBar",
      color: markerColor(p.bias),
      shape: p.bias === "bajista" ? "arrowDown" : "arrowUp",
      text: p.name,
    }));

    markersRef.current.setMarkers(markers);
  }, [patterns]);

  return (
    <div style={{ position: "relative", width: "100%", height: "100%" }}>
      <div
        ref={containerRef}
        style={{ width: "100%", height: "100%" }}
        aria-label="Grafico de velas japonesas con RSI"
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

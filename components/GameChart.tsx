"use client";

import {
  createChart,
  CandlestickSeries,
  createSeriesMarkers,
  type IChartApi,
  type ISeriesApi,
  type CandlestickData,
  type UTCTimestamp,
  type SeriesMarker,
  type ISeriesMarkersPluginApi,
  type Time,
} from "lightweight-charts";
import { useEffect, useRef } from "react";
import type { Candle } from "@/lib/types";

interface Props {
  candles: Candle[];
  markerTime: number; // vela donde termina el patron
}

// Grafico simple para el juego: solo velas + un marcador NEUTRO que senala
// donde esta el patron, sin revelar cual es ni su direccion.
export default function GameChart({ candles, markerTime }: Props) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const chartRef = useRef<IChartApi | null>(null);
  const seriesRef = useRef<ISeriesApi<"Candlestick"> | null>(null);
  const markersRef = useRef<ISeriesMarkersPluginApi<Time> | null>(null);

  useEffect(() => {
    if (!containerRef.current) return;
    const chart = createChart(containerRef.current, {
      autoSize: true,
      layout: {
        background: { color: "#0e1116" },
        textColor: "#d1d4dc",
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
      handleScroll: false,
      handleScale: false,
    });

    const series = chart.addSeries(CandlestickSeries, {
      upColor: "#26a69a",
      downColor: "#ef5350",
      borderUpColor: "#26a69a",
      borderDownColor: "#ef5350",
      wickUpColor: "#26a69a",
      wickDownColor: "#ef5350",
    });

    chartRef.current = chart;
    seriesRef.current = series;
    markersRef.current = createSeriesMarkers(series, []);

    return () => {
      markersRef.current = null;
      seriesRef.current = null;
      chartRef.current = null;
      chart.remove();
    };
  }, []);

  useEffect(() => {
    const series = seriesRef.current;
    if (!series) return;
    const data: CandlestickData<Time>[] = candles.map((c) => ({
      time: c.time as UTCTimestamp,
      open: c.open,
      high: c.high,
      low: c.low,
      close: c.close,
    }));
    series.setData(data);
    chartRef.current?.timeScale().fitContent();
  }, [candles]);

  useEffect(() => {
    if (!markersRef.current) return;
    // Marcador NEUTRO (circulo dorado, sin texto ni flecha) para no delatar
    // el patron ni su direccion: solo indica DONDE mirar.
    const markers: SeriesMarker<Time>[] = [
      {
        time: markerTime as UTCTimestamp,
        position: "aboveBar",
        color: "#f5a524",
        shape: "circle",
      },
    ];
    markersRef.current.setMarkers(markers);
  }, [markerTime]);

  return (
    <div
      ref={containerRef}
      style={{ width: "100%", height: "100%" }}
      aria-label="Grafico del juego de patrones"
    />
  );
}

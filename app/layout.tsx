import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Detector de Velas Japonesas · Xentris",
  description:
    "Detecta patrones de velas japonesas en cripto, visualizalos tipo TradingView y obten un veredicto alcista/bajista con IA. Por Xentris.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="es">
      <body>{children}</body>
    </html>
  );
}

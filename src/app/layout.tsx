import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";

const inter = Inter({
  variable: "--font-sans",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Raio X do Financiamento",
  description:
    "Simule seu financiamento imobiliário, compare os sistemas SAC e PRICE e descubra quanto você realmente vai pagar de juros. Grátis para começar.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="pt-BR" className={`${inter.variable} h-full antialiased`}>
      <body className="min-h-full flex flex-col bg-[#F5F5F5] text-[#1A1A1A]">
        {children}
      </body>
    </html>
  );
}

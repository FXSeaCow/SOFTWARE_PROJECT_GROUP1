/// <reference types="vite/client" />

declare module "jsqr" {
  export type QRCode = {
    binaryData: number[];
    data: string;
    chunks: unknown[];
    version: number;
    location: unknown;
  };

  export default function jsQR(
    data: Uint8ClampedArray,
    width: number,
    height: number,
    options?: { inversionAttempts?: "dontInvert" | "onlyInvert" | "attemptBoth" | "invertFirst" },
  ): QRCode | null;
}

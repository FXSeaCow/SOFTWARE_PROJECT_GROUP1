import React, { useEffect, useRef, useState } from "react";
import jsQR from "jsqr";
import { Camera, X } from "lucide-react";

import { Modal } from "./Modal";

export function QrScannerModal({
  isOpen,
  title,
  onClose,
  onScan,
}: {
  isOpen: boolean;
  title: string;
  onClose: () => void;
  onScan: (token: string) => void;
}) {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const animationFrameRef = useRef<number | null>(null);
  const [cameraError, setCameraError] = useState<string | null>(null);

  useEffect(() => {
    if (!isOpen) {
      return;
    }

    let isCancelled = false;
    setCameraError(null);

    async function startCamera() {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: "environment" },
        });

        if (isCancelled) {
          stream.getTracks().forEach((track) => track.stop());
          return;
        }

        streamRef.current = stream;

        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          await videoRef.current.play();
        }

        scanFrame();
      } catch (error) {
        setCameraError(
          error instanceof Error
            ? `Unable to access camera: ${error.message}`
            : "Unable to access camera.",
        );
      }
    }

    function scanFrame() {
      const video = videoRef.current;
      const canvas = canvasRef.current;

      if (!video || !canvas || video.readyState !== video.HAVE_ENOUGH_DATA) {
        animationFrameRef.current = requestAnimationFrame(scanFrame);
        return;
      }

      const context = canvas.getContext("2d");
      if (!context) {
        animationFrameRef.current = requestAnimationFrame(scanFrame);
        return;
      }

      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      context.drawImage(video, 0, 0, canvas.width, canvas.height);

      const imageData = context.getImageData(0, 0, canvas.width, canvas.height);
      const result = jsQR(imageData.data, imageData.width, imageData.height);

      if (result?.data) {
        onScan(result.data);
        return;
      }

      animationFrameRef.current = requestAnimationFrame(scanFrame);
    }

    void startCamera();

    return () => {
      isCancelled = true;

      if (animationFrameRef.current !== null) {
        cancelAnimationFrame(animationFrameRef.current);
        animationFrameRef.current = null;
      }

      streamRef.current?.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen]);

  return (
    <Modal isOpen={isOpen} onClose={onClose}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 18, fontWeight: 900 }}>
          <Camera size={20} color="#ff9a3d" />
          {title}
        </div>
        <button
          type="button"
          onClick={onClose}
          aria-label="Close scanner"
          style={{
            width: 32,
            height: 32,
            borderRadius: "50%",
            border: "1px solid rgba(255,255,255,0.08)",
            background: "rgba(255,255,255,0.04)",
            color: "#cfd5df",
            display: "grid",
            placeItems: "center",
            cursor: "pointer",
          }}
        >
          <X size={16} />
        </button>
      </div>

      {cameraError ? (
        <div style={{ color: "#fecaca", fontSize: 14, marginBottom: 12 }}>{cameraError}</div>
      ) : (
        <div style={{ color: "#9ca8b7", fontSize: 13, marginBottom: 12 }}>
          Point the camera at the member's QR code (shown on their Account page).
        </div>
      )}

      <div
        style={{
          position: "relative",
          width: "100%",
          aspectRatio: "4 / 3",
          borderRadius: 14,
          overflow: "hidden",
          background: "#000000",
        }}
      >
        <video
          ref={videoRef}
          muted
          playsInline
          style={{ width: "100%", height: "100%", objectFit: "cover" }}
        />
        <canvas ref={canvasRef} style={{ display: "none" }} />
      </div>
    </Modal>
  );
}

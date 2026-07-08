import React from "react";
import ReactDOM from "react-dom";

export function Modal({
  isOpen,
  onClose,
  children,
}: {
  isOpen: boolean;
  onClose?: () => void;
  children: React.ReactNode;
}) {
  if (!isOpen || typeof document === "undefined") {
    return null;
  }

  return ReactDOM.createPortal(
    <div
      className="modal-backdrop"
      onClick={onClose}
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(0,0,0,0.58)",
        backdropFilter: "blur(8px)",
        display: "grid",
        placeItems: "center",
        padding: 20,
        zIndex: 70,
      }}
    >
      <div
        className="modal-panel"
        onClick={(event) => event.stopPropagation()}
        style={{
          width: "min(100%, 560px)",
          borderRadius: 20,
          border: "1px solid rgba(255,255,255,0.08)",
          background: "linear-gradient(180deg, rgba(20,20,20,0.98), rgba(14,14,14,0.98))",
          boxShadow: "0 30px 70px rgba(0,0,0,0.34)",
          padding: 24,
        }}
      >
        {children}
      </div>
    </div>,
    document.body,
  );
}

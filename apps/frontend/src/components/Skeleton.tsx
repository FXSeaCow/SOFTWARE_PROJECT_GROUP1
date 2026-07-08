import React from "react";

export function Skeleton({
  height,
  width = "100%",
  radius = 12,
}: {
  height: number;
  width?: number | string;
  radius?: number;
}) {
  return (
    <div
      className="skeleton-shimmer"
      style={{
        width,
        height,
        borderRadius: radius,
      }}
    />
  );
}

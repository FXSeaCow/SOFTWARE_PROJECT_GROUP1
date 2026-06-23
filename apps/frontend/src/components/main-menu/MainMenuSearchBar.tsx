import React from "react";
import { Search } from "lucide-react";

import { searchBarStyle } from "./styles";

export function MainMenuSearchBar() {
  return (
    <div
      style={{
        ...searchBarStyle,
        width: "min(320px, 100%)",
        borderRadius: 14,
        minHeight: 46,
        padding: "0 16px",
        background: "rgba(255,255,255,0.03)",
      }}
    >
      <Search size={18} color="rgba(255,255,255,0.42)" />
      <span style={{ color: "rgba(222, 226, 235, 0.58)", fontSize: 14 }}>
        Search workouts, exercises...
      </span>
    </div>
  );
}

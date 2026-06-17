import React from "react";
import { Search } from "lucide-react";

import { searchBarStyle } from "./styles";

export function MainMenuSearchBar() {
  return (
    <section style={{ marginBottom: 26 }}>
      <div style={searchBarStyle}>
        <Search size={22} color="rgba(255,255,255,0.42)" />
        <span style={{ color: "rgba(222, 226, 235, 0.58)", fontSize: 16 }}>
          Search workouts, exercises...
        </span>
      </div>
    </section>
  );
}

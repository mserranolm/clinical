import React from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import { Toaster } from "sileo";
import { App } from "./App";
import "./styles.css";


ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <BrowserRouter>
      <Toaster
        position="bottom-right"
        offset={20}
        options={{
          fill: "#0f172a",
          styles: {
            title: "text-white! font-semibold!",
            description: "text-slate-400!",
            badge: "bg-slate-700!",
          },
        }}
      />
      <App />
    </BrowserRouter>
  </React.StrictMode>
);

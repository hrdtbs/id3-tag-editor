import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";
import { Provider, defaultTheme } from "@adobe/react-spectrum";

ReactDOM.createRoot(document.getElementById("root") as HTMLElement).render(
  <React.StrictMode>
    <Provider theme={defaultTheme} colorScheme="light">
      <App />
    </Provider>
  </React.StrictMode>
);

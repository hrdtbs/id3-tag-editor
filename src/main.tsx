import { Provider, defaultTheme } from "@adobe/react-spectrum";
import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";
import "./style.css";

ReactDOM.createRoot(document.getElementById("root") as HTMLElement).render(
	<React.StrictMode>
		<Provider theme={defaultTheme} colorScheme="dark">
			<App />
		</Provider>
	</React.StrictMode>,
);

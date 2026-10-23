/** Client entry: reads ?embed=1 and the API URL, creates the chat service and mounts the app. */
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import App from "./App";
import { createChatApi } from "./services/chatApi";
import "./styles/index.css";

const embed = new URLSearchParams(window.location.search).get("embed") === "1";
const api = createChatApi(import.meta.env.VITE_API_URL || "http://localhost:8787");

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <App embed={embed} api={api} />
  </StrictMode>,
);

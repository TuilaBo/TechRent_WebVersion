// src/main.jsx
import "antd/dist/reset.css";
import "./index.css";

import React from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import App from "./App.jsx";
import { AuthProvider } from "./context/AuthContext.jsx";
import ScrollToTop from "./components/ScrollToTop.jsx";
import { Toaster } from "react-hot-toast";
ReactDOM.createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <AuthProvider>
      <BrowserRouter>
        <ScrollToTop />
        <App />
        <Toaster
          position="bottom-right"
          toastOptions={{
            duration: 3500,
            style: {
              fontSize: 14,
              padding: "12px 14px",
              borderRadius: 10,
              maxWidth: 420,
            },
          }}
          containerStyle={{ top: 10, right: 10 }}
        />
      </BrowserRouter>
    </AuthProvider>
  </React.StrictMode>
);

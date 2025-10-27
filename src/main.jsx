// src/main.jsx
import "antd/dist/reset.css";
import "./index.css";

import React from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import App from "./App.jsx";
import { AuthProvider } from "./context/AuthContext.jsx";
import { Toaster } from "react-hot-toast";
import ScrollToTop from "./components/ScrollToTop.jsx";
ReactDOM.createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <AuthProvider>
      <BrowserRouter>
        {/* Scroll to top on route change */}
        <ScrollToTop />
        <App />
        <Toaster position="top-center" toastOptions={{ duration: 2500 }} />
      </BrowserRouter>
    </AuthProvider>
  </React.StrictMode>
);

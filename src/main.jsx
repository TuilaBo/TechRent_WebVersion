// src/main.jsx
import "antd/dist/reset.css";
import "./index.css";

import React from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import App from "./App.jsx";
import { AuthProvider } from "./context/AuthContext.jsx";

// 👇 thêm
import { Toaster } from "react-hot-toast";

ReactDOM.createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <AuthProvider>
      <BrowserRouter>
        <App />
        {/* Toaster global */}
        <Toaster position="top-center" toastOptions={{ duration: 2500 }} />
      </BrowserRouter>
    </AuthProvider>
  </React.StrictMode>
);

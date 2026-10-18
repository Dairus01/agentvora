import React, { Suspense, lazy } from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import "@fontsource/dm-sans/latin-400.css";
import "@fontsource/dm-sans/latin-500.css";
import "@fontsource/dm-sans/latin-600.css";
import "@fontsource/dm-sans/latin-700.css";
import "@fontsource/ibm-plex-mono/latin-400.css";
import "@fontsource/ibm-plex-mono/latin-500.css";
import Landing from "./Landing";
import "./styles.css";
const Workspace = lazy(() => import("./Workspace"));
const client = new QueryClient();
createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <QueryClientProvider client={client}>
      <BrowserRouter>
        <Suspense
          fallback={
            <div className="loading-screen">Connecting to Agentvora...</div>
          }
        >
          <Routes>
            <Route path="/" element={<Landing />} />
            <Route path="/*" element={<Workspace />} />
          </Routes>
        </Suspense>
      </BrowserRouter>
    </QueryClientProvider>
  </React.StrictMode>,
);

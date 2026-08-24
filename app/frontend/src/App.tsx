import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { EmpresaProvider } from "@/lib/empresaContext";
import OfflineIndicator from "@/components/OfflineIndicator";
import Index from "./pages/Index";
import EquipoQRPage from "./pages/EquipoQR";
import PortalCliente from "./pages/PortalCliente";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <EmpresaProvider>
        <Toaster />
        <OfflineIndicator />
        <BrowserRouter>
          <Routes>
            <Route path="/" element={<Index />} />
            <Route path="/equipo/:id" element={<EquipoQRPage />} />
            <Route path="/portal/:token" element={<PortalCliente />} />
          </Routes>
        </BrowserRouter>
      </EmpresaProvider>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import NotFound from "@/pages/NotFound";
import { Route, Switch } from "wouter";
import ErrorBoundary from "./components/ErrorBoundary";
import { ThemeProvider } from "./contexts/ThemeContext";
import { AuthProvider } from "./contexts/AuthContext";
import Home from "./pages/Home";
import History from "./pages/History";
import Account from "./pages/Account";
import LoginPage from "./pages/LoginPage";

import ProjectDetail from "./pages/ProjectDetail";
import UploadStep from "./pages/create/UploadStep";
import AnalyzeStep from "./pages/create/AnalyzeStep";
import PlatformStep from "./pages/create/PlatformStep";
import GenerateStep from "./pages/create/GenerateStep";
import CopywritingStep from "./pages/create/CopywritingStep";
import ConfirmStep from "./pages/create/ConfirmStep";
import ResultStep from "./pages/create/ResultStep";
import PaymentStep from "./pages/create/PaymentStep";
import TermsPage from "./pages/TermsPage";
import PrivacyPage from "./pages/PrivacyPage";

function Router() {
  return (
    <Switch>
      <Route path={"/"} component={Home} />
      <Route path="/login" component={LoginPage} />
      <Route path="/history" component={History} />
      <Route path="/account" component={Account} />

      <Route path="/create/upload" component={UploadStep} />
      <Route path="/create/analyze" component={AnalyzeStep} />
      <Route path="/create/platform" component={PlatformStep} />
      <Route path="/create/generate" component={GenerateStep} />
      <Route path="/create/copywriting" component={CopywritingStep} />
      <Route path="/create/confirm" component={ConfirmStep} />
      <Route path="/create/result" component={ResultStep} />
      <Route path="/create/payment" component={PaymentStep} />
      <Route path="/terms" component={TermsPage} />
      <Route path="/privacy" component={PrivacyPage} />
      <Route path="/project/:id" component={ProjectDetail} />
      <Route path={"/404"} component={NotFound} />
      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  return (
    <ErrorBoundary>
      <AuthProvider>
        <ThemeProvider defaultTheme="light">
          <TooltipProvider>
            <Toaster />
            <Router />
          </TooltipProvider>
        </ThemeProvider>
      </AuthProvider>
    </ErrorBoundary>
  );
}

export default App;

import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import NotFound from "@/pages/NotFound";
import { Route, Switch } from "wouter";
import ErrorBoundary from "./components/ErrorBoundary";
import { ThemeProvider } from "./contexts/ThemeContext";
import Home from "./pages/Home";
import History from "./pages/History";
import Account from "./pages/Account";

import ProjectDetail from "./pages/ProjectDetail";
import UploadStep from "./pages/create/UploadStep";
import AnalyzeStep from "./pages/create/AnalyzeStep";
import SuggestStep from "./pages/create/SuggestStep";
import RemoveBgStep from "./pages/create/RemoveBgStep";
import PlatformStep from "./pages/create/PlatformStep";
import GenerateStep from "./pages/create/GenerateStep";
import FeaturesStep from "./pages/create/FeaturesStep";
import CopywritingStep from "./pages/create/CopywritingStep";
import ConfirmStep from "./pages/create/ConfirmStep";
import ResultStep from "./pages/create/ResultStep";
import PaymentStep from "./pages/create/PaymentStep";
import HDResultStep from "./pages/create/HDResultStep";
import HDPaymentStep from "./pages/create/HDPaymentStep";
import DetailResultStep from "./pages/create/DetailResultStep";
import DetailConfirmStep from "./pages/create/DetailConfirmStep";
import StrategyStep from "./pages/create/StrategyStep";
import RecommendStep from "./pages/create/RecommendStep";
import TermsPage from "./pages/TermsPage";
import PrivacyPage from "./pages/PrivacyPage";

function Router() {
  return (
    <Switch>
      <Route path={"/"} component={Home} />
      <Route path="/history" component={History} />
      <Route path="/account" component={Account} />

      <Route path="/create/upload" component={UploadStep} />
      <Route path="/create/analyze" component={AnalyzeStep} />
      <Route path="/create/suggest" component={SuggestStep} />
      <Route path="/create/remove-bg" component={RemoveBgStep} />
      <Route path="/create/platform" component={PlatformStep} />
      <Route path="/create/recommend" component={RecommendStep} />
      <Route path="/create/generate" component={GenerateStep} />
      <Route path="/create/strategy" component={StrategyStep} />
      <Route path="/create/features" component={FeaturesStep} />
      <Route path="/create/copywriting" component={CopywritingStep} />
      <Route path="/create/confirm" component={ConfirmStep} />
      <Route path="/create/result" component={ResultStep} />
      <Route path="/create/payment" component={PaymentStep} />
      <Route path="/create/hd-result" component={HDResultStep} />
      <Route path="/create/hd-payment" component={HDPaymentStep} />
      <Route path="/create/detail-confirm" component={DetailConfirmStep} />
      <Route path="/create/detail-result" component={DetailResultStep} />
      <Route path="/terms" component={TermsPage} />
      <Route path="/privacy" component={PrivacyPage} />
      <Route path="/project/:id" component={ProjectDetail} />
      <Route path={"/404"} component={NotFound} />
      <Route component={NotFound} />
    </Switch>
  );
}

// NOTE: About Theme
// - First choose a default theme according to your design style (dark or light bg), than change color palette in index.css
//   to keep consistent foreground/background color across components
// - If you want to make theme switchable, pass `switchable` ThemeProvider and use `useTheme` hook

function App() {
  return (
    <ErrorBoundary>
      <ThemeProvider
        defaultTheme="light"
        // switchable
      >
        <TooltipProvider>
          <Toaster />
          <Router />
        </TooltipProvider>
      </ThemeProvider>
    </ErrorBoundary>
  );
}

export default App;

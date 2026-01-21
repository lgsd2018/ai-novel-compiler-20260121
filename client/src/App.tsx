import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import NotFound from "@/pages/NotFound";
import { useEffect } from "react";
import { Route, Switch, useLocation, useParams } from "wouter";
import ErrorBoundary from "./components/ErrorBoundary";
import { ThemeProvider } from "./contexts/ThemeContext";
import Home from "./pages/Home";
import ProjectEditor from "./pages/ProjectEditor";
import Characters from "./pages/Characters";
import Timeline from "./pages/Timeline";
import AIModels from "./pages/AIModels";
import Statistics from "./pages/Statistics";
import Exports from "./pages/Exports";
import ExportStyleEditor from "./pages/ExportStyleEditor";
import PlatformPublish from "./pages/PlatformPublish";
import SensitiveWords from "./pages/SensitiveWords";
import TaskMonitor from "./pages/TaskMonitor";
import TaskPlannerPage from "./pages/TaskPlannerPage";
import PlatformRules from "./pages/PlatformRules";
import SpeechHistory from "./pages/SpeechHistory";
import ExtractionRules from "./pages/ExtractionRules";
import RuleAnalytics from "./pages/RuleAnalytics";
import { DEFAULT_PROJECT_ID, LAST_PROJECT_ID_KEY } from "@/const";

function ProjectEntry() {
  const { projectId } = useParams();
  const [, setLocation] = useLocation();
  const lastProjectId = localStorage.getItem(LAST_PROJECT_ID_KEY);

  useEffect(() => {
    if (lastProjectId && projectId !== lastProjectId) {
      setLocation(`/project/${lastProjectId}`, { replace: true });
    }
  }, [lastProjectId, projectId, setLocation]);

  if (lastProjectId && projectId !== lastProjectId) {
    return null;
  }

  if (!lastProjectId) {
    return <Home />;
  }

  return <ProjectEditor />;
}

function RedirectToDefaultProject() {
  const [, setLocation] = useLocation();

  useEffect(() => {
    setLocation(`/project/${DEFAULT_PROJECT_ID}`, { replace: true });
  }, [setLocation]);

  return null;
}

function Router() {
  return (
    <Switch>
      <Route path="/" component={RedirectToDefaultProject} />
      <Route path="/project/:projectId" component={ProjectEntry} />
      <Route path="/project/:projectId/characters" component={Characters} />
      <Route path="/project/:projectId/timeline" component={Timeline} />
      <Route path="/ai-models" component={AIModels} />
      <Route path="/statistics" component={Statistics} />
      <Route path="/project/:projectId/exports" component={Exports} />
      <Route path="/project/:projectId/export-style" component={ExportStyleEditor} />
      <Route path="/project/:projectId/publish" component={PlatformPublish} />
      <Route path="/project/:projectId/task-planner" component={TaskPlannerPage} />
      <Route path="/sensitive-words" component={SensitiveWords} />
      <Route path="/task-monitor" component={TaskMonitor} />
      <Route path="/platform-rules" component={PlatformRules} />
      <Route path="/speech-history" component={SpeechHistory} />
      <Route path="/extraction-rules" component={ExtractionRules} />
      <Route path="/rule-analytics" component={RuleAnalytics} />
      <Route path="/404" component={NotFound} />
      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  console.log("App component rendering...");
  return (
    // <div id="app-container">
    //   <div style={{ position: 'fixed', top: 50, left: 0, width: '100%', background: 'blue', color: 'white', zIndex: 999999, textAlign: 'center' }}>
    //     App Component Rendered
    //   </div>
      <ErrorBoundary>
        <ThemeProvider defaultTheme="light" switchable>
        <TooltipProvider>
          <Toaster />
          <Router />
        </TooltipProvider>
      </ThemeProvider>
    </ErrorBoundary>
    // </div>
  );
}

export default App;

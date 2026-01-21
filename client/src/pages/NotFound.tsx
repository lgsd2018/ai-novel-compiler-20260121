import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { AlertCircle, Home } from "lucide-react";
import { useLocation } from "wouter";

export default function NotFound() {
  const [, setLocation] = useLocation();

  const handleGoHome = () => {
    setLocation("/");
  };

  return (
    <div className="min-h-screen w-full flex items-center justify-center bg-background p-4">
      <div className="absolute inset-0 -z-10 bg-[radial-gradient(ellipse_at_center,_var(--tw-gradient-stops))] from-primary/5 via-background to-background"></div>
      
      <Card className="w-full max-w-lg shadow-xl border-border/50 bg-card/50 backdrop-blur-md">
        <CardContent className="pt-12 pb-12 text-center space-y-8">
          <div className="relative inline-flex mb-4">
            <div className="absolute inset-0 bg-destructive/20 rounded-full animate-pulse blur-xl" />
            <div className="relative bg-background rounded-full p-4 border border-border/50 shadow-sm">
              <AlertCircle className="h-16 w-16 text-destructive" />
            </div>
          </div>

          <div className="space-y-2">
            <h1 className="text-6xl font-heading font-bold text-foreground tracking-tighter">404</h1>
            <h2 className="text-2xl font-medium text-foreground/80 tracking-tight">
              页面未找到
            </h2>
          </div>

          <p className="text-muted-foreground max-w-sm mx-auto leading-relaxed">
            抱歉，您访问的页面不存在。
            <br />
            它可能已被移动或删除。
          </p>

          <div className="flex justify-center pt-4">
            <Button
              onClick={handleGoHome}
              size="lg"
              className="shadow-lg shadow-primary/20 hover:scale-105 transition-transform"
            >
              <Home className="w-4 h-4 mr-2" />
              返回首页
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

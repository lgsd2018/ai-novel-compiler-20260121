/**
 * Rule Analytics Page
 * 规则效果分析页面
 */

import { useState } from 'react';
import { trpc } from '../lib/trpc';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { BarChart3, TrendingUp, Clock, CheckCircle, XCircle, Trash2, RefreshCw, Activity, AlertTriangle, Zap } from 'lucide-react';
import { toast } from 'sonner';
import DashboardLayout from '../components/DashboardLayout';
import { Badge } from '../components/ui/badge';

export function RuleAnalyticsContent() {
  const [selectedProjectId, setSelectedProjectId] = useState<number | undefined>();
  
  const { data: analytics, isLoading, refetch } = trpc.ruleStats.getAnalytics.useQuery({
    projectId: selectedProjectId,
  });

  const cleanStatsMutation = trpc.ruleStats.cleanOldStats.useMutation({
    onSuccess: (data) => {
      toast.success(`已清理 ${data.deletedCount} 条旧统计数据`);
      refetch();
    },
    onError: (error) => {
      toast.error(`清理失败: ${error.message}`);
    },
  });

  const handleCleanOldStats = () => {
    if (confirm('确定要清理30天前的统计数据吗？')) {
      cleanStatsMutation.mutate();
    }
  };

  return (
    <div className="space-y-6">
        <div className="flex flex-col md:flex-row gap-4 items-start md:items-center justify-between">
          <div>
            <h2 className="text-2xl font-bold font-heading tracking-tight">规则效果分析</h2>
            <p className="text-muted-foreground">查看自定义提取规则的使用统计和效果分析</p>
          </div>
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => refetch()}
              className="shadow-sm"
            >
              <RefreshCw className="w-4 h-4 mr-2" />
              刷新数据
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={handleCleanOldStats}
              disabled={cleanStatsMutation.isPending}
              className="shadow-sm hover:text-destructive hover:border-destructive/50"
            >
              <Trash2 className="w-4 h-4 mr-2" />
              {cleanStatsMutation.isPending ? '清理中...' : '清理旧数据'}
            </Button>
          </div>
        </div>

        {isLoading ? (
          <div className="flex flex-col items-center justify-center min-h-[400px] text-muted-foreground">
            <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-primary mb-4"></div>
            <p>加载规则分析数据...</p>
          </div>
        ) : !analytics || analytics.length === 0 ? (
          <Card className="border-border/40 bg-card/50 backdrop-blur-sm">
            <CardContent className="py-20 text-center flex flex-col items-center justify-center">
              <div className="w-16 h-16 rounded-full bg-muted/50 flex items-center justify-center mb-4">
                <BarChart3 className="w-8 h-8 opacity-50" />
              </div>
              <h3 className="text-xl font-semibold mb-2">暂无统计数据</h3>
              <p className="text-muted-foreground max-w-sm">
                开始使用自定义提取规则后，这里将显示详细的效果分析和性能评估
              </p>
            </CardContent>
          </Card>
        ) : (
          <div className="grid grid-cols-1 gap-6">
            {analytics.map((rule) => (
              <Card key={rule.ruleId} className="border-border/40 bg-card/50 backdrop-blur-sm hover:shadow-lg hover:shadow-primary/5 transition-all duration-300 hover:-translate-y-1 overflow-hidden group">
                <div className={`h-1 w-full ${
                   rule.successRate >= 90 ? 'bg-green-500' : 
                   rule.successRate >= 70 ? 'bg-yellow-500' : 'bg-red-500'
                }`} />
                <CardHeader className="pb-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <CardTitle className="text-xl font-heading flex items-center gap-2 group-hover:text-primary transition-colors">
                        {rule.ruleName}
                        <Badge variant="outline" className="text-xs font-normal text-muted-foreground ml-2">
                          ID: {rule.ruleId}
                        </Badge>
                      </CardTitle>
                      <CardDescription className="flex items-center gap-2 mt-1">
                        <Clock className="w-3.5 h-3.5" />
                        最后使用: {new Date(rule.lastUsedAt).toLocaleString('zh-CN')}
                      </CardDescription>
                    </div>
                    <Badge 
                      variant="outline" 
                      className={`text-sm px-3 py-1 border-0 ring-1 ring-inset ${
                        rule.successRate >= 90 ? 'bg-green-50 text-green-700 ring-green-600/20 dark:bg-green-900/10 dark:text-green-400 dark:ring-green-900/30' : 
                        rule.successRate >= 70 ? 'bg-yellow-50 text-yellow-700 ring-yellow-600/20 dark:bg-yellow-900/10 dark:text-yellow-400 dark:ring-yellow-900/30' : 
                        'bg-red-50 text-red-700 ring-red-600/20 dark:bg-red-900/10 dark:text-red-400 dark:ring-red-900/30'
                      }`}
                    >
                      {rule.successRate >= 90 ? '运行稳定' : rule.successRate >= 70 ? '表现良好' : '需要优化'}
                    </Badge>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
                    {/* 总使用次数 */}
                    <div className="bg-muted/30 rounded-xl p-4 border border-border/30 hover:bg-muted/50 transition-colors">
                      <div className="flex items-center gap-2 text-muted-foreground mb-2 text-sm">
                        <Activity className="w-4 h-4 text-blue-500" />
                        总使用次数
                      </div>
                      <div className="text-2xl font-bold font-mono">{rule.totalUses}</div>
                    </div>

                    {/* 成功率 */}
                    <div className="bg-muted/30 rounded-xl p-4 border border-border/30 hover:bg-muted/50 transition-colors">
                      <div className="flex items-center gap-2 text-muted-foreground mb-2 text-sm">
                        {rule.successRate >= 90 ? (
                          <CheckCircle className="w-4 h-4 text-green-500" />
                        ) : rule.successRate >= 70 ? (
                          <AlertTriangle className="w-4 h-4 text-yellow-500" />
                        ) : (
                          <XCircle className="w-4 h-4 text-red-500" />
                        )}
                        成功率
                      </div>
                      <div className={`text-2xl font-bold font-mono ${
                        rule.successRate >= 90 ? 'text-green-600 dark:text-green-400' : 
                        rule.successRate >= 70 ? 'text-yellow-600 dark:text-yellow-400' : 'text-red-600 dark:text-red-400'
                      }`}>
                        {rule.successRate.toFixed(1)}%
                      </div>
                    </div>

                    {/* 平均处理时间 */}
                    <div className="bg-muted/30 rounded-xl p-4 border border-border/30 hover:bg-muted/50 transition-colors">
                      <div className="flex items-center gap-2 text-muted-foreground mb-2 text-sm">
                        <Zap className="w-4 h-4 text-purple-500" />
                        平均耗时
                      </div>
                      <div className="text-2xl font-bold font-mono">
                        {rule.avgProcessingTime 
                          ? `${Math.round(rule.avgProcessingTime)}ms`
                          : 'N/A'}
                      </div>
                    </div>

                    {/* 平均提取数量 */}
                    <div className="bg-muted/30 rounded-xl p-4 border border-border/30 hover:bg-muted/50 transition-colors">
                      <div className="flex items-center gap-2 text-muted-foreground mb-2 text-sm">
                        <TrendingUp className="w-4 h-4 text-orange-500" />
                        平均提取数
                      </div>
                      <div className="text-2xl font-bold font-mono">
                        {rule.avgExtractedCount.toFixed(1)}
                      </div>
                    </div>
                  </div>

                  {/* 性能评估 */}
                  <div className="bg-primary/5 rounded-xl p-4 border border-primary/10">
                    <h4 className="text-sm font-semibold mb-3 flex items-center gap-2">
                      <Sparkles className="w-4 h-4 text-primary" />
                      AI 性能评估建议
                    </h4>
                    <div className="space-y-2">
                      {rule.successRate >= 90 && (
                        <div className="flex items-start gap-2 text-sm text-muted-foreground">
                          <CheckCircle className="w-4 h-4 text-green-500 mt-0.5 shrink-0" />
                          <span>规则运行非常稳定，提取效果优秀。</span>
                        </div>
                      )}
                      {rule.successRate < 90 && rule.successRate >= 70 && (
                        <div className="flex items-start gap-2 text-sm text-muted-foreground">
                          <TrendingUp className="w-4 h-4 text-yellow-500 mt-0.5 shrink-0" />
                          <span>规则运行基本正常，建议微调提示词以进一步提高准确率。</span>
                        </div>
                      )}
                      {rule.successRate < 70 && (
                        <div className="flex items-start gap-2 text-sm text-muted-foreground">
                          <XCircle className="w-4 h-4 text-red-500 mt-0.5 shrink-0" />
                          <span>规则成功率较低，建议检查字段定义是否过于复杂，或优化提示词描述。</span>
                        </div>
                      )}
                      {rule.avgProcessingTime && rule.avgProcessingTime > 5000 && (
                        <div className="flex items-start gap-2 text-sm text-muted-foreground">
                          <Clock className="w-4 h-4 text-orange-500 mt-0.5 shrink-0" />
                          <span>处理时间较长 ({Math.round(rule.avgProcessingTime/1000)}s)，建议简化规则逻辑或减少单次处理文本量。</span>
                        </div>
                      )}
                      {rule.avgExtractedCount < 1 && (
                        <div className="flex items-start gap-2 text-sm text-muted-foreground">
                          <BarChart3 className="w-4 h-4 text-blue-500 mt-0.5 shrink-0" />
                          <span>平均提取数量较少，请确认规则是否适用于当前的文本内容类型。</span>
                        </div>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
  );
}

export default function RuleAnalytics() {
  return (
    <DashboardLayout>
      <RuleAnalyticsContent />
    </DashboardLayout>
  );
}

function Sparkles(props: any) {
  return (
    <svg
      {...props}
      xmlns="http://www.w3.org/2000/svg"
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="m12 3-1.912 5.813a2 2 0 0 1-1.275 1.275L3 12l5.813 1.912a2 2 0 0 1 1.275 1.275L12 21l1.912-5.813a2 2 0 0 1 1.275-1.275L21 12l-5.813-1.912a2 2 0 0 1-1.275-1.275L12 3Z" />
      <path d="M5 3v4" />
      <path d="M9 5h4" />
      <path d="M5 19v4" />
      <path d="M9 19h4" />
    </svg>
  )
}

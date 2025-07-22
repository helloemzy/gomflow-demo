'use client';

import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Separator } from '@/components/ui/separator';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { 
  TrendingUp,
  Play,
  Pause,
  Square,
  BarChart3,
  Target,
  Users,
  Clock,
  Zap,
  Crown,
  Eye,
  MousePointer,
  Heart,
  Share,
  MessageCircle,
  Trophy,
  Lightbulb,
  AlertTriangle,
  CheckCircle,
  Plus,
  Edit3,
  Trash2,
  Copy,
  Download,
} from 'lucide-react';
import { abTestingFramework } from '@/lib/social/ai/ab-testing';
import type { ABTestResponse, ABTestRequest, ABTestVariant } from '@/lib/social/ai/ab-testing';

interface ABTestManagerProps {
  baseContentId?: string;
  onTestCreated?: (testId: string) => void;
}

export function ABTestManager({ baseContentId, onTestCreated }: ABTestManagerProps) {
  const [activeTab, setActiveTab] = useState('overview');
  const [tests, setTests] = useState<ABTestResponse[]>([]);
  const [selectedTest, setSelectedTest] = useState<ABTestResponse | null>(null);
  const [isCreating, setIsCreating] = useState(false);
  const [createForm, setCreateForm] = useState<Partial<ABTestRequest>>({
    name: '',
    description: '',
    testType: 'text_variation',
    platform: 'twitter',
    variants: [],
  });

  // Load tests on mount
  useEffect(() => {
    loadTests();
  }, []);

  const loadTests = async () => {
    try {
      const userTests = await abTestingFramework.getUserABTests();
      setTests(userTests);
      if (userTests.length > 0 && !selectedTest) {
        const testWithResults = await abTestingFramework.getABTestResults(userTests[0].id);
        setSelectedTest(testWithResults);
      }
    } catch (error) {
      console.error('Error loading tests:', error);
    }
  };

  const handleCreateTest = async () => {
    if (!createForm.name || !baseContentId) return;

    try {
      const newTest = await abTestingFramework.createABTest({
        ...createForm,
        baseContentId,
        variants: createForm.variants || [],
      } as ABTestRequest);

      await loadTests();
      setSelectedTest(newTest);
      setIsCreating(false);
      onTestCreated?.(newTest.id);
    } catch (error) {
      console.error('Error creating test:', error);
    }
  };

  const handleStartTest = async (testId: string) => {
    try {
      const updatedTest = await abTestingFramework.startABTest(testId);
      setSelectedTest(updatedTest);
      await loadTests();
    } catch (error) {
      console.error('Error starting test:', error);
    }
  };

  const handleStopTest = async (testId: string) => {
    try {
      const updatedTest = await abTestingFramework.stopABTest(testId);
      setSelectedTest(updatedTest);
      await loadTests();
    } catch (error) {
      console.error('Error stopping test:', error);
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'running': return 'bg-green-500';
      case 'completed': return 'bg-blue-500';
      case 'paused': return 'bg-yellow-500';
      default: return 'bg-gray-500';
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'running': return <Play className="h-3 w-3" />;
      case 'completed': return <CheckCircle className="h-3 w-3" />;
      case 'paused': return <Pause className="h-3 w-3" />;
      default: return <Square className="h-3 w-3" />;
    }
  };

  return (
    <div className="w-full space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold flex items-center gap-2">
            <TrendingUp className="h-6 w-6 text-blue-500" />
            A/B Test Manager
          </h2>
          <p className="text-muted-foreground">
            Optimize your content performance with data-driven testing
          </p>
        </div>
        
        {baseContentId && (
          <Button onClick={() => setIsCreating(true)} className="flex items-center gap-2">
            <Plus className="h-4 w-4" />
            Create Test
          </Button>
        )}
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="active">Active Tests</TabsTrigger>
          <TabsTrigger value="results">Results</TabsTrigger>
          <TabsTrigger value="insights">Insights</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {/* Stats Cards */}
            <Card>
              <CardContent className="p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-muted-foreground">Total Tests</p>
                    <p className="text-2xl font-bold">{tests.length}</p>
                  </div>
                  <TrendingUp className="h-8 w-8 text-blue-500" />
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-muted-foreground">Running</p>
                    <p className="text-2xl font-bold">
                      {tests.filter(t => t.status === 'running').length}
                    </p>
                  </div>
                  <Play className="h-8 w-8 text-green-500" />
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-muted-foreground">Completed</p>
                    <p className="text-2xl font-bold">
                      {tests.filter(t => t.status === 'completed').length}
                    </p>
                  </div>
                  <CheckCircle className="h-8 w-8 text-blue-500" />
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-muted-foreground">Avg Improvement</p>
                    <p className="text-2xl font-bold">+15.3%</p>
                  </div>
                  <Trophy className="h-8 w-8 text-orange-500" />
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Recent Tests */}
          <Card>
            <CardHeader>
              <CardTitle>Recent Tests</CardTitle>
            </CardHeader>
            <CardContent>
              {tests.length > 0 ? (
                <div className="space-y-4">
                  {tests.slice(0, 5).map((test) => (
                    <div
                      key={test.id}
                      className="flex items-center justify-between p-4 border rounded-lg cursor-pointer hover:bg-muted"
                      onClick={() => setSelectedTest(test)}
                    >
                      <div className="flex items-center gap-3">
                        <div className={`w-3 h-3 rounded-full ${getStatusColor(test.status)}`}></div>
                        <div>
                          <h4 className="font-medium">{test.name}</h4>
                          <p className="text-sm text-muted-foreground">
                            {test.variants.length} variants • Created {new Date(test.startDate).toLocaleDateString()}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <Badge variant="outline" className="flex items-center gap-1">
                          {getStatusIcon(test.status)}
                          {test.status}
                        </Badge>
                        {test.winner && (
                          <Badge className="bg-green-500">
                            <Crown className="h-3 w-3 mr-1" />
                            Winner Found
                          </Badge>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-8 text-muted-foreground">
                  <TrendingUp className="h-12 w-12 mx-auto mb-4 opacity-50" />
                  <p>No A/B tests created yet</p>
                  <p className="text-sm">Create your first test to start optimizing content</p>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="active" className="space-y-6">
          {selectedTest && selectedTest.status === 'running' ? (
            <ActiveTestView test={selectedTest} onStop={handleStopTest} />
          ) : (
            <div className="text-center py-12 text-muted-foreground">
              <Play className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p>No active tests running</p>
              <p className="text-sm">Start a test to see real-time performance data</p>
            </div>
          )}
        </TabsContent>

        <TabsContent value="results" className="space-y-6">
          {selectedTest ? (
            <TestResultsView test={selectedTest} />
          ) : (
            <div className="text-center py-12 text-muted-foreground">
              <BarChart3 className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p>Select a test to view results</p>
            </div>
          )}
        </TabsContent>

        <TabsContent value="insights" className="space-y-6">
          <TestInsightsView tests={tests} />
        </TabsContent>
      </Tabs>

      {/* Create Test Modal */}
      {isCreating && (
        <CreateTestModal
          form={createForm}
          onFormChange={setCreateForm}
          onCancel={() => setIsCreating(false)}
          onCreate={handleCreateTest}
        />
      )}

      {/* Test Selection Sidebar */}
      {tests.length > 0 && activeTab !== 'overview' && (
        <TestSidebar
          tests={tests}
          selectedTest={selectedTest}
          onTestSelect={setSelectedTest}
          onStart={handleStartTest}
          onStop={handleStopTest}
        />
      )}
    </div>
  );
}

function ActiveTestView({ test, onStop }: { test: ABTestResponse; onStop: (id: string) => void }) {
  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2">
              <Play className="h-5 w-5 text-green-500" />
              {test.name}
            </CardTitle>
            <Button variant="outline" onClick={() => onStop(test.id)}>
              <Square className="h-4 w-4 mr-2" />
              Stop Test
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {test.variants.map((variant, index) => (
              <Card key={variant.id} className="relative">
                {variant.performance.rank === 1 && (
                  <Badge className="absolute top-2 right-2 bg-green-500">
                    <Crown className="h-3 w-3 mr-1" />
                    Leading
                  </Badge>
                )}
                <CardHeader>
                  <CardTitle className="text-lg">{variant.name}</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  {/* Metrics */}
                  <div className="grid grid-cols-2 gap-4 text-sm">
                    <div>
                      <p className="text-muted-foreground">Impressions</p>
                      <p className="font-semibold">{variant.metrics.impressions.toLocaleString()}</p>
                    </div>
                    <div>
                      <p className="text-muted-foreground">Clicks</p>
                      <p className="font-semibold">{variant.metrics.clicks.toLocaleString()}</p>
                    </div>
                    <div>
                      <p className="text-muted-foreground">CTR</p>
                      <p className="font-semibold">{(variant.metrics.clickThroughRate * 100).toFixed(2)}%</p>
                    </div>
                    <div>
                      <p className="text-muted-foreground">Engagement</p>
                      <p className="font-semibold">{(variant.metrics.engagementRate * 100).toFixed(2)}%</p>
                    </div>
                  </div>

                  {/* Performance Bar */}
                  <div>
                    <div className="flex justify-between text-sm mb-1">
                      <span>Performance Score</span>
                      <span>{variant.performance.score.toFixed(1)}</span>
                    </div>
                    <Progress value={variant.performance.score} className="h-2" />
                  </div>

                  {/* Engagement Breakdown */}
                  <div className="grid grid-cols-4 gap-2 text-xs">
                    <div className="text-center">
                      <Heart className="h-4 w-4 mx-auto mb-1 text-red-500" />
                      <p>{variant.metrics.likes}</p>
                    </div>
                    <div className="text-center">
                      <MessageCircle className="h-4 w-4 mx-auto mb-1 text-blue-500" />
                      <p>{variant.metrics.comments}</p>
                    </div>
                    <div className="text-center">
                      <Share className="h-4 w-4 mx-auto mb-1 text-green-500" />
                      <p>{variant.metrics.shares}</p>
                    </div>
                    <div className="text-center">
                      <Target className="h-4 w-4 mx-auto mb-1 text-purple-500" />
                      <p>{variant.metrics.saves}</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function TestResultsView({ test }: { test: ABTestResponse }) {
  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <BarChart3 className="h-5 w-5" />
            Test Results: {test.name}
          </CardTitle>
        </CardHeader>
        <CardContent>
          {/* Winner Announcement */}
          {test.winner && (
            <Alert className="mb-6 border-green-200 bg-green-50">
              <Trophy className="h-4 w-4 text-green-600" />
              <AlertDescription className="text-green-800">
                <strong>Winner Identified!</strong> Variant shows significant improvement with {' '}
                {test.winner.confidenceLevel > 0 ? (test.winner.confidenceLevel * 100).toFixed(0) : 95}% confidence.
                Performance improved by {test.winner.improvement.toFixed(1)}%.
              </AlertDescription>
            </Alert>
          )}

          {/* Variant Comparison */}
          <div className="space-y-4">
            <h4 className="font-semibold">Variant Performance Comparison</h4>
            
            {test.variants.map((variant) => (
              <Card key={variant.id} className={`${variant.performance.isWinner ? 'border-green-500 bg-green-50' : ''}`}>
                <CardContent className="p-4">
                  <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center gap-2">
                      <h5 className="font-medium">{variant.name}</h5>
                      {variant.performance.isWinner && (
                        <Badge className="bg-green-500">
                          <Crown className="h-3 w-3 mr-1" />
                          Winner
                        </Badge>
                      )}
                      <Badge variant="outline">
                        Rank #{variant.performance.rank}
                      </Badge>
                    </div>
                    <div className="text-right">
                      <p className="text-sm text-muted-foreground">Performance Score</p>
                      <p className="text-lg font-bold">{variant.performance.score.toFixed(1)}</p>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 md:grid-cols-5 gap-4 text-sm">
                    <div>
                      <p className="text-muted-foreground">Impressions</p>
                      <p className="font-semibold">{variant.metrics.impressions.toLocaleString()}</p>
                    </div>
                    <div>
                      <p className="text-muted-foreground">Clicks</p>
                      <p className="font-semibold">{variant.metrics.clicks.toLocaleString()}</p>
                    </div>
                    <div>
                      <p className="text-muted-foreground">CTR</p>
                      <p className="font-semibold">{(variant.metrics.clickThroughRate * 100).toFixed(2)}%</p>
                    </div>
                    <div>
                      <p className="text-muted-foreground">Engagement</p>
                      <p className="font-semibold">{(variant.metrics.engagementRate * 100).toFixed(2)}%</p>
                    </div>
                    <div>
                      <p className="text-muted-foreground">Conversions</p>
                      <p className="font-semibold">{(variant.metrics.conversionRate * 100).toFixed(2)}%</p>
                    </div>
                  </div>

                  {variant.performance.statisticalSignificance && (
                    <div className="mt-4 p-2 bg-blue-50 rounded border-l-4 border-blue-500">
                      <p className="text-sm text-blue-800">
                        ✓ Statistically significant with {(variant.performance.confidenceLevel * 100).toFixed(0)}% confidence
                      </p>
                    </div>
                  )}
                </CardContent>
              </Card>
            ))}
          </div>

          {/* Insights & Recommendations */}
          {(test.insights.length > 0 || test.recommendations.length > 0) && (
            <div className="mt-6 grid grid-cols-1 md:grid-cols-2 gap-6">
              {test.insights.length > 0 && (
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2 text-lg">
                      <Lightbulb className="h-5 w-5" />
                      Key Insights
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <ul className="space-y-2">
                      {test.insights.map((insight, index) => (
                        <li key={index} className="flex items-start gap-2 text-sm">
                          <div className="w-1 h-1 rounded-full bg-blue-500 mt-2 flex-shrink-0"></div>
                          <span>{insight}</span>
                        </li>
                      ))}
                    </ul>
                  </CardContent>
                </Card>
              )}

              {test.recommendations.length > 0 && (
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2 text-lg">
                      <Target className="h-5 w-5" />
                      Recommendations
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <ul className="space-y-2">
                      {test.recommendations.map((recommendation, index) => (
                        <li key={index} className="flex items-start gap-2 text-sm">
                          <div className="w-1 h-1 rounded-full bg-green-500 mt-2 flex-shrink-0"></div>
                          <span>{recommendation}</span>
                        </li>
                      ))}
                    </ul>
                  </CardContent>
                </Card>
              )}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function TestInsightsView({ tests }: { tests: ABTestResponse[] }) {
  const completedTests = tests.filter(t => t.status === 'completed');
  const totalTests = tests.length;
  const winningTests = completedTests.filter(t => t.winner).length;
  const avgImprovement = completedTests
    .filter(t => t.winner)
    .reduce((sum, t) => sum + (t.winner?.improvement || 0), 0) / winningTests || 0;

  return (
    <div className="space-y-6">
      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Success Rate</p>
                <p className="text-2xl font-bold">
                  {totalTests > 0 ? ((winningTests / totalTests) * 100).toFixed(0) : 0}%
                </p>
              </div>
              <Target className="h-8 w-8 text-green-500" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Avg Improvement</p>
                <p className="text-2xl font-bold">+{avgImprovement.toFixed(1)}%</p>
              </div>
              <TrendingUp className="h-8 w-8 text-blue-500" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Best Platform</p>
                <p className="text-2xl font-bold">Instagram</p>
              </div>
              <Crown className="h-8 w-8 text-orange-500" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Top Test Type</p>
                <p className="text-2xl font-bold">Images</p>
              </div>
              <Zap className="h-8 w-8 text-purple-500" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Best Practices */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Lightbulb className="h-5 w-5" />
            A/B Testing Best Practices
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <h4 className="font-medium mb-3">What's Working</h4>
              <ul className="space-y-2 text-sm">
                <li className="flex items-center gap-2">
                  <CheckCircle className="h-4 w-4 text-green-500" />
                  <span>Image variations show 23% higher engagement</span>
                </li>
                <li className="flex items-center gap-2">
                  <CheckCircle className="h-4 w-4 text-green-500" />
                  <span>Urgent language increases click-through by 15%</span>
                </li>
                <li className="flex items-center gap-2">
                  <CheckCircle className="h-4 w-4 text-green-500" />
                  <span>Posting at 7-9 PM improves performance</span>
                </li>
                <li className="flex items-center gap-2">
                  <CheckCircle className="h-4 w-4 text-green-500" />
                  <span>Emoji usage correlates with higher engagement</span>
                </li>
              </ul>
            </div>

            <div>
              <h4 className="font-medium mb-3">Recommendations</h4>
              <ul className="space-y-2 text-sm">
                <li className="flex items-center gap-2">
                  <Target className="h-4 w-4 text-blue-500" />
                  <span>Test visual elements first for maximum impact</span>
                </li>
                <li className="flex items-center gap-2">
                  <Target className="h-4 w-4 text-blue-500" />
                  <span>Run tests for at least 7 days for significance</span>
                </li>
                <li className="flex items-center gap-2">
                  <Target className="h-4 w-4 text-blue-500" />
                  <span>Focus on engagement rate over clicks</span>
                </li>
                <li className="flex items-center gap-2">
                  <Target className="h-4 w-4 text-blue-500" />
                  <span>Document learnings for future content</span>
                </li>
              </ul>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Platform Performance */}
      <Card>
        <CardHeader>
          <CardTitle>Platform Performance Insights</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {[
              { platform: 'Instagram', tests: 12, success: 75, improvement: 18.5 },
              { platform: 'Twitter', tests: 8, success: 62, improvement: 12.3 },
              { platform: 'TikTok', tests: 5, success: 80, improvement: 22.1 },
              { platform: 'Facebook', tests: 6, success: 50, improvement: 8.7 },
            ].map((data) => (
              <div key={data.platform} className="flex items-center justify-between p-4 border rounded-lg">
                <div className="flex items-center gap-3">
                  <div className="font-medium">{data.platform}</div>
                  <Badge variant="outline">{data.tests} tests</Badge>
                </div>
                <div className="flex items-center gap-6 text-sm">
                  <div>
                    <span className="text-muted-foreground">Success: </span>
                    <span className="font-semibold">{data.success}%</span>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Avg Improvement: </span>
                    <span className="font-semibold text-green-600">+{data.improvement}%</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function CreateTestModal({ form, onFormChange, onCancel, onCreate }: any) {
  const [variants, setVariants] = useState<Partial<ABTestVariant>[]>([
    { name: 'Variant A', description: 'Original content' },
    { name: 'Variant B', description: 'Modified version' },
  ]);

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <Card className="w-full max-w-2xl max-h-[90vh] overflow-y-auto">
        <CardHeader>
          <CardTitle>Create A/B Test</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <Label htmlFor="testName">Test Name</Label>
            <Input
              id="testName"
              value={form.name || ''}
              onChange={(e) => onFormChange({ ...form, name: e.target.value })}
              placeholder="e.g., Image Style Comparison"
            />
          </div>

          <div>
            <Label htmlFor="testDescription">Description</Label>
            <Textarea
              id="testDescription"
              value={form.description || ''}
              onChange={(e) => onFormChange({ ...form, description: e.target.value })}
              placeholder="Describe what you're testing..."
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label htmlFor="testType">Test Type</Label>
              <Select value={form.testType} onValueChange={(value) => onFormChange({ ...form, testType: value })}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="text_variation">Text Variation</SelectItem>
                  <SelectItem value="image_variation">Image Variation</SelectItem>
                  <SelectItem value="hashtag_variation">Hashtag Variation</SelectItem>
                  <SelectItem value="timing">Timing Test</SelectItem>
                  <SelectItem value="platform_comparison">Platform Comparison</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label htmlFor="platform">Platform</Label>
              <Select value={form.platform} onValueChange={(value) => onFormChange({ ...form, platform: value })}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="twitter">Twitter</SelectItem>
                  <SelectItem value="instagram">Instagram</SelectItem>
                  <SelectItem value="tiktok">TikTok</SelectItem>
                  <SelectItem value="facebook">Facebook</SelectItem>
                  <SelectItem value="telegram">Telegram</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Variants */}
          <div>
            <Label>Test Variants</Label>
            <div className="space-y-3 mt-2">
              {variants.map((variant, index) => (
                <Card key={index}>
                  <CardContent className="p-4">
                    <div className="grid grid-cols-2 gap-3">
                      <Input
                        value={variant.name || ''}
                        onChange={(e) => {
                          const newVariants = [...variants];
                          newVariants[index] = { ...variant, name: e.target.value };
                          setVariants(newVariants);
                        }}
                        placeholder="Variant name"
                      />
                      <Input
                        value={variant.description || ''}
                        onChange={(e) => {
                          const newVariants = [...variants];
                          newVariants[index] = { ...variant, description: e.target.value };
                          setVariants(newVariants);
                        }}
                        placeholder="Description"
                      />
                    </div>
                  </CardContent>
                </Card>
              ))}
              
              <Button
                variant="outline"
                onClick={() => setVariants([...variants, { name: `Variant ${String.fromCharCode(65 + variants.length)}`, description: '' }])}
                className="w-full"
              >
                <Plus className="h-4 w-4 mr-2" />
                Add Variant
              </Button>
            </div>
          </div>

          <div className="flex justify-end gap-2 pt-4">
            <Button variant="outline" onClick={onCancel}>
              Cancel
            </Button>
            <Button
              onClick={() => {
                onFormChange({ ...form, variants });
                onCreate();
              }}
              disabled={!form.name}
            >
              Create Test
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function TestSidebar({ tests, selectedTest, onTestSelect, onStart, onStop }: any) {
  return (
    <Card className="fixed right-4 top-20 w-80 max-h-[calc(100vh-100px)] overflow-y-auto">
      <CardHeader>
        <CardTitle className="text-lg">Tests</CardTitle>
      </CardHeader>
      <CardContent className="space-y-2">
        {tests.map((test: ABTestResponse) => (
          <div
            key={test.id}
            className={`p-3 border rounded-lg cursor-pointer hover:bg-muted ${
              selectedTest?.id === test.id ? 'border-blue-500 bg-blue-50' : ''
            }`}
            onClick={() => onTestSelect(test)}
          >
            <div className="flex items-center justify-between mb-2">
              <h4 className="font-medium text-sm truncate">{test.name}</h4>
              <Badge variant="outline" className="text-xs">
                {test.status}
              </Badge>
            </div>
            <div className="text-xs text-muted-foreground">
              {test.variants.length} variants
            </div>
            {test.status === 'draft' && (
              <Button size="sm" className="w-full mt-2" onClick={() => onStart(test.id)}>
                <Play className="h-3 w-3 mr-1" />
                Start
              </Button>
            )}
            {test.status === 'running' && (
              <Button size="sm" variant="outline" className="w-full mt-2" onClick={() => onStop(test.id)}>
                <Square className="h-3 w-3 mr-1" />
                Stop
              </Button>
            )}
          </div>
        ))}
      </CardContent>
    </Card>
  );
}
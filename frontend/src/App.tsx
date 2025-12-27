import { useState, useCallback, useEffect } from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card, CardContent, CardDescription, CardHeader } from '@/components/ui/card';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import {
  Database,
  FolderOpen,
  Upload,
  Search,
  CheckCircle2,
  XCircle,
  Loader2,
  Lightbulb,
  HardDrive
} from 'lucide-react';

import { SearchInterface } from './components/SearchInterface';
import { SearchResults } from './components/SearchResults';
import { AddKnowledge } from './components/AddKnowledge';
import { ManageIndexes } from './components/ManageIndexes';
import { Toaster, toast } from './components/ui/toaster';
import { queryKnowledgeBase, checkHealth, listIndexes, getIndexRecordCount } from './api/client';
import type { SearchResult } from './api/types';

function App() {
  const [activeTab, setActiveTab] = useState('manage-indexes');
  const [results, setResults] = useState<SearchResult[]>([]);
  const [currentQuery, setCurrentQuery] = useState('');
  const [currentIndex, setCurrentIndex] = useState('');
  const [searchTimeMs, setSearchTimeMs] = useState<number | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isHealthy, setIsHealthy] = useState<boolean | null>(null);
  const [preSelectedIndex, setPreSelectedIndex] = useState<string | null>(null);
  const [indexCount, setIndexCount] = useState<number>(0);
  const [totalRecords, setTotalRecords] = useState<number>(0);
  const [indexRefreshTrigger, setIndexRefreshTrigger] = useState(0);

  const hasIndexes = indexCount > 0;

  useEffect(() => {
    checkHealth()
      .then(() => setIsHealthy(true))
      .catch(() => setIsHealthy(false));
  }, []);

  useEffect(() => {
    if (isHealthy) {
      listIndexes()
        .then(async (response) => {
          setIndexCount(response.count);
          if (response.indexes.length > 0) {
            const counts = await Promise.all(
              response.indexes.map((indexName) =>
                getIndexRecordCount(indexName).then((r) => r.record_count).catch(() => 0)
              )
            );
            setTotalRecords(counts.reduce((sum, count) => sum + count, 0));
          } else {
            setTotalRecords(0);
          }
        })
        .catch(() => { setIndexCount(0); setTotalRecords(0); });
    }
  }, [isHealthy, indexRefreshTrigger]);

  const handleIndexChange = useCallback(() => setIndexRefreshTrigger((prev) => prev + 1), []);

  const addNotification = useCallback((
    type: 'success' | 'error' | 'warning' | 'info' | 'in-progress',
    header: string,
    content?: React.ReactNode,
    options?: { id?: string }
  ): string => {
    const id = options?.id || Date.now().toString();
    const desc = typeof content === 'string' ? content : undefined;
    if (type === 'success') toast.success(header, { description: desc, id });
    else if (type === 'error') toast.error(header, { description: desc, id });
    else if (type === 'warning') toast.warning(header, { description: desc, id });
    else if (type === 'info') toast.info(header, { description: desc, id });
    else if (type === 'in-progress') toast.loading(header, { description: desc, id });
    return id;
  }, []);

  const removeNotification = useCallback((id: string) => toast.dismiss(id), []);

  const handleSearch = useCallback(async (query: string, indexName: string) => {
    setIsLoading(true);
    setCurrentQuery(query);
    setCurrentIndex(indexName);
    setResults([]);
    setSearchTimeMs(null);
    const startTime = performance.now();
    try {
      const response = await queryKnowledgeBase({ query, index_name: indexName, top_k: 5 });
      setSearchTimeMs(Math.round(performance.now() - startTime));
      setResults(response.results);
      if (response.results.length === 0) toast.info('No results found', { description: 'Try a different query' });
    } catch (error) {
      toast.error('Search failed', { description: error instanceof Error ? error.message : 'Unknown error' });
      setSearchTimeMs(null);
    } finally {
      setIsLoading(false);
    }
  }, []);

  const handleNavigateToAddKnowledge = useCallback((indexName: string) => {
    setPreSelectedIndex(indexName);
    setActiveTab('add-knowledge');
  }, []);

  const handleClearPreSelectedIndex = useCallback(() => setPreSelectedIndex(null), []);

  return (
    <div className="min-h-screen bg-background">
      <Toaster />
      <header className="border-b bg-card/80 backdrop-blur-sm sticky top-0 z-50">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-primary rounded-xl shadow-lg">
                <Lightbulb className="h-6 w-6 text-primary-foreground" />
              </div>
              <div>
                <h1 className="text-xl font-bold text-foreground">
                  Simple Knowledge Base
                </h1>
                <p className="text-sm text-muted-foreground">Semantic search powered by LanceDB and ML embeddings</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              {isHealthy === null ? (
                <Badge variant="secondary" className="gap-1"><Loader2 className="h-3 w-3 animate-spin" />Checking...</Badge>
              ) : isHealthy ? (
                <Badge className="gap-1"><CheckCircle2 className="h-3 w-3" />Connected</Badge>
              ) : (
                <Badge variant="destructive" className="gap-1"><XCircle className="h-3 w-3" />Offline</Badge>
              )}
            </div>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-6 space-y-6">
        {isHealthy === false && (
          <Alert variant="destructive">
            <XCircle className="h-4 w-4" />
            <AlertTitle>Backend Unavailable</AlertTitle>
            <AlertDescription>
              Unable to connect to the backend API. Please ensure the server is running at <code className="bg-destructive/20 px-1 rounded">http://localhost:8000</code>
            </AlertDescription>
          </Alert>
        )}

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <Card className="border-primary/20">
            <CardHeader className="pb-2"><CardDescription>Total Indexes</CardDescription></CardHeader>
            <CardContent><div className="flex items-center gap-2"><Database className="h-8 w-8 text-primary" /><span className="text-3xl font-bold">{indexCount}</span></div></CardContent>
          </Card>
          <Card className="border-primary/20">
            <CardHeader className="pb-2"><CardDescription>Total Records</CardDescription></CardHeader>
            <CardContent><div className="flex items-center gap-2"><FolderOpen className="h-8 w-8 text-primary" /><span className="text-3xl font-bold">{totalRecords.toLocaleString()}</span></div></CardContent>
          </Card>
          <Card className="border-primary/20">
            <CardHeader className="pb-2"><CardDescription>Database Type</CardDescription></CardHeader>
            <CardContent><div className="flex items-center gap-2"><HardDrive className="h-8 w-8 text-primary" /><span className="text-xl font-semibold">LanceDB</span></div></CardContent>
          </Card>
          <Card className="border-primary/20">
            <CardHeader className="pb-2"><CardDescription>Database Path</CardDescription></CardHeader>
            <CardContent><code className="text-sm bg-muted px-2 py-1 rounded">backend/data/lancedb</code></CardContent>
          </Card>
        </div>

        {isHealthy && !hasIndexes && (
          <Alert><Database className="h-4 w-4" /><AlertTitle>No indexes found</AlertTitle><AlertDescription>Create an index first to start adding knowledge and searching your documents.</AlertDescription></Alert>
        )}

        <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
          <TabsList className="grid w-full grid-cols-3 lg:w-auto lg:inline-grid">
            <TabsTrigger value="manage-indexes" className="gap-2"><FolderOpen className="h-4 w-4" /><span className="hidden sm:inline">Manage Indexes</span><span className="sm:hidden">Indexes</span></TabsTrigger>
            <TabsTrigger value="add-knowledge" disabled={!hasIndexes} className="gap-2"><Upload className="h-4 w-4" /><span className="hidden sm:inline">Add Knowledge</span><span className="sm:hidden">Add</span></TabsTrigger>
            <TabsTrigger value="search" disabled={!hasIndexes} className="gap-2"><Search className="h-4 w-4" /><span>Search</span></TabsTrigger>
          </TabsList>
          <TabsContent value="manage-indexes"><ManageIndexes onNotification={addNotification} onRemoveNotification={removeNotification} onNavigateToAddKnowledge={handleNavigateToAddKnowledge} onIndexChange={handleIndexChange} hasIndexes={hasIndexes} /></TabsContent>
          <TabsContent value="add-knowledge"><AddKnowledge onNotification={addNotification} onRemoveNotification={removeNotification} preSelectedIndex={preSelectedIndex} onClearPreSelectedIndex={handleClearPreSelectedIndex} /></TabsContent>
          <TabsContent value="search" className="space-y-4"><SearchInterface onSearch={handleSearch} isLoading={isLoading} /><SearchResults results={results} query={currentQuery} indexName={currentIndex} searchTimeMs={searchTimeMs} isLoading={isLoading} /></TabsContent>
        </Tabs>
      </main>
    </div>
  );
}

export default App;

import { useState, useCallback, useEffect } from 'react';
import {
  AppLayout,
  Alert,
  Box,
  Container,
  ContentLayout,
  Flashbar,
  Header,
  Icon,
  KeyValuePairs,
  SpaceBetween,
  StatusIndicator,
  Tabs,
} from '@cloudscape-design/components';
import type { FlashbarProps } from '@cloudscape-design/components';

import { SearchInterface } from './components/SearchInterface';
import { SearchResults } from './components/SearchResults';
import { AddKnowledge } from './components/AddKnowledge';
import { ManageIndexes } from './components/ManageIndexes';
import { queryKnowledgeBase, checkHealth, listIndexes, getIndexRecordCount } from './api/client';
import type { SearchResult } from './api/types';

// Application logo
import logoSvg from '/idea-bulb-learning-knowledge-education-book-idea.svg';

function App() {
  const [activeTab, setActiveTab] = useState('manage-indexes');
  const [results, setResults] = useState<SearchResult[]>([]);
  const [currentQuery, setCurrentQuery] = useState('');
  const [currentIndex, setCurrentIndex] = useState('');
  const [searchTimeMs, setSearchTimeMs] = useState<number | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isHealthy, setIsHealthy] = useState<boolean | null>(null);
  const [notifications, setNotifications] = useState<FlashbarProps.MessageDefinition[]>([]);

  // Pre-selected index for navigating from Manage Indexes to Add Knowledge
  const [preSelectedIndex, setPreSelectedIndex] = useState<string | null>(null);

  // Track index count for enabling/disabling tabs and tiles
  const [indexCount, setIndexCount] = useState<number>(0);
  const [totalRecords, setTotalRecords] = useState<number>(0);
  const [indexRefreshTrigger, setIndexRefreshTrigger] = useState(0);

  const hasIndexes = indexCount > 0;

  // Check backend health on mount
  useEffect(() => {
    checkHealth()
      .then(() => setIsHealthy(true))
      .catch(() => setIsHealthy(false));
  }, []);

  // Fetch index count on mount and when refresh trigger changes
  useEffect(() => {
    if (isHealthy) {
      listIndexes()
        .then(async (response) => {
          setIndexCount(response.count);
          // Fetch record counts for all indexes and sum them
          if (response.indexes.length > 0) {
            const counts = await Promise.all(
              response.indexes.map((indexName) =>
                getIndexRecordCount(indexName)
                  .then((r) => r.record_count)
                  .catch(() => 0)
              )
            );
            setTotalRecords(counts.reduce((sum, count) => sum + count, 0));
          } else {
            setTotalRecords(0);
          }
        })
        .catch(() => {
          setIndexCount(0);
          setTotalRecords(0);
        });
    }
  }, [isHealthy, indexRefreshTrigger]);

  // Callback to refresh index count (called from ManageIndexes after create/delete)
  const handleIndexChange = useCallback(() => {
    setIndexRefreshTrigger((prev) => prev + 1);
  }, []);

  const addNotification = useCallback((
    type: 'success' | 'error' | 'warning' | 'info' | 'in-progress',
    header: string,
    content?: React.ReactNode,
    options?: { id?: string; loading?: boolean; dismissible?: boolean }
  ): string => {
    const id = options?.id || Date.now().toString();

    const dismissNotification = () => {
      setNotifications((prev) => prev.filter((n) => n.id !== id));
    };

    // Auto-dismiss success and info notifications after 5 seconds (not in-progress)
    if (type === 'success' || type === 'info') {
      setTimeout(dismissNotification, 5000);
    }

    setNotifications((prev) => {
      // If id exists, update it; otherwise add new
      const existing = prev.find((n) => n.id === id);
      if (existing) {
        return prev.map((n) => n.id === id ? {
          ...n,
          type,
          header,
          content,
          loading: options?.loading,
          dismissible: options?.dismissible ?? true,
        } : n);
      }
      return [
        ...prev,
        {
          type,
          header,
          content,
          loading: options?.loading,
          dismissible: options?.dismissible ?? true,
          dismissLabel: 'Dismiss',
          onDismiss: dismissNotification,
          id,
        },
      ];
    });

    return id;
  }, []);

  const removeNotification = useCallback((id: string) => {
    setNotifications((prev) => prev.filter((n) => n.id !== id));
  }, []);

  const handleSearch = useCallback(async (query: string, indexName: string) => {
    setIsLoading(true);
    setCurrentQuery(query);
    setCurrentIndex(indexName);
    setResults([]);
    setSearchTimeMs(null);

    const startTime = performance.now();

    try {
      const response = await queryKnowledgeBase({
        query,
        index_name: indexName,
        top_k: 5
      });

      const endTime = performance.now();
      setSearchTimeMs(Math.round(endTime - startTime));
      setResults(response.results);

      if (response.results.length === 0) {
        addNotification('info', 'No results found', 'Try a different query');
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      addNotification('error', 'Search failed', message);
      setSearchTimeMs(null);
    } finally {
      setIsLoading(false);
    }
  }, [addNotification]);

  // Navigate to Add Knowledge tab with a pre-selected index
  const handleNavigateToAddKnowledge = useCallback((indexName: string) => {
    setPreSelectedIndex(indexName);
    setActiveTab('add-knowledge');
  }, []);

  // Clear pre-selected index when user manually changes it
  const handleClearPreSelectedIndex = useCallback(() => {
    setPreSelectedIndex(null);
  }, []);

  return (
    <AppLayout
      notifications={<Flashbar items={notifications} stackItems />}
      navigationHide
      toolsHide
      content={
        <ContentLayout
          header={
            <Header
              variant="h1"
              description="Semantic search powered by LanceDB and ML embeddings"
              info={
                isHealthy === null ? (
                  <StatusIndicator type="loading">Checking backend...</StatusIndicator>
                ) : isHealthy ? (
                  <StatusIndicator type="success">Backend connected</StatusIndicator>
                ) : (
                  <StatusIndicator type="error">Backend offline</StatusIndicator>
                )
              }
            >
              <SpaceBetween size="xs" direction="horizontal" alignItems="center">
                <img src={logoSvg} alt="Logo" style={{ height: '32px', width: '32px' }} />
                <span>Simple Knowledge Base</span>
              </SpaceBetween>
            </Header>
          }
        >
          <SpaceBetween size="l">
            {isHealthy === false && (
              <Alert type="error" header="Backend Unavailable">
                Unable to connect to the backend API. Please ensure the server is running at{' '}
                <Box variant="code">http://localhost:8000</Box>
              </Alert>
            )}

            {/* Overview Stats */}
            <Container>
              <KeyValuePairs
                columns={4}
                items={[
                  {
                    label: 'Total indexes',
                    value: (
                      <Box variant="awsui-value-large" color="text-status-info">
                        {indexCount}
                      </Box>
                    ),
                  },
                  {
                    label: 'Total records',
                    value: (
                      <Box variant="awsui-value-large" color="text-status-info">
                        {totalRecords.toLocaleString()}
                      </Box>
                    ),
                  },
                  {
                    label: 'Database type',
                    value: 'LanceDB',
                  },
                  {
                    label: 'Database path',
                    value: <Box variant="code">backend/data/lancedb</Box>,
                  },
                ]}
              />
            </Container>

            {/* Info message when no indexes exist */}
            {isHealthy && !hasIndexes && (
              <Alert type="info" header="No indexes found">
                Create an index first to start adding knowledge and searching your documents.
              </Alert>
            )}

            <Tabs
              activeTabId={activeTab}
              onChange={({ detail }) => setActiveTab(detail.activeTabId)}
              tabs={[
                {
                  id: 'manage-indexes',
                  label: (
                    <SpaceBetween size="xs" direction="horizontal" alignItems="center">
                      <Icon name="folder" />
                      <span>Manage Indexes</span>
                    </SpaceBetween>
                  ),
                  content: (
                    <ManageIndexes
                      onNotification={addNotification}
                      onRemoveNotification={removeNotification}
                      onNavigateToAddKnowledge={handleNavigateToAddKnowledge}
                      onIndexChange={handleIndexChange}
                      hasIndexes={hasIndexes}
                    />
                  ),
                },
                {
                  id: 'add-knowledge',
                  label: (
                    <SpaceBetween size="xs" direction="horizontal" alignItems="center">
                      <Icon name="upload" />
                      <span>Add Knowledge</span>
                    </SpaceBetween>
                  ),
                  content: (
                    <AddKnowledge
                      onNotification={addNotification}
                      onRemoveNotification={removeNotification}
                      preSelectedIndex={preSelectedIndex}
                      onClearPreSelectedIndex={handleClearPreSelectedIndex}
                    />
                  ),
                  disabled: !hasIndexes,
                },
                {
                  id: 'search',
                  label: (
                    <SpaceBetween size="xs" direction="horizontal" alignItems="center">
                      <Icon name="search" />
                      <span>Search</span>
                    </SpaceBetween>
                  ),
                  content: (
                    <SpaceBetween size="l">
                      <SearchInterface
                        onSearch={handleSearch}
                        isLoading={isLoading}
                      />
                      <SearchResults
                        results={results}
                        query={currentQuery}
                        indexName={currentIndex}
                        searchTimeMs={searchTimeMs}
                        isLoading={isLoading}
                      />
                    </SpaceBetween>
                  ),
                  disabled: !hasIndexes,
                },
              ]}
            />
          </SpaceBetween>
        </ContentLayout>
      }
    />
  );
}

export default App;

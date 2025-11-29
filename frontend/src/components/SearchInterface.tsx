/**
 * Search Interface Component
 * Main search input with index selection and submit functionality
 */

import { useState } from 'react';
import {
  Alert,
  Button,
  Container,
  FormField,
  Grid,
  Header,
  Input,
  SpaceBetween,
} from '@cloudscape-design/components';

import { IndexSelector } from './IndexSelector';

interface SearchInterfaceProps {
  onSearch: (query: string, indexName: string) => void;
  isLoading: boolean;
}

export function SearchInterface({ onSearch, isLoading }: SearchInterfaceProps) {
  const [query, setQuery] = useState('');
  const [selectedIndex, setSelectedIndex] = useState<string | null>(null);

  const canSearch = query.trim() && selectedIndex;

  const handleSubmit = () => {
    if (canSearch) {
      onSearch(query.trim(), selectedIndex);
    }
  };

  const handleKeyDown = ({ detail }: { detail: { key: string } }) => {
    if (detail.key === 'Enter' && canSearch && !isLoading) {
      handleSubmit();
    }
  };

  return (
    <Container
      header={
        <Header
          variant="h2"
          description="Search through your knowledge base using natural language queries"
        >
          <SpaceBetween size="xs" direction="horizontal" alignItems="center">
              <img src="/knowledge-icon.svg" alt="" style={{ height: '24px', width: '24px' }} />
              <span>Search Knowledge Base</span>
          </SpaceBetween>
        </Header>
      }
    >
      <SpaceBetween size="m">
        <Grid gridDefinition={[{ colspan: 4 }, { colspan: 8 }]}>
          <IndexSelector
            selectedIndex={selectedIndex}
            onIndexChange={setSelectedIndex}
            disabled={isLoading}
            label="Search Index"
            description="Select the index to search"
          />
          <FormField
            label="Search Query"
            description="Enter your question or search terms"
          >
            <Input
              value={query}
              onChange={({ detail }) => setQuery(detail.value)}
              onKeyDown={handleKeyDown}
              placeholder="e.g., How do I create a table in LanceDB?"
              disabled={isLoading || !selectedIndex}
            />
          </FormField>
        </Grid>

        {!selectedIndex && (
          <Alert type="info">
            Select an index to search. If no indexes exist, go to the "Add Knowledge" tab to create one.
          </Alert>
        )}

        <Button
          variant="primary"
          onClick={handleSubmit}
          loading={isLoading}
          loadingText="Searching..."
          disabled={!canSearch}
          iconName="search"
        >
          Search
        </Button>
      </SpaceBetween>
    </Container>
  );
}

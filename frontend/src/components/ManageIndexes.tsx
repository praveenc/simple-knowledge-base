/**
 * ManageIndexes Component
 * Page for creating and deleting indexes in the knowledge base
 *
 * Flow:
 * 1. Choose action: "Create New" or "Delete Index"
 * 2. Create: Enter name and create index
 * 3. Delete: Select index and confirm deletion via modal
 */

import { useState, useCallback } from 'react';
import type { ReactNode } from 'react';
import {
  Alert,
  Box,
  Button,
  ColumnLayout,
  Container,
  FormField,
  Header,
  Input,
  Modal,
  SpaceBetween,
  StatusIndicator,
  Tiles,
} from '@cloudscape-design/components';

import { IndexSelector } from './IndexSelector';
import { createIndex, deleteIndex, getIndexRecordCount } from '../api/client';

// Index name validation pattern (must match backend)
const INDEX_NAME_PATTERN = /^[a-zA-Z][a-zA-Z0-9_-]*$/;

interface ManageIndexesProps {
  onNotification: (
    type: 'success' | 'error' | 'warning' | 'info' | 'in-progress',
    header: string,
    content?: ReactNode,
    options?: { id?: string; loading?: boolean; dismissible?: boolean }
  ) => string;
  onRemoveNotification: (id: string) => void;
  onNavigateToAddKnowledge: (indexName: string) => void;
  onIndexChange: () => void;
  hasIndexes: boolean;
}

export function ManageIndexes({ onNotification, onNavigateToAddKnowledge, onIndexChange, hasIndexes }: ManageIndexesProps) {
  // Action mode: create or delete
  const [actionMode, setActionMode] = useState<'create' | 'delete'>('create');

  // Create Index state
  const [newIndexName, setNewIndexName] = useState('');
  const [isCreatingIndex, setIsCreatingIndex] = useState(false);
  const [indexRefreshTrigger, setIndexRefreshTrigger] = useState(0);
  const [createdIndexName, setCreatedIndexName] = useState<string | null>(null);

  // Delete Index state
  const [selectedIndex, setSelectedIndex] = useState<string | null>(null);
  const [isDeletingIndex, setIsDeletingIndex] = useState(false);
  const [showDeleteConfirmModal, setShowDeleteConfirmModal] = useState(false);
  const [deleteIndexRecordCount, setDeleteIndexRecordCount] = useState<number | null>(null);

  // Validate index name
  const isValidIndexName = INDEX_NAME_PATTERN.test(newIndexName);
  const indexNameError =
    newIndexName && !isValidIndexName
      ? 'Must start with a letter, followed by letters, numbers, underscores, or hyphens'
      : '';

  // Handle create index
  const handleCreateIndex = useCallback(async () => {
    if (!newIndexName || !isValidIndexName) return;

    setIsCreatingIndex(true);
    setCreatedIndexName(null);
    try {
      const response = await createIndex({ index_name: newIndexName });
      onNotification('success', 'Index created', response.message);
      setCreatedIndexName(newIndexName);
      setNewIndexName('');
      setIndexRefreshTrigger((prev) => prev + 1);
      onIndexChange(); // Notify parent to refresh index count
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to create index';
      onNotification('error', 'Failed to create index', message);
    } finally {
      setIsCreatingIndex(false);
    }
  }, [newIndexName, isValidIndexName, onNotification, onIndexChange]);

  // Handle showing delete confirmation modal with record count
  const handleShowDeleteConfirm = useCallback(async () => {
    if (selectedIndex) {
      try {
        const response = await getIndexRecordCount(selectedIndex);
        setDeleteIndexRecordCount(response.record_count);
      } catch {
        setDeleteIndexRecordCount(null);
      }
    }
    setShowDeleteConfirmModal(true);
  }, [selectedIndex]);

  // Handle delete index
  const handleDeleteIndex = useCallback(async () => {
    if (!selectedIndex) return;

    setIsDeletingIndex(true);
    setShowDeleteConfirmModal(false);

    try {
      const response = await deleteIndex(selectedIndex);
      onNotification('success', 'Index deleted', response.message);
      setSelectedIndex(null);
      setIndexRefreshTrigger((prev) => prev + 1);
      onIndexChange(); // Notify parent to refresh index count
      // Switch back to create mode since we just deleted an index
      setActionMode('create');
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to delete index';
      onNotification('error', 'Failed to delete index', message);
    } finally {
      setIsDeletingIndex(false);
    }
  }, [selectedIndex, onNotification, onIndexChange]);

  return (
    <SpaceBetween size="l">
      {/* Main Container: Manage Indexes */}
      <Container
        header={
          <Header variant="h2" description="Create new indexes or delete existing ones">
            <SpaceBetween size="xs" direction="horizontal" alignItems="center">
              <img src="/manage-index.svg" alt="" style={{ height: '24px', width: '24px' }} />
              <span>Manage Indexes</span>
            </SpaceBetween>
          </Header>
        }
      >
        <SpaceBetween size="l">
          {/* Action Selection */}
          <FormField label="Choose Action" description="Select what you want to do with indexes">
            <Tiles
              columns={2}
              value={actionMode}
              onChange={({ detail }) => {
                setActionMode(detail.value as 'create' | 'delete');
                // Clear states when switching modes
                setCreatedIndexName(null);
                setSelectedIndex(null);
              }}
              items={[
                {
                  value: 'create',
                  label: 'Create New Index',
                  description: 'Create a new index to organize your documents',
                },
                {
                  value: 'delete',
                  label: 'Delete Index',
                  description: 'Permanently remove an existing index and all its data',
                  disabled: !hasIndexes,
                },
              ]}
            />
          </FormField>

          {/* Create Index Mode */}
          {actionMode === 'create' && (
            <SpaceBetween size="m">
              <FormField
                label="Index Name"
                description="A unique name for your new index (letters, numbers, underscores, hyphens)"
                errorText={indexNameError}
                constraintText="Must start with a letter"
              >
                <SpaceBetween size="xs" direction="horizontal">
                  <div style={{ flexGrow: 1 }}>
                    <Input
                      value={newIndexName}
                      onChange={({ detail }) => setNewIndexName(detail.value)}
                      placeholder="my-knowledge-base"
                      disabled={isCreatingIndex}
                      onKeyDown={({ detail }) => {
                        if (detail.key === 'Enter' && newIndexName && isValidIndexName && !isCreatingIndex) {
                          handleCreateIndex();
                        }
                      }}
                    />
                  </div>
                  <Button
                    variant="primary"
                    onClick={handleCreateIndex}
                    loading={isCreatingIndex}
                    loadingText="Creating..."
                    disabled={!newIndexName || !isValidIndexName}
                    iconName="add-plus"
                  >
                    Create Index
                  </Button>
                </SpaceBetween>
              </FormField>

              {createdIndexName && (
                <Alert
                  type="success"
                  statusIconAriaLabel="Success"
                  action={
                    <Button
                      onClick={() => onNavigateToAddKnowledge(createdIndexName)}
                      iconName="upload"
                    >
                      Add Knowledge
                    </Button>
                  }
                >
                  Index <strong>{createdIndexName}</strong> created successfully!
                </Alert>
              )}
            </SpaceBetween>
          )}

          {/* Delete Index Mode */}
          {actionMode === 'delete' && (
            <SpaceBetween size="m">
              <IndexSelector
                selectedIndex={selectedIndex}
                onIndexChange={setSelectedIndex}
                refreshTrigger={indexRefreshTrigger}
                label="Select Index to Delete"
                description="Choose the index you want to permanently remove"
                disabled={isDeletingIndex}
              />

              {selectedIndex && (
                <Alert type="warning" header="Warning: This action cannot be undone">
                  Deleting an index will permanently remove all documents and embeddings stored in
                  it. Make sure you have backed up any important data before proceeding.
                </Alert>
              )}

              <Button
                variant="primary"
                onClick={handleShowDeleteConfirm}
                loading={isDeletingIndex}
                loadingText="Deleting..."
                disabled={!selectedIndex}
                iconName="remove"
              >
                Delete Index
              </Button>
            </SpaceBetween>
          )}
        </SpaceBetween>
      </Container>

      {/* Delete Confirmation Modal */}
      <Modal
        visible={showDeleteConfirmModal}
        onDismiss={() => setShowDeleteConfirmModal(false)}
        header="Confirm Index Deletion"
        size="medium"
        closeAriaLabel="Close confirmation"
        footer={
          <Box float="right">
            <SpaceBetween direction="horizontal" size="xs">
              <Button variant="link" onClick={() => setShowDeleteConfirmModal(false)}>
                Cancel
              </Button>
              <Button
                variant="primary"
                onClick={handleDeleteIndex}
                iconName="remove"
              >
                Delete Index
              </Button>
            </SpaceBetween>
          </Box>
        }
      >
        <SpaceBetween size="m">
          <StatusIndicator type="warning">
            You are about to permanently delete an index
          </StatusIndicator>

          <ColumnLayout columns={2} variant="text-grid">
            <div>
              <Box variant="awsui-key-label">Index Name</Box>
              <Box fontWeight="bold" color="text-status-error">
                {selectedIndex}
              </Box>
            </div>
            <div>
              <Box variant="awsui-key-label">Records to Delete</Box>
              <Box fontWeight="bold">
                {deleteIndexRecordCount !== null
                  ? `${deleteIndexRecordCount.toLocaleString()} chunks`
                  : '—'}
              </Box>
            </div>
          </ColumnLayout>

          <Alert type="error" header="This action cannot be undone">
            All documents, chunks, and embeddings in this index will be permanently deleted. This
            data cannot be recovered.
          </Alert>
        </SpaceBetween>
      </Modal>
    </SpaceBetween>
  );
}

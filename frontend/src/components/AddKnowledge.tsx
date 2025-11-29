/**
 * AddKnowledge Component
 * Page for creating indexes and adding documents to the knowledge base
 * 
 * Flow:
 * 1. Choose index mode: "Use existing" or "Create new"
 * 2. Select/create index
 * 3. Choose document source: "Single" or "Batch"
 * 4. Add documents
 */

import { useState, useCallback, useEffect, useRef } from 'react';
import type { ReactNode } from 'react';
import {
  Alert,
  Box,
  Button,
  ColumnLayout,
  Container,
  ExpandableSection,
  FileUpload,
  Form,
  FormField,
  Header,
  Input,
  Modal,
  ProgressBar,
  SpaceBetween,
  Tiles,
} from '@cloudscape-design/components';

import { IndexSelector } from './IndexSelector';
import { createIndex, uploadDocument, encodeBatch, getIndexRecordCount } from '../api/client';

// Index name validation pattern (must match backend)
const INDEX_NAME_PATTERN = /^[a-zA-Z][a-zA-Z0-9_-]*$/;

// Allowed file extensions for single document upload
const ALLOWED_EXTENSIONS = ['.md', '.txt'];

// Helper to validate file extension
function validateFileExtension(fileName: string): string | null {
  const extension = fileName.toLowerCase().substring(fileName.lastIndexOf('.'));
  if (!ALLOWED_EXTENSIONS.includes(extension)) {
    return `Unsupported file type "${extension}". Only ${ALLOWED_EXTENSIONS.join(', ')} files are allowed.`;
  }
  return null;
}

interface AddKnowledgeProps {
  onNotification: (
    type: 'success' | 'error' | 'warning' | 'info' | 'in-progress',
    header: string,
    content?: ReactNode,
    options?: { id?: string; loading?: boolean; dismissible?: boolean }
  ) => string;
  onRemoveNotification: (id: string) => void;
}

export function AddKnowledge({ onNotification, onRemoveNotification }: AddKnowledgeProps) {
  // Index mode: use existing or create new
  const [indexMode, setIndexMode] = useState<'existing' | 'new'>('existing');
  
  // Create Index state
  const [newIndexName, setNewIndexName] = useState('');
  const [isCreatingIndex, setIsCreatingIndex] = useState(false);
  const [indexRefreshTrigger, setIndexRefreshTrigger] = useState(0);

  // Document encoding state
  const [selectedIndex, setSelectedIndex] = useState<string | null>(null);
  const [uploadedFiles, setUploadedFiles] = useState<File[]>([]);
  const [isEncodingDoc, setIsEncodingDoc] = useState(false);
  
  // Upload progress state
  const [uploadProgress, setUploadProgress] = useState<'idle' | 'uploading' | 'success' | 'error'>('idle');
  const [uploadResult, setUploadResult] = useState<{ filename: string; chunkCount: number } | null>(null);

  // Batch encoding state
  const [directoryPath, setDirectoryPath] = useState('');
  const [filePatterns] = useState<string[]>(['*.md', '*.txt']);
  const [isEncodingBatch, setIsEncodingBatch] = useState(false);
  const [showBatchConfirmModal, setShowBatchConfirmModal] = useState(false);
  const [batchStarted, setBatchStarted] = useState(false);
  const [preProcessRecordCount, setPreProcessRecordCount] = useState<number | null>(null);

  // Document source mode selection
  const [encodeMode, setEncodeMode] = useState<'single' | 'batch'>('single');
  
  // Determine if we have a valid index to work with
  const activeIndex = indexMode === 'existing' ? selectedIndex : (isCreatingIndex ? null : selectedIndex);

  // Validate index name
  const isValidIndexName = INDEX_NAME_PATTERN.test(newIndexName);
  const indexNameError = newIndexName && !isValidIndexName
    ? 'Must start with a letter, followed by letters, numbers, underscores, or hyphens'
    : '';

  // Handle create index
  const handleCreateIndex = useCallback(async () => {
    if (!newIndexName || !isValidIndexName) return;

    setIsCreatingIndex(true);
    try {
      const response = await createIndex({ index_name: newIndexName });
      onNotification('success', 'Index created', response.message);
      setNewIndexName('');
      setIndexRefreshTrigger((prev) => prev + 1);
      // Auto-select the new index
      setSelectedIndex(newIndexName);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to create index';
      onNotification('error', 'Failed to create index', message);
    } finally {
      setIsCreatingIndex(false);
    }
  }, [newIndexName, isValidIndexName, onNotification]);

  // Handle file upload and encoding
  const handleUploadDocument = useCallback(async () => {
    if (!selectedIndex || uploadedFiles.length === 0) return;

    const file = uploadedFiles[0];
    
    // Validate file extension
    const error = validateFileExtension(file.name);
    if (error) {
      onNotification('error', 'Invalid file', error);
      return;
    }

    setIsEncodingDoc(true);
    setUploadProgress('uploading');
    setUploadResult(null);
    
    try {
      const response = await uploadDocument(file, selectedIndex);
      setUploadProgress('success');
      setUploadResult({ filename: response.filename, chunkCount: response.chunk_count });
      onNotification(
        'success',
        'Document encoded',
        `${response.chunk_count} chunks created from "${response.filename}"`
      );
      setUploadedFiles([]);
      setIndexRefreshTrigger((prev) => prev + 1);
    } catch (err) {
      setUploadProgress('error');
      const message = err instanceof Error ? err.message : 'Failed to upload document';
      onNotification('error', 'Upload failed', message);
    } finally {
      setIsEncodingDoc(false);
    }
  }, [selectedIndex, uploadedFiles, onNotification]);
  
  // Reset progress when file changes
  const handleFileChange = useCallback((files: File[]) => {
    setUploadedFiles(files);
    setUploadProgress('idle');
    setUploadResult(null);
  }, []);

  // Polling interval ref
  const pollingIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  
  // Cleanup polling on unmount
  useEffect(() => {
    return () => {
      if (pollingIntervalRef.current) {
        clearInterval(pollingIntervalRef.current);
      }
    };
  }, []);

  // Handle batch encoding with progress polling
  const handleEncodeBatch = useCallback(async () => {
    if (!selectedIndex || !directoryPath) return;

    const initialCount = preProcessRecordCount ?? 0;
    const notificationId = `batch-${Date.now()}`;
    let lastCount = initialCount;
    let stablePolls = 0;

    setIsEncodingBatch(true);
    
    try {
      const response = await encodeBatch({
        index_name: selectedIndex,
        directory_path: directoryPath,
        file_patterns: filePatterns.length > 0 ? filePatterns : undefined,
      });
      
      const docsQueued = response.documents_queued ?? 0;
      
      // Show progress notification
      onNotification(
        'in-progress',
        'Batch processing in progress',
        `Processing ${docsQueued} documents from directory...`,
        { id: notificationId, loading: true, dismissible: false }
      );
      
      setDirectoryPath('');
      setBatchStarted(true);
      setIsEncodingBatch(false);
      
      // Start polling for completion
      pollingIntervalRef.current = setInterval(async () => {
        try {
          const countResponse = await getIndexRecordCount(selectedIndex);
          const currentCount = countResponse.record_count;
          const addedDocs = currentCount - initialCount;
          
          // Update progress notification
          onNotification(
            'in-progress',
            'Batch processing in progress',
            `Added ${addedDocs} chunks so far... (${currentCount} total in index)`,
            { id: notificationId, loading: true, dismissible: false }
          );
          
          // Check if count has stabilized (same for 2 consecutive polls)
          if (currentCount === lastCount && addedDocs > 0) {
            stablePolls++;
            if (stablePolls >= 2) {
              // Processing complete
              if (pollingIntervalRef.current) {
                clearInterval(pollingIntervalRef.current);
                pollingIntervalRef.current = null;
              }
              
              // Remove progress notification and show success
              onRemoveNotification(notificationId);
              onNotification(
                'success',
                'Batch processing complete',
                `Successfully added ${addedDocs} chunks to "${selectedIndex}" (${currentCount} total records)`
              );
              
              // Refresh index counts
              setIndexRefreshTrigger((prev) => prev + 1);
            }
          } else {
            stablePolls = 0;
            lastCount = currentCount;
          }
        } catch {
          // Ignore polling errors, will retry
        }
      }, 3000); // Poll every 3 seconds
      
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to start batch encoding';
      onNotification('error', 'Batch encoding failed', message);
      setIsEncodingBatch(false);
    }
  }, [selectedIndex, directoryPath, filePatterns, preProcessRecordCount, onNotification, onRemoveNotification]);

  // Handle showing batch confirmation modal with record count
  const handleShowBatchConfirm = useCallback(async () => {
    if (selectedIndex) {
      try {
        const response = await getIndexRecordCount(selectedIndex);
        setPreProcessRecordCount(response.record_count);
      } catch {
        setPreProcessRecordCount(null);
      }
    }
    setShowBatchConfirmModal(true);
  }, [selectedIndex]);

  return (
    <SpaceBetween size="l">
      {/* Help Section - How it works */}
      <ExpandableSection
        headerText="How it works"
        variant="container"
        defaultExpanded={false}
      >
        <ColumnLayout columns={3} variant="text-grid">
          <div>
            <Box variant="awsui-key-label">1. Select or Create Index</Box>
            <Box color="text-body-secondary">
              Choose an existing index or create a new one. An index is a 
              container for organizing related documents.
            </Box>
          </div>
          <div>
            <Box variant="awsui-key-label">2. Add Documents</Box>
            <Box color="text-body-secondary">
              Documents are automatically chunked, embedded, and stored in the
              vector database for semantic search.
            </Box>
          </div>
          <div>
            <Box variant="awsui-key-label">3. Search</Box>
            <Box color="text-body-secondary">
              Use natural language queries to find relevant content. Results
              are ranked by semantic similarity.
            </Box>
          </div>
        </ColumnLayout>
      </ExpandableSection>

      {/* Main Container: Add Knowledge */}
      <Container
        header={
          <Header
            variant="h2"
            description="Add documents to your knowledge base"
          >
            <SpaceBetween size="xs" direction="horizontal" alignItems="center">
              <img src="/add-file.svg" alt="" style={{ height: '24px', width: '24px' }} />
              <span>Add Knowledge</span>
            </SpaceBetween>
          </Header>
        }
      >
        <SpaceBetween size="l">
          {/* Step 1: Index Selection Mode */}
          <FormField 
            label="Step 1: Choose Index"
            description="Select an existing index or create a new one"
          >
            <Tiles
              columns={2}
              value={indexMode}
              onChange={({ detail }) => {
                setIndexMode(detail.value as 'existing' | 'new');
                // Clear selection when switching modes
                if (detail.value === 'new') {
                  setSelectedIndex(null);
                }
              }}
              items={[
                {
                  value: 'existing',
                  label: 'Use Existing Index',
                  description: 'Add documents to an index you\'ve already created',
                },
                {
                  value: 'new',
                  label: 'Create New Index',
                  description: 'Create a new index and add documents to it',
                },
              ]}
            />
          </FormField>

          {/* Existing Index Selection */}
          {indexMode === 'existing' && (
            <IndexSelector
              selectedIndex={selectedIndex}
              onIndexChange={setSelectedIndex}
              refreshTrigger={indexRefreshTrigger}
              description="Select the index to add documents to"
            />
          )}

          {/* New Index Creation */}
          {indexMode === 'new' && (
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
                    Create
                  </Button>
                </SpaceBetween>
              </FormField>
              
              {selectedIndex && (
                <Alert type="success" statusIconAriaLabel="Success">
                  Index <strong>{selectedIndex}</strong> created successfully! You can now add documents below.
                </Alert>
              )}
            </SpaceBetween>
          )}

          {/* Show prompt if no index selected */}
          {!activeIndex && (
            <Alert type="info">
              {indexMode === 'existing' 
                ? 'Select an index above to add documents. If you don\'t have any indexes, switch to "Create New Index".'
                : 'Enter an index name and click "Create" to continue.'}
            </Alert>
          )}

          {/* Step 2: Add Documents (only shown when index is selected) */}
          {activeIndex && (
            <>
              <Box variant="h3" padding={{ top: 's' }}>
                <SpaceBetween size="xs" direction="horizontal" alignItems="center">
                  <span>Step 2: Add Documents to</span>
                  <Box color="text-status-info" fontWeight="bold">{activeIndex}</Box>
                </SpaceBetween>
              </Box>

              {/* Document Source Mode Selection */}
              <FormField label="Document Source">
                <Tiles
                  columns={2}
                  value={encodeMode}
                  onChange={({ detail }) => setEncodeMode(detail.value as 'single' | 'batch')}
                  items={[
                    {
                      value: 'single',
                      label: 'Single Document',
                      description: 'Upload a single document file',
                    },
                    {
                      value: 'batch',
                      label: 'Batch Directory',
                      description: 'Process .md and .txt files from a directory',
                    },
                  ]}
                />
              </FormField>

              {/* Single Document Mode */}
              {encodeMode === 'single' && (
                <SpaceBetween size="l">
                  <Form
                    actions={
                      <Button
                        variant="primary"
                        onClick={handleUploadDocument}
                        loading={isEncodingDoc}
                        loadingText="Uploading & Encoding..."
                        disabled={uploadedFiles.length === 0 || uploadProgress === 'uploading'}
                        iconName="upload"
                      >
                        Upload & Encode
                      </Button>
                    }
                  >
                    <FormField
                      label="Select Document"
                      description="Choose a document file to upload and encode"
                    >
                      <FileUpload
                        value={uploadedFiles}
                        onChange={({ detail }) => handleFileChange(detail.value)}
                        accept={ALLOWED_EXTENSIONS.join(',')}
                        i18nStrings={{
                          uploadButtonText: (multiple) => multiple ? 'Choose files' : 'Choose file',
                          dropzoneText: (multiple) => multiple ? 'Drop files to upload' : 'Drop file to upload',
                          removeFileAriaLabel: (fileIndex) => `Remove file ${fileIndex + 1}`,
                          errorIconAriaLabel: 'Error',
                          limitShowFewer: 'Show fewer files',
                          limitShowMore: 'Show more files',
                        }}
                        showFileLastModified
                        showFileSize
                        constraintText={`Supported formats: ${ALLOWED_EXTENSIONS.join(', ')}`}
                        errorText={
                          uploadedFiles.length > 0 && validateFileExtension(uploadedFiles[0].name)
                            ? validateFileExtension(uploadedFiles[0].name)
                            : undefined
                        }
                      />
                    </FormField>
                  </Form>
                  
                  {/* Progress indicator */}
                  {uploadProgress !== 'idle' && (
                    <ProgressBar
                      value={uploadProgress === 'uploading' ? 50 : 100}
                      status={
                        uploadProgress === 'uploading' ? 'in-progress' :
                        uploadProgress === 'success' ? 'success' : 'error'
                      }
                      label="Document Processing"
                      description={
                        uploadProgress === 'uploading' 
                          ? 'Uploading and encoding document...' 
                          : uploadProgress === 'success' && uploadResult
                            ? `Successfully created ${uploadResult.chunkCount} chunks from "${uploadResult.filename}"`
                            : 'Upload failed'
                      }
                      resultText={
                        uploadProgress === 'success' ? 'Complete' :
                        uploadProgress === 'error' ? 'Failed' : undefined
                      }
                    />
                  )}
                </SpaceBetween>
              )}

              {/* Batch Mode */}
              {encodeMode === 'batch' && (
                <Form
                  actions={
                    <Button
                      variant="primary"
                      onClick={handleShowBatchConfirm}
                      loading={isEncodingBatch}
                      loadingText="Starting batch..."
                      disabled={!directoryPath}
                      iconName="folder"
                    >
                      Start Batch Processing
                    </Button>
                  }
                >
                  <SpaceBetween size="m">
                    <FormField
                      label="Directory Path"
                      description="Absolute path to the directory containing .md and .txt documents"
                    >
                      <Input
                        value={directoryPath}
                        onChange={({ detail }) => setDirectoryPath(detail.value)}
                        placeholder="/path/to/documents/"
                        disabled={isEncodingBatch}
                      />
                    </FormField>

                    {!batchStarted && (
                      <Alert type="info" header="Background Processing">
                        Batch processing runs in the background. You can continue using the application
                        while documents are being processed.
                      </Alert>
                    )}
                  </SpaceBetween>
                </Form>
              )}
            </>
          )}
        </SpaceBetween>
      </Container>

      {/* Batch Processing Confirmation Modal */}
      <Modal
        visible={showBatchConfirmModal}
        onDismiss={() => setShowBatchConfirmModal(false)}
        header="Confirm Batch Processing"
        size="medium"
        closeAriaLabel="Close confirmation"
        footer={
          <Box float="right">
            <SpaceBetween direction="horizontal" size="xs">
              <Button 
                variant="link" 
                onClick={() => setShowBatchConfirmModal(false)}
              >
                Cancel
              </Button>
              <Button 
                variant="primary" 
                onClick={() => {
                  setShowBatchConfirmModal(false);
                  handleEncodeBatch();
                }}
              >
                Start Processing
              </Button>
            </SpaceBetween>
          </Box>
        }
      >
        <SpaceBetween size="m">
          <Box variant="p">
            You are about to start batch processing with the following settings:
          </Box>
          
          <ColumnLayout columns={2} variant="text-grid">
            <div>
              <Box variant="awsui-key-label">Target Index</Box>
              <Box fontWeight="bold">{activeIndex}</Box>
            </div>
            <div>
              <Box variant="awsui-key-label">Current Records</Box>
              <Box>{preProcessRecordCount !== null ? preProcessRecordCount.toLocaleString() : '—'}</Box>
            </div>
            <div>
              <Box variant="awsui-key-label">Supported Formats</Box>
              <Box>{filePatterns.join(', ')}</Box>
            </div>
          </ColumnLayout>
          
          <div>
            <Box variant="awsui-key-label">Directory Path</Box>
            <Box variant="code" fontSize="body-s">{directoryPath}</Box>
          </div>

          <Alert type="info">
            This will process all .md and .txt files in the specified directory. 
            Processing runs in the background and may take some time depending on the number of documents.
          </Alert>
        </SpaceBetween>
      </Modal>
    </SpaceBetween>
  );
}

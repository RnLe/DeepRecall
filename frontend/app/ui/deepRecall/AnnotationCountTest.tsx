// AnnotationCountTest.tsx
// A test component to verify annotation counting functionality

import React, { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { initializeAllAnnotationCounts, initializeSingleVersionAnnotationCount } from '../../utils/initializeAnnotationCounts';

const AnnotationCountTest: React.FC = () => {
  const [isInitializing, setIsInitializing] = useState(false);
  const [singleLitId, setSingleLitId] = useState('');
  const [singleVersionId, setSingleVersionId] = useState('');
  const [status, setStatus] = useState('');
  const queryClient = useQueryClient();

  const initializeAllMutation = useMutation({
    mutationFn: initializeAllAnnotationCounts,
    onSuccess: () => {
      setStatus('✅ All annotation counts initialized successfully!');
      queryClient.invalidateQueries({ queryKey: ['literatures'] });
    },
    onError: (error: Error) => {
      setStatus(`❌ Failed to initialize: ${error.message}`);
    },
  });

  const initializeSingleMutation = useMutation({
    mutationFn: ({ litId, versionId }: { litId: string; versionId: string }) => 
      initializeSingleVersionAnnotationCount(litId, versionId),
    onSuccess: () => {
      setStatus('✅ Single version annotation count initialized successfully!');
      queryClient.invalidateQueries({ queryKey: ['literatures'] });
    },
    onError: (error: Error) => {
      setStatus(`❌ Failed to initialize single version: ${error.message}`);
    },
  });

  const handleInitializeAll = async () => {
    setIsInitializing(true);
    setStatus('🔄 Initializing annotation counts for all versions...');
    try {
      await initializeAllMutation.mutateAsync();
    } finally {
      setIsInitializing(false);
    }
  };

  const handleInitializeSingle = async () => {
    if (!singleLitId || !singleVersionId) {
      setStatus('❌ Please provide both Literature ID and Version ID');
      return;
    }
    
    setStatus('🔄 Initializing annotation count for single version...');
    await initializeSingleMutation.mutateAsync({
      litId: singleLitId,
      versionId: singleVersionId,
    });
  };

  return (
    <div className="p-6 bg-slate-800/40 backdrop-blur-sm border border-slate-700/50 rounded-xl max-w-2xl mx-auto">
      <h2 className="text-xl font-bold text-slate-100 mb-6">Annotation Count Test Panel</h2>
      
      <div className="space-y-6">
        {/* Initialize All */}
        <div className="p-4 bg-slate-700/30 rounded-lg">
          <h3 className="text-lg font-semibold text-slate-200 mb-3">Initialize All Annotation Counts</h3>
          <p className="text-sm text-slate-400 mb-4">
            This will count existing annotations for all versions and initialize their annotationCount metadata.
            This should be run once when implementing the feature.
          </p>
          <button
            onClick={handleInitializeAll}
            disabled={isInitializing || initializeAllMutation.isPending}
            className="px-4 py-2 bg-blue-600 hover:bg-blue-500 disabled:bg-slate-600 disabled:cursor-not-allowed text-white rounded-lg transition-colors"
          >
            {isInitializing || initializeAllMutation.isPending ? 'Initializing...' : 'Initialize All'}
          </button>
        </div>

        {/* Initialize Single */}
        <div className="p-4 bg-slate-700/30 rounded-lg">
          <h3 className="text-lg font-semibold text-slate-200 mb-3">Initialize Single Version</h3>
          <p className="text-sm text-slate-400 mb-4">
            Initialize annotation count for a specific version (useful for testing).
          </p>
          <div className="space-y-3">
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-1">
                Literature ID:
              </label>
              <input
                type="text"
                value={singleLitId}
                onChange={(e) => setSingleLitId(e.target.value)}
                placeholder="Enter literature document ID"
                className="w-full px-3 py-2 bg-slate-600/50 border border-slate-500/50 rounded text-slate-100 placeholder-slate-400"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-1">
                Version ID:
              </label>
              <input
                type="text"
                value={singleVersionId}
                onChange={(e) => setSingleVersionId(e.target.value)}
                placeholder="Enter version document ID"
                className="w-full px-3 py-2 bg-slate-600/50 border border-slate-500/50 rounded text-slate-100 placeholder-slate-400"
              />
            </div>
            <button
              onClick={handleInitializeSingle}
              disabled={initializeSingleMutation.isPending}
              className="px-4 py-2 bg-green-600 hover:bg-green-500 disabled:bg-slate-600 disabled:cursor-not-allowed text-white rounded-lg transition-colors"
            >
              {initializeSingleMutation.isPending ? 'Initializing...' : 'Initialize Single'}
            </button>
          </div>
        </div>

        {/* Status */}
        {status && (
          <div className="p-4 bg-slate-600/30 rounded-lg">
            <h4 className="text-sm font-medium text-slate-300 mb-2">Status:</h4>
            <p className="text-sm text-slate-100">{status}</p>
          </div>
        )}

        {/* Instructions */}
        <div className="p-4 bg-amber-900/20 border border-amber-700/50 rounded-lg">
          <h4 className="text-sm font-semibold text-amber-300 mb-2">⚠️ Important Notes:</h4>
          <ul className="text-sm text-amber-200 space-y-1 list-disc list-inside">
            <li>This should only be run once when first implementing annotation counting</li>
            <li>After initialization, annotation counts will be maintained automatically</li>
            <li>The process may take some time for large literature collections</li>
            <li>Make sure to backup your data before running bulk operations</li>
          </ul>
        </div>
      </div>
    </div>
  );
};

export default AnnotationCountTest;

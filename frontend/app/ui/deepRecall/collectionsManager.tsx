// collectionsManager.tsx

import React, { useState } from 'react';
import { useCollections, useCreateCollection, useUpdateCollection, useDeleteCollection } from '../../customHooks/useCollections';
import { Collection } from '../../types/deepRecall/strapi/collectionTypes';
import { Search, Plus, Edit2, Trash2, X, Save, Folder, FolderOpen, Hash } from 'lucide-react';

interface CollectionsManagerProps {
  className?: string;
  onCollectionSelect?: (collectionId: string | null) => void;
  selectedCollection?: string | null;
  onRequestEditMode?: (collectionId: string) => void;
}

export default function CollectionsManager({ 
  className, 
  onCollectionSelect, 
  selectedCollection,
  onRequestEditMode 
}: CollectionsManagerProps) {
  const { data: collections, isLoading, error } = useCollections();
  const createMutation = useCreateCollection();
  const updateMutation = useUpdateCollection();
  const deleteMutation = useDeleteCollection();

  // UI state
  const [searchTerm, setSearchTerm] = useState('');
  const [isCreating, setIsCreating] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [newCollectionData, setNewCollectionData] = useState({
    title: '',
    color: '#3B82F6',
    icon: 'folder'
  });
  const [editData, setEditData] = useState({
    title: '',
    color: '#3B82F6',
    icon: 'folder'
  });

  // Available colors and icons
  const availableColors = [
    '#3B82F6', '#EF4444', '#10B981', '#F59E0B', '#8B5CF6',
    '#EC4899', '#06B6D4', '#84CC16', '#F97316', '#6366F1'
  ];

  const availableIcons = [
    { value: 'folder', label: 'Folder', icon: Folder },
    { value: 'hash', label: 'Tag', icon: Hash },
    { value: 'star', label: 'Star', icon: '⭐' }
  ];

  // Filter collections based on search
  const filteredCollections = collections?.filter(collection =>
    collection.title.toLowerCase().includes(searchTerm.toLowerCase())
  ) || [];

  // Handle collection selection
  const handleCollectionClick = (collection: Collection) => {
    onCollectionSelect?.(collection.documentId || null);
  };

  // Handle creating new collection
  const handleCreateCollection = async () => {
    if (!newCollectionData.title.trim()) return;

    try {
      await createMutation.mutateAsync({
        title: newCollectionData.title,
        metadata: JSON.stringify({
          color: newCollectionData.color,
          icon: newCollectionData.icon
        }),
        customMetadata: {}
      });
      
      setIsCreating(false);
      setNewCollectionData({ title: '', color: '#3B82F6', icon: 'folder' });
    } catch (error) {
      console.error('Error creating collection:', error);
    }
  };

  // Handle updating collection
  const handleUpdateCollection = async (collection: Collection) => {
    if (!editData.title.trim() || !collection.documentId) return;

    try {
      await updateMutation.mutateAsync({
        id: collection.documentId,
        data: {
          title: editData.title,
          metadata: JSON.stringify({
            color: editData.color,
            icon: editData.icon
          })
        }
      });
      
      setEditingId(null);
    } catch (error) {
      console.error('Error updating collection:', error);
    }
  };

  // Handle deleting collection
  const handleDeleteCollection = async (collection: Collection) => {
    if (!confirm(`Are you sure you want to delete "${collection.title}"?`) || !collection.documentId) return;

    try {
      await deleteMutation.mutateAsync(collection.documentId);
    } catch (error) {
      console.error('Error deleting collection:', error);
    }
  };

  // Start editing a collection
  const startEditing = (collection: Collection) => {
    if (!collection.documentId) return;
    
    let metadata: { color?: string; icon?: string; [key: string]: any } = {};
    // Handle metadata parsing safely, similar to literatureTypes.ts
    if (collection.metadata) {
      if (typeof collection.metadata === 'string') {
        try {
          metadata = JSON.parse(collection.metadata);
        } catch (error) {
          console.error(`Failed to parse metadata for collection "${collection.title}":`, error);
        }
      } else if (typeof collection.metadata === 'object' && collection.metadata !== null) {
        metadata = collection.metadata as any;
      }
    }
    
    setEditData({
      title: collection.title,
      color: metadata.color || '#3B82F6',
      icon: metadata.icon || 'folder'
    });
    setEditingId(collection.documentId);
  };

  // Cancel editing
  const cancelEditing = () => {
    setEditingId(null);
    setEditData({ title: '', color: '#3B82F6', icon: 'folder' });
  };

  // Get icon component
  const getIconComponent = (iconName: string) => {
    const iconConfig = availableIcons.find(i => i.value === iconName);
    if (!iconConfig) return <Folder className="w-4 h-4" />;
    
    if (typeof iconConfig.icon === 'string') {
      return <span className="text-sm">{iconConfig.icon}</span>;
    }
    
    const IconComponent = iconConfig.icon;
    return <IconComponent className="w-4 h-4" />;
  };

  if (isLoading) {
    return (
      <div className={`p-4 ${className}`}>
        <div className="animate-pulse space-y-4">
          <div className="h-6 bg-slate-700 rounded w-3/4"></div>
          <div className="h-10 bg-slate-700 rounded"></div>
          <div className="space-y-2">
            {[...Array(5)].map((_, i) => (
              <div key={i} className="h-8 bg-slate-700 rounded"></div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className={`p-4 ${className}`}>
        <div className="bg-red-950/20 border border-red-900/20 rounded-lg p-4">
          <h3 className="text-red-400 font-semibold mb-2">Error Loading Collections</h3>
          <p className="text-red-300 text-sm">{(error as Error)?.message}</p>
        </div>
      </div>
    );
  }

  return (
    <div className={`flex flex-col h-full bg-slate-900/50 ${className}`}>
      {/* Header */}
      <div className="p-4 border-b border-slate-700/50">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-slate-100 flex items-center space-x-2">
            <FolderOpen className="w-5 h-5 text-blue-400" />
            <span>Collections</span>
          </h2>
          <button
            onClick={() => setIsCreating(true)}
            className="p-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors"
            title="Create new collection"
          >
            <Plus className="w-4 h-4" />
          </button>
        </div>

        {/* Search */}
        <div className="relative">
          <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
            <Search className="h-4 w-4 text-slate-400" />
          </div>
          <input
            type="text"
            placeholder="Search collections..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-10 pr-4 py-2 bg-slate-800/50 border border-slate-700/50 rounded-lg text-slate-100 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500/50 transition-all text-sm"
          />
        </div>
      </div>

      {/* Collections List */}
      <div className="flex-1 overflow-y-auto p-4 space-y-2">
        {/* All Literature Option */}
        <button
          onClick={() => onCollectionSelect?.(null)}
          className={`w-full flex items-center space-x-3 p-3 rounded-lg transition-all text-left ${
            selectedCollection === null
              ? 'bg-blue-600/20 border border-blue-500/30 text-blue-300'
              : 'bg-slate-800/30 hover:bg-slate-700/30 text-slate-300 hover:text-slate-200'
          }`}
        >
          <div className="w-6 h-6 flex items-center justify-center">
            <Folder className="w-4 h-4" />
          </div>
          <span className="font-medium">All Literature</span>
        </button>

        {/* Uncategorized Option */}
        <button
          onClick={() => onCollectionSelect?.('__uncategorized__')}
          className={`w-full flex items-center space-x-3 p-3 rounded-lg transition-all text-left ${
            selectedCollection === '__uncategorized__'
              ? 'bg-amber-600/20 border border-amber-500/30 text-amber-300'
              : 'bg-slate-800/30 hover:bg-slate-700/30 text-slate-300 hover:text-slate-200'
          }`}
        >
          <div className="w-6 h-6 flex items-center justify-center">
            <Hash className="w-4 h-4" />
          </div>
          <span className="font-medium">Uncategorized</span>
        </button>

        {/* Create New Collection Form */}
        {isCreating && (
          <div className="bg-slate-800/50 border border-slate-700/50 rounded-lg p-4 space-y-3">
            <input
              type="text"
              placeholder="Collection title"
              value={newCollectionData.title}
              onChange={(e) => setNewCollectionData(prev => ({ ...prev, title: e.target.value }))}
              className="w-full px-3 py-2 bg-slate-700/50 border border-slate-600/50 rounded-lg text-slate-100 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/50 text-sm"
              autoFocus
            />
            
            {/* Color Picker */}
            <div className="space-y-2">
              <label className="text-xs font-medium text-slate-400">Color</label>
              <div className="flex flex-wrap gap-2">
                {availableColors.map(color => (
                  <button
                    key={color}
                    onClick={() => setNewCollectionData(prev => ({ ...prev, color }))}
                    className={`w-6 h-6 rounded-full transition-all ${
                      newCollectionData.color === color ? 'ring-2 ring-white ring-offset-2 ring-offset-slate-800' : ''
                    }`}
                    style={{ backgroundColor: color }}
                  />
                ))}
              </div>
            </div>

            {/* Icon Picker */}
            <div className="space-y-2">
              <label className="text-xs font-medium text-slate-400">Icon</label>
              <div className="flex flex-wrap gap-2">
                {availableIcons.map(iconOption => (
                  <button
                    key={iconOption.value}
                    onClick={() => setNewCollectionData(prev => ({ ...prev, icon: iconOption.value }))}
                    className={`p-2 rounded-lg transition-all ${
                      newCollectionData.icon === iconOption.value 
                        ? 'bg-blue-600/30 border border-blue-500/50 text-blue-300' 
                        : 'bg-slate-700/50 hover:bg-slate-600/50 text-slate-400 hover:text-slate-300'
                    }`}
                    title={iconOption.label}
                  >
                    {getIconComponent(iconOption.value)}
                  </button>
                ))}
              </div>
            </div>

            <div className="flex space-x-2">
              <button
                onClick={handleCreateCollection}
                disabled={!newCollectionData.title.trim() || createMutation.isPending}
                className="flex-1 flex items-center justify-center space-x-2 px-3 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-600/50 text-white rounded-lg transition-colors text-sm"
              >
                <Save className="w-4 h-4" />
                <span>{createMutation.isPending ? 'Creating...' : 'Create'}</span>
              </button>
              <button
                onClick={() => {
                  setIsCreating(false);
                  setNewCollectionData({ title: '', color: '#3B82F6', icon: 'folder' });
                }}
                className="px-3 py-2 bg-slate-600 hover:bg-slate-500 text-slate-200 rounded-lg transition-colors text-sm"
              >
                Cancel
              </button>
            </div>
          </div>
        )}

        {/* Collections */}
        {filteredCollections.map(collection => {
          if (!collection.documentId) return null;
          
          // Handle metadata parsing safely, similar to literatureTypes.ts
          let metadata: { color?: string; icon?: string; [key: string]: any } = {};
          if (collection.metadata) {
            if (typeof collection.metadata === 'string') {
              try {
                metadata = JSON.parse(collection.metadata);
              } catch (error) {
                console.error(`Failed to parse metadata for collection "${collection.title}":`, error);
              }
            } else if (typeof collection.metadata === 'object' && collection.metadata !== null) {
              metadata = collection.metadata as any;
            }
          }
          
          const isEditing = editingId === collection.documentId;
          const isSelected = selectedCollection === collection.documentId;

          if (isEditing) {
            return (
              <div key={collection.documentId} className="bg-slate-800/50 border border-slate-700/50 rounded-lg p-4 space-y-3">
                <input
                  type="text"
                  value={editData.title}
                  onChange={(e) => setEditData(prev => ({ ...prev, title: e.target.value }))}
                  className="w-full px-3 py-2 bg-slate-700/50 border border-slate-600/50 rounded-lg text-slate-100 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/50 text-sm"
                  autoFocus
                />
                
                {/* Color Picker */}
                <div className="space-y-2">
                  <label className="text-xs font-medium text-slate-400">Color</label>
                  <div className="flex flex-wrap gap-2">
                    {availableColors.map(color => (
                      <button
                        key={color}
                        onClick={() => setEditData(prev => ({ ...prev, color }))}
                        className={`w-6 h-6 rounded-full transition-all ${
                          editData.color === color ? 'ring-2 ring-white ring-offset-2 ring-offset-slate-800' : ''
                        }`}
                        style={{ backgroundColor: color }}
                      />
                    ))}
                  </div>
                </div>

                {/* Icon Picker */}
                <div className="space-y-2">
                  <label className="text-xs font-medium text-slate-400">Icon</label>
                  <div className="flex flex-wrap gap-2">
                    {availableIcons.map(iconOption => (
                      <button
                        key={iconOption.value}
                        onClick={() => setEditData(prev => ({ ...prev, icon: iconOption.value }))}
                        className={`p-2 rounded-lg transition-all ${
                          editData.icon === iconOption.value 
                            ? 'bg-blue-600/30 border border-blue-500/50 text-blue-300' 
                            : 'bg-slate-700/50 hover:bg-slate-600/50 text-slate-400 hover:text-slate-300'
                        }`}
                        title={iconOption.label}
                      >
                        {getIconComponent(iconOption.value)}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="flex space-x-2">
                  <button
                    onClick={() => handleUpdateCollection(collection)}
                    disabled={!editData.title.trim() || updateMutation.isPending}
                    className="flex-1 flex items-center justify-center space-x-2 px-3 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-600/50 text-white rounded-lg transition-colors text-sm"
                  >
                    <Save className="w-4 h-4" />
                    <span>{updateMutation.isPending ? 'Saving...' : 'Save'}</span>
                  </button>
                  <button
                    onClick={cancelEditing}
                    className="px-3 py-2 bg-slate-600 hover:bg-slate-500 text-slate-200 rounded-lg transition-colors text-sm"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            );
          }

          return (
            <div
              key={collection.documentId}
              className={`group flex items-center space-x-3 p-3 rounded-lg transition-all cursor-pointer ${
                isSelected
                  ? 'border border-opacity-50 text-white'
                  : 'bg-slate-800/30 hover:bg-slate-700/30 text-slate-300 hover:text-slate-200'
              }`}
              style={{
                backgroundColor: isSelected ? `${metadata.color || '#3B82F6'}20` : undefined,
                borderColor: isSelected ? `${metadata.color || '#3B82F6'}50` : undefined,
                color: isSelected ? (metadata.color || '#3B82F6') : undefined
              }}
              onClick={() => handleCollectionClick(collection)}
            >
              <div 
                className="w-6 h-6 flex items-center justify-center rounded"
                style={{ backgroundColor: `${metadata.color || '#3B82F6'}30` }}
              >
                {getIconComponent(metadata.icon || 'folder')}
              </div>
              
              <span className="flex-1 font-medium text-sm truncate">
                {collection.title}
              </span>

              <div className="opacity-0 group-hover:opacity-100 flex items-center space-x-1 transition-opacity">
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    onRequestEditMode?.(collection.documentId!);
                  }}
                  className="p-1.5 bg-purple-600/50 hover:bg-purple-500 text-purple-300 hover:text-white rounded transition-colors"
                  title="Add literature to collection"
                >
                  <Plus className="w-3 h-3" />
                </button>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    startEditing(collection);
                  }}
                  className="p-1.5 bg-slate-600/50 hover:bg-slate-500 text-slate-300 hover:text-white rounded transition-colors"
                  title="Edit collection"
                >
                  <Edit2 className="w-3 h-3" />
                </button>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    handleDeleteCollection(collection);
                  }}
                  className="p-1.5 bg-red-600/50 hover:bg-red-500 text-red-300 hover:text-white rounded transition-colors"
                  title="Delete collection"
                  disabled={deleteMutation.isPending}
                >
                  <Trash2 className="w-3 h-3" />
                </button>
              </div>
            </div>
          );
        })}

        {/* No Collections Message */}
        {filteredCollections.length === 0 && !isCreating && (
          <div className="text-center py-8">
            <div className="w-12 h-12 bg-slate-700/30 rounded-full flex items-center justify-center mx-auto mb-3">
              <Folder className="w-6 h-6 text-slate-500" />
            </div>
            <h3 className="text-slate-400 font-medium mb-1">
              {searchTerm ? 'No matching collections' : 'No collections yet'}
            </h3>
            <p className="text-slate-500 text-sm">
              {searchTerm 
                ? 'Try adjusting your search terms'
                : 'Create your first collection to organize your literature'
              }
            </p>
          </div>
        )}
      </div>
    </div>
  );
}

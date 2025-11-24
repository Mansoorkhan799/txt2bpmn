'use client';

import { useState } from 'react';
import { HiEye, HiPencil, HiDuplicate, HiTrash, HiFolderAdd, HiDocumentAdd } from 'react-icons/hi';

interface FileNode {
  id: string;
  name: string;
  type: 'file' | 'folder';
  content?: string;
  children?: FileNode[];
  isOpen?: boolean;
}

interface FileTreeSidebarProps {
  files: FileNode[];
  currentFile: string;
  onFileSelect: (fileId: string) => void;
  onAddFile: (fileName: string) => void;
  onAddFolder?: (folderName: string) => void;
  onDeleteFile: (fileId: string) => void;
  onRenameFile: (fileId: string, newName: string) => void;
  onMoveNode?: (nodeId: string, newParentId: string | null) => void;
}

export default function FileTreeSidebar({
  files,
  currentFile,
  onFileSelect,
  onAddFile,
  onAddFolder,
  onDeleteFile,
  onRenameFile,
  onMoveNode,
}: FileTreeSidebarProps) {
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [showNewFileDialog, setShowNewFileDialog] = useState(false);
  const [newFileName, setNewFileName] = useState('');
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number; fileId: string } | null>(null);
  const [editingFileId, setEditingFileId] = useState<string | null>(null);
  const [editingFileName, setEditingFileName] = useState('');
  const [draggingId, setDraggingId] = useState<string | null>(null);

  const handleAddFile = () => {
    if (newFileName.trim()) {
      onAddFile(newFileName.trim());
      setNewFileName('');
      setShowNewFileDialog(false);
    }
  };

  const handleContextMenu = (e: React.MouseEvent, fileId: string) => {
    e.preventDefault();
    setContextMenu({ x: e.clientX, y: e.clientY, fileId });
  };

  const handleRename = (fileId: string) => {
    const file = files.find(f => f.id === fileId);
    if (file) {
      setEditingFileId(fileId);
      setEditingFileName(file.name);
    }
    setContextMenu(null);
  };

  const handleRenameSubmit = () => {
    if (editingFileId && editingFileName.trim()) {
      onRenameFile(editingFileId, editingFileName.trim());
      setEditingFileId(null);
      setEditingFileName('');
    }
  };

  const handleDelete = (fileId: string) => {
    if (confirm('Are you sure you want to delete this file?')) {
      onDeleteFile(fileId);
    }
    setContextMenu(null);
  };

  // Build a simple tree from the flat list using parentId
  const buildTree = (parentId: string | null = null): FileNode[] =>
    files.filter((f) => (f.parentId ?? null) === parentId);

  const isDescendant = (id: string, potentialAncestorId: string): boolean => {
    let current = files.find((f) => f.id === id);
    while (current && current.parentId) {
      if (current.parentId === potentialAncestorId) return true;
      current = files.find((f) => f.id === current!.parentId);
    }
    return false;
  };

  const handleDragStart = (id: string) => {
    setDraggingId(id);
  };

  const handleDropOnFolder = (folderId: string) => {
    if (!draggingId || !onMoveNode) return;

    const dragged = files.find((f) => f.id === draggingId);
    const target = files.find((f) => f.id === folderId);

    if (!dragged || !target || target.type !== 'folder') return;
    if (dragged.id === target.id) return;
    if (isDescendant(target.id, dragged.id)) return; // prevent cycles

    onMoveNode(dragged.id, target.id);
    setDraggingId(null);
  };

  const handleDropOnRoot = () => {
    if (!draggingId || !onMoveNode) return;
    const dragged = files.find((f) => f.id === draggingId);
    if (!dragged) return;
    onMoveNode(dragged.id, null);
    setDraggingId(null);
  };

  const renderNode = (node: FileNode, depth = 0) => {
    const isEditing = editingFileId === node.id;
    const isCurrent = node.name === currentFile;

    return (
      <div key={node.id}>
        <div
          className="group flex items-center justify-between px-2 py-1 rounded cursor-pointer"
          style={{ paddingLeft: isCollapsed ? undefined : 8 + depth * 12 }}
          draggable
          onDragStart={() => handleDragStart(node.id)}
          onDragOver={(e) => {
            if (node.type === 'folder') {
              e.preventDefault();
            }
          }}
          onDrop={(e) => {
            e.preventDefault();
            if (node.type === 'folder') {
              handleDropOnFolder(node.id);
            }
          }}
          onContextMenu={(e) => handleContextMenu(e, node.id)}
        >
          {isEditing ? (
            <div className="flex items-center gap-1 flex-1">
              <input
                type="text"
                value={editingFileName}
                onChange={(e) => setEditingFileName(e.target.value)}
                onBlur={handleRenameSubmit}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') handleRenameSubmit();
                  if (e.key === 'Escape') {
                    setEditingFileId(null);
                    setEditingFileName('');
                  }
                }}
                className="flex-1 px-2 py-1 text-sm border rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
                autoFocus
              />
            </div>
          ) : (
            <div
              className={`w-full flex items-center gap-2 px-1 py-1 rounded text-sm transition-colors ${
                isCurrent ? 'bg-blue-50 text-blue-700 font-medium' : 'text-gray-700 hover:bg-gray-100'
              }`}
            >
              <button
                onClick={() => onFileSelect(node.id)}
                className="flex items-center gap-2 flex-1 text-left"
              >
                {node.type === 'folder' ? (
                  <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                    <path d="M2 6a2 2 0 012-2h5l2 2h5a2 2 0 012 2v6a2 2 0 01-2 2H4a2 2 0 01-2-2V6z" />
                  </svg>
                ) : (
                  <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                    <path
                      fillRule="evenodd"
                      d="M4 4a2 2 0 012-2h4.586A2 2 0 0112 2.586L15.414 6A2 2 0 0116 7.414V16a2 2 0 01-2 2H6a2 2 0 01-2-2V4z"
                      clipRule="evenodd"
                    />
                  </svg>
                )}
                <span className="flex-1 text-left truncate">{node.name}</span>
              </button>

              {node.type === 'file' && (
                <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity ml-1">
                  <button
                    onClick={() => onFileSelect(node.id)}
                    className="p-1 rounded hover:bg-blue-50"
                    title="Open"
                  >
                    <HiEye className="w-3.5 h-3.5 text-blue-600" />
                  </button>
                  <button
                    onClick={() => handleRename(node.id)}
                    className="p-1 rounded hover:bg-gray-100"
                    title="Rename"
                  >
                    <HiPencil className="w-3.5 h-3.5 text-gray-700" />
                  </button>
                  <button
                    onClick={() => {
                      const copyName = `${node.name.replace(/\\.tex$/i, '')} (Copy).tex`;
                      onAddFile(copyName);
                    }}
                    className="p-1 rounded hover:bg-purple-50"
                    title="Duplicate"
                  >
                    <HiDuplicate className="w-3.5 h-3.5 text-purple-700" />
                  </button>
                  <button
                    onClick={() => handleDelete(node.id)}
                    className="p-1 rounded hover:bg-red-50"
                    title="Delete"
                  >
                    <HiTrash className="w-3.5 h-3.5 text-red-600" />
                  </button>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Render children (folders can contain other folders and files) */}
        {node.type === 'folder' &&
          buildTree(node.id).map((child) => renderNode(child, depth + 1))}
      </div>
    );
  };

  return (
    <>
      <div className={`${isCollapsed ? 'w-12' : 'w-64'} bg-white border-r flex flex-col overflow-hidden transition-all duration-300`}>
        {/* Header */}
        <div className="bg-gray-50 border-b px-2 py-3 flex items-center justify-between">
          <button
            onClick={() => setIsCollapsed(!isCollapsed)}
            className="p-1 hover:bg-gray-200 rounded transition-colors"
            title={isCollapsed ? 'Expand Sidebar' : 'Collapse Sidebar'}
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              {isCollapsed ? (
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
              ) : (
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              )}
            </svg>
          </button>
          {!isCollapsed && (
            <div className="flex items-center gap-2">
              <h3 className="text-sm font-medium text-gray-700">Files</h3>
              <div className="flex items-center gap-1">
                {/* New Folder */}
                <button
                  onClick={() => {
                    const name = prompt('Enter folder name');
                    if (name && onAddFolder) {
                      onAddFolder(name.trim());
                    }
                  }}
                  className="w-7 h-7 flex items-center justify-center rounded-md bg-blue-500 hover:bg-blue-600 text-white shadow-sm transition-colors"
                  title="New Folder"
                >
                  <HiFolderAdd className="w-4 h-4" />
                </button>
                {/* New File */}
                <button
                  onClick={() => setShowNewFileDialog(true)}
                  className="w-7 h-7 flex items-center justify-center rounded-md bg-green-500 hover:bg-green-600 text-white shadow-sm transition-colors"
                  title="New File"
                >
                  <HiDocumentAdd className="w-4 h-4" />
                </button>
              </div>
            </div>
          )}
        </div>

        {/* File List */}
        {!isCollapsed ? (
          <>
            <div
              className="flex-1 overflow-y-auto p-2"
              onDragOver={(e) => {
                // Allow dropping on empty space to move node to root
                if (draggingId) e.preventDefault();
              }}
              onDrop={(e) => {
                e.preventDefault();
                handleDropOnRoot();
              }}
            >
              {buildTree(null).map((node) => renderNode(node, 0))}
            </div>
          </>
        ) : (
          <div className="flex-1 flex flex-col items-center gap-3 py-4">
            {files.map((file) => (
              <button
                key={file.id}
                onClick={() => onFileSelect(file.id)}
                onContextMenu={(e) => handleContextMenu(e, file.id)}
                className={`p-2 rounded transition-colors ${
                  file.name === currentFile
                    ? 'bg-blue-50 text-blue-700'
                    : 'text-gray-700 hover:bg-gray-100'
                }`}
                title={file.name}
              >
                <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                  <path
                    fillRule="evenodd"
                    d="M4 4a2 2 0 012-2h4.586A2 2 0 0112 2.586L15.414 6A2 2 0 0116 7.414V16a2 2 0 01-2 2H6a2 2 0 01-2-2V4z"
                    clipRule="evenodd"
                  />
                </svg>
              </button>
            ))}
          </div>
        )}
      </div>

      {/* New File Dialog */}
      {showNewFileDialog && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-96">
            <h3 className="text-lg font-semibold mb-4">New File</h3>
            <input
              type="text"
              value={newFileName}
              onChange={(e) => setNewFileName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') handleAddFile();
                if (e.key === 'Escape') {
                  setShowNewFileDialog(false);
                  setNewFileName('');
                }
              }}
              placeholder="Enter file name (e.g., chapter1.tex)"
              className="w-full px-3 py-2 border rounded focus:outline-none focus:ring-2 focus:ring-blue-500 mb-4"
              autoFocus
            />
            <div className="flex justify-end gap-2">
              <button
                onClick={() => {
                  setShowNewFileDialog(false);
                  setNewFileName('');
                }}
                className="px-4 py-2 text-gray-700 hover:bg-gray-100 rounded"
              >
                Cancel
              </button>
              <button
                onClick={handleAddFile}
                className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
              >
                Create
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Context Menu */}
      {contextMenu && (
        <>
          <div
            className="fixed inset-0 z-40"
            onClick={() => setContextMenu(null)}
          />
          <div
            className="fixed bg-white border rounded shadow-lg py-1 z-50"
            style={{ left: contextMenu.x, top: contextMenu.y }}
          >
            <button
              onClick={() => handleRename(contextMenu.fileId)}
              className="w-full px-4 py-2 text-left text-sm hover:bg-gray-100"
            >
              Rename
            </button>
            <button
              onClick={() => handleDelete(contextMenu.fileId)}
              className="w-full px-4 py-2 text-left text-sm text-red-600 hover:bg-gray-100"
            >
              Delete
            </button>
          </div>
        </>
      )}
    </>
  );
}


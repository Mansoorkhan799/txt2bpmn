'use client';

interface SharedToolbarProps {
  mode: 'code' | 'visual';
  onModeChange: (mode: 'code' | 'visual') => void;
  onCompile: () => void;
  compiling: boolean;
  showLog: boolean;
  onToggleLog: () => void;
  onBold: () => void;
  onItalic: () => void;
  onUnderline: () => void;
  onInsertMath: () => void;
  onInsertTable: () => void;
  onInsertImage: () => void;
  onToggleList: () => void;
}

export default function SharedToolbar({
  mode,
  onModeChange,
  onCompile,
  compiling,
  showLog,
  onToggleLog,
  onBold,
  onItalic,
  onUnderline,
  onInsertMath,
  onInsertTable,
  onInsertImage,
  onToggleList,
}: SharedToolbarProps) {
  return (
    <div className="bg-white border-b px-4 py-2 flex items-center justify-between gap-4 flex-wrap">
      {/* Editor Mode Tabs */}
      <div className="flex gap-1">
        <button
          onClick={() => onModeChange('code')}
          className={`px-4 py-2 rounded-t text-sm font-medium transition-colors ${
            mode === 'code' 
              ? 'bg-green-500 text-white shadow-md' 
              : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
          }`}
        >
          Code Editor
        </button>
        <button
          onClick={() => onModeChange('visual')}
          className={`px-4 py-2 rounded-t text-sm font-medium transition-colors ${
            mode === 'visual' 
              ? 'bg-green-500 text-white shadow-md' 
              : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
          }`}
        >
          Visual Editor
        </button>
      </div>

      {/* Formatting Tools */}
      <div className="flex items-center gap-1">
        <button
          onClick={onBold}
          className="p-2 hover:bg-gray-100 rounded transition-colors text-sm font-bold"
          title="Bold"
        >
          B
        </button>
        <button
          onClick={onItalic}
          className="p-2 hover:bg-gray-100 rounded transition-colors text-sm italic"
          title="Italic"
        >
          I
        </button>
        <button
          onClick={onUnderline}
          className="p-2 hover:bg-gray-100 rounded transition-colors text-sm underline"
          title="Underline"
        >
          U
        </button>
        <div className="w-px h-6 bg-gray-300 mx-1"></div>
        <button
          onClick={onInsertMath}
          className="p-2 hover:bg-gray-100 rounded transition-colors"
          title="Math"
        >
          Σ
        </button>
        <button
          onClick={onInsertTable}
          className="p-2 hover:bg-gray-100 rounded transition-colors"
          title="Table"
        >
          ⊞
        </button>
        <button
          onClick={onInsertImage}
          className="p-2 hover:bg-gray-100 rounded transition-colors"
          title="Image"
        >
          🖼️
        </button>
        <button
          onClick={onToggleList}
          className="p-2 hover:bg-gray-100 rounded transition-colors"
          title="List"
        >
          ☰
        </button>
      </div>

      {/* Right Side Controls */}
      <div className="flex items-center gap-3 ml-auto">
        {/* Compile Button */}
        <button
          onClick={onCompile}
          disabled={compiling}
          className={`px-4 py-2 rounded font-medium text-sm transition-all ${
            compiling
              ? 'bg-gray-400 text-white cursor-not-allowed'
              : 'bg-green-600 text-white hover:bg-green-700 shadow-md hover:shadow-lg'
          }`}
        >
          {compiling ? (
            <span className="flex items-center gap-2">
              <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none"></circle>
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
              </svg>
              Compiling...
            </span>
          ) : (
            'Recompile'
          )}
        </button>

        {/* Log Toggle */}
        <button
          onClick={onToggleLog}
          className={`p-2 rounded transition-colors ${
            showLog ? 'bg-blue-100 text-blue-700' : 'hover:bg-gray-100'
          }`}
          title="Toggle Compilation Log"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
          </svg>
        </button>
      </div>
    </div>
  );
}


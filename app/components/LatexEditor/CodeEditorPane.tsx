'use client';

import { useEffect, useState, useRef, useImperativeHandle, forwardRef } from 'react';
import CodeMirror, { ReactCodeMirrorRef } from '@uiw/react-codemirror';
import { javascript } from '@codemirror/lang-javascript';
import { EditorView } from '@codemirror/view';

interface CodeEditorPaneProps {
  content: string;
  onChange: (value: string) => void;
}

export interface CodeEditorRef {
  insertText: (text: string) => void;
  wrapSelection: (before: string, after: string) => void;
  getSelection: () => string;
}

const CodeEditorPane = forwardRef<CodeEditorRef, CodeEditorPaneProps>(
  ({ content, onChange }, ref) => {
    const [mounted, setMounted] = useState(false);
    const editorRef = useRef<ReactCodeMirrorRef>(null);

    useEffect(() => {
      setMounted(true);
    }, []);

    useImperativeHandle(ref, () => ({
      insertText: (text: string) => {
        const view = editorRef.current?.view;
        if (!view) return;

        const { from, to } = view.state.selection.main;
        view.dispatch({
          changes: { from, to, insert: text },
          selection: { anchor: from + text.length },
        });
        view.focus();
      },
      wrapSelection: (before: string, after: string) => {
        const view = editorRef.current?.view;
        if (!view) return;

        const { from, to } = view.state.selection.main;
        const selectedText = view.state.sliceDoc(from, to);
        const newText = before + selectedText + after;

        view.dispatch({
          changes: { from, to, insert: newText },
          selection: { anchor: from + before.length, head: from + before.length + selectedText.length },
        });
        view.focus();
      },
      getSelection: () => {
        const view = editorRef.current?.view;
        if (!view) return '';

        const { from, to } = view.state.selection.main;
        return view.state.sliceDoc(from, to);
      },
    }));

    if (!mounted) {
      return (
        <div className="flex items-center justify-center h-full bg-gray-50">
          <div className="text-gray-500">Loading editor...</div>
        </div>
      );
    }

    return (
      <div className="h-full w-full overflow-auto">
        <CodeMirror
          ref={editorRef}
          value={content}
          height="100%"
          theme="light"
          extensions={[
            javascript({ jsx: false }),
            EditorView.lineWrapping,
          ]}
          onChange={(value) => {
            onChange(value);
          }}
          basicSetup={{
            lineNumbers: true,
            highlightActiveLineGutter: true,
            highlightSpecialChars: true,
            history: true,
            foldGutter: true,
            drawSelection: true,
            dropCursor: true,
            allowMultipleSelections: true,
            indentOnInput: true,
            syntaxHighlighting: true,
            bracketMatching: true,
            closeBrackets: true,
            autocompletion: true,
            rectangularSelection: true,
            crosshairCursor: true,
            highlightActiveLine: true,
            highlightSelectionMatches: true,
            closeBracketsKeymap: true,
            defaultKeymap: true,
            searchKeymap: true,
            historyKeymap: true,
            foldKeymap: true,
            completionKeymap: true,
            lintKeymap: true,
          }}
          className="text-sm"
          style={{
            fontSize: '14px',
            height: '100%',
          }}
        />
      </div>
    );
  }
);

CodeEditorPane.displayName = 'CodeEditorPane';

export default CodeEditorPane;

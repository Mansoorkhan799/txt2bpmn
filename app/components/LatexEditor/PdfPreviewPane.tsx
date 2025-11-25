'use client';

import { useState, useEffect } from 'react';
import { Viewer, Worker } from '@react-pdf-viewer/core';
import { defaultLayoutPlugin } from '@react-pdf-viewer/default-layout';
import '@react-pdf-viewer/core/lib/styles/index.css';
import '@react-pdf-viewer/default-layout/lib/styles/index.css';

interface PdfPreviewPaneProps {
  pdfUrl: string | null;
  currentPage: number;
  onPageChange: (page: number) => void;
  onTotalPagesChange: (total: number) => void;
  zoom: number;
}

export default function PdfPreviewPane({
  pdfUrl,
  currentPage,
  onPageChange,
  onTotalPagesChange,
  zoom,
}: PdfPreviewPaneProps) {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  const defaultLayoutPluginInstance = defaultLayoutPlugin();

  if (!mounted) {
    return (
      <div className="w-full min-w-[24rem] max-w-2xl bg-gray-100 border-l flex items-center justify-center">
        <div className="text-gray-500">Loading PDF viewer...</div>
      </div>
    );
  }

  if (!pdfUrl) {
    return (
      <div className="w-full min-w-[24rem] max-w-2xl bg-gray-100 border-l flex flex-col items-center justify-center p-8">
        <svg
          className="w-24 h-24 text-gray-300 mb-4"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={1.5}
            d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z"
          />
        </svg>
        <p className="text-gray-500 text-center text-sm">
          No PDF preview available yet.
          <br />
          Compile your LaTeX document to see the preview.
        </p>
      </div>
    );
  }

  return (
    <div className="w-full min-w-[24rem] max-w-2xl bg-gray-100 border-l flex flex-col overflow-hidden">
      <div className="bg-white border-b px-4 py-2">
        <h3 className="text-sm font-medium text-gray-700">PDF Preview</h3>
      </div>
      
      <div className="flex-1 overflow-auto bg-gray-200">
        <Worker workerUrl={`https://unpkg.com/pdfjs-dist@3.11.174/build/pdf.worker.min.js`}>
          <div style={{ height: '100%' }}>
            <Viewer
              fileUrl={pdfUrl}
              plugins={[defaultLayoutPluginInstance]}
              defaultScale={zoom / 100}
              onDocumentLoad={(e) => {
                onTotalPagesChange(e.doc.numPages);
              }}
              onPageChange={(e) => {
                onPageChange(e.currentPage + 1);
              }}
            />
          </div>
        </Worker>
      </div>
    </div>
  );
}


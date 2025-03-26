// literatureList.tsx
import React from 'react';
import { useLiterature } from '../customHooks/useLiterature';
import LiteratureCardM from './literatureCardM';
import { Literature } from '../helpers/literatureTypes';

interface LiteratureListProps {
  className?: string;
}

export default function LiteratureList({ className }: LiteratureListProps) {
  const { data, isLoading, error } = useLiterature();

  if (isLoading) {
    return <div className={`p-4 ${className}`}>Loading literature...</div>;
  }
  if (error) {
    return (
      <div className={`p-4 text-red-600 ${className}`}>
        Error loading literature: {(error as Error).message}
      </div>
    );
  }

  // Now data is of type NormalizedLiteratureResponse
  const textbooks: Literature[] = data?.textbooks ?? [];
  const papers: Literature[] = data?.papers ?? [];
  const scripts: Literature[] = data?.scripts ?? [];
  const theses: Literature[] = data?.theses ?? [];

  console.log("Data:");
  console.log(data);

  return (
    <div className={`p-4 bg-slate-100 overflow-auto ${className}`}>
      <h2 className="text-xl font-bold mb-4">Literature List</h2>

      {/* Textbooks Section */}
      <section className="mb-4">
        <h3 className="font-semibold text-lg">Textbooks ({textbooks.length})</h3>
        <div className="grid grid-cols-1 gap-4">
          {textbooks.length > 0 ? (
            textbooks.map((tb) => (
              <LiteratureCardM
                key={tb.documentId}
                documentId={tb.documentId}
                title={tb.title ?? "Untitled Textbook"}
                type="Textbook"
                metadata={tb.type_metadata}
              />
            ))
          ) : (
            <p className="text-gray-500">No textbooks available.</p>
          )}
        </div>
      </section>

      {/* Papers Section */}
      <section className="mb-4">
        <h3 className="font-semibold text-lg">Papers ({papers.length})</h3>
        <div className="grid grid-cols-1 gap-4">
          {papers.length > 0 ? (
            papers.map((p) => (
              <LiteratureCardM
                key={p.documentId}
                documentId={p.documentId}
                title={p.title ?? "Untitled Paper"}
                type="Paper"
                metadata={p.type_metadata}
              />
            ))
          ) : (
            <p className="text-gray-500">No papers available.</p>
          )}
        </div>
      </section>

      {/* Scripts Section */}
      <section className="mb-4">
        <h3 className="font-semibold text-lg">Scripts ({scripts.length})</h3>
        <div className="grid grid-cols-1 gap-4">
          {scripts.length > 0 ? (
            scripts.map((s) => (
              <LiteratureCardM
                key={s.documentId}
                documentId={s.documentId}
                title={s.title ?? "Untitled Script"}
                type="Script"
                metadata={s.type_metadata}
              />
            ))
          ) : (
            <p className="text-gray-500">No scripts available.</p>
          )}
        </div>
      </section>

      {/* Theses Section */}
      <section className="mb-4">
        <h3 className="font-semibold text-lg">Theses ({theses.length})</h3>
        <div className="grid grid-cols-1 gap-4">
          {theses.length > 0 ? (
            theses.map((t) => (
              <LiteratureCardM
                key={t.documentId}
                documentId={t.documentId}
                title={t.title ?? "Untitled Thesis"}
                type="Thesis"
                metadata={t.type_metadata}
              />
            ))
          ) : (
            <p className="text-gray-500">No theses available.</p>
          )}
        </div>
      </section>
    </div>
  );
}

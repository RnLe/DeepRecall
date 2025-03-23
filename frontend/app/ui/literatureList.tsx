// literatureList.tsx
import React from 'react';
import { useLiterature } from '../customHooks/useLiterature';
import LiteratureCardM from './literatureCardM';
import { Textbook, Paper, Script } from '../helpers/mediaTypes';

interface LiteratureListProps {
  className?: string;
}

export default function LiteratureList({ className }: LiteratureListProps) {
  const { data, isLoading, error } = useLiterature();

  if (isLoading) return <div className={`p-4 ${className}`}>Loading literature...</div>;
  if (error) return <div className={`p-4 text-red-600 ${className}`}>Error loading literature: {(error as Error).message}</div>;

  const textbooks = data?.textbooks ?? [];
  const papers = data?.papers ?? [];
  const scripts = data?.scripts ?? [];

  return (
    <div className={`p-4 bg-slate-100 overflow-auto ${className}`}>
      <h2 className="text-xl font-bold mb-4">Literature List</h2>

      {/* Textbooks Section */}
      <section className="mb-4">
        <h3 className="font-semibold text-lg">Textbooks ({textbooks.length})</h3>
        <div className="grid grid-cols-1 gap-4">
          {textbooks.length > 0 ? textbooks.map((tb: Textbook) => (
            <LiteratureCardM
              key={tb.id}
              id={tb.id}
              title={tb.title ?? "Untitled Textbook"}
              type="Textbook"
              versions={tb.textbook_versions || []}
            />
          )) : (
            <p className="text-gray-500">No textbooks available.</p>
          )}
        </div>
      </section>

      {/* Papers Section */}
      <section className="mb-4">
        <h3 className="font-semibold text-lg">Papers ({papers.length})</h3>
        <div className="grid grid-cols-1 gap-4">
          {papers.length > 0 ? papers.map((p: Paper) => (
            <LiteratureCardM
              key={p.id}
              id={p.id}
              title={p.title ?? "Untitled Paper"}
              type="Paper"
              versions={p.paper_versions || []}
            />
          )) : (
            <p className="text-gray-500">No papers available.</p>
          )}
        </div>
      </section>

      {/* Scripts Section */}
      <section>
        <h3 className="font-semibold text-lg">Scripts ({scripts.length})</h3>
        <div className="grid grid-cols-1 gap-4">
          {scripts.length > 0 ? scripts.map((s: Script) => (
            <LiteratureCardM
              key={s.id}
              id={s.id}
              title={s.title ?? "Untitled Script"}
              type="Script"
              versions={s.script_versions || []}
            />
          )) : (
            <p className="text-gray-500">No scripts available.</p>
          )}
        </div>
      </section>
    </div>
  );
}

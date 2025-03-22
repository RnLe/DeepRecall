import React from 'react';
import { useLiterature } from '../customHooks/useLiterature';

interface LiteratureItem {
  id: number;
  title: string;
  type: 'Paper' | 'Textbook' | 'Script';
}

interface LiteratureListProps {
  className?: string;
}

export default function LiteratureList({ className }: LiteratureListProps) {
  const { data, isLoading, error } = useLiterature();

  if (isLoading) return <div className={`p-4 ${className}`}>Loading literature...</div>;
  if (error) return <div className={`p-4 text-red-600 ${className}`}>Error loading literature: {(error as Error).message}</div>;

  const textbooks: LiteratureItem[] = data?.textbooks.map(tb => ({ id: tb.id, title: tb.title ?? 'Untitled Textbook', type: 'Textbook' })) ?? [];
  const papers: LiteratureItem[] = data?.papers.map(p => ({ id: p.id, title: p.title ?? 'Untitled Paper', type: 'Paper' })) ?? [];
  const scripts: LiteratureItem[] = data?.scripts.map(s => ({ id: s.id, title: s.title ?? 'Untitled Script', type: 'Script' })) ?? [];

  return (
    <div className={`p-4 bg-slate-100 overflow-auto ${className}`}>      
      <h2 className="text-xl font-bold mb-4">Literature List</h2>

      {/* Textbooks Section */}
      <section className="mb-4">
        <h3 className="font-semibold text-lg">Textbooks ({textbooks.length})</h3>
        <ul className="list-disc list-inside pl-2">
          {textbooks.length > 0 ? textbooks.map(item => <li key={item.id}>{item.title}</li>) : <li className="text-gray-500">No textbooks available.</li>}
        </ul>
      </section>

      {/* Papers Section */}
      <section className="mb-4">
        <h3 className="font-semibold text-lg">Papers ({papers.length})</h3>
        <ul className="list-disc list-inside pl-2">
          {papers.length > 0 ? papers.map(item => <li key={item.id}>{item.title}</li>) : <li className="text-gray-500">No papers available.</li>}
        </ul>
      </section>

      {/* Scripts Section */}
      <section>
        <h3 className="font-semibold text-lg">Scripts ({scripts.length})</h3>
        <ul className="list-disc list-inside pl-2">
          {scripts.length > 0 ? scripts.map(item => <li key={item.id}>{item.title}</li>) : <li className="text-gray-500">No scripts available.</li>}
        </ul>
      </section>
    </div>
  );
}

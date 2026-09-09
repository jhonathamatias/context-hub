import type { ChatReference } from '../api/types';
import { formatTimestamp } from '../lib/format';

export function ReferenceList({
  references,
}: {
  references: ChatReference[];
}) {
  if (references.length === 0) {
    return (
      <p className="text-sm text-stone-500">
        Nenhuma referência retornada para esta resposta.
      </p>
    );
  }

  return (
    <ul className="space-y-3">
      {references.map((reference) => (
        <li
          key={`${reference.chunkId}-${reference.index}`}
          className="border-l-2 border-stone-400 pl-3"
        >
          <p className="text-sm font-medium">
            [{reference.index}] {reference.sourceName} ·{' '}
            {formatTimestamp(reference.startSeconds)}–
            {formatTimestamp(reference.endSeconds)}
          </p>
          <p className="mt-1 text-sm text-stone-600">{reference.excerpt}</p>
        </li>
      ))}
    </ul>
  );
}

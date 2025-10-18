import { KBarResults, useMatches } from 'kbar';
import ResultItem from './result-item';

export default function RenderResults() {
  const { results, rootActionId } = useMatches();

  // Separate results into Quick Access (with shortcuts) and General (without shortcuts)
  const quickAccessResults: typeof results = [];
  const generalResults: typeof results = [];

  results.forEach((item) => {
    if (typeof item === 'string') {
      // Skip string items (section headers from original data)
      return;
    }
    // Check if item has a shortcut property
    if ((item as any).shortcut && (item as any).shortcut.length > 0) {
      quickAccessResults.push(item);
    } else {
      generalResults.push(item);
    }
  });

  // Combine with section headers
  const organizedResults: typeof results = [];
  
  if (quickAccessResults.length > 0) {
    organizedResults.push('Quick Access' as any);
    organizedResults.push(...quickAccessResults);
  }
  
  if (generalResults.length > 0) {
    organizedResults.push('General' as any);
    organizedResults.push(...generalResults);
  }

  return (
    <KBarResults
      items={organizedResults}
      onRender={({ item, active }) =>
        typeof item === 'string' ? (
          <div className="text-secondary-foreground px-4 py-2 text-sm font-semibold uppercase">
            {item}
          </div>
        ) : (
          <ResultItem action={item} active={active} currentRootActionId={rootActionId ?? ''} />
        )
      }
    />
  );
}


import { SAMPLE_QUERIES } from '../../api/mock-data';

interface SamplePromptsProps {
  onSelect: (query: string) => void;
  disabled?: boolean;
}

export default function SamplePrompts({ onSelect, disabled }: SamplePromptsProps) {
  return (
    <div className="sample-prompts">
      <h4 className="sample-prompts-title">Try a demo query</h4>
      <div className="sample-prompts-grid">
        {SAMPLE_QUERIES.map((item, i) => (
          <button
            key={i}
            className="sample-prompt-btn"
            onClick={() => onSelect(item.query)}
            disabled={disabled}
            aria-label={`Sample query: ${item.query}`}
          >
            <span className="sample-prompt-label">{item.label}</span>
            <span className="sample-prompt-text">{item.query}</span>
          </button>
        ))}
      </div>
    </div>
  );
}

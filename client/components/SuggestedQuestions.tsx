/** Empty-chat starters: one click asks the question (F4). */

export const SUGGESTED_QUESTIONS = [
  "What kind of role is Troy looking for?",
  "Tell me about the UN Esplanade project",
  "What size of projects has he worked on?",
  "Is he authorized to work in the US?",
  "Show me the Kosciuszko Bridge simulations",
];

interface Props {
  onAsk(question: string): void;
  compact: boolean;
}

export default function SuggestedQuestions({ onAsk, compact }: Props) {
  return (
    <section aria-labelledby="suggested-title" className={compact ? "px-1 py-3" : "py-8"}>
      <h2 id="suggested-title" className={`font-semibold text-slate-900 ${compact ? "text-base" : "text-xl"}`}>
        Hi, I'm Troy's AI assistant.
      </h2>
      <p className="mt-1 text-sm text-slate-600">
        Ask me about Troy's experience, projects, skills or availability. Try one of these:
      </p>
      <ul className="mt-4 grid gap-2 sm:grid-cols-2">
        {SUGGESTED_QUESTIONS.map((q) => (
          <li key={q}>
            <button
              type="button"
              onClick={() => onAsk(q)}
              className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-left text-sm text-slate-800 shadow-sm transition hover:border-blue-600 hover:bg-blue-50"
            >
              {q}
            </button>
          </li>
        ))}
      </ul>
    </section>
  );
}

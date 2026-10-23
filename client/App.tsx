/** App shell: standalone page (header, disclaimer) or compact embed layout for the portfolio panel (F8). */
import { useMemo } from "react";
import ChatInput from "./components/ChatInput";
import Header from "./components/Header";
import MessageList from "./components/MessageList";
import SuggestedQuestions from "./components/SuggestedQuestions";
import type { ChatApi } from "./services/chatApi";
import { useChat } from "./state/useChat";

interface AppProps {
  embed: boolean;
  api: ChatApi;
}

const DISCLAIMER = "AI answers based on Troy's knowledge base — please verify important details with Troy.";

export default function App({ embed, api }: AppProps) {
  const { messages, busy, send, stop, reset } = useChat(api);
  const fullPageUrl = useMemo(() => window.location.origin + window.location.pathname, []);

  return (
    <div className="flex h-dvh flex-col bg-slate-50">
      {!embed && <Header />}
      {embed && (
        <div className="flex items-center justify-between border-b border-slate-200 bg-white px-3 py-1.5 text-xs text-slate-600">
          <span>
            <span className="font-medium text-blue-800">AI assistant</span> ·{" "}
            <span className="hidden sm:inline">answers from </span>Troy's knowledge base
          </span>
          <a className="link" href={fullPageUrl} target="_blank" rel="noreferrer">
            Open full page
          </a>
        </div>
      )}
      <main className="flex-1 overflow-y-auto">
        <div className={`mx-auto max-w-3xl ${embed ? "px-3" : "px-4"}`}>
          {messages.length === 0 ? <SuggestedQuestions onAsk={send} compact={embed} /> : <MessageList messages={messages} />}
        </div>
      </main>
      <div className="mx-auto w-full max-w-3xl">
        <ChatInput busy={busy} canReset={messages.length > 0} onSend={send} onStop={stop} onReset={reset} />
        {!embed && <p className="px-4 pb-2 text-center text-xs text-slate-600">{DISCLAIMER}</p>}
      </div>
    </div>
  );
}

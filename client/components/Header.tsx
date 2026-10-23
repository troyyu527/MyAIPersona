/** Standalone page header: avatar, name, AI label, disclaimer and contact links. */
import { CONTACT } from "../../shared/prompt";

export default function Header() {
  return (
    <header className="border-b border-slate-200 bg-white">
      <div className="mx-auto flex max-w-3xl flex-wrap items-center gap-x-4 gap-y-2 px-4 py-3">
        <div
          aria-hidden="true"
          className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-blue-700 text-base font-semibold text-white"
        >
          TY
        </div>
        <div className="min-w-0 flex-1">
          <h1 className="text-lg font-semibold leading-tight text-slate-900">Troy Yu</h1>
          <p className="text-sm text-slate-600">
            <span className="mr-1 rounded bg-blue-50 px-1.5 py-0.5 text-xs font-medium text-blue-800">AI assistant</span>
            answers from Troy's knowledge base
          </p>
        </div>
        <nav aria-label="Contact Troy" className="flex w-full gap-4 pl-15 text-sm sm:w-auto sm:pl-0">
          <a className="link" href={`mailto:${CONTACT.email}`}>
            Email
          </a>
          <a className="link" href={CONTACT.linkedin} target="_blank" rel="noreferrer">
            LinkedIn
          </a>
          <a className="link" href="https://troyyu527.github.io/ReactWebsite" target="_blank" rel="noreferrer">
            Portfolio
          </a>
        </nav>
      </div>
    </header>
  );
}

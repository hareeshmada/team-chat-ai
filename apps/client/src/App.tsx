import { APP_NAME } from '@teamchat/shared';

export function App() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-slate-950 text-slate-100">
      <h1 className="text-3xl font-semibold tracking-tight">{APP_NAME}</h1>
    </main>
  );
}

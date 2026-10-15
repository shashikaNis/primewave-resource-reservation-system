import LoginForm from "./login-form";

export default function LoginPage() {
  return (
    <main className="flex flex-1 items-center justify-center px-4">
      <div className="w-full max-w-sm rounded-lg border border-border bg-surface p-6 shadow-sm">
        <h1 className="text-2xl font-semibold">Resource Reservations</h1>
        <p className="mb-6 text-sm text-muted">Log in to book rooms and equipment.</p>
        <LoginForm />
      </div>
    </main>
  );
}

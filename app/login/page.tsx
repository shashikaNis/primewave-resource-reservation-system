import LoginForm from "./login-form";

export default function LoginPage() {
  return (
    <main className="flex flex-1 items-center justify-center px-4">
      <div className="w-full max-w-sm rounded-lg border border-zinc-200 p-6 shadow-sm dark:border-zinc-800">
        <h1 className="text-2xl font-semibold">Resource Reservations</h1>
        <p className="mb-6 text-sm text-zinc-500">Log in to book rooms and equipment.</p>
        <LoginForm />
      </div>
    </main>
  );
}

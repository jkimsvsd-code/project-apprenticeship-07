import AuthForm from "@/src/features/auth/AuthForm";
export const dynamic = "force-dynamic";
export default function Login() {
  return (
    <main className="auth-page">
      <AuthForm />
    </main>
  );
}

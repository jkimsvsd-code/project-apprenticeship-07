import AuthForm from "@/src/features/auth/AuthForm";
export const dynamic = "force-dynamic";
export default function Signup() {
  return (
    <main className="auth-page">
      <AuthForm signup />
    </main>
  );
}

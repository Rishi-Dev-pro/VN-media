import AuthForm from '../components/auth/AuthForm';
import AuthShell from '../components/auth/AuthShell';
import AuthVisual from '../components/auth/AuthVisual';
import '../components/auth/auth.css';

export default function LoginPage() {
  return (
    <AuthShell>
      <AuthVisual />
      <AuthForm />
    </AuthShell>
  );
}

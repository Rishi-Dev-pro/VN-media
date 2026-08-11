import AuthShell from '../components/auth/AuthShell';
import RegisterForm from '../components/auth/RegisterForm';
import RegisterVisual from '../components/auth/RegisterVisual';
import '../components/auth/auth.css';

export default function RegisterPage() {
  return (
    <AuthShell variant="register">
      <RegisterVisual />
      <RegisterForm />
    </AuthShell>
  );
}

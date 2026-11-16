import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';
import { Navigate, useNavigate } from 'react-router-dom';
import { PASSWORD_POLICY } from '@/shared';
import { z } from 'zod';
import { Button, Input } from '@/components/ui';
import { errorMessage } from '@/lib/api';
import { AuthLayout } from '@/layouts/AuthLayout';
import { passwordSchema, pendingPasswordChange, useChangePassword } from '../api';
import { useAuth } from '../auth-context';

const schema = z
  .object({ currentPassword: z.string().min(1, 'Obligatoire'), newPassword: passwordSchema, confirm: z.string() })
  .refine((v) => v.newPassword === v.confirm, { path: ['confirm'], message: 'Les mots de passe ne correspondent pas' });

/** First login: the temporary password must be replaced (restricted token, see the API). */
export function ChangePasswordPage() {
  const pending = pendingPasswordChange.get();
  const { signIn } = useAuth();
  const navigate = useNavigate();
  const change = useChangePassword();
  const { register, handleSubmit, formState } = useForm<z.infer<typeof schema>>({ resolver: zodResolver(schema) });

  if (!pending) return <Navigate to="/login" replace />;

  const onSubmit = handleSubmit(({ currentPassword, newPassword }) =>
    change.mutate(
      { currentPassword, newPassword, token: pending.token },
      {
        onSuccess: (result) => {
          pendingPasswordChange.clear();
          signIn(result.accessToken, result.user);
          navigate('/', { replace: true });
        },
      },
    ),
  );

  return (
    <AuthLayout title="Choisissez votre mot de passe" subtitle={`Première connexion de ${pending.email}`}>
      <form onSubmit={onSubmit} className="space-y-4" noValidate>
        <Input label="Mot de passe temporaire (reçu par email)" type="password" autoComplete="current-password" required error={formState.errors.currentPassword?.message} {...register('currentPassword')} />
        <Input label="Nouveau mot de passe" type="password" autoComplete="new-password" hint={PASSWORD_POLICY.description} required error={formState.errors.newPassword?.message} {...register('newPassword')} />
        <Input label="Confirmation" type="password" autoComplete="new-password" required error={formState.errors.confirm?.message} {...register('confirm')} />
        {change.isError && <p role="alert" className="text-sm font-medium text-red-600">{errorMessage(change.error)}</p>}
        <Button type="submit" className="w-full" loading={change.isPending}>Valider et continuer</Button>
      </form>
    </AuthLayout>
  );
}

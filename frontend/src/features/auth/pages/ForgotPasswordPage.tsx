import { zodResolver } from '@hookform/resolvers/zod';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { Link, useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { PASSWORD_POLICY } from '@/shared';
import { z } from 'zod';
import { Button, Input } from '@/components/ui';
import { errorMessage } from '@/lib/api';
import { AuthLayout } from '@/layouts/AuthLayout';
import { passwordSchema, useForgotPassword, useResetPassword } from '../api';

const emailSchema = z.object({ email: z.string().trim().email('Email invalide') });
const resetSchema = z
  .object({ code: z.string().regex(/^\d{6}$/, 'Code à 6 chiffres'), newPassword: passwordSchema, confirm: z.string() })
  .refine((v) => v.newPassword === v.confirm, { path: ['confirm'], message: 'Les mots de passe ne correspondent pas' });

/** Two steps: email → code received + new password. */
export function ForgotPasswordPage() {
  const [email, setEmail] = useState<string | null>(null);
  const navigate = useNavigate();
  const forgot = useForgotPassword();
  const reset = useResetPassword();
  const emailForm = useForm<z.infer<typeof emailSchema>>({ resolver: zodResolver(emailSchema) });
  const resetForm = useForm<z.infer<typeof resetSchema>>({ resolver: zodResolver(resetSchema) });

  const sendCode = emailForm.handleSubmit((v) => forgot.mutate(v.email, { onSuccess: () => setEmail(v.email) }));
  const submitReset = resetForm.handleSubmit((v) =>
    reset.mutate(
      { email: email!, code: v.code, newPassword: v.newPassword },
      {
        onSuccess: () => {
          toast.success('Mot de passe réinitialisé. Vous pouvez vous connecter.');
          navigate('/login');
        },
      },
    ),
  );

  return (
    <AuthLayout
      title="Mot de passe oublié"
      subtitle={email ? `Si un compte existe pour ${email}, un code vient d’être envoyé.` : 'Recevez un code de réinitialisation par email.'}
    >
      {!email ? (
        <form onSubmit={sendCode} className="space-y-4" noValidate>
          <Input label="Email" type="email" autoComplete="email" required error={emailForm.formState.errors.email?.message} {...emailForm.register('email')} />
          {forgot.isError && <p role="alert" className="text-sm text-red-600">{errorMessage(forgot.error)}</p>}
          <Button type="submit" className="w-full" loading={forgot.isPending}>Recevoir un code</Button>
        </form>
      ) : (
        <form onSubmit={submitReset} className="space-y-4" noValidate>
          <Input label="Code reçu" inputMode="numeric" autoComplete="one-time-code" maxLength={6} required error={resetForm.formState.errors.code?.message} {...resetForm.register('code')} />
          <Input label="Nouveau mot de passe" type="password" autoComplete="new-password" hint={PASSWORD_POLICY.description} required error={resetForm.formState.errors.newPassword?.message} {...resetForm.register('newPassword')} />
          <Input label="Confirmation" type="password" autoComplete="new-password" required error={resetForm.formState.errors.confirm?.message} {...resetForm.register('confirm')} />
          {reset.isError && <p role="alert" className="text-sm text-red-600">{errorMessage(reset.error)}</p>}
          <Button type="submit" className="w-full" loading={reset.isPending}>Réinitialiser</Button>
        </form>
      )}
      <Link to="/login" className="mt-4 block text-center text-sm font-medium text-brand-700 hover:underline">Retour à la connexion</Link>
    </AuthLayout>
  );
}

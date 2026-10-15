import { zodResolver } from '@hookform/resolvers/zod';
import { Lock, Mail, MonitorPlay } from 'lucide-react';
import { useForm } from 'react-hook-form';
import { Link, Navigate, useNavigate } from 'react-router-dom';
import { isPasswordChangeRequired, ROLE_LABELS } from '@/shared';
import { z } from 'zod';
import { Button, Input } from '@/components/ui';
import { errorMessage } from '@/lib/api';
import { cn } from '@/lib/cn';
import { ROLE_TONES } from '@/lib/roles-ui';
import { AuthLayout } from '@/layouts/AuthLayout';
import { pendingPasswordChange, useLogin } from '../api';
import { enPhrase, useDemoInfo, useDemoLogin } from '../../demo/sandbox';
import { useAuth } from '../auth-context';

const schema = z.object({
  email: z.string().trim().email('Email invalide'),
  password: z.string().min(1, 'Mot de passe obligatoire'),
});

export function LoginPage() {
  const { user, signIn, sessionExpired } = useAuth();
  const navigate = useNavigate();
  const login = useLogin();
  const { register, handleSubmit, formState } = useForm<z.infer<typeof schema>>({ resolver: zodResolver(schema) });
  const demo = useDemoInfo();
  const demoLogin = useDemoLogin();

  if (user) return <Navigate to="/" replace />;

  const onSubmit = handleSubmit((values) =>
    login.mutate(values, {
      onSuccess: (result) => {
        if (isPasswordChangeRequired(result)) {
          pendingPasswordChange.save(result.passwordChangeToken, values.email);
          navigate('/changer-mot-de-passe');
          return;
        }
        signIn(result.accessToken, result.user);
        navigate('/', { replace: true });
      },
    }),
  );

  return (
    <AuthLayout title="Bienvenue 👋" subtitle="Connectez-vous à votre espace">
      {sessionExpired && (
        <p role="status" className="mb-4 rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-800">
          Votre session a expiré. Reconnectez-vous.
        </p>
      )}
      <form onSubmit={onSubmit} className="space-y-4" noValidate>
        <Input label="Email" type="email" icon={<Mail />} placeholder="votre@email.fr" autoComplete="email" required error={formState.errors.email?.message} {...register('email')} />
        <Input label="Mot de passe" type="password" icon={<Lock />} placeholder="••••••••" autoComplete="current-password" required error={formState.errors.password?.message} {...register('password')} />
        {login.isError && <p role="alert" className="text-sm font-medium text-red-600">{errorMessage(login.error)}</p>}
        <Button type="submit" size="lg" className="mt-2 w-full font-semibold" loading={login.isPending}>Se connecter</Button>
        <Link to="/mot-de-passe-oublie" className="block text-center text-sm font-medium text-brand-700 hover:underline">
          Mot de passe oublié ?
        </Link>
      </form>

      {demo.data?.actif && (
        <section className="mt-6 border-t border-gray-200 pt-5" aria-labelledby="demo-title">
          <h2 id="demo-title" className="flex items-center gap-2 text-sm font-semibold text-gray-800">
            <MonitorPlay className="size-4 text-purple-600" /> Démo en ligne : entrez sans mot de passe
          </h2>
          <p className="mt-1 text-xs text-gray-500">Données fictives, remises à zéro {enPhrase(demo.data.reinitialisation)}. Aucun email n’est envoyé.</p>
          <div className="mt-3 grid grid-cols-2 gap-2">
            {demo.data.comptes.map((c) => (
              <button
                key={c.role}
                type="button"
                disabled={demoLogin.isPending}
                onClick={() =>
                  demoLogin.mutate(c.role, {
                    onSuccess: (session) => {
                      signIn(session.accessToken, session.user);
                      navigate('/', { replace: true });
                    },
                  })
                }
                className="flex flex-col items-start rounded-lg border border-gray-200 px-3 py-2 text-left hover:border-brand-500 hover:bg-brand-100/40 disabled:opacity-60"
              >
                <span className={cn('rounded-full px-2 py-0.5 text-[11px] font-semibold', ROLE_TONES[c.role].badge)}>{ROLE_LABELS[c.role]}</span>
                <span className="mt-1 text-xs text-gray-600">{c.nom}</span>
              </button>
            ))}
          </div>
          {demoLogin.isError && <p role="alert" className="mt-2 text-sm text-red-600">{errorMessage(demoLogin.error)}</p>}
        </section>
      )}
    </AuthLayout>
  );
}

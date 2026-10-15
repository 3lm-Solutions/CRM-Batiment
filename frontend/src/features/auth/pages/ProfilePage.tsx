import { zodResolver } from '@hookform/resolvers/zod';
import { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { toast } from 'sonner';
import { PASSWORD_POLICY, ROLE_LABELS, type Role } from '@/shared';
import { z } from 'zod';
import { SignaturePad } from '@/components/signature/SignaturePad';
import { Button, Card, CardHeader, ErrorState, Input, Loading, PageHeader } from '@/components/ui';
import { errorMessage } from '@/lib/api';
import { formatDateTime } from '@/lib/format';
import { passwordSchema, useChangePassword, useProfile, useSaveSignature, useSignature, useUpdateProfile } from '../api';
import { useAuth } from '../auth-context';
import { zPhone } from '@/lib/validation';

const profileSchema = z.object({ prenom: z.string().trim().min(1, 'Obligatoire'), nom: z.string().trim().min(1, 'Obligatoire'), telephone: zPhone });
const passwordFormSchema = z
  .object({ currentPassword: z.string().min(1, 'Obligatoire'), newPassword: passwordSchema, confirm: z.string() })
  .refine((v) => v.newPassword === v.confirm, { path: ['confirm'], message: 'Les mots de passe ne correspondent pas' });

export function ProfilePage() {
  const { hasRole, signIn } = useAuth();
  const isStaff = hasRole('ADMIN', 'TECHNICO', 'ASSISTANTE', 'CHEF_CHANTIER');
  const profile = useProfile();
  const update = useUpdateProfile();
  const change = useChangePassword();
  const signature = useSignature(isStaff);
  const saveSignature = useSaveSignature();
  const [drawn, setDrawn] = useState<string | null>(null);

  const profileForm = useForm<z.infer<typeof profileSchema>>({ resolver: zodResolver(profileSchema) });
  const passwordForm = useForm<z.infer<typeof passwordFormSchema>>({ resolver: zodResolver(passwordFormSchema) });
  const { reset } = profileForm;

  useEffect(() => {
    if (profile.data) reset({ prenom: profile.data.prenom, nom: profile.data.nom, telephone: profile.data.telephone ?? '' });
  }, [profile.data, reset]);

  if (profile.isPending) return <Loading />;
  if (profile.isError) return <ErrorState error={profile.error} onRetry={() => void profile.refetch()} />;
  const me = profile.data;

  return (
    <>
      <PageHeader title="Mon profil" description={`${ROLE_LABELS[me.role as Role]} · ${me.company.nom} · dernière connexion ${formatDateTime(me.lastLoginAt)}`} />
      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader title="Informations" description={me.email} />
          <form
            className="space-y-4 p-5"
            onSubmit={profileForm.handleSubmit((v) =>
              update.mutate({ ...v, telephone: v.telephone || null }, { onSuccess: () => toast.success('Profil mis à jour') }),
            )}
          >
            <div className="grid gap-4 sm:grid-cols-2">
              <Input label="Prénom" required error={profileForm.formState.errors.prenom?.message} {...profileForm.register('prenom')} />
              <Input label="Nom" required error={profileForm.formState.errors.nom?.message} {...profileForm.register('nom')} />
            </div>
            <Input label="Téléphone" type="tel" error={profileForm.formState.errors.telephone?.message} {...profileForm.register('telephone')} />
            {update.isError && <p role="alert" className="text-sm text-red-600">{errorMessage(update.error)}</p>}
            <Button type="submit" loading={update.isPending}>Enregistrer</Button>
          </form>
        </Card>

        <Card>
          <CardHeader title="Mot de passe" description="Changer votre mot de passe ferme vos autres sessions." />
          <form
            className="space-y-4 p-5"
            onSubmit={passwordForm.handleSubmit(({ currentPassword, newPassword }) =>
              change.mutate(
                { currentPassword, newPassword },
                {
                  onSuccess: (result) => {
                    signIn(result.accessToken, result.user); // the previous token was revoked
                    passwordForm.reset();
                    toast.success('Mot de passe modifié');
                  },
                },
              ),
            )}
          >
            <Input label="Mot de passe actuel" type="password" autoComplete="current-password" error={passwordForm.formState.errors.currentPassword?.message} {...passwordForm.register('currentPassword')} />
            <Input label="Nouveau mot de passe" type="password" autoComplete="new-password" hint={PASSWORD_POLICY.description} error={passwordForm.formState.errors.newPassword?.message} {...passwordForm.register('newPassword')} />
            <Input label="Confirmation" type="password" autoComplete="new-password" error={passwordForm.formState.errors.confirm?.message} {...passwordForm.register('confirm')} />
            {change.isError && <p role="alert" className="text-sm text-red-600">{errorMessage(change.error)}</p>}
            <Button type="submit" loading={change.isPending}>Modifier</Button>
          </form>
        </Card>

        {isStaff && (
          <Card className="lg:col-span-2">
            <CardHeader title="Ma signature" description="Apposée sur les devis que vous signez en tant que conseiller." />
            <div className="grid gap-6 p-5 md:grid-cols-2">
              <div>
                <p className="mb-2 text-sm font-medium">Signature actuelle</p>
                {signature.data?.signatureBase64 ? (
                  <img src={signature.data.signatureBase64} alt="Votre signature enregistrée" className="h-32 rounded-xl border border-slate-200 bg-white object-contain p-2" />
                ) : (
                  <p className="text-sm text-slate-500">Aucune signature enregistrée.</p>
                )}
              </div>
              <div>
                <SignaturePad onChange={setDrawn} height={140} />
                <Button
                  className="mt-2"
                  disabled={!drawn}
                  loading={saveSignature.isPending}
                  onClick={() =>
                    saveSignature.mutate(drawn!, {
                      onSuccess: () => {
                        toast.success('Signature enregistrée');
                        void signature.refetch();
                      },
                      onError: (e) => toast.error(errorMessage(e)),
                    })
                  }
                >
                  Enregistrer cette signature
                </Button>
              </div>
            </div>
          </Card>
        )}
      </div>
    </>
  );
}

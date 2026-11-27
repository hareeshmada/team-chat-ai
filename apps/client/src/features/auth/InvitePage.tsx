import { acceptInviteResponseSchema, invitePreviewResponseSchema } from '@teamchat/shared';
import { useMutation, useQuery } from '@tanstack/react-query';
import { useEffect } from 'react';
import { Navigate, useNavigate, useParams } from 'react-router';
import { Button } from '../../components/ui/Button';
import { FormError } from '../../components/ui/FormError';
import { TerminalCard } from '../../components/ui/TerminalCard';
import { api, ApiError } from '../../lib/api';
import { queryClient } from '../../lib/queryClient';
import { useAuthStore } from '../../stores/auth';
import { queryKeys } from '../chat/queries';
import { setLastWorkspace } from '../workspace/lastWorkspace';
import { AuthLayout } from './AuthLayout';
import { FeaturesShowcase } from './BrandShowcase';
import { LoadingScreen } from './LoadingScreen';
import { RegisterPage } from './RegisterPage';

/**
 * /invite/:token, the link in the invite email (Step 5.2).
 * - Signed out: sign-up with a banner and the invited email locked; signing up joins.
 * - Signed in (or right after that sign-up): accept the invite and open the workspace.
 * Accepting is idempotent, so running it after a sign-up that already joined is harmless.
 */
export function InvitePage() {
  const token = useParams().token ?? '';
  const status = useAuthStore((s) => s.status);

  if (status === 'loading') return <LoadingScreen />;
  return status === 'authenticated' ? (
    <AcceptInvite token={token} />
  ) : (
    <InviteSignUp token={token} />
  );
}

const invalidMessage = 'This invite link is invalid or has expired. Ask for a new invite.';

function InviteSignUp({ token }: { token: string }) {
  const preview = useQuery({
    queryKey: ['invite', token],
    queryFn: async ({ signal }) =>
      (await api(`/invites/${token}`, { signal, auth: false }, invitePreviewResponseSchema)).invite,
    retry: false,
  });

  if (preview.isPending) return <LoadingScreen />;
  if (preview.isError) {
    // Still a normal sign-up: they can create an account and be invited again.
    return <RegisterPage notice={<FormError>{invalidMessage}</FormError>} />;
  }
  return <RegisterPage invite={{ token, preview: preview.data }} />;
}

function AcceptInvite({ token }: { token: string }) {
  const navigate = useNavigate();
  const accept = useMutation({
    mutationFn: () =>
      api(`/invites/${token}/accept`, { method: 'POST' }, acceptInviteResponseSchema),
    onSuccess: ({ workspaceId }) => {
      setLastWorkspace(workspaceId);
      void queryClient.invalidateQueries({ queryKey: queryKeys.workspaces });
    },
  });
  const { mutate } = accept;

  useEffect(() => {
    mutate();
  }, [mutate]);

  if (accept.isSuccess) return <Navigate to={`/app/${accept.data.workspaceId}`} replace />;
  if (!accept.isError) return <LoadingScreen />;

  const message =
    accept.error instanceof ApiError && accept.error.code === 'INVITE_EMAIL_MISMATCH'
      ? `${accept.error.message}. Sign in with that account to join.`
      : accept.error instanceof ApiError && accept.error.code === 'INVITE_NOT_FOUND'
        ? invalidMessage
        : 'Could not accept the invite. Try again in a moment.';

  return (
    <AuthLayout headline="Set up your team in under a minute." showcase={<FeaturesShowcase />}>
      <TerminalCard title="teamchat invite" prompt>
        <div className="flex flex-col gap-4">
          <h1 className="text-[22px] leading-[1.3] font-semibold">Couldn’t join</h1>
          <FormError>{message}</FormError>
          <Button onClick={() => navigate('/app', { replace: true })}>Open TeamChat</Button>
        </div>
      </TerminalCard>
    </AuthLayout>
  );
}

import { zodResolver } from '@hookform/resolvers/zod';
import {
  createChannelSchema,
  type CreateChannelData,
  type CreateChannelInput,
} from '@teamchat/shared';
import { useForm } from 'react-hook-form';
import { useNavigate } from 'react-router';
import { Button } from '../../components/ui/Button';
import { CheckboxCard } from '../../components/ui/CheckboxCard';
import { FormError } from '../../components/ui/FormError';
import { Input } from '../../components/ui/Input';
import { Label } from '../../components/ui/Label';
import { Modal } from '../../components/ui/Modal';
import { Textarea } from '../../components/ui/Textarea';
import { applyServerError } from '../auth/serverErrors';
import { useCreateChannel } from './queries';
import { useShell } from './shellContext';

export function CreateChannelModal({ onClose }: { onClose: () => void }) {
  const { workspace } = useShell();
  const createChannel = useCreateChannel(workspace.id);
  const navigate = useNavigate();
  const {
    register,
    handleSubmit,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<CreateChannelInput, unknown, CreateChannelData>({
    resolver: zodResolver(createChannelSchema),
    mode: 'onTouched',
    defaultValues: { name: '', description: '', isPrivate: false },
  });

  const nameField = register('name');

  const onSubmit = handleSubmit(async (values) => {
    try {
      const channel = await createChannel.mutateAsync(values);
      onClose();
      navigate(`/app/${workspace.id}/${channel.id}`);
    } catch (err) {
      applyServerError(err, setError, ['name', 'description'], { CHANNEL_NAME_TAKEN: 'name' });
    }
  });

  return (
    <Modal
      title="Create a channel"
      onClose={onClose}
      footer={
        <>
          <Button variant="secondary" className="h-10" onClick={onClose}>
            Cancel
          </Button>
          <Button
            type="submit"
            form="create-channel"
            enterHint={!isSubmitting}
            disabled={isSubmitting}
            className="h-10"
          >
            {isSubmitting ? 'Creating…' : 'Create channel'}
          </Button>
        </>
      }
    >
      <form id="create-channel" onSubmit={onSubmit} noValidate className="flex flex-col gap-4">
        {errors.root?.server && <FormError>{errors.root.server.message}</FormError>}
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="channel-name">name</Label>
          <Input
            id="channel-name"
            leading="#"
            mono
            autoComplete="off"
            placeholder="design-reviews"
            aria-describedby="channel-name-hint"
            error={errors.name?.message}
            {...nameField}
            // Channel names are lowercase with dashes: convert as you type ("Design Reviews" → "design-reviews").
            onChange={(e) => {
              e.target.value = e.target.value.toLowerCase().replace(/\s/g, '-');
              void nameField.onChange(e);
            }}
          />
          {!errors.name && (
            <span id="channel-name-hint" className="text-xs text-muted">
              1–40 characters: lowercase letters, numbers, - and _.
            </span>
          )}
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="channel-description">
            description <span className="text-subtle">(optional)</span>
          </Label>
          <Textarea
            id="channel-description"
            rows={2}
            placeholder="What is this channel about?"
            error={errors.description?.message}
            {...register('description')}
          />
        </div>
        <CheckboxCard
          title="Make private"
          description="Only invited members can see and join this channel."
          {...register('isPrivate')}
        />
      </form>
    </Modal>
  );
}

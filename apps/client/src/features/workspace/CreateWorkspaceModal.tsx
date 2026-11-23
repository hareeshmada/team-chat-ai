import { useNavigate } from 'react-router';
import { Button } from '../../components/ui/Button';
import { Modal } from '../../components/ui/Modal';
import { CreateWorkspaceForm } from './CreateWorkspaceForm';

export function CreateWorkspaceModal({ onClose }: { onClose: () => void }) {
  const navigate = useNavigate();
  return (
    <Modal
      title="Create a workspace"
      onClose={onClose}
      footer={
        <>
          <Button variant="secondary" className="h-10" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" form="create-workspace" enterHint className="h-10">
            Create workspace
          </Button>
        </>
      }
    >
      <CreateWorkspaceForm
        id="create-workspace"
        onCreated={(workspace) => {
          onClose();
          navigate(`/app/${workspace.id}`);
        }}
      />
    </Modal>
  );
}

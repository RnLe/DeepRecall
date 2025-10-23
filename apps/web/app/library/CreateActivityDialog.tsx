/**
 * CreateActivityDialog - Next.js Wrapper
 * Wraps the platform-agnostic CreateActivityDialog with Electric hooks
 */

"use client";

import { CreateActivityDialog as CreateActivityDialogUI } from "@deeprecall/ui";
import { useCreateActivity } from "@deeprecall/data/hooks";

interface CreateActivityDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

export function CreateActivityDialog(props: CreateActivityDialogProps) {
  const createActivityMutation = useCreateActivity();

  return (
    <CreateActivityDialogUI
      {...props}
      onCreateActivity={async (activity) => {
        await createActivityMutation.mutateAsync(activity);
      }}
      isCreating={createActivityMutation.isPending}
    />
  );
}

"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Dialog } from "@/components/ui/dialog";
import { Button, Input, TextArea } from "@/components/ui";
import { createClient } from "@/lib/supabase/client";
import { setActiveWorkspaceCookie } from "@/lib/workspace-cookie";

interface NewProductDialogProps {
  open: boolean;
  onClose: () => void;
}

export function NewProductDialog({ open, onClose }: NewProductDialogProps) {
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [creating, setCreating] = useState(false);
  const router = useRouter();
  const supabase = createClient();

  async function handleCreate() {
    if (!name.trim() || creating) return;
    setCreating(true);

    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      setCreating(false);
      return;
    }

    const { data: ws } = await supabase
      .from("workspaces")
      .insert({
        user_id: user.id,
        name: name.trim(),
        product_description: description.trim() || null,
        principles: [],
      })
      .select("id")
      .single();

    if (ws) {
      setActiveWorkspaceCookie(ws.id);
      onClose();
      setName("");
      setDescription("");
      router.refresh();
    }

    setCreating(false);
  }

  function handleClose() {
    if (!creating) {
      setName("");
      setDescription("");
      onClose();
    }
  }

  return (
    <Dialog open={open} onClose={handleClose}>
      <h2 className="text-lg font-bold tracking-tight">New Product</h2>
      <div className="mt-6 space-y-5">
        <Input
          label="Product name"
          placeholder="Acme"
          value={name}
          onChange={(e) => setName(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") handleCreate();
          }}
        />
        <TextArea
          label="Description"
          placeholder="Describe your product..."
          value={description}
          onChange={(e) => setDescription(e.target.value)}
        />
      </div>
      <div className="mt-8 flex justify-end gap-3">
        <Button variant="ghost" onClick={handleClose} disabled={creating}>
          Cancel
        </Button>
        <Button onClick={handleCreate} disabled={!name.trim() || creating}>
          {creating ? "Creating..." : "Create Product"}
        </Button>
      </div>
    </Dialog>
  );
}

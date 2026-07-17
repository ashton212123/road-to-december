"use server";

import { revalidatePath } from "next/cache";
import { syncCanvasData } from "@/lib/canvas/sync";
import { CanvasAuthError, CanvasError } from "@/lib/canvas/client";

export async function refreshCanvasAction(): Promise<{ error: string | null }> {
  try {
    await syncCanvasData();
  } catch (err) {
    const error =
      err instanceof CanvasAuthError || err instanceof CanvasError ? err.message : "Failed to sync Canvas data.";
    return { error };
  }
  revalidatePath("/school");
  revalidatePath("/home");
  return { error: null };
}

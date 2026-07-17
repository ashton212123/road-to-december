"use server";

import { revalidatePath } from "next/cache";
import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { businesses, businessTransactions, businessTasks, businessNotes } from "@/lib/db/schema";
import { todayManilaISO } from "@/lib/time";

export async function createBusinessAction(input: { name: string; description: string | null }) {
  const [created] = await db
    .insert(businesses)
    .values({ name: input.name, description: input.description })
    .returning();
  revalidatePath("/business");
  return created;
}

export async function setBusinessArchivedAction(businessId: number, archived: boolean) {
  await db.update(businesses).set({ archived }).where(eq(businesses.id, businessId));
  revalidatePath("/business");
  revalidatePath(`/business/${businessId}`);
}

export async function deleteBusinessAction(businessId: number) {
  await db.delete(businesses).where(eq(businesses.id, businessId));
  revalidatePath("/business");
}

export async function logTransactionAction(input: {
  businessId: number;
  type: "income" | "expense";
  amountPhp: number;
  description: string;
  date?: string;
}) {
  await db.insert(businessTransactions).values({
    businessId: input.businessId,
    type: input.type,
    amountPhp: String(input.amountPhp),
    description: input.description,
    date: input.date ?? todayManilaISO(),
  });
  revalidatePath(`/business/${input.businessId}`);
  revalidatePath("/business");
}

export async function deleteTransactionAction(id: number, businessId: number) {
  await db.delete(businessTransactions).where(eq(businessTransactions.id, id));
  revalidatePath(`/business/${businessId}`);
  revalidatePath("/business");
}

export async function addTaskAction(input: { businessId: number; title: string; dueDate: string | null }) {
  await db.insert(businessTasks).values({ businessId: input.businessId, title: input.title, dueDate: input.dueDate });
  revalidatePath(`/business/${input.businessId}`);
}

export async function toggleTaskAction(id: number, businessId: number, done: boolean) {
  await db.update(businessTasks).set({ done }).where(eq(businessTasks.id, id));
  revalidatePath(`/business/${businessId}`);
}

export async function deleteTaskAction(id: number, businessId: number) {
  await db.delete(businessTasks).where(eq(businessTasks.id, id));
  revalidatePath(`/business/${businessId}`);
}

export async function addNoteAction(input: { businessId: number; body: string }) {
  await db.insert(businessNotes).values({ businessId: input.businessId, body: input.body });
  revalidatePath(`/business/${input.businessId}`);
}

export async function deleteNoteAction(id: number, businessId: number) {
  await db.delete(businessNotes).where(eq(businessNotes.id, id));
  revalidatePath(`/business/${businessId}`);
}

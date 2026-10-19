"use server";
import { revalidatePath } from "next/cache";
import { getViewer } from "@/features/auth/session";
import { getDatabase } from "@/lib/prisma";
import { writeLeaderboardSettings } from "./store";
import { leaderboardSettingsSchema, type LeaderboardFormState } from "./validation";

export async function saveLeaderboardSettings(_previous: LeaderboardFormState, form: FormData): Promise<LeaderboardFormState> {
  const optIn = form.get("optIn") === "on";
  const input = leaderboardSettingsSchema.safeParse(optIn ? { optIn, displayName: form.get("displayName") } : { optIn });
  if (!input.success) return { errors: { displayName: input.error.issues.map((issue) => issue.message) }, message: "Check the display name." };
  try {
    const viewer = await getViewer();
    if (!viewer) return { message: "Sign in to change your leaderboard setting." };
    const result = await writeLeaderboardSettings(getDatabase(), viewer.id, input.data);
    if (!result.ok) return result.reason === "taken"
      ? { errors: { displayName: ["That name is already on the leaderboard. Choose another."] }, message: "Choose a different display name." }
      : { message: "Could not find your profile. Reload and try again." };
    revalidatePath("/leaderboard");
    revalidatePath("/profile");
    return { success: true, message: result.optIn ? "You are on the leaderboard." : "You are hidden from the leaderboard." };
  } catch { return { message: "Could not save your setting. Please try again." }; }
}

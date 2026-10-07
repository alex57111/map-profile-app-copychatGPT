import { supabase, db } from "../../supabase"
import type { AuthAdapter } from "../interface"
import type { UserProfile } from "../../../types/user"

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function toProfile(id: string, row: any): UserProfile {
  return { id, displayName: row.display_name, avatarUrl: row.avatar_url, phone: row.phone, isAnonymous: row.is_anonymous, createdAt: row.created_at }
}

function fallbackProfile(id: string): UserProfile {
  return {
    id,
    displayName: "Водитель",
    avatarUrl: null,
    phone: null,
    isAnonymous: true,
    createdAt: new Date().toISOString(),
  }
}

async function readProfile(id: string): Promise<UserProfile | null> {
  const { data, error } = await db.from("profiles").select("*").eq("id", id).single()
  if (data) return toProfile(id, data)
  // Authentication itself is sufficient for the app to work. A profile row
  // may appear a moment later because it is created by the auth.users trigger.
  if (error) console.warn("[auth] profile read unavailable:", error.message)
  return null
}

export const supabaseAuthAdapter: AuthAdapter = {
  async signInAnonymous(): Promise<UserProfile> {
    const { data, error } = await supabase.auth.signInAnonymously()
    if (error || !data.user) throw new Error(error?.message ?? "Anonymous sign-in failed")

    const profile = await readProfile(data.user.id)
    return profile ?? fallbackProfile(data.user.id)
  },

  async getCurrentUser(): Promise<UserProfile | null> {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return null
    const profile = await readProfile(user.id)
    return profile ?? fallbackProfile(user.id)
  },

  async signOut(): Promise<void> { await supabase.auth.signOut() },

  async updateProfile(patch): Promise<UserProfile> {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) throw new Error("Not authenticated")
    const update: Record<string, string> = {}
    if (patch.displayName !== undefined) update["display_name"] = patch.displayName
    if (patch.phone != null) update["phone"] = patch.phone
    const { data, error } = await db.from("profiles").update(update).eq("id", user.id).select("*").single()
    if (error || !data) throw new Error(error?.message ?? "Update failed")
    return toProfile(user.id, data)
  },

  async becomeAdmin(password: string): Promise<void> {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error } = await (db as any).rpc("become_admin", { p_password: password })
    if (error) throw new Error(error.message)
  },
}

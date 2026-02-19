import { betterAuth } from 'better-auth/minimal'
import { createClient } from '@convex-dev/better-auth'
import { convex } from '@convex-dev/better-auth/plugins'
import type { GenericCtx } from '@convex-dev/better-auth'
import { components, internal } from './_generated/api'
import type { DataModel } from './_generated/dataModel'
import authConfig from './auth.config'

// Explicit type annotation is required to break the circular reference:
//   authComponent → internal.auth (from _generated/api which re-exports this file)
//   → triggersApi exports → authComponent.triggersApi() → authComponent
// Without it, TypeScript gives TS7022 "implicitly has type 'any'".
export const authComponent: ReturnType<typeof createClient<DataModel>> =
  createClient<DataModel>(components.betterAuth, {
    triggers: {
      user: {
        onCreate: async (ctx, doc) => {
          const existing = await ctx.db
            .query('users')
            .withIndex('by_better_auth_id', (q) =>
              q.eq('betterAuthId', doc._id),
            )
            .first()
          if (existing) return
          await ctx.db.insert('users', {
            betterAuthId: doc._id,
            email: doc.email,
            name: doc.name,
            role: 'viewer',
            createdAt: Date.now(),
          })
        },
      },
    },
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    authFunctions: internal.auth as any,
  })

// These must be exported so Convex can register them as internal mutations.
// They are called by the betterAuth component when users are created/updated/deleted.
export const { onCreate, onUpdate, onDelete } = authComponent.triggersApi()

export const createAuth = (ctx: GenericCtx<DataModel>) =>
  betterAuth({
    baseURL: process.env.SITE_URL!,
    database: authComponent.adapter(ctx),
    emailAndPassword: {
      enabled: true,
      requireEmailVerification: false,
    },
    plugins: [convex({ authConfig })],
    session: {
      expiresIn: 60 * 60 * 24 * 7,
      updateAge: 60 * 60 * 24,
    },
  })

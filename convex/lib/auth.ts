import type { QueryCtx, MutationCtx } from '../_generated/server'
import { authComponent } from '../auth'

export async function requireRole(
  ctx: QueryCtx | MutationCtx,
  allowedRoles: string[],
) {
  const authUser = await authComponent.getAuthUser(ctx)
  if (!authUser) throw new Error('Unauthenticated')

  const user = await ctx.db
    .query('users')
    .withIndex('by_better_auth_id', (q) =>
      q.eq('betterAuthId', authUser._id),
    )
    .first()

  if (!user) throw new Error('User not provisioned')

  if (!allowedRoles.includes(user.role)) {
    throw new Error(
      `Forbidden: requires one of [${allowedRoles.join(', ')}]`,
    )
  }

  return user
}

import { Hono } from 'hono'
import type { ContentfulStatusCode } from 'hono/utils/http-status'
import { z } from 'zod'
import { validate } from '../../lib/validation'
import { createUser, deleteUser, getUser, listUsers, updateUser } from './users.service'

const createSchema = z.object({
  email: z.email(),
  name: z.string().min(1).max(100),
})

const updateSchema = createSchema.partial()

const listQuerySchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
})

const idParamSchema = z.object({ id: z.uuid() })

/**
 * Route layer: validate with zod, delegate to the service, return JSON.
 * No try/catch — the central error handler covers failures.
 */
export const userRoutes = new Hono()
  .get('/users', validate('query', listQuerySchema), async (c) => {
    const { page, pageSize } = c.req.valid('query')
    const { items, total } = await listUsers({ page, pageSize })

    return c.json({
      data: items,
      meta: { page, pageSize, total, pages: Math.max(1, Math.ceil(total / pageSize)) },
    })
  })

  .get('/users/:id', validate('param', idParamSchema), async (c) => {
    const { id } = c.req.valid('param')
    const user = await getUser(id)

    return c.json({ data: user })
  })

  .post('/users', validate('json', createSchema), async (c) => {
    const body = c.req.valid('json')
    const user = await createUser(body)

    return c.json({ data: user }, 201)
  })

  .patch('/users/:id', validate('param', idParamSchema), validate('json', updateSchema), async (c) => {
    const { id } = c.req.valid('param')
    const body = c.req.valid('json')
    const user = await updateUser(id, body)

    return c.json({ data: user })
  })

  .delete('/users/:id', validate('param', idParamSchema), async (c) => {
    const { id } = c.req.valid('param')
    await deleteUser(id)

    return c.body(null, 204 as ContentfulStatusCode)
  })

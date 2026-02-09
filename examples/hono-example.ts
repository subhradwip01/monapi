/**
 * Monapi — Hono Example
 *
 * The same bookstore API, but using Hono instead of Express.
 * Works with Bun, Deno, Cloudflare Workers, and Node.js.
 *
 * Install Hono first:
 *   npm install hono @hono/node-server
 *
 * Run with:
 *   npx ts-node examples/hono-example.ts
 *
 * Or with Bun:
 *   bun examples/hono-example.ts
 */

import { Hono } from 'hono'
import { serve } from '@hono/node-server'
import mongoose, { Schema } from 'mongoose'
import { MongoMemoryServer } from 'mongodb-memory-server'
import { Monapi } from '../src'

// ============================================================================
// 1. Schemas (identical to Express example)
// ============================================================================

const BookSchema = new Schema({
  title: { type: String, required: true },
  author: { type: String, required: true },
  price: { type: Number, required: true },
  genre: { type: String, enum: ['fiction', 'non-fiction', 'sci-fi', 'tech'] },
  inStock: { type: Boolean, default: true },
})

const UserSchema = new Schema({
  name: { type: String, required: true },
  email: { type: String, required: true },
  role: { type: String, enum: ['admin', 'editor', 'reader'], default: 'reader' },
})

// ============================================================================
// 2. Auth middleware (Hono style — uses c.set() instead of req.user)
// ============================================================================

async function authMiddleware(c: any, next: () => Promise<void>): Promise<void> {
  const header = c.req.header('authorization')
  if (header?.startsWith('Bearer ')) {
    const role = header.slice(7)
    c.set('user', { id: 'demo-user', roles: [role] })
  }
  await next()
}

// ============================================================================
// 3. Boot
// ============================================================================

async function main() {
  const mongoServer = await MongoMemoryServer.create()
  const uri = mongoServer.getUri()
  const connection = mongoose.createConnection(uri)

  await new Promise<void>((resolve) => {
    if (connection.readyState === 1) return resolve()
    connection.once('open', resolve)
  })

  // --------------------------------------------------------------------------
  // 4. Create Monapi instance with framework: 'hono'
  // --------------------------------------------------------------------------

  const monapi = new Monapi({
    connection,
    framework: 'hono',   // <-- the only difference from Express setup
    defaults: {
      pagination: { limit: 10, maxLimit: 50 },
    },
    auth: { middleware: authMiddleware },
  })

  // --------------------------------------------------------------------------
  // 5. Register resources (identical config to Express)
  // --------------------------------------------------------------------------

  monapi.resource('books', {
    schema: BookSchema,
    permissions: {
      list: 'public',
      get: 'public',
      create: ['admin', 'editor'],
      update: ['admin', 'editor'],
      patch: ['admin', 'editor'],
      delete: ['admin'],
    },
    query: {
      allowedFilters: ['title', 'author', 'genre', 'price', 'inStock'],
      allowedSorts: ['title', 'price'],
      defaultSort: 'title',
    },
    hooks: {
      afterCreate(ctx) {
        console.log(`[hook] Book created: "${ctx.result?.title}"`)
      },
    },
  })

  monapi.resource('users', {
    schema: UserSchema,
    permissions: {
      list: ['admin'],
      get: ['admin'],
      create: ['admin'],
      update: ['admin'],
      patch: ['admin'],
      delete: ['admin'],
    },
  })

  // --------------------------------------------------------------------------
  // 6. Hono app
  // --------------------------------------------------------------------------

  const app = new Hono()

  app.get('/', (c) => {
    return c.json({ status: 'ok', framework: 'hono' })
  })

  // Mount Monapi router — use app.route() instead of app.use()
  app.route('/api', monapi.router())

  // --------------------------------------------------------------------------
  // 7. Seed data
  // --------------------------------------------------------------------------

  const Book = connection.model('Books')

  const books = await Book.insertMany([
    { title: 'Dune', author: 'Frank Herbert', price: 15, genre: 'sci-fi', inStock: true },
    { title: 'Clean Code', author: 'Robert C. Martin', price: 38, genre: 'tech', inStock: true },
    { title: '1984', author: 'George Orwell', price: 10, genre: 'fiction', inStock: true },
  ])

  const bookId = books[0]._id

  // --------------------------------------------------------------------------
  // 8. Start (using @hono/node-server for Node.js)
  // --------------------------------------------------------------------------

  const PORT = 3457
  serve({ fetch: app.fetch, port: PORT }, () => {
    console.log(`\nHono server running on http://localhost:${PORT}\n`)
    console.log(`
# List all books (public)
curl http://localhost:${PORT}/api/books | jq

# Filter: sci-fi books
curl "http://localhost:${PORT}/api/books?genre=sci-fi" | jq

# Filter: books under $20
curl "http://localhost:${PORT}/api/books?price__lt=20" | jq

# Sort: cheapest first
curl "http://localhost:${PORT}/api/books?sort=price" | jq

# Create a book (needs auth)
curl -X POST http://localhost:${PORT}/api/books \\
  -H "Content-Type: application/json" \\
  -H "Authorization: Bearer editor" \\
  -d '{"title":"Neuromancer","author":"William Gibson","price":12,"genre":"sci-fi"}' | jq

# Create without auth -> 401
curl -X POST http://localhost:${PORT}/api/books \\
  -H "Content-Type: application/json" \\
  -d '{"title":"Nope","author":"Nobody","price":0}' | jq

# Patch a book
curl -X PATCH http://localhost:${PORT}/api/books/${bookId} \\
  -H "Content-Type: application/json" \\
  -H "Authorization: Bearer editor" \\
  -d '{"price":9.99}' | jq

# Delete a book (admin only)
curl -X DELETE http://localhost:${PORT}/api/books/${bookId} \\
  -H "Authorization: Bearer admin" | jq

# List users (admin only)
curl -H "Authorization: Bearer admin" http://localhost:${PORT}/api/users | jq
`)
  })

  process.on('SIGINT', async () => {
    await connection.close()
    await mongoServer.stop()
    process.exit(0)
  })
}

main().catch((err) => {
  console.error('Failed to start:', err)
  process.exit(1)
})

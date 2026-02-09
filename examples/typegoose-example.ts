/**
 * Monapi — Typegoose Example
 *
 * The same bookstore API, but using Typegoose decorator classes instead of raw Mongoose schemas.
 * Uses mongodb-memory-server so no real MongoDB is needed.
 *
 * Install Typegoose first:
 *   npm install @typegoose/typegoose reflect-metadata
 *
 * Run with:
 *   npx ts-node examples/typegoose-example.ts
 */

import 'reflect-metadata'
import express, { Request, Response, NextFunction } from 'express'
import mongoose from 'mongoose'
import { prop } from '@typegoose/typegoose'
import { MongoMemoryServer } from 'mongodb-memory-server'
import { Monapi } from '../src'

// ============================================================================
// 1. Typegoose classes (replaces raw Mongoose schemas)
// ============================================================================

class Book {
  @prop({ required: true })
  public title!: string

  @prop({ required: true })
  public author!: string

  @prop({ required: true })
  public price!: number

  @prop({ enum: ['fiction', 'non-fiction', 'sci-fi', 'tech'] })
  public genre?: string

  @prop({ default: true })
  public inStock?: boolean
}

class User {
  @prop({ required: true })
  public name!: string

  @prop({ required: true })
  public email!: string

  @prop({ enum: ['admin', 'editor', 'reader'], default: 'reader' })
  public role?: string
}

// ============================================================================
// 2. Auth middleware (simulates JWT — reads "Bearer <role>" from header)
// ============================================================================

function authMiddleware(req: Request, _res: Response, next: NextFunction): void {
  const header = req.headers.authorization
  if (header?.startsWith('Bearer ')) {
    const role = header.slice(7)
    ;(req as any).user = { id: 'demo-user', roles: [role] }
  }
  next()
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
  // 4. Create Monapi instance
  // --------------------------------------------------------------------------

  const monapi = new Monapi({
    connection,
    defaults: {
      pagination: { limit: 10, maxLimit: 50 },
    },
    auth: { middleware: authMiddleware },
  })

  // --------------------------------------------------------------------------
  // 5. Register resources — pass Typegoose classes directly!
  //    Monapi detects them automatically and calls getModelForClass() for you.
  // --------------------------------------------------------------------------

  monapi.resource('books', {
    schema: Book,
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
    schema: User,
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
  // 6. Express app
  // --------------------------------------------------------------------------

  const app = express()
  app.use(express.json())

  app.get('/', (_req, res) => {
    res.json({ status: 'ok', framework: 'express', schema: 'typegoose' })
  })

  // Mount Monapi router
  app.use('/api', monapi.router())

  // --------------------------------------------------------------------------
  // 7. Seed data
  // --------------------------------------------------------------------------

  const BookModel = connection.model('Books')

  const books = await BookModel.insertMany([
    { title: 'Dune', author: 'Frank Herbert', price: 15, genre: 'sci-fi', inStock: true },
    { title: 'Clean Code', author: 'Robert C. Martin', price: 38, genre: 'tech', inStock: true },
    { title: '1984', author: 'George Orwell', price: 10, genre: 'fiction', inStock: true },
  ])

  const bookId = (books[0] as any)._id

  // --------------------------------------------------------------------------
  // 8. Start
  // --------------------------------------------------------------------------

  const PORT = 3458
  app.listen(PORT, () => {
    console.log(`\nTypegoose + Express server running on http://localhost:${PORT}\n`)
    console.log(`
# List all books (public — no auth needed)
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

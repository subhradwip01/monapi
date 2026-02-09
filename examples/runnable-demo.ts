/**
 * Monapi — Runnable Demo
 *
 * A bookstore API with users, books, and reviews.
 * Uses mongodb-memory-server so you don't need a real MongoDB — just run it.
 *
 *   npx ts-node examples/runnable-demo.ts
 *
 * Then try the curl commands printed to the console.
 */

import express, { Request, Response, NextFunction } from 'express'
import mongoose, { Schema } from 'mongoose'
import { MongoMemoryServer } from 'mongodb-memory-server'
import { Monapi } from '../src'

// ============================================================================
// 1. Schemas
// ============================================================================

const UserSchema = new Schema({
  name: { type: String, required: true },
  email: { type: String, required: true },
  age: { type: Number },
  role: { type: String, enum: ['admin', 'editor', 'reader'], default: 'reader' },
  active: { type: Boolean, default: true },
  createdAt: { type: Date, default: Date.now },
})

const BookSchema = new Schema({
  title: { type: String, required: true },
  author: { type: String, required: true },
  price: { type: Number, required: true },
  genre: { type: String, enum: ['fiction', 'non-fiction', 'sci-fi', 'biography', 'tech'] },
  pages: { type: Number },
  inStock: { type: Boolean, default: true },
  publishedAt: { type: Date },
})

const ReviewSchema = new Schema({
  bookTitle: { type: String, required: true },
  reviewer: { type: String, required: true },
  rating: { type: Number, required: true, min: 1, max: 5 },
  comment: { type: String },
  createdAt: { type: Date, default: Date.now },
})

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
  // Start in-memory MongoDB
  const mongoServer = await MongoMemoryServer.create()
  const uri = mongoServer.getUri()
  const connection = mongoose.createConnection(uri)

  await new Promise<void>((resolve) => {
    if (connection.readyState === 1) return resolve()
    connection.once('open', resolve)
  })

  console.log('MongoDB memory server started')

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
  // 5. Register resources
  // --------------------------------------------------------------------------

  // BOOKS — public browsing, only editors/admins can create/update, only admins delete
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
      allowedFilters: ['title', 'author', 'genre', 'price', 'inStock', 'pages'],
      allowedSorts: ['title', 'price', 'pages', 'publishedAt'],
      defaultSort: 'title',
    },
    hooks: {
      afterCreate(ctx) {
        console.log(`[hook] Book created: "${ctx.result?.title}"`)
      },
    },
  })

  // USERS — only admins can manage, editors can read
  monapi.resource('users', {
    schema: UserSchema,
    permissions: {
      list: ['admin', 'editor'],
      get: ['admin', 'editor'],
      create: ['admin'],
      update: ['admin'],
      patch: ['admin'],
      delete: ['admin'],
    },
    query: {
      allowedFilters: ['name', 'email', 'age', 'role', 'active'],
      allowedSorts: ['name', 'age', 'createdAt'],
      defaultSort: '-createdAt',
    },
    hooks: {
      beforeCreate(ctx) {
        // Normalize email to lowercase before saving
        if (ctx.data?.email) {
          ctx.data.email = ctx.data.email.toLowerCase()
        }
      },
    },
  })

  // REVIEWS — anyone can read, readers+ can create, only admins delete
  monapi.resource('reviews', {
    schema: ReviewSchema,
    permissions: {
      list: 'public',
      get: 'public',
      create: ['admin', 'editor', 'reader'],
      update: ['admin', 'editor'],
      patch: ['admin', 'editor'],
      delete: ['admin'],
    },
    query: {
      allowedFilters: ['bookTitle', 'reviewer', 'rating'],
      allowedSorts: ['rating', 'createdAt'],
      defaultSort: '-createdAt',
    },
  })

  // --------------------------------------------------------------------------
  // 6. Express app
  // --------------------------------------------------------------------------

  const app = express()
  app.use(express.json())

  // Health check
  app.get('/', (_req, res) => {
    res.json({ status: 'ok', message: 'Monapi Bookstore Demo' })
  })

  // Mount Monapi router
  app.use('/api', monapi.router())

  // --------------------------------------------------------------------------
  // 7. Seed some data
  // --------------------------------------------------------------------------

  const Book = connection.model('Books')
  const User = connection.model('Users')
  const Review = connection.model('Reviews')

  await User.insertMany([
    { name: 'Alice Admin', email: 'alice@bookstore.com', age: 32, role: 'admin', active: true },
    { name: 'Bob Editor', email: 'bob@bookstore.com', age: 28, role: 'editor', active: true },
    { name: 'Charlie Reader', email: 'charlie@bookstore.com', age: 24, role: 'reader', active: true },
  ])

  const books = await Book.insertMany([
    { title: 'The Pragmatic Programmer', author: 'David Thomas', price: 45, genre: 'tech', pages: 352, inStock: true, publishedAt: new Date('2019-09-20') },
    { title: 'Dune', author: 'Frank Herbert', price: 15, genre: 'sci-fi', pages: 688, inStock: true, publishedAt: new Date('1965-08-01') },
    { title: 'Clean Code', author: 'Robert C. Martin', price: 38, genre: 'tech', pages: 464, inStock: true, publishedAt: new Date('2008-08-01') },
    { title: 'Sapiens', author: 'Yuval Noah Harari', price: 22, genre: 'non-fiction', pages: 498, inStock: false, publishedAt: new Date('2015-02-10') },
    { title: 'Steve Jobs', author: 'Walter Isaacson', price: 18, genre: 'biography', pages: 656, inStock: true, publishedAt: new Date('2011-10-24') },
    { title: 'Neuromancer', author: 'William Gibson', price: 12, genre: 'sci-fi', pages: 271, inStock: true, publishedAt: new Date('1984-07-01') },
    { title: 'Design Patterns', author: 'Gang of Four', price: 50, genre: 'tech', pages: 395, inStock: true, publishedAt: new Date('1994-10-31') },
    { title: '1984', author: 'George Orwell', price: 10, genre: 'fiction', pages: 328, inStock: true, publishedAt: new Date('1949-06-08') },
  ])

  await Review.insertMany([
    { bookTitle: 'Dune', reviewer: 'Charlie Reader', rating: 5, comment: 'A masterpiece of science fiction.' },
    { bookTitle: 'Dune', reviewer: 'Bob Editor', rating: 4, comment: 'Great world-building, dense at times.' },
    { bookTitle: 'Clean Code', reviewer: 'Alice Admin', rating: 5, comment: 'Every developer should read this.' },
    { bookTitle: '1984', reviewer: 'Charlie Reader', rating: 5, comment: 'Terrifyingly relevant.' },
  ])

  const bookId = books[0]._id

  // --------------------------------------------------------------------------
  // 8. Start server & print curl commands
  // --------------------------------------------------------------------------

  const PORT = 3457
  app.listen(PORT, () => {
    console.log(`\nServer running on http://localhost:${PORT}\n`)
    console.log('='.repeat(70))
    console.log('  CURL COMMANDS — copy/paste to test the API')
    console.log('='.repeat(70))

    console.log(`
--- PUBLIC (no auth needed) ---

# List all books (public)
curl http://localhost:${PORT}/api/books | jq

# Get a single book
curl http://localhost:${PORT}/api/books/${bookId} | jq

# Filter: only sci-fi books
curl "http://localhost:${PORT}/api/books?genre=sci-fi" | jq

# Filter: books under $20
curl "http://localhost:${PORT}/api/books?price__lt=20" | jq

# Filter: tech books between $30 and $50
curl "http://localhost:${PORT}/api/books?genre=tech&price__gte=30&price__lte=50" | jq

# Search: title contains "code" (case-insensitive regex)
curl "http://localhost:${PORT}/api/books?title__like=code" | jq

# Filter: books in stock
curl "http://localhost:${PORT}/api/books?inStock=true" | jq

# Sort: cheapest first
curl "http://localhost:${PORT}/api/books?sort=price" | jq

# Sort: most expensive first
curl "http://localhost:${PORT}/api/books?sort=-price" | jq

# Sort: genre ascending, then price descending
curl "http://localhost:${PORT}/api/books?sort=title,-price" | jq

# Pagination: page 1, 3 per page
curl "http://localhost:${PORT}/api/books?page=1&limit=3" | jq

# Pagination: page 2
curl "http://localhost:${PORT}/api/books?page=2&limit=3" | jq

# Field selection: only title and price
curl "http://localhost:${PORT}/api/books?fields=title,price" | jq

# Combine: sci-fi books sorted by price, only title & price
curl "http://localhost:${PORT}/api/books?genre=sci-fi&sort=price&fields=title,price" | jq

# List reviews (public)
curl http://localhost:${PORT}/api/reviews | jq

# Filter reviews: 5-star only
curl "http://localhost:${PORT}/api/reviews?rating=5" | jq

--- AUTH REQUIRED ---

# List users (needs editor or admin)
curl -H "Authorization: Bearer admin" http://localhost:${PORT}/api/users | jq

# List users (editor role also works)
curl -H "Authorization: Bearer editor" http://localhost:${PORT}/api/users | jq

# List users without auth -> 401
curl http://localhost:${PORT}/api/users | jq

# Create a book (needs editor or admin)
curl -X POST http://localhost:${PORT}/api/books \\
  -H "Content-Type: application/json" \\
  -H "Authorization: Bearer editor" \\
  -d '{"title":"Refactoring","author":"Martin Fowler","price":42,"genre":"tech","pages":448}' | jq

# Create a book without auth -> 401
curl -X POST http://localhost:${PORT}/api/books \\
  -H "Content-Type: application/json" \\
  -d '{"title":"Unauthorized Book","author":"Nobody","price":10}' | jq

# Create a user (admin only)
curl -X POST http://localhost:${PORT}/api/users \\
  -H "Content-Type: application/json" \\
  -H "Authorization: Bearer admin" \\
  -d '{"name":"Diana Dev","email":"Diana@Bookstore.com","age":26,"role":"reader"}' | jq

# Create a user as editor -> 403 forbidden
curl -X POST http://localhost:${PORT}/api/users \\
  -H "Content-Type: application/json" \\
  -H "Authorization: Bearer editor" \\
  -d '{"name":"Nope","email":"nope@test.com"}' | jq

# Patch a book (partial update)
curl -X PATCH http://localhost:${PORT}/api/books/${bookId} \\
  -H "Content-Type: application/json" \\
  -H "Authorization: Bearer editor" \\
  -d '{"price":39.99}' | jq

# Delete a book (admin only)
curl -X DELETE http://localhost:${PORT}/api/books/${bookId} \\
  -H "Authorization: Bearer admin" | jq

# Delete a book as editor -> 403 forbidden
curl -X DELETE http://localhost:${PORT}/api/books/${bookId} \\
  -H "Authorization: Bearer editor" | jq

# Post a review (any authenticated user)
curl -X POST http://localhost:${PORT}/api/reviews \\
  -H "Content-Type: application/json" \\
  -H "Authorization: Bearer reader" \\
  -d '{"bookTitle":"1984","reviewer":"New Reader","rating":4,"comment":"Still powerful."}' | jq

# Validation error: missing required fields
curl -X POST http://localhost:${PORT}/api/books \\
  -H "Content-Type: application/json" \\
  -H "Authorization: Bearer admin" \\
  -d '{"genre":"tech"}' | jq

# Operator injection blocked
curl -X PATCH http://localhost:${PORT}/api/books/${bookId} \\
  -H "Content-Type: application/json" \\
  -H "Authorization: Bearer admin" \\
  -d '{"\$set":{"price":0}}' | jq
`)

    console.log('Press Ctrl+C to stop the server.')
  })

  // Cleanup on exit
  process.on('SIGINT', async () => {
    console.log('\nShutting down...')
    await connection.close()
    await mongoServer.stop()
    process.exit(0)
  })
}

main().catch((err) => {
  console.error('Failed to start:', err)
  process.exit(1)
})

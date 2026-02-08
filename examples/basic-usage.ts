import express from 'express'
import mongoose, { Schema } from 'mongoose'
import { Monapi } from '../src'

const app = express()
app.use(express.json())

// Connect to MongoDB
mongoose.connect('mongodb://localhost:27017/myapp')

// Define schemas
const UserSchema = new Schema({
  name: { type: String, required: true },
  email: { type: String, required: true, unique: true },
  age: { type: Number },
  role: { type: String, enum: ['admin', 'user', 'moderator'], default: 'user' },
  active: { type: Boolean, default: true },
  createdAt: { type: Date, default: Date.now },
})

const PostSchema = new Schema({
  title: { type: String, required: true },
  body: { type: String, required: true },
  author: { type: Schema.Types.ObjectId, ref: 'User' },
  tags: [{ type: String }],
  published: { type: Boolean, default: false },
  createdAt: { type: Date, default: Date.now },
})

// Create Monapi instance
const monapi = new Monapi({
  connection: mongoose.connection,
  defaults: {
    pagination: { limit: 20, maxLimit: 100 },
    security: { maxRegexLength: 50 },
  },
})

// Register resources
monapi.resource('users', {
  schema: UserSchema,
  query: {
    allowedFilters: ['name', 'email', 'age', 'role', 'active'],
    allowedSorts: ['name', 'age', 'createdAt'],
    defaultSort: '-createdAt',
  },
  hooks: {
    beforeCreate: async (ctx) => {
      console.log(`Creating user:`, ctx.data)
    },
    afterCreate: async (ctx) => {
      console.log(`User created: ${ctx.result._id}`)
    },
  },
})

monapi.resource('posts', {
  schema: PostSchema,
  query: {
    allowedFilters: ['title', 'author', 'published', 'tags'],
    defaultSort: '-createdAt',
  },
  permissions: {
    create: ['admin', 'moderator'],
    update: ['admin', 'moderator'],
    delete: ['admin'],
  },
})

// Mount the API
app.use('/api', monapi.router())

// Start server
app.listen(3000, () => {
  console.log('Server running on http://localhost:3000')
  console.log('')
  console.log('Available endpoints:')
  console.log('  GET    /api/users            - List users')
  console.log('  GET    /api/users/:id         - Get user by id')
  console.log('  POST   /api/users             - Create user')
  console.log('  PUT    /api/users/:id          - Replace user')
  console.log('  PATCH  /api/users/:id          - Update user')
  console.log('  DELETE /api/users/:id          - Delete user')
  console.log('')
  console.log('  GET    /api/posts             - List posts')
  console.log('  GET    /api/posts/:id          - Get post by id')
  console.log('  POST   /api/posts              - Create post')
  console.log('  PUT    /api/posts/:id           - Replace post')
  console.log('  PATCH  /api/posts/:id           - Update post')
  console.log('  DELETE /api/posts/:id           - Delete post')
  console.log('')
  console.log('Query examples:')
  console.log('  GET /api/users?role=admin')
  console.log('  GET /api/users?age__gt=18&age__lt=30')
  console.log('  GET /api/users?name__like=john')
  console.log('  GET /api/users?sort=-createdAt&page=2&limit=10')
  console.log('  GET /api/users?fields=name,email')
})

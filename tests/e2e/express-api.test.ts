import express, { Request, Response, NextFunction } from 'express'
import mongoose, { Schema, Connection } from 'mongoose'
import { MongoMemoryServer } from 'mongodb-memory-server'
import request from 'supertest'
import { Monapi } from '../../src'

// ---------------------------------------------------------------------------
// Schemas
// ---------------------------------------------------------------------------
const UserSchema = new Schema({
  name: { type: String, required: true },
  email: { type: String, required: true },
  age: { type: Number },
  role: { type: String, default: 'user' },
  active: { type: Boolean, default: true },
})

const ProductSchema = new Schema({
  title: { type: String, required: true },
  price: { type: Number, required: true },
  category: { type: String },
  inStock: { type: Boolean, default: true },
})

// ---------------------------------------------------------------------------
// Mock auth middleware: reads Bearer <role> and sets req.user
// ---------------------------------------------------------------------------
function mockAuth(req: Request, _res: Response, next: NextFunction): void {
  const header = req.headers.authorization
  if (header?.startsWith('Bearer ')) {
    const role = header.slice(7)
    ;(req as any).user = { id: 'test-user', roles: [role] }
  }
  next()
}

// ---------------------------------------------------------------------------
// Test app factory
// ---------------------------------------------------------------------------
let mongoServer: MongoMemoryServer
let connection: Connection
let app: express.Express

// Side-effect tracker for hook tests
let hookSideEffects: Record<string, any> = {}

async function createTestApp() {
  mongoServer = await MongoMemoryServer.create()
  const uri = mongoServer.getUri()
  connection = mongoose.createConnection(uri)

  // Wait for connection to be ready
  await new Promise<void>((resolve) => {
    if (connection.readyState === 1) return resolve()
    connection.once('open', resolve)
  })

  const monapi = new Monapi({
    connection,
    defaults: {
      pagination: { limit: 10, maxLimit: 100 },
    },
    auth: { middleware: mockAuth },
    logger: { info: () => {}, warn: () => {}, error: () => {}, debug: () => {} },
  })

  monapi.resource('users', {
    schema: UserSchema,
    permissions: {
      list: ['admin', 'user'],
      get: ['admin', 'user'],
      create: ['admin'],
      update: ['admin'],
      patch: ['admin', 'user'],
      delete: ['admin'],
    },
    hooks: {
      beforeCreate(ctx) {
        if (ctx.data) {
          // Hooks can modify data before it's saved — set role based on user
          ctx.data.role = ctx.user?.roles?.[0] ?? 'guest'
        }
      },
      afterCreate(ctx) {
        hookSideEffects.lastCreated = {
          id: ctx.result?._id,
          collection: ctx.collection,
        }
      },
      beforeFind(ctx) {
        // Inject filter: only return active users
        if (ctx.query) {
          ctx.query.filter = { ...ctx.query.filter, active: true }
        }
      },
    },
    query: {
      allowedFilters: ['name', 'email', 'age', 'role', 'active'],
      allowedSorts: ['name', 'email', 'age', 'role'],
    },
  })

  monapi.resource('products', {
    schema: ProductSchema,
    permissions: {
      list: 'public',
      get: 'public',
      create: ['admin'],
      update: ['admin'],
      patch: ['admin'],
      delete: ['admin'],
    },
  })

  app = express()
  app.use(express.json())
  app.use('/api', monapi.router())

  return { app, connection, mongoServer }
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
function adminAuth() {
  return { Authorization: 'Bearer admin' }
}

function userAuth() {
  return { Authorization: 'Bearer user' }
}

/** Insert users directly into the collection (bypasses API) */
async function seedUsers(users: any[]) {
  const UserModel = connection.model('Users')
  return UserModel.insertMany(users)
}

/** Insert products directly */
async function seedProducts(products: any[]) {
  const ProductModel = connection.model('Products')
  return ProductModel.insertMany(products)
}

// ---------------------------------------------------------------------------
// Setup / Teardown
// ---------------------------------------------------------------------------
beforeAll(async () => {
  await createTestApp()
}, 30000)

afterEach(async () => {
  // Clear all collections for test isolation
  const collections = connection.collections
  for (const key of Object.keys(collections)) {
    await collections[key].deleteMany({})
  }
  hookSideEffects = {}
})

afterAll(async () => {
  if (connection) await connection.close()
  if (mongoServer) await mongoServer.stop()
}, 15000)

// ===========================================================================
// 1. Basic CRUD Operations
// ===========================================================================
describe('Basic CRUD Operations', () => {
  it('POST /api/users — creates a user and returns 201', async () => {
    const res = await request(app)
      .post('/api/users')
      .set(adminAuth())
      .send({ name: 'Alice', email: 'alice@test.com', age: 30, role: 'admin' })

    expect(res.status).toBe(201)
    expect(res.body.data).toMatchObject({
      name: 'Alice',
      email: 'alice@test.com',
      age: 30,
      role: 'admin',
    })
    expect(res.body.data._id).toBeDefined()
  })

  it('GET /api/users — lists users with { data, meta } format', async () => {
    await seedUsers([
      { name: 'A', email: 'a@t.com', active: true },
      { name: 'B', email: 'b@t.com', active: true },
    ])

    const res = await request(app).get('/api/users').set(adminAuth())

    expect(res.status).toBe(200)
    expect(res.body.data).toHaveLength(2)
    expect(res.body.meta).toMatchObject({ page: 1, limit: 10, total: 2 })
  })

  it('GET /api/users/:id — returns a single user', async () => {
    const [user] = await seedUsers([{ name: 'Alice', email: 'a@t.com', active: true }])

    const res = await request(app).get(`/api/users/${user._id}`).set(adminAuth())

    expect(res.status).toBe(200)
    expect(res.body.data.name).toBe('Alice')
  })

  it('PUT /api/users/:id — replaces user', async () => {
    const [user] = await seedUsers([
      { name: 'Alice', email: 'a@t.com', age: 25, role: 'user', active: true },
    ])

    const res = await request(app)
      .put(`/api/users/${user._id}`)
      .set(adminAuth())
      .send({ name: 'Bob', email: 'bob@t.com', age: 35, role: 'admin' })

    expect(res.status).toBe(200)
    expect(res.body.data.name).toBe('Bob')
    expect(res.body.data.email).toBe('bob@t.com')
    expect(res.body.data.age).toBe(35)
  })

  it('PATCH /api/users/:id — partially updates user', async () => {
    const [user] = await seedUsers([
      { name: 'Alice', email: 'a@t.com', age: 25, role: 'user', active: true },
    ])

    const res = await request(app)
      .patch(`/api/users/${user._id}`)
      .set(adminAuth())
      .send({ age: 26 })

    expect(res.status).toBe(200)
    expect(res.body.data.age).toBe(26)
    expect(res.body.data.name).toBe('Alice') // unchanged
  })

  it('DELETE /api/users/:id — deletes user, then GET returns 404', async () => {
    const [user] = await seedUsers([{ name: 'Alice', email: 'a@t.com', active: true }])

    const delRes = await request(app).delete(`/api/users/${user._id}`).set(adminAuth())
    expect(delRes.status).toBe(200)

    const getRes = await request(app).get(`/api/users/${user._id}`).set(adminAuth())
    expect(getRes.status).toBe(404)
  })
})

// ===========================================================================
// 2. Validation & Error Handling
// ===========================================================================
describe('Validation & Error Handling', () => {
  it('POST /api/users with missing required fields → error response', async () => {
    const res = await request(app)
      .post('/api/users')
      .set(adminAuth())
      .send({ age: 25 }) // missing name, email

    // Mongoose validation error surfaces as 500 (not a MonapiError)
    expect(res.status).toBeGreaterThanOrEqual(400)
    expect(res.body.error).toBeDefined()
    expect(res.body.error.code).toBeDefined()
  })

  it('GET /api/users/:invalidId → 404', async () => {
    const fakeId = new mongoose.Types.ObjectId().toString()
    const res = await request(app).get(`/api/users/${fakeId}`).set(adminAuth())

    expect(res.status).toBe(404)
    expect(res.body.error.code).toBe('NOT_FOUND')
  })

  it('PATCH /api/users/:id with $ operator in body → 400', async () => {
    const [user] = await seedUsers([{ name: 'Alice', email: 'a@t.com', active: true }])

    const res = await request(app)
      .patch(`/api/users/${user._id}`)
      .set(adminAuth())
      .send({ $set: { role: 'admin' } })

    expect(res.status).toBe(400)
    expect(res.body.error.code).toBe('VALIDATION_ERROR')
  })
})

// ===========================================================================
// 3. Filtering
// ===========================================================================
describe('Filtering', () => {
  beforeEach(async () => {
    await seedUsers([
      { name: 'Alice', email: 'alice@t.com', age: 30, role: 'admin', active: true },
      { name: 'Bob', email: 'bob@t.com', age: 20, role: 'user', active: true },
      { name: 'Charlie', email: 'charlie@t.com', age: 25, role: 'admin', active: true },
      { name: 'John Doe', email: 'john@t.com', age: 35, role: 'user', active: true },
    ])
  })

  it('GET /api/users?role=admin → only admins returned', async () => {
    const res = await request(app).get('/api/users?role=admin').set(adminAuth())

    expect(res.status).toBe(200)
    expect(res.body.data).toHaveLength(2)
    res.body.data.forEach((u: any) => expect(u.role).toBe('admin'))
  })

  it('GET /api/users?age__gt=25 → operator filtering', async () => {
    const res = await request(app).get('/api/users?age__gt=25').set(adminAuth())

    expect(res.status).toBe(200)
    res.body.data.forEach((u: any) => expect(u.age).toBeGreaterThan(25))
  })

  it('GET /api/users?age__gte=20&age__lte=30 → range filter', async () => {
    const res = await request(app).get('/api/users?age__gte=20&age__lte=30').set(adminAuth())

    expect(res.status).toBe(200)
    res.body.data.forEach((u: any) => {
      expect(u.age).toBeGreaterThanOrEqual(20)
      expect(u.age).toBeLessThanOrEqual(30)
    })
  })

  it('GET /api/users?name__like=john → regex search (case insensitive)', async () => {
    const res = await request(app).get('/api/users?name__like=john').set(adminAuth())

    expect(res.status).toBe(200)
    expect(res.body.data.length).toBeGreaterThanOrEqual(1)
    expect(res.body.data[0].name.toLowerCase()).toContain('john')
  })

  it('GET /api/users?active__exists=true → existence filter', async () => {
    const res = await request(app).get('/api/users?active__exists=true').set(adminAuth())

    expect(res.status).toBe(200)
    // All seeded users have active field, so we should get all of them
    expect(res.body.data.length).toBeGreaterThanOrEqual(1)
  })
})

// ===========================================================================
// 4. Sorting
// ===========================================================================
describe('Sorting', () => {
  beforeEach(async () => {
    await seedUsers([
      { name: 'Charlie', email: 'c@t.com', age: 30, role: 'admin', active: true },
      { name: 'Alice', email: 'a@t.com', age: 20, role: 'user', active: true },
      { name: 'Bob', email: 'b@t.com', age: 25, role: 'admin', active: true },
    ])
  })

  it('GET /api/users?sort=age → ascending sort', async () => {
    const res = await request(app)
      .get('/api/users')
      .query({ sort: 'age' })
      .set(adminAuth())

    expect(res.status).toBe(200)
    expect(res.body.data).toHaveLength(3)
    const ages = res.body.data.map((u: any) => u.age)
    expect(ages).toEqual([20, 25, 30])
  })

  it('GET /api/users?sort=-age → descending sort', async () => {
    const res = await request(app)
      .get('/api/users')
      .query({ sort: '-age' })
      .set(adminAuth())

    expect(res.status).toBe(200)
    expect(res.body.data).toHaveLength(3)
    const ages = res.body.data.map((u: any) => u.age)
    expect(ages).toEqual([30, 25, 20])
  })

  it('GET /api/users?sort=role,-age → multi-field sort', async () => {
    const res = await request(app)
      .get('/api/users')
      .query({ sort: 'role,-age' })
      .set(adminAuth())

    expect(res.status).toBe(200)
    expect(res.body.data).toHaveLength(3)
    const data = res.body.data
    // admins first (sorted by -age: 30, 25), then user (age 20)
    expect(data[0].role).toBe('admin')
    expect(data[0].age).toBe(30)
    expect(data[1].role).toBe('admin')
    expect(data[1].age).toBe(25)
    expect(data[2].role).toBe('user')
  })
})

// ===========================================================================
// 5. Pagination
// ===========================================================================
describe('Pagination', () => {
  beforeEach(async () => {
    const users = Array.from({ length: 25 }, (_, i) => ({
      name: `User${String(i + 1).padStart(2, '0')}`,
      email: `user${i + 1}@t.com`,
      age: 20 + i,
      active: true,
    }))
    await seedUsers(users)
  })

  it('page=1&limit=10 → 10 results, meta.total=25, totalPages=3', async () => {
    const res = await request(app).get('/api/users?page=1&limit=10').set(adminAuth())

    expect(res.status).toBe(200)
    expect(res.body.data).toHaveLength(10)
    expect(res.body.meta.total).toBe(25)
    expect(res.body.meta.totalPages).toBe(3)
    expect(res.body.meta.page).toBe(1)
    expect(res.body.meta.limit).toBe(10)
  })

  it('page=3&limit=10 → 5 results (last page)', async () => {
    const res = await request(app).get('/api/users?page=3&limit=10').set(adminAuth())

    expect(res.status).toBe(200)
    expect(res.body.data).toHaveLength(5)
  })

  it('limit=1000 → capped at maxLimit (100)', async () => {
    const res = await request(app).get('/api/users?limit=1000').set(adminAuth())

    expect(res.status).toBe(200)
    expect(res.body.meta.limit).toBe(100)
    // All 25 users should be returned since 100 > 25
    expect(res.body.data).toHaveLength(25)
  })
})

// ===========================================================================
// 6. Field Selection
// ===========================================================================
describe('Field Selection', () => {
  it('GET /api/users?fields=name,email → only name, email, _id returned', async () => {
    await seedUsers([
      { name: 'Alice', email: 'a@t.com', age: 30, role: 'admin', active: true },
    ])

    const res = await request(app).get('/api/users?fields=name,email').set(adminAuth())

    expect(res.status).toBe(200)
    const user = res.body.data[0]
    expect(user.name).toBe('Alice')
    expect(user.email).toBe('a@t.com')
    expect(user._id).toBeDefined()
    // age, role, active should NOT be present
    expect(user.age).toBeUndefined()
    expect(user.role).toBeUndefined()
    expect(user.active).toBeUndefined()
  })
})

// ===========================================================================
// 7. Public Routes (products)
// ===========================================================================
describe('Public Routes (products)', () => {
  it('GET /api/products — no auth → 200 (public)', async () => {
    await seedProducts([{ title: 'Widget', price: 10 }])

    const res = await request(app).get('/api/products')
    expect(res.status).toBe(200)
    expect(res.body.data).toHaveLength(1)
  })

  it('GET /api/products/:id — no auth → 200 (public)', async () => {
    const [product] = await seedProducts([{ title: 'Widget', price: 10 }])

    const res = await request(app).get(`/api/products/${product._id}`)
    expect(res.status).toBe(200)
    expect(res.body.data.title).toBe('Widget')
  })

  it('POST /api/products — no auth → 401', async () => {
    const res = await request(app)
      .post('/api/products')
      .send({ title: 'Gadget', price: 20 })

    expect(res.status).toBe(401)
    expect(res.body.error.code).toBe('UNAUTHORIZED')
  })

  it('POST /api/products — admin auth → 201', async () => {
    const res = await request(app)
      .post('/api/products')
      .set(adminAuth())
      .send({ title: 'Gadget', price: 20, category: 'electronics' })

    expect(res.status).toBe(201)
    expect(res.body.data.title).toBe('Gadget')
  })
})

// ===========================================================================
// 8. Role-Based Permissions (users)
// ===========================================================================
describe('Role-Based Permissions', () => {
  it('all requests without auth → 401', async () => {
    const res = await request(app).get('/api/users')
    expect(res.status).toBe(401)
  })

  it('GET /api/users with regular user token → 200', async () => {
    await seedUsers([{ name: 'A', email: 'a@t.com', active: true }])

    const res = await request(app).get('/api/users').set(userAuth())
    expect(res.status).toBe(200)
  })

  it('POST /api/users with regular user → 403 (admin only)', async () => {
    const res = await request(app)
      .post('/api/users')
      .set(userAuth())
      .send({ name: 'New', email: 'new@t.com' })

    expect(res.status).toBe(403)
    expect(res.body.error.code).toBe('FORBIDDEN')
  })

  it('DELETE /api/users/:id with admin → 200', async () => {
    const [user] = await seedUsers([{ name: 'A', email: 'a@t.com', active: true }])

    const res = await request(app).delete(`/api/users/${user._id}`).set(adminAuth())
    expect(res.status).toBe(200)
  })
})

// ===========================================================================
// 9. Lifecycle Hooks
// ===========================================================================
describe('Lifecycle Hooks', () => {
  it('beforeCreate hook modifies data (sets role from user context)', async () => {
    const res = await request(app)
      .post('/api/users')
      .set(adminAuth())
      .send({ name: 'Alice', email: 'alice@t.com', role: 'user' })

    expect(res.status).toBe(201)
    // The beforeCreate hook overrides role with the user's first role
    expect(res.body.data.role).toBe('admin')
  })

  it('afterCreate hook sets side-effect metadata', async () => {
    const res = await request(app)
      .post('/api/users')
      .set(adminAuth())
      .send({ name: 'Bob', email: 'bob@t.com' })

    expect(res.status).toBe(201)
    expect(hookSideEffects.lastCreated).toBeDefined()
    expect(hookSideEffects.lastCreated.collection).toBe('users')
    expect(hookSideEffects.lastCreated.id).toBeDefined()
  })

  it('beforeFind hook injects active=true filter', async () => {
    // Insert one active and one inactive user directly (bypassing API)
    const UserModel = connection.model('Users')
    await UserModel.insertMany([
      { name: 'Active', email: 'active@t.com', active: true },
      { name: 'Inactive', email: 'inactive@t.com', active: false },
    ])

    const res = await request(app).get('/api/users').set(adminAuth())

    expect(res.status).toBe(200)
    // Only the active user should be returned because beforeFind injects active: true
    expect(res.body.data).toHaveLength(1)
    expect(res.body.data[0].name).toBe('Active')
  })
})

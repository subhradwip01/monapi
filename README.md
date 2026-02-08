# monapi

Auto-generate secure, extensible REST APIs for MongoDB collections using configuration only.

Define a schema. Get a full CRUD API. No boilerplate.

## Install

```bash
npm install monapi
```

**Peer dependencies:**

```bash
npm install express mongoose
```

## Quick Start

```ts
import express from 'express'
import mongoose, { Schema } from 'mongoose'
import { Monapi } from 'monapi'

const app = express()
app.use(express.json())

mongoose.connect('mongodb://localhost:27017/myapp')

const UserSchema = new Schema({
  name: { type: String, required: true },
  email: { type: String, required: true },
  age: { type: Number },
  role: { type: String, enum: ['admin', 'user'], default: 'user' },
})

const monapi = new Monapi({ connection: mongoose.connection })

monapi.resource('users', { schema: UserSchema })

app.use('/api', monapi.router())
app.listen(3000)
```

This generates:

```
GET    /api/users           List users
GET    /api/users/:id       Get user by id
POST   /api/users           Create user
PUT    /api/users/:id       Replace user
PATCH  /api/users/:id       Partial update user
DELETE /api/users/:id       Delete user
```

## Filtering

### Simple equality

```
GET /api/users?role=admin
GET /api/users?age=25&active=true
```

### Operators (double-underscore syntax)

```
GET /api/users?age__gt=18&age__lt=30
GET /api/users?role__in=admin,moderator
GET /api/users?name__like=john
GET /api/users?email__exists=true
```

| Operator | MongoDB | Example |
|----------|---------|---------|
| `__eq` | `$eq` | `?role__eq=admin` |
| `__ne` | `$ne` | `?role__ne=banned` |
| `__gt` | `$gt` | `?age__gt=18` |
| `__gte` | `$gte` | `?age__gte=18` |
| `__lt` | `$lt` | `?age__lt=65` |
| `__lte` | `$lte` | `?age__lte=65` |
| `__in` | `$in` | `?role__in=admin,user` |
| `__nin` | `$nin` | `?role__nin=banned` |
| `__like` | `$regex` (case-insensitive) | `?name__like=john` |
| `__exists` | `$exists` | `?phone__exists=true` |

### Advanced bracket syntax

```
GET /api/users?filter[age][gt]=18&filter[age][lt]=30
```

### Auto type coercion

Query values are automatically coerced:
- `"25"` becomes `25` (number)
- `"true"` / `"false"` becomes boolean
- `"2024-01-15"` becomes a Date object

## Sorting

```
GET /api/users?sort=name              # ascending
GET /api/users?sort=-createdAt        # descending
GET /api/users?sort=role,-createdAt   # multiple fields
```

## Pagination

```
GET /api/users?page=2&limit=20
```

List responses include metadata:

```json
{
  "data": [...],
  "meta": {
    "page": 2,
    "limit": 20,
    "total": 150,
    "totalPages": 8
  }
}
```

## Field Selection

```
GET /api/users?fields=name,email
```

## Query Configuration

Control what's filterable and sortable per collection:

```ts
monapi.resource('users', {
  schema: UserSchema,
  query: {
    allowedFilters: ['name', 'email', 'age', 'role'],
    allowedSorts: ['name', 'age', 'createdAt'],
    defaultSort: '-createdAt',
    defaultLimit: 20,
    maxLimit: 100,
  },
})
```

## Lifecycle Hooks

Run custom logic before or after any operation:

```ts
monapi.resource('users', {
  schema: UserSchema,
  hooks: {
    beforeCreate: async (ctx) => {
      ctx.data.slug = slugify(ctx.data.name)
    },
    afterCreate: async (ctx) => {
      await sendWelcomeEmail(ctx.result.email)
    },
    beforeFind: async (ctx) => {
      // Inject tenant filter
      ctx.query.filter.tenantId = ctx.user?.tenantId
    },
    beforeDelete: async (ctx) => {
      // Prevent deletion
      if (ctx.user?.role !== 'admin') {
        ctx.preventDefault = true
        ctx.res.status(403).json({ error: { message: 'Only admins can delete' } })
      }
    },
  },
})
```

Available hooks: `beforeFind`, `afterFind`, `beforeCreate`, `afterCreate`, `beforeUpdate`, `afterUpdate`, `beforeDelete`, `afterDelete`.

### Hook Context

Every hook receives a mutable `HookContext`:

| Property | Type | Description |
|----------|------|-------------|
| `collection` | string | Collection name |
| `operation` | string | `'find'`, `'create'`, `'update'`, `'patch'`, `'delete'` |
| `user` | User | Authenticated user (from `req.user`) |
| `query` | MongoQuery | MongoDB query object (find operations) |
| `data` | any | Request body (create/update operations) |
| `result` | any | Database result (after hooks) |
| `id` | string | Document ID (get/update/delete) |
| `req` | Request | Express request |
| `res` | Response | Express response |
| `meta` | object | Custom metadata |
| `preventDefault` | boolean | Set `true` to skip the default operation |

## Authentication & Authorization

### Auth middleware

Provide your own auth middleware to populate `req.user`:

```ts
const monapi = new Monapi({
  connection: mongoose.connection,
  auth: {
    middleware: (req, res, next) => {
      const token = req.headers.authorization?.split(' ')[1]
      req.user = verifyToken(token)
      next()
    },
  },
})
```

### Role-based permissions

```ts
monapi.resource('posts', {
  schema: PostSchema,
  permissions: {
    list: ['admin', 'user'],         // any of these roles
    get: ['admin', 'user'],
    create: ['admin', 'editor'],
    update: ['admin', 'editor'],
    delete: ['admin'],
  },
})
```

### Custom permission functions

```ts
monapi.resource('posts', {
  schema: PostSchema,
  permissions: {
    update: async (ctx) => {
      // Only allow authors to edit their own posts
      const post = await PostModel.findById(ctx.id)
      return post?.author.toString() === ctx.user.id
    },
    delete: (ctx) => ctx.user.roles?.includes('admin'),
  },
})
```

## Custom Middleware

Inject middleware at different levels:

```ts
monapi.resource('users', {
  schema: UserSchema,
  middleware: {
    all: [rateLimiter],                    // all operations
    create: [validateCaptcha],             // only create
    delete: [requireSuperAdmin],           // only delete
  },
})
```

## Custom Handlers

Override any default handler:

```ts
monapi.resource('users', {
  schema: UserSchema,
  handlers: {
    list: async (req, res, next) => {
      // Completely custom list implementation
      const users = await UserModel.aggregate([...])
      res.json({ data: users, meta: { page: 1, limit: 10, total: users.length } })
    },
  },
})
```

## Global Defaults

```ts
const monapi = new Monapi({
  connection: mongoose.connection,
  defaults: {
    pagination: {
      limit: 20,         // default page size
      maxLimit: 100,      // maximum allowed page size
    },
    security: {
      maxRegexLength: 50,     // max length for __like patterns
    },
  },
})
```

## Response Formats

### List response

```json
{
  "data": [
    { "_id": "...", "name": "John", "email": "john@test.com" }
  ],
  "meta": {
    "page": 1,
    "limit": 20,
    "total": 42,
    "totalPages": 3
  }
}
```

### Single document response

```json
{
  "data": {
    "_id": "...",
    "name": "John",
    "email": "john@test.com"
  }
}
```

### Error response

```json
{
  "error": {
    "code": "NOT_FOUND",
    "message": "users with id '123' not found"
  }
}
```

## Security

monapi enforces safe defaults:

- Filters only work on schema-defined fields (when `allowedFilters` is set or adapter is provided)
- All filter operators are whitelisted (no raw MongoDB operators)
- `$` prefixed field names are blocked everywhere (filters, sort, projection, patch body)
- Regex patterns have length limits
- Maximum filter count enforced
- Pagination limits enforced (configurable `maxLimit`)
- Patch bodies reject `$` operators (no `$set`, `$unset` injection)
- Production error responses hide internal details

## API Reference

### `new Monapi(config)`

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `connection` | `mongoose.Connection` | *required* | MongoDB connection |
| `basePath` | `string` | `''` | Base path prefix for routes |
| `auth` | `AuthConfig` | - | Auth configuration |
| `defaults` | `DefaultConfig` | - | Global defaults |
| `logger` | `Logger` | console logger | Custom logger |

### `monapi.resource(name, config)`

| Option | Type | Description |
|--------|------|-------------|
| `schema` | `Schema \| Model` | Mongoose schema or model |
| `model` | `Model` | Explicit Mongoose model (optional) |
| `query` | `QueryConfig` | Filter/sort/pagination config |
| `hooks` | `LifecycleHooks` | Before/after hooks |
| `permissions` | `PermissionConfig` | Role-based or custom permissions |
| `middleware` | `MiddlewareConfig` | Custom middleware per operation |
| `handlers` | `CRUDHandlers` | Override default handlers |
| `adapter` | `SchemaAdapter` | Custom schema adapter |

### `monapi.router()`

Returns an Express `Router` with all registered collection routes.

## License

MIT

You are a senior Node.js + MongoDB engineer and open-source maintainer.

### Project

**Name:** monapi
**Type:** Production-ready npm package
**Goal:** Automatically generate secure, extensible REST APIs for MongoDB collections using configuration only, similar in spirit to PostgREST but for MongoDB.

---

### Problem Statement

Building basic CRUD APIs for every MongoDB collection (list, get by id, create, update, delete, filtering, sorting, pagination) is repetitive and time-consuming. Developers should focus on business logic, not boilerplate.

---

### Core Requirements

## 1. Automatic CRUD API Generation (Mandatory)

For each configured collection, monapi must automatically expose the following REST endpoints:

```http
GET    /:collection           → list documents
GET    /:collection/:id       → get document by id
POST   /:collection           → create document
PUT    /:collection/:id       → update document (replace)
PATCH  /:collection/:id       → update document (partial)
DELETE /:collection/:id       → delete document
```

Each endpoint must support:

* Validation
* Authorization
* Error handling
* Safe defaults for production

---

## 2. Schema Handling (Mandatory)

monapi must support multiple schema types:

* **Mongoose schemas**
* **Typegoose models**
* **Validator-first schemas** (Zod / Joi / Yup)

### Schema Behavior

If **only a schema or model is provided**, monapi must:

* Auto-generate all CRUD APIs
* Apply default request validation
* Enable filtering, sorting, pagination, and field selection
* Return a standardized default response format

Mixed usage (database model + validator schema) must be supported.

---

## 3. Default Response Format

All list endpoints must return:

```json
{
  "data": [],
  "meta": {
    "page": 1,
    "limit": 10,
    "total": 0
  }
}
```

Single-record endpoints must return:

```json
{
  "data": {}
}
```

---

## 4. Easy Filtering (Primary UX)

Filtering must be **simple by default**, readable, and beginner-friendly.

### Default Filter Syntax (Simple Mode)

```http
GET /users?age=25&role=admin
```

Equality is implicit.

### Comparison Operators (Suffix-Based)

Use double-underscore operators:

```http
GET /users?age__gt=18&age__lt=29
```

Supported operators:

* `__eq` (default)
* `__ne`
* `__gt`
* `__gte`
* `__lt`
* `__lte`
* `__in` (comma-separated)
* `__nin`
* `__like` (partial match)
* `__exists`

Examples:

```http
GET /users?role__in=admin,user
GET /users?name__like=john
GET /users?email__exists=true
```

Dates must be auto-detected from ISO strings.

---

## 5. Advanced Filtering (Optional / Power Users)

Structured filters must also be supported:

```http
GET /users?filter[age][gt]=18&filter[age][lt]=29
```

This mode is optional and not required for normal usage.

---

## 6. Query Features (Mandatory)

* Sorting:

  ```http
  ?sort=age,-createdAt
  ```

* Pagination:

  ```http
  ?page=2&limit=20
  ```

* Field selection (projection):

  ```http
  ?fields=name,email
  ```

---

## 7. Authentication & Authorization

* Plug-and-play auth middleware
* Role-based access control
* Per-collection and per-route permissions
* Ability to inject custom auth logic

---

## 8. Extensibility

* Lifecycle hooks:

  * beforeCreate / afterCreate
  * beforeUpdate / afterUpdate
  * beforeDelete / afterDelete
  * beforeFind / afterFind
* Ability to override default handlers
* Custom middleware injection

---

## 9. Security & Safety (Mandatory)

* Filters allowed only on schema-defined fields
* Operators must be whitelisted
* No raw MongoDB operators
* No `$where`
* Regex length & complexity limits
* Pagination & query cost limits enforced
* Safe production error responses

---

## 10. Technical Requirements

* Written in **TypeScript**
* Fully typed public API
* Clean modular architecture
* No framework lock-in (Express default, Fastify adapter support)
* Production-grade logging
* MongoDB optimized querying
* Tree-shakable package

---

## Deliverables

1. monapi npm package (publish-ready)
2. Core engine implementation
3. Public TypeScript interfaces
4. Example usage
5. README.md documentation
6. Minimal landing page content

---

## What to Do Now

1. Design the overall architecture
2. Define the public configuration API
3. Design schema adapters (mongoose / typegoose / validators)
4. Design filter parser (simple + advanced)
5. Implement CRUD engine
6. Prepare README and examples

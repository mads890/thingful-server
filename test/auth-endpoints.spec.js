const knex = require('knex')
const jwt = require('jsonwebtoken')
const app = require('../src/app')
const helpers = require('./test-helpers')
const supertest = require('supertest')

describe('Auth Endpoints', function() {
    let db

    const { testUsers } = helpers.makeUsersArray()
    const testUser = testUsers[0]

    before('make knex instance', () => {
        db = knex({
            client: 'pg',
            connection: process.env.TEST_DB_URL,
        })
        app.set('db', db)
    })

    after('disconnect from db', () => db.destroy())

    before('cleanup', () => helpers.cleanTables(db))

    afterEach('cleanup', () => helpers.cleanTables(db))

    describe(`POST /api/auth/login`, () => {
        beforeEach('insert users', () =>
            helpers.seedUsers(
                db,
                testUsers,
            )
        )

        const requiredFields = ['user_name', 'password']

        requiredFields.forEach(field => {
            const loginAttemptBody = {
                user_name: testUser.user_name,
                password: testUser.password,
            }

            it(`responds with 400 when ${field} is missing`, () => {
                delete loginAttemptBody[field]

                return supertest(app)
                    .post('/api/auth/login')
                    .send(loginAttemptBody)
                    .expect(400, { error: `Missing '${field}' in request body` })
            })
        })

        it(`responds 400 'invalid username or password' when invalid username`, () => {
            const invalidUsername = { user_name: 'invalid', password: testUser.password}
            return supertest(app)
                .post('/api/auth/login')
                .send(invalidUsername)
                .expect(400, { error: `Invalid username or password` })
        })

        it(`responds 400 'invalid username or password' when invalid password`, () => {
            const invalidPassword = { user_name: testUser.user_name, password: 'invalid'}
            return supertest(app)
                .post('/api/auth/login')
                .send(invalidPassword)
                .expect(400, { error: `Invalid username or password` })
        })

        it(`responds 200 and JWT auth token using secret when valid creds`, () => {
            const validUser = {user_name: testUser.user_name, password: testUser.password}
            const expectedToken = jwt.sign(
                {user_id: testUser.id},
                process.env.JWT_SECRET,
                {
                    subject: testUser.user_name,
                    algorithm: 'HS256'
                }
            )
            return supertest(app)
                .post('/api/auth/login')
                .send(validUser)
                .expect(200, {authToken: expectedToken})
        })
    })
})
const knex = require('knex')
const app = require('../src/app')
const bcrypt = require('bcryptjs')
const helpers = require('./test-helpers')
const supertest = require('supertest')
const { expect } = require('chai')

describe.only('Users Endpoints', function() {
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

  describe(`POST /api/users`, () => {
    context(`User Validation`, () => {
      beforeEach('insert users', () =>
        helpers.seedUsers(
          db,
          testUsers,
        )
      )

      const requiredFields = ['user_name', 'password', 'full_name']

      requiredFields.forEach(field => {
        const registerAttemptBody = {
          user_name: 'test user_name',
          password: 'test password',
          full_name: 'test full_name',
          nickname: 'test nickname',
        }

        it(`responds with 400 required error when '${field}' is missing`, () => {
          delete registerAttemptBody[field]

          return supertest(app)
            .post('/api/users')
            .send(registerAttemptBody)
            .expect(400, {
              error: `Missing '${field}' in request body`,
            })
        })
    })

        it(`responds 400 'password must be 8 char' when empty password`, () => {
            const userEmptyPass = {
                user_name: 'username',
                password: '',
                full_name: 'full name',
            }
            return supertest(app)
                .post('/api/users')
                .send(userEmptyPass)
                .expect(400, {error: `Password must be longer than 8 characters` })
        })

        it(`responds 400 'Password must be less than 72 characters' when long pass`, () => {
            const userLongPass = {
                user_name: 'username',
                password: 'aA*'.repeat(25)
                full_name: 'full name',
            }
            return supertest(app)
                .post('/api/users')
                .send(userLongPass)
                .expect(400, { error: `Password must be less than 72 characters` })
        })

        it(`responds 400 error when password starts with spaces`, () => {
            const userPassLeadingSpace = {
                user_name: 'username',
                password: ' aA!bBb123',
                full_name: 'full name',
            }
            return supertest(app)
                .post('/api/users')
                .send(userPassLeadingSpace)
                .expect(400, { error: `Password must not start or end with empty spaces` })
        })

        it(`responds with 400 when password ends with spaces`, () => {
            const userPassTrailingSpace = {
                user_name: 'username',
                password: 'aA!bBb123 ',
                full_name: 'full name',
            }
            return supertest(app)
                .post('/api/users')
                .send(userPassTrailingSpace)
                .expect(400, { error: `Password must not start or end with empty spaces` })
        })

        it(`responds with 400 when password is not complex`, () => {
            const userSimplePass = {
                user_name: 'username',
                password: 'helloworld',
                full_name: 'full name',
            }
            return supertest(app)
                .post('/api/users')
                .send(userSimplePass)
                .expect(400, { error: `Password must contain an uppercase letter, a lowercase letter, a number, and a special character` })
        })

        it(`responds 400 'username already exists' when appropriate`, () => {
            const duplicateUser = {
                user_name: testUser.user_name,
                password: 'blfahBBFH12@@#$',
                full_name: 'full name',
            }
            return supertest(app)
                .post('/api/users')
                .send(duplicateUser)
                .expect(400, { error: 'username taken' })
        })
    })

    context(`happy path`, () => {
        it(`responds 201, serialized user, storing bcrypted password`, () => {
            const newUser = {
                user_name: 'testUsername',
                password: 'TestPassw0rd!',
                full_name: 'testFull Name',
            }
            return supertest(app)
                .post('/api/users')
                .send(newUser)
                .expect(201)
                .expect(res => {
                    expect(res.body).to.have.property('id')
                    expect(res.body.user_name).to.eql(newUser.user_name)
                    expect(res.body.full_name).to.eql(newUser.full_name)
                    expect(res.body.nick_name).to.eql('')
                    expect(res.body).to.not.have.property('password')
                    expect(res.headers.location).to.eql(`api/users/${res.body.id}`)
                    const expectedDate = new Date().toLocaleString('en', { timeZone: 'UTC' })
                    const actualDate = new Date(res.body.date_created).toLocaleString()
                    expect(actualDate).to.eql(expectedDate)
                })
                .expect(res => 
                    db
                        .from('thingful_users')
                        .select('*')
                        .where({ id: res.body.id })
                        .first()
                        .then(row => {
                            expect(row.user_name).to.eql(newUser.user_name)
                            expect(row.full_name).to.eql(newUser.full_name)
                            expect(row.nick_name).to.eql(null)
                            const expectedDate = newDate().toLocaleString('en', { timeZone: 'UTC' })
                            const actualDate = new Date(row.date_created).toLocaleString()
                            expect(actualDate).to.eql(expectedDate)

                            return bcrypt.compare(newUser.password, row.password)
                        })
                        .then(compareMatch => {
                            expect(compareMatch).to.be.true
                        })
                )
        }
    })
  })
})
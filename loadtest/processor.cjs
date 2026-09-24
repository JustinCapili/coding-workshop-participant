/**
 * Artillery hooks: each virtual user signs in as a random seeded account of the scenario's role.
 * CommonJS because Artillery loads processors with require. users.json comes from seed.js.
 */
const fs = require('node:fs')
const path = require('node:path')

const users = JSON.parse(fs.readFileSync(path.join(__dirname, 'users.json'), 'utf8'))

function signInAs(list) {
  return (context, events, done) => {
    const user = list[Math.floor(Math.random() * list.length)]
    context.vars.email = user.email
    context.vars.password = user.password
    // Unique per virtual user, so every filed report can be told apart in the database.
    context.vars.title = `Load test ${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`
    return done()
  }
}

module.exports = {
  asEmployee: signInAs(users.employees),
  asEngineer: signInAs(users.engineers),
  asAdmin: signInAs(users.admins),
}

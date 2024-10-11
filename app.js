const express = require('express')
const {open} = require('sqlite')
const sqlite3 = require('sqlite3')
const path = require('path')
const bcrypt = require('bcrypt')
const jwttoken = require('jsonwebtoken')

const dbPath = path.join(__dirname, 'covid19IndiaPortal.db')

const app = express()

app.use(express.json())

let db = null

const initializeDbAndServer = async () => {
  try {
    db = await open({
      filename: dbPath,
      driver: sqlite3.Database,
    })

    app.listen(3000, () => {
      console.log('Server is running on http://localhost:3000')
    })
  } catch (e) {
    console.log(`Error Message ${e.message}`)
    process.exit(1)
  }
}
initializeDbAndServer()

const authenticateToken = (request, response, next) => {
  const authenticationHeader = request.headers['authorization']
  let jwt
  if (authenticationHeader !== undefined) {
    jwt = authenticationHeader.split(' ')[1]
  }
  if (jwt === undefined) {
    response.status(401)
    response.send('Invalid JWT Token')
  } else {
    jwttoken.verify(jwt, 'MY_SECRET_TOKEN', async (err, payLoad) => {
      if (err) {
        response.status(401)
        response.send('Invalid JWT Token')
      } else {
        next()
      }
    })
  }
}

//API 1  Path: /login/ Method: POST

app.post('/login/', async (request, response) => {
  const {username, password} = request.body
  try {
    const checkUser = `
    SELECT * FROM user WHERE username='${username}';
  `
    const user = await db.get(checkUser)
    if (user === undefined) {
      response.status(400)
      response.send('Invalid user')
    } else {
      const checkPassword = await bcrypt.compare(password, user.password)
      if (checkPassword) {
        const payLoad = {
          username: username,
        }
        const token = jwttoken.sign(payLoad, 'MY_SECRET_TOKEN')
        response.send({ jwtToken: token })
      } else {
        response.status(400)
        response.send('Invalid password')
      }
    }
  } catch (e) {
    console.log(`Internal error ${e.message}`)
  }
})

//Path: /states/    Method: GET api call 2

const convertStateDbObjectToResponseObject = dbObject => {
  return {
    stateId: dbObject.state_id,
    stateName: dbObject.state_name,
    population: dbObject.population,
  }
}

app.get('/states/', authenticateToken, async (request, response) => {
  const getAllstateQuery = `
           SELECT * FROM state;   
       `
  const result = await db.all(getAllstateQuery)
  response.send(
    result.map(eachState => convertStateDbObjectToResponseObject(eachState)),
  )
})

//API 3   Path: /states/:stateId/    Method: GET

app.get('/states/:stateId/', authenticateToken, async (request, response) => {
  const {stateId} = request.params
  const getstateQuery = `
    SELECT * FROM state WHERE state_id=${stateId};
  `
  const result = await db.get(getstateQuery)
  response.send(convertStateDbObjectToResponseObject(result))
})

//API 4   Path: /districts/  Method: POST

app.post('/districts/', authenticateToken, async (request, response) => {
  const {districtName, stateId, cases, cured, active, deaths} = request.body
  const createDistrictQuery = `
      INSERT INTO district ( district_name, state_id, cases,cured,active,deaths)
      VALUES ('${districtName}',${stateId},${cases},${cured},${active},${deaths});
  `
  await db.run(createDistrictQuery)
  response.send('District Successfully Added')
})

//API 5   Path: /districts/:districtId/  Method: GET

const convertDistrictDbObjectToResponseObject = dbObject => {
  return {
    districtId: dbObject.district_id,
    districtName: dbObject.district_name,
    stateId: dbObject.state_id,
    cases: dbObject.cases,
    cured: dbObject.cured,
    active: dbObject.active,
    deaths: dbObject.deaths,
  }
}

app.get('/districts/:districtId/', authenticateToken, async (request, response) => {
  const {districtId} = request.params
  const getdistrict = `
        SELECT * FROM district WHERE district_id=${districtId};
      `
  const result = await db.get(getdistrict)
  response.send(convertDistrictDbObjectToResponseObject(result))
})

//API 6  Path: /districts/:districtId/   Method: DELETE

app.delete('/districts/:districtId/',authenticateToken, async (request, response) => {
  const {districtId} = request.params
  const deleteDistrictQuery = `
    DELETE  FROM district WHERE district_id=${districtId};
  `
  await db.run(deleteDistrictQuery)
  response.send('District Removed')
})

//Path: /districts/:districtId/    Method: PUT API 7

app.put('/districts/:districtId/', authenticateToken, async (request, response) => {
  const {districtId} = request.params
  const {districtName, stateId, cases, cured, active, deaths} = request.body
  const updateDistrictQuery = `
    UPDATE district SET
      district_name = '${districtName}',state_id = ${stateId},cases = ${cases},cured = ${cured},active = ${active},deaths = ${deaths} WHERE district_id = ${districtId};
  `
  await db.run(updateDistrictQuery)
  response.send('District Details Updated')
})

//API 8   Path: /states/:stateId/stats/   Method: GET
app.get('/states/:stateId/stats/', authenticateToken, async (request, response) => {
  const {stateId} = request.params
  const getStateDetails = `SELECT SUM(cases) AS totalCases,SUM(cured) AS totalCured,SUM(active) AS totalActive,SUM(deaths) AS totalDeaths FROM district WHERE state_id = '${stateId}';`

  const result = await db.get(getStateDetails)

  response.send({
      totalCases: result.totalCases,
      totalCured: result.totalCured,
      totalActive: result.totalActive,
      totalDeaths: result.totalDeaths
    });
})

module.exports = app

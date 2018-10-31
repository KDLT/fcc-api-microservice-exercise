const express = require('express')
const app = express()
const bodyParser = require('body-parser')

const cors = require('cors')

const mongoose = require('mongoose')
mongoose.connect(process.env.MLAB_URI || 'mongodb://localhost/exercise-track')

app.use(cors())

app.use(bodyParser.urlencoded({extended: false}))
app.use(bodyParser.json())

app.use(myMiddleware);

app.use(express.static('public'))
app.get('/', (req, res) => {
  res.sendFile(__dirname + '/views/index.html')
});

function myMiddleware(req, res, next) {
  console.log(`${req.method} ${req.path} - ${req.ip}`);
  next();
} // kapag naka-arrow function dapat mauna ideclare bago gamitin

const logSchema = new mongoose.Schema({
  description: {type: String},
  duration: {type: Number},
  date: {type: Object}
});

const userSchema = new mongoose.Schema({
  username: {type: String, required: true},
  log: [logSchema]
});
const User = mongoose.model('User', userSchema);

// I can create a user by posting form data username to /api/exercise/new-user and returned will be an object with username and _id.
// adds new user to designated database
app.post('/api/exercise/new-user', function(req, res, next) {
  // console.log('req.body: ', req.body); // {username: 'your_entered_username'}
  console.log('req.body.username: ', req.body.username);
  let newUser = new User({username: req.body.username})
  newUser.save(function(err, user) {
    err ? next(err) : res.json({username: user.username, _id: user._id})
  });
});

// DEVELOPMENT ONLY, DELETES ALL USER INFORMATION
app.post('/api/exercise/delete-all', function(req, res, next) {
  console.log('wiping user database..');
  User.deleteMany({}, function(err, removedData) { // this deletes all dahil blank ang criteria
    // console.log('removedData:', 'removed ' + removedData.n + ' entries.');
    err ? next(err) : res.send('removed ' + removedData.n + ' entries.');
  });
});

// responds with the complete array of user and corresponding id
app.get('/api/exercise/users', function(req, res, next) {
  console.log('getting full userlist...');
  // User.find({}, function(err, completeArray) {
  //   let responseArray = completeArray.map(data => {
  //     let _id = data._id, username = data.username;
  //     return {_id, username}; 
  //   });
  //   err ? next(err) : res.json(responseArray)
  // }); // old User.find()
  User.find({})
      .select('-__v -log') // don't show the log and __v
      .exec(function(err, userList) {
        err ? next(err) : res.send(userList)
      })
});

// takes the request string from html form and returns a valid date string
// if the input is invalid, returns the current time with new Date()
const returnDateData = (requestString) => {
  let dateObject = new Date(requestString);
  if (dateObject instanceof Date && !isNaN(dateObject)) { // && kasi kapag blank ang input 'di dapat pilitin gawing string
    // return dateObject.toString().slice(0,15) // old, i've decided to put return the date object instead of the string version
    return dateObject
  } else { // kapag warak 'yung input na date, current date ang ireturn
    // return new Date().toString().slice(0,15)
    return new Date()
  };
};

// I can add an exercise to any user by posting form data userId(_id), description, duration, and optionally date to /api/exercise/add. 
// If no date supplied it will use current date. Returned will the the user object with also with the exercise fields added.
// new Date('2012-02-02') == 'Thu Feb 02 2012 08:00:00 GMT+0800 (Philippine Standard Time)'
// sample desired response: {"username":"hello","description":"hasdfsdf","duration":23,"_id":"BkP-DPnHe","date":"Mon Feb 20 1888"}
app.post('/api/exercise/add', function(req, res, next) {
  console.log('adding exercise...'); 
  let dateData = returnDateData(req.body.date);
  let id = req.body.userId;
  let update = {
    description: req.body.description,
    duration: req.body.duration,
    date: dateData
  };
  User.findOneAndUpdate(
    {_id: id}, // criteria
    {$push: {
      log: {
        description: update.description,
        duration: update.duration,
        date: update.date
      }
    }},
    { new: false, upsert: false }, // options
    function(err, data) { // callback
      err ? next(err) 
      : res.json({
        username: data.username,
        description: update.description,
        duration: update.duration,
        date: update.date.toString().slice(0,15) // date is still a Date Object, it just responds with a string here for readability
      })
    });
});

// I can retrieve a full exercise log of any user by getting /api/exercise/log with a parameter of userId(_id). Return will be the user object with added array log and count (total exercise count).
// I can retrieve part of the log of any user by also passing along optional parameters of from & to or limit. (Date format yyyy-mm-dd, limit = int)

// example URI request: https://fuschia-custard.glitch.me/api/exercise/log?userId=r1LSbd3He
// example output response: {"_id":"r1LSbd3He","username":"2956fcc","count":0,"log":[]}

// example URL: https://fcc-api-microservice-exercise.glitch.me/api/exercise/log?userId=5bd9583982e4e70e24253ea4&from=2012-05-10&to=2012-05-12&limit=2

// different example output: {"_id":"5bd9445e43cd831d3da9c02e","username":"Adel","count":1,"log":[{"_id":"5bd94bb3bb5acf25f0155a61","duration":2,"date":"Wed May 09 2012"}]}

// /api/exercise/log?{userId}[&from][&to][&limit]

app.get('/api/exercise/log', function(req, res, next) {
  console.log({from: req.query.from, to: req.query.to});
  let search = {
    _id: req.query.userId,
    from: new Date(req.query.from),
    // from: returnDateData(req.query.from),
    to: new Date(req.query.to),
    // to: returnDateData(req.query.to),
    limit: parseInt(req.query.limit)
  };
  console.log(search);
  User.findOne({_id: search._id})
      .exec(function(err, match) {
        if (err) {
          next(err);
        } else {
          console.log('anong match? ', match);
          if (!req.query.from || !req.query.to) {
            res.json(match.log);
          } else {
            console.log('filtering...')
            let filteredLog = match.log.filter(d => d.date >= search.from && d.date <= search.to);
            console.log('sorting...')
            let sortedLog = filteredLog.sort((a,b) => a.date - b.date); console.log('sortedLog', sortedLog);
            console.log('slicing...')
            let slicedLog = sortedLog.slice(0, search.limit);
            res.json(slicedLog);
          }
        }
      })
});

const listener = app.listen(process.env.PORT || 3000, () => {
  console.log('Your app is listening on port ' + listener.address().port)
})

// All error handling middlewares are positioned after all route calls (e.g., GET POST)
// Not found middleware
app.use((req, res, next) => {
  return next({status: 404, message: 'not found'})
})

// Error Handling middleware
app.use((err, req, res, next) => {
  let errCode, errMessage

  if (err.errors) {
    // mongoose validation error
    errCode = 400 // bad request
    const keys = Object.keys(err.errors)
    // report the first validation error
    errMessage = err.errors[keys[0]].message
  } else {
    // generic or custom error
    errCode = err.status || 500
    errMessage = err.message || 'Internal Server Error'
  }
  res.status(errCode).type('txt')
    .send(errMessage)
})
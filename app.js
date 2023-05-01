const express = require("express");
const session = require("express-session");
require("dotenv").config();

const app = express();
const port = 3000;
const path = require("path");
const router = express.Router();
const bodyParser = require("body-parser");

const { MongoClient } = require("mongodb");

const mongoConnectionUri = `mongodb+srv://${process.env.MONGODB_USER}:${process.env.MONGODB_PASSWORD}@${process.env.MONGODB_CLUSTER}`;
const mongoDb = process.env.MONGODB_DATABASE;
const mongoCollection = process.env.MONGODB_COLLECTION;

const bcrypt = require("bcrypt");
const saltRounds = 10;

const Joi = require("joi");

app.use(bodyParser.urlencoded({ extended: false }));
app.use(express.static(path.join(__dirname, "public")));

app.use(
  session({
    secret: process.env.NODE_SESSION_SECRET,
    //secret: 'secrettt',
    resave: false,
    saveUninitialized: false,
  })
);

app.set("view engine", "pug");
app.set("views", path.join(__dirname, "views"));

router.get("/", (req, res) => {
  if (req.session.username) {
    res.setHeader("Content-Type", "text/html");
    res.write('<a href="/members">Go to Members Area</a><p>');
    res.write('<a href="/logout">Logout</a>');
    res.end();
  } else {
    res.setHeader("Content-Type", "text/html");
    res.write(
      '<link rel="stylsheet" type="text/css" href="/public/stylesheets/style.css">'
    );
    res.write('<a href="/signup">Signup</a><p>');
    res.write('<a href="/login">Login</a>');
    res.end();
  }
});

router.get("/login", (req, res) => {
  res.render("login");
});

router.post("/loginSubmit", async function (req, res) {
  console.log("loginSubmit called with email: " + req.body.email);

  const loginData = {
    email: req.body.email,
    password: req.body.password,
  };

  const loginSchema = Joi.object({
    email: Joi.string().min(3).required().email(),
    password: Joi.string().min(3).required(),
  });

  const { error, value } = loginSchema.validate(loginData);

  if (error) {
    res.setHeader("Content-Type", "text/html");
    res.write(`<p>${error}<\p>`);
    res.write('<a href="/login">Try again</a>');
    res.end();
    return;
  }

  const client = new MongoClient(mongoConnectionUri);
  //const client = new MongoClient('mongodb+srv://User230430:v8Ztsn35GZKJcgO7@cluster0.gwjgaoz.mongodb.net');

  await client.connect();
  console.log("Connected successfully to mongodb");
  const db = client.db(mongoDb);
  //const db = client.db('asgn1');
  const usersCollection = db.collection(mongoCollection);
  //const usersCollection = db.collection('users');
  const query = { _id: loginData.email };
  const userDocument = await usersCollection.findOne(query);
  //console.log("userDocument: " + JSON.stringify(userDocument));

  //ToDo: create pw hash below
  // let hashedPassword;
  // bcrypt.hash(loginData.password, saltRounds, function(err, hash) {
  //   if(err){
  //     console.log(err);
  //   }
  //   hashedPassword = hash;
  // });

  //-- hash doesn't work here
  let hashedPassword = loginData.password;

  if (!userDocument || userDocument.password !== hashedPassword) {
    res.setHeader("Content-Type", "text/html");
    res.write("<p>Invalid email/password combination<p>");
    res.write('<a href="/login">Try again</a>');
    res.end();
    return;
  }

  //-- Create a session
  req.session.username = userDocument.username;
  //--redirect the user to the /members page.
  res.redirect("/members");
});

router.get("/signup", (req, res) => {
  res.render("signup");
});

router.post("/signupSubmit", async function (req, res) {
  console.log("signupSubmit called with name: " + req.body.name);

  const signupData = {
    name: req.body.name,
    email: req.body.email,
    password: req.body.password,
  };

  //--ToDo: using Joi to validate the input (name, email and password) so that NoSQL Injection attacks are not possible.
  const signupSchema = Joi.object({
    name: Joi.string().min(1).required(),
    email: Joi.string().min(3).required().email(),
    password: Joi.string().min(3).required(),
  });

  const { error, value } = signupSchema.validate(signupData);

  if (error) {
    res.setHeader("Content-Type", "text/html");
    res.write(`<p>${error}<\p>`);
    res.write('<a href="/signup">Try again</a>');
    res.end();
    return;
  }

  //--ToDo: Add the name, email and a BCrypted hashed password as a user to the database.
  // let hashedPassword;
  // bcrypt.hash(signupData.password, saltRounds, function(err, hash) {
  //   hashedPassword = hash;
  // });

  //-- hash works here but disabled cause it doesn't work in login
  const hashedPassword = signupData.password;

  const client = new MongoClient(mongoConnectionUri);
  try {
    await client.connect();
    console.log("Connected successfully to mongodb");
    const db = client.db(mongoDb);
    const usersCollection = db.collection(mongoCollection);

    try {
      await usersCollection.insertOne({
        _id: signupData.email,
        username: signupData.name,
        password: hashedPassword,
      });
    } catch (e) {
      if (e.code === 11000) {
        res.setHeader("Content-Type", "text/html");
        res.write(`<p>User with email ${signupData.email} already exists<\p>`);
        res.write('<a href="/signup">Try again</a>');
        res.end();
        return;
      }
      throw e;
    }

    console.log("Signup data inserted to Db");
  } finally {
    await client.close();
  }

  //-- Create a session
  req.session.username = req.body.name;
  //--redirect the user to the /members page.
  res.redirect("/members");
});

router.get("/members", (req, res) => {
  if (!req.session.username) {
    res.end("unauthorized");
    return;
  }
  const imageFile = getRandomImageFile();
  res.render("members", { userName: req.session.username });
});

router.get("/logout", (req, res) => {
  req.session.destroy();
  res.redirect("/");
});

//-- ToDo: test route, remove
router.get("/setSession", (req, res) => {
  req.session.username = "test-session-user-name";
  res.end("session is set");
});

//-- ToDo: test route, remove
router.get("/tryMongo", async function (req, res) {
  const client = new MongoClient(mongoConnectionUri);
  try {
    await client.connect();
    console.log("Connected successfully to server");
    const db = client.db(mongoDb);
    const usersCollection = db.collection(mongoCollection);
    const cursor = usersCollection.find();
    res.end("connected to MongoDb");
  } finally {
    await client.close();
  }
});

app.use("/", router);
app.listen(process.env.port || 3000);

console.log("Running at Port 3000");

function getRandomImageFile() {
  //--ToDo: implement random
  return "image_1.jpg";
}

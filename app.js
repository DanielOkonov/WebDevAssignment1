const express = require("express");
const session = require("express-session");
const MongoDbSessionStore = require("connect-mongodb-session")(session);
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

var sessionStore = new MongoDbSessionStore({
  uri: mongoConnectionUri,
  collection: "sessions",
});

const bcrypt = require("bcrypt");
const saltRounds = 10;

const Joi = require("joi");

app.use(bodyParser.urlencoded({ extended: false }));
app.use(express.static(path.join(__dirname, "public")));

app.use(
  session({
    secret: process.env.SESSION_SECRET,
    cookie: {
      maxAge: 1000 * 60 * 60,
    },
    store: sessionStore,
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

  await client.connect();
  console.log("Connected successfully to mongodb");
  const db = client.db(mongoDb);
  const usersCollection = db.collection(mongoCollection);
  const query = { _id: loginData.email };
  const userDocument = await usersCollection.findOne(query);

  if (
    !userDocument ||
    !bcrypt.compareSync(loginData.password, userDocument.password)
  ) {
    res.setHeader("Content-Type", "text/html");
    res.write("<p>Invalid email/password combination<p>");
    res.write('<a href="/login">Try again</a>');
    res.end();
    return;
  }

  req.session.username = userDocument.username;
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

  const salt = bcrypt.genSaltSync(saltRounds);
  const hashedPassword = bcrypt.hashSync(signupData.password, salt);

  const client = new MongoClient(mongoConnectionUri);

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

  req.session.username = req.body.name;
  res.redirect("/members");
});

router.get("/members", (req, res) => {
  if (!req.session.username) {
    res.end("unauthorized");
    return;
  }
  const imageFile = getRandomImageFile();
  res.render("members", { userName: req.session.username, image: imageFile });
});

router.get("/logout", (req, res) => {
  req.session.destroy();
  res.redirect("/");
});

router.get("*", (req, res) => {
  res.setHeader("Content-Type", "text/html");
  res.write("<p>Page not found<p>");
  res.statusCode = 404;
  res.end();
});

app.use("/", router);
app.listen(process.env.port || 3000);

console.log("Running at Port 3000");

function getRandomImageFile() {
  const imageNum = 1 + Math.floor(Math.random() * 3);
  return `image_${imageNum}.jpg`;
}

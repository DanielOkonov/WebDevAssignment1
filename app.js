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

app.set("view engine", "ejs");
app.set("views", path.join(__dirname, "views"));

router.get("/", (req, res) => {
  if (req.session.user) {
    res.render("indexAuthenticated");
  } else {
    res.render("index");
  }
});

router.get("/login", (req, res) => {
  res.render("login");
});

router.post(
  "/loginSubmit",
  bodyParser.urlencoded({ extended: false }),
  async function (req, res) {
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

    const usersCollection = await connectToUsersCollection();
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

    req.session.user = {
      email: userDocument._id,
      name: userDocument.username,
      type: userDocument.type,
    };

    res.redirect("/members");
  }
);

router.get("/signup", (req, res) => {
  res.render("signup");
});

router.post(
  "/signupSubmit",
  bodyParser.urlencoded({ extended: false }),
  async function (req, res) {
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

    const usersCollection = await connectToUsersCollection();
    let type = "user";

    //Makes the first user an admin to have at least one admin when the database is empty.
    if ((await usersCollection.countDocuments()) === 0) {
      type = "admin";
    }

    try {
      await usersCollection.insertOne({
        _id: signupData.email,
        username: signupData.name,
        password: hashedPassword,
        type: type,
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

    req.session.user = {
      email: signupData.email,
      name: signupData.name,
      type: type,
    };

    res.redirect("/members");
  }
);

router.get("/members", (req, res) => {
  if (!req.session.user) {
    res.redirect("/");
    return;
  }
  res.render("members", { userName: req.session.user.name });
});

router.get("/logout", (req, res) => {
  req.session.destroy();
  res.redirect("/");
});

router.get("/admin", async function (req, res) {
  if (!req.session.user) {
    res.redirect("/");
    return;
  }

  if (req.session.user.type !== "admin") {
    res.status(403).send();
    return;
  }

  const usersCollection = await connectToUsersCollection();
  const projection = { _id: 1, username: 2, type: 3 };
  const users = await usersCollection.find().project(projection).toArray();
  res.render("admin", {
    users: users,
    currentUserEmail: req.session.user.email,
  });
});

router.post("/promoteUser", bodyParser.json(), async function (req, res) {
  if (!req.session.user || req.session.user.type !== "admin") {
    res.redirect("/");
    return;
  }

  console.log(`promoteUser called with data: ${JSON.stringify(req.body)}`);

  const query = { _id: req.body.userId };
  const usersCollection = await connectToUsersCollection();
  await usersCollection.updateOne(query, { $set: { type: "admin" } });

  // usersCollection.updateOne(query, {$set: {type: 'admin'}})
  // .then(result => res.redirect('/admin'))
  // .catch(err => console.error(`Error occurred: ${err}`));

  res.redirect("/admin");
});

router.post("/demoteUser", bodyParser.json(), async function (req, res) {
  if (!req.session.user || req.session.user.type !== "admin") {
    res.redirect("/");
    return;
  }

  console.log(`demoteUser called with data: ${JSON.stringify(req.body)}`);

  const query = { _id: req.body.userId };
  const usersCollection = await connectToUsersCollection();
  await usersCollection.updateOne(query, { $set: { type: "user" } });

  res.redirect("/admin");
});

//TODO: remove.
router.get("/checksession", (req, res) => {
  const sessionData = req.session.user;
  console.log("sessionData: " + JSON.stringify(sessionData));
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

async function connectToUsersCollection() {
  const client = new MongoClient(mongoConnectionUri);
  await client.connect();
  console.log("Connected successfully to mongodb");
  const db = client.db(mongoDb);
  return db.collection(mongoCollection);
}

const express = require("express");
const session = require("express-session");
require("dotenv").config();

const app = express();
const port = 3000;
const path = require("path");
const router = express.Router();
const bodyParser = require("body-parser");

app.use(bodyParser.urlencoded({ extended: false }));
app.use(express.static(path.join(__dirname, "public")));

app.use(
  session({
    secret: "strashniysecret",
    resave: false,
    saveUninitialized: false,
  })
);

const testVar = process.env.TEST_VAR;

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

router.post("/loginSubmit", (req, res) => {
  console.log("loginSubmit called with email: " + req.body.email);
});

router.get("/signup", (req, res) => {
  res.render("signup");
});

router.post("/signupSubmit", (req, res) => {
  console.log("signupSubmit called with name: " + req.body.name);
  //res.end('session is set');

  //--ToDo: validate all 3 inputs to make sure they aren't empty.
  //--ToDo: using Joi to validate the input (name, email and password) so that NoSQL Injection attacks are not possible.
  //--ToDo: Add the name, email and a BCrypted hashed password as a user to the database.
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

router.get("/setSession", (req, res) => {
  req.session.username = "test-session-user-name";
  res.end("session is set");
});

app.use("/", router);
app.listen(process.env.port || 3000);

console.log("Running at Port 3000");

function getRandomImageFile() {
  //--ToDo: implement random
  return "image_1.jpg";
}

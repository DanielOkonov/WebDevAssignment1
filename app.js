const express = require("express");
require("dotenv").config();
const app = express();
const PORT = process.env.PORT || 3000;

app.get("/", (req, res) => {
  const name = process.env.TEST_VAR;
  res.send("Hello " + name);
});

app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});

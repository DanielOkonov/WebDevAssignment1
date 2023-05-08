function promote(email) {
  console.log(`promoting user...; email: ${email}`);

  fetch("/promoteUser", {
    method: "POST",
    body: JSON.stringify({
      userId: email,
    }),
    headers: {
      "Content-type": "application/json; charset=UTF-8",
    },
  });
}

function demote(email) {
  console.log(`demoting user...; email: ${email}`);

  fetch("/demoteUser", {
    method: "POST",
    body: JSON.stringify({
      userId: email,
    }),
    headers: {
      "Content-type": "application/json; charset=UTF-8",
    },
  });
}

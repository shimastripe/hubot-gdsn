module.exports = robot => {
  robot.respond(/hoge$/i, (res) => {
    res.send("hoge");
  });
}
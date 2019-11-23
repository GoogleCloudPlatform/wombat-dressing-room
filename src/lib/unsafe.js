// userland types bug. this is the only documented way to clear the session.
const clearSession = req => {
  if (req) req.session = null;
};
module.exports.clearSession = clearSession;

//userland type doesnt include user.url
const ghUserData = user => {
  if (user)
    return {
      avatar_url: user.avatar_url,
      html_url: user.html_url,
      name: user.name,
      login: user.login,
    };
  return {};
};

module.exports.ghUserData = ghUserData;

//debug helper
const logEmit = emitter => {
  const oem = emitter.emit;
  emitter.emit = function(ev) {
    console.log(ev);
    return oem.apply(this, arguments);
  };
};
module.exports.logEmit = logEmit;

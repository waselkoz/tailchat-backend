const validateEmail = (email) => {
  const re = /^\w+([\.-]?\w+)*@\w+([\.-]?\w+)*(\.\w{2,3})+$/;
  return re.test(String(email).toLowerCase());
};

const validateUsername = (username) => {
  return typeof username === 'string' && username.length >= 3 && username.length <= 30;
};

const validatePassword = (password) => {
  return typeof password === 'string' && password.length >= 6;
};

module.exports = { validateEmail, validateUsername, validatePassword };

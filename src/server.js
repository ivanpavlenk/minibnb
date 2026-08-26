const app = require('./app');

const port = process.env.PORT || 3000;
app.listen(port, () => {
    console.log(`MiniBnB API listening on http://localhost:${port}`);
});
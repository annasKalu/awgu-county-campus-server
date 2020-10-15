const express = require('express');
const morgan = require('morgan');
const cors = require('cors');
const mongoose = require('mongoose');
const bodyParser = require('body-parser');

require('dotenv').config();



const app = express();


// Connecting database:
mongoose.connect(process.env.DATABASE, {
    useNewUrlParser: true,
    useFindAndModify: false,
    useCreateIndex: true,
    useUnifiedTopology: true
})
    .then(() => console.log('DB Successfully Connected'))
    .catch(err => console.log('DB Connection Error:', err))

// importing routes

const authRoutes = require('./routes/auth.routes');
const userRoutes = require('./routes/user.routes');


// app middlewares:
app.use(morgan('dev'));
app.use(bodyParser.json());
//app.use(cors()); // will allow access from all origins
if (process.env.NODE_ENV = 'development') {
    app.use(cors({ origin: `http://localhost:3000` }))
}

// the route middleware functions:


app.use('/api', authRoutes);
app.use('/api', userRoutes);

const port = process.env.PORT || 8000;


app.listen(port, () => {
    console.log(`API is running on port ${port}`);
})
// dependencies
const express = require('express');
const path = require('path');
const favicon = require('serve-favicon');
const logger = require('morgan');
const compression = require('compression');
const cookieParser = require('cookie-parser');
const bodyParser = require('body-parser');
const mongoose = require('mongoose');
const passport = require('passport');
const LocalStrategy = require('passport-local').Strategy;
const flash = require('connect-flash');

const dbConfig = require('./config/db-config.json');
const routes = require('./routes/index');
const accountRoutes = require('./routes/accounts');
const voteRoutes = require('./routes/votes');

const app = express();

// view engine setup
app.set('views', path.join(__dirname, 'views'));
app.set('view engine', 'pug');

// uncomment after placing your favicon in /public
//app.use(favicon(__dirname + '/public/favicon.ico'));
app.use(logger('dev'));
app.use(compression());
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: false }));
app.use(cookieParser());
app.use(require('express-session')({
    secret: 'keyboard cat',
    resave: false,
    saveUninitialized: false
}));
app.use(passport.initialize());
app.use(flash());
app.use(passport.session());
app.use(express.static(path.join(__dirname, 'public')));
app.use(function(req, res, next) {
    res.locals.user = req.user;
    next();
});

// 라우팅
app.use('/', [routes, accountRoutes, voteRoutes]);

// passport config
const Account = require('./models/account');
passport.use(new LocalStrategy(Account.authenticate()));
passport.serializeUser(Account.serializeUser());
passport.deserializeUser(Account.deserializeUser());

// mongoose
if(dbConfig.mongo.state === 'remote') {
    mongoose.connect(`mongodb://${dbConfig.mongo.id}:${dbConfig.mongo.password}@${dbConfig.remoteUrl}:${dbConfig.mongo.port}/vote`);
} else {
    mongoose.connect(`mongodb://${dbConfig.mongo.id}:${dbConfig.mongo.password}@${dbConfig.localUrl}:${dbConfig.mongo.port}/vote`);
}

// catch 404 and forward to error handler
app.use(function(req, res, next) {
    const err = new Error('Not Found');
    err.status = 404;
    next(err);
});

// error handlers

// development error handler
// will print stacktrace
if (app.get('env') === 'development') {
    app.use(function(err, req, res, next) {
        res.status(err.status || 500);
        res.render('base/error', {
            message: err.message,
            error: err
        });
    });
}

// production error handler
// no stacktraces leaked to user
app.use(function(err, req, res, next) {
    res.status(err.status || 500);
    res.render('base/error', {
        message: err.message,
        error: {}
    });
});


module.exports = app;

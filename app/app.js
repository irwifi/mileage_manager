"use strict";
const express = require('express');
const path = require('path');
const favicon = require('serve-favicon');
const logger = require('morgan');
const cookieParser = require('cookie-parser');
const bodyParser = require('body-parser');
const methodOverride = require('method-override');
const sessions = require("client-sessions");
const validator = require('validator');

const app = express();

// Application configuration
const confg = require('./../confg/confg');
// Connect to mongodb server
const hdb = require("./handlers/hdb");
// Initialize session
require("./handlers/hsession")( { app, sessions } );
// User authentication
const hauthen = require('./handlers/hauthen')( { express } );

const routes = require('./routes/index');
const authen = require('./routes/authen');
const users = require('./routes/users');
const readings = require('./routes/readings');

// view engine setup
app.set('views', path.join(__dirname, 'views'));
app.set('view engine', 'ejs');

// uncomment after placing your favicon in /public
//app.use(favicon(path.join(__dirname, 'public', 'favicon.ico')));
app.use(logger('dev'));
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: false }));
app.use(cookieParser());
app.use(express.static(path.join(__dirname, 'public')));
app.use(express.static(__dirname.replace("app", "") + '/node_modules/bootstrap/dist/')); // redirect bootstrap js and css files
app.use(express.static(__dirname.replace("app", "") + '/node_modules/jquery/dist')); // redirect JS jQuery
app.use(express.static(__dirname.replace("app", "") + '/node_modules/jquery-validation/dist')); // redirect jquery-validation
app.use(express.static(path.join(__dirname, 'plugins/jquery-validation'))); // redirect jquery-validation

// sanitize input data
const sanitize_data = (params) => {
	const raw_data = params.data;
	let cooked_data = validator.escape(raw_data);
	if(params.no_trim !== undefined) {
		cooked_data = cooked_data.trim();
	}
	return cooked_data;
};

// override method to PUT and DELETE
app.use(methodOverride((req, res) => {
	if (req.body && typeof req.body === 'object' && '_method' in req.body) {
		// look in urlencoded POST bodies and delete it 
		const method = sanitize_data({data: req.body._method});
		delete req.body._method;
		return method;
	}
}));

app.use(hauthen);
app.use('/', routes);
app.use('/authen', authen);
app.use('/users', users);
app.use('/readings', users);

console.log("Application running at http://localhost:3000/ ");

// catch 404 and forward to error handler
app.use((req, res, next) => {
	const err = new Error('Not Found');
	err.status = 404;
	next(err);
});

// error handlers

// development error handler
// will print stacktrace
if (app.get('env') === 'development') {
	app.use((err, req, res, next) => {
		res.status(err.status || 500);
		res.render('error', {
			message: err.message,
			error: err
		});
	});
}

// production error handler
// no stacktraces leaked to user
app.use((err, req, res, next) => {
	res.status(err.status || 500);
	res.render('error', {
		message: err.message,
		error: {}
	});
});

module.exports = app;

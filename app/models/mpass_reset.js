"use strict";
const mongoose = require('mongoose');
const async = require('async');

const hmodels = require("../handlers/hmodels");
const musers = require("../models/musers");

// Define password reset schema
const pass_resetSchema = new mongoose.Schema(
	{
		user_email: {type: String, required: true},
		reset_phrase: {type: String, required: true},
		status: {type: Number, min: 1, max: 3} // 1 - active, 2 - used , 3 - expired
	},
	{timestamps: true} // reset link should be active for 24 hours
);

const pass_reset = {};

// Define users model
pass_reset.pass_reset_model = mongoose.model('pass_reset', pass_resetSchema);

// error handler
const error_handler = (err, callback) => {
	if(err) { 
		return callback(err);
	}
};

// make password request entry in database
// save user_email, generated_phrase, status and time stamp
pass_reset.password_request_entry = (err, params, callback) => {
	const doc_data = {user_email: params.form_data.user_email, reset_phrase: params.reset_phrase, status: 1};
	pass_reset.pass_reset_model.create(doc_data, (err, reset_detail) => {
		params.async_callback = true;
		hmodels.error_handler(err, params, callback);
	});	
};

// check the existence of reset link
pass_reset.reset_link_existence_check = (err, params, callback) => {
	params.doc = {};
	params.doc.model = pass_reset.pass_reset_model;
	params.doc.condition = { reset_phrase: params.req.params.reset_phrase };
	params.doc.select = { reset_phrase:1 };
	hmodels.find_one(null, params, callback);
};

// check the expiry of reset link
// expiry period is 24 hours
pass_reset.reset_link_expiry_check = (err, params, callback) => {
	params.doc = {};
	params.doc.model = pass_reset.pass_reset_model;
	params.doc.condition = { reset_phrase: params.form_data.reset_phrase, $where: function () { return Date.now() - this._id.getTimestamp() < (24 * 60 * 60 * 1000); } };
	params.doc.select = { user_email: 1 };
	params.async_callback = true;
	hmodels.find_one(null, params, callback);
};
 
// change the status if the link is expired 
pass_reset.expired_link_status_change = (err, params, callback) => {
	params.pass_reset_info = params.doc.doc_info;
	delete params.doc;

	if ( params.pass_reset_info === null ) {
		// reset link is expired
		params.reset_message = "The reset link has expired. Please repeat the Forgot Password process once again.";
		params.stop = true;

		params.doc = {};
		params.doc.model = pass_reset.pass_reset_model;
		params.doc.condition = { reset_phrase: params.form_data.reset_phrase };
		params.doc.form_data = { status : 3};
		params.doc.options = {};
		params.async_callback = true;
		hmodels.update_doc(err, params, callback);	
	} else {
		// reset link not expired
		callback(err, err, params);
	}
};

module.exports = pass_reset;

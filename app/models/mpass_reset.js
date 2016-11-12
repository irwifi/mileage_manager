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
	if(params.stop !== true) {
		const doc_data = {user_email: params.form_data.user_email, reset_phrase: params.reset_phrase, status: 1};
		pass_reset.pass_reset_model.create(doc_data, (err, reset_detail) => {
			hmodels.error_handler(err, params, callback);
		});	
	} else {
		hmodels.error_handler(err, params, callback);
	}
};

// check the existence of reset link
pass_reset.reset_link_existence_check = (err, params, callback) => {
	params.doc = {};
	params.doc.model = pass_reset.pass_reset_model;
	params.doc.condition = { reset_phrase: params.reset_phrase };
	params.doc.select = { user_email:1, reset_phrase:1 };
	hmodels.find_one(null, params, callback);
};

// check the expiry of reset link
// expiry period is 24 hours
pass_reset.reset_link_expiry_check = (err, params, callback) => {
	if(params.stop !== true) {
		params.doc = {};
		params.doc.model = pass_reset.pass_reset_model;
		// this.createdAt used instead of this._id.getTimestamp() for making suitable to testing
		params.doc.condition = { reset_phrase: params.req.params.reset_phrase, $where: function () { return Date.now() - this.createdAt < (24 * 60 * 60 * 1000); } };
		params.doc.select = {};
		hmodels.find_one(null, params, callback);
	} else {
		// there are some errors in earlier steps
		hmodels.error_handler(err, params, callback);
	}
};
 
// change the status if the link is expired 
pass_reset.expired_link_status_change = (err, params, callback) => {
	if(params.stop !== true) {
		params.reset_link_info = params.doc.doc_info;
		delete params.doc;

		if ( params.reset_link_info === null ) {
			// reset link is expired
			params.reset_message = ["The reset link has expired. Please repeat the Forgot Password process once again."];
			params.stop = true;

			params.doc = {};
			params.doc.model = pass_reset.pass_reset_model;
			params.doc.condition = { reset_phrase: params.req.params.reset_phrase };
			params.doc.form_data = { status : 3};
			params.doc.options = {};
			hmodels.update_doc(err, params, callback);	
		} else {
			// reset link not expired
			hmodels.error_handler(err, params, callback);
		}
	} else {
		// there are some errors in earlier steps
		hmodels.error_handler(err, params, callback);
	}
};

module.exports = pass_reset;

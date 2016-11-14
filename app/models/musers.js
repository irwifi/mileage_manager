"use strict";
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const async = require('async');

const hmodels = require("../handlers/hmodels");
const base64 = require("../../node_modules/js-base64/base64").Base64;

// Define user schema
const userSchema = new mongoose.Schema(
	{
		fname: String,
		lname: String,
		username: {type: String, unique: true},
		user_email: {type: String, unique: true, required: true},
		password: {type: String, required: true},
		user_role: {type: String, required: true, default: "user"}
	},
	{timestamps: true}
);

// hashing the password during save
userSchema.pre('save', function(next) {
	let user = this;

	// only hash the password if it has been modified (or is new)
	if (!user.isModified('password')) return next();

	// generate a salt, saltRounds set to 10
	bcrypt.genSalt(10 , (err, salt) => {
			if (err) return next(err);

			// hash the password using our new salt
			bcrypt.hash(user.password, salt, (err, hash) => {
					if (err) return next(err);

					// override the clear text password with the hashed one
					user.password = hash;
					next();
			});
	});
});

// user schema method for comparing the password
userSchema.methods.comparePassword = function(candidatePassword, callback) {
		bcrypt.compare(candidatePassword, this.password, function(err, isMatch) {
		if (err) return callback(err);
		callback(null, isMatch);
	});
};

const user = {};

// Define users model
user.user_model = mongoose.model('users', userSchema);

// error handler
const error_handler = (err, callback) => {
	if(err) { 
		return callback(err);
	}
};

// check if user exists
user.admin_exist_check = (err, params, callback) => {
	params.doc = {};
	params.doc.name = "admin_exist_check";
	params.doc.model = user.user_model;
	params.doc.condition = { user_role: "admin" };
	hmodels.count_doc(null, params, callback);	
};

// check if email already exists
user.check_email_exist = (err, params, callback) => {
	params.doc = {};
	params.doc.name = "check_email_exist";
	params.doc.model = user.user_model;
	params.doc.condition = { "user_email": params.form_data.user_email };
	hmodels.count_doc(null, params, callback);
};

// fetch user info
user.get_user_info = (err, params, callback) => {
	params.doc = {};
	params.doc.name = "get_user_info";
	params.doc.model = user.user_model;
	params.doc.condition = { user_email: params.form_data.user_email };
	hmodels.find_one(null, params, callback);
};

// generate reset password link
user.generate_reset_password_link = (err, params, callback) => {
	const random_number = Math.random().toString() + Math.random().toString() + Math.random().toString() + Math.random().toString(); 
	const random_phrase = base64.encode(random_number);
	params.reset_phrase = random_phrase;
	hmodels.error_handler(err, params, callback);
};

// send forgot password email with reset link (only for production mode)
user.send_forgot_pasword_email = (err, params, callback) => {
	const reset_link = "http://" + params.host + "/authen/reset_password/" + params.reset_phrase;
	params.reset_link = reset_link;

	if(params.env === "development") {
		params.display_reset_link = true;
	} else {
		/* =============== email sending mechanism =============== */
	}
	hmodels.error_handler(err, params, callback);
};

// update the password
user.update_password = (err, params, callback) => {
	params.doc = {};
	params.doc.name = "update_password";
	params.doc.model = user.user_model;
	params.doc.condition = { user_email: params.reset_link_info.user_email };

	params.doc.model.findOne(params.doc.condition, (err, doc) => {
		doc.password = params.form_data.new_password;
		doc.save((err, doc_info) => {
			params.doc.doc_info = doc_info;
			hmodels.error_handler(err, params, callback);
		});
	});
};

// create new user
user.create_new_user = (err, params, callback) => {
	params.operation = 'new_user';
	// save new user
	params.doc = {};
	params.doc.name = "create_new_user";
	params.doc.model = user.user_model;
	params.doc.form_data = {username: params.form_data.user_email, user_email: params.form_data.user_email, password: params.form_data.password};
	if(params.form_data.user_role !== undefined) {
		params.doc.form_data.user_role = params.form_data.user_role;	
	}
	
	hmodels.save_doc(null, params, callback);	
};

// compare user password
user.compare_user_password = (err, params, callback) => {
	params.user_info.comparePassword(params.form_data.password, function(err, isMatch) {
		params.is_match = isMatch;
		hmodels.error_handler(err, params, callback);
	});
};

// compare passwore
user.compare_password = function (err, params, callback) {
	bcrypt.compare(params.password, params.hash, function(err, isMatch) {
		callback(null, isMatch);
	});
};

module.exports = user;

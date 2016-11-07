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
	params.doc.model = user.user_model;
	params.doc.condition = { user_role: "admin" };
	hmodels.count_doc(null, params, callback);	
};

// check if email already exists
user.check_email_exist = (err, params, callback) => {
	params.doc = {};
	params.doc.model = user.user_model;
	params.doc.condition = { "user_email": params.form_data.user_email };
	hmodels.count_doc(null, params, callback);
};

// authenticate user name password
user.authenticate_login = (err, params, callback) => {
	params.final_callback = callback;
	async.waterfall([
			(async_callback) => {async_callback(null, null, params);},	
			user.get_login_user
		], login_user_response
	);
};

// fetch user name
user.get_login_user = (err, params, callback) => {
	params.doc = {};
	params.doc.model = user.user_model;
	params.doc.condition = { user_email: params.form_data.user_email };
	hmodels.find_one(null, params, callback);
};

// generate reset password link
user.generate_reset_password_link = (err, params, callback) => {
	if(params.stop !== true) {
		const random_number = Math.random().toString() + Math.random().toString() + Math.random().toString() + Math.random().toString(); 
		const random_phrase = base64.encode(random_number);
		params.reset_phrase = random_phrase;
	}

	hmodels.error_handler(err, params, callback);
};

// send forgot password email with reset link (only for production mode)
user.send_forgot_pasword_email = (err, params, callback) => {
	if(params.stop !== true) {
		const reset_link = "http://" + params.host + "/authen/reset_password/" + params.reset_phrase;
		params.reset_link = reset_link;

		if(params.env === "development") {
			params.display_reset_link = true;
		} else {
			/* =============== email sending mechanism =============== */
		}
	}
	
	hmodels.error_handler(err, params, callback);
};

// update the password
user.update_password = (err, params, callback) => {
	const reset_link_info = params.doc.doc_info;
	delete params.doc;
	if ( reset_link_info !== null ) {
		params.reset_message = ["Password has been reset. <a href='/authen/'>Click here</a> to log in."];

		if ( params.doc !== undefined ) { delete params.doc; }
		params.doc = {};
		params.doc.model = user.user_model;
		params.doc.condition = { user_email: reset_link_info.user_email };

		params.doc.model.findOne(params.doc.condition, (err, doc) => {
			doc.password = params.form_data.new_password;
			doc.save((err, doc_info) => {
				params.doc.doc_info = doc_info;
				hmodels.error_handler(err, params, callback);
			});
		});
	} else {
		// there has been some errors in previous steps
		params.reset_message = ["There has been some error. Please repeat the Forgot Password process."];
		hmodels.error_handler(err, params, callback);
	}
	};

// create new user
user.create_new_user = (err, params, callback) => {
	error_handler(err, callback);

	if(params.stop !== true) {
		params.operation = 'new_user';
		// save new user
		params.doc = {};
		params.doc.model = user.user_model;
		params.doc.form_data = {username: params.form_data.user_email, user_email: params.form_data.user_email, password: params.form_data.password};
		if(params.form_data.user_role !== undefined) {
			params.doc.form_data.user_role = params.form_data.user_role;	
		}
		
		hmodels.save_doc(null, params, callback);	
	} else {
		// do not create new user, there is some error
		callback(err, params);
	}
};

// check password if user exists
const login_user_response = (err, params) => {
	const callback = params.final_callback;
	error_handler(err, callback);

	const user_info = params.doc.doc_info;
	if ( user_info === null ) {
		params.error_condition = true;
		params.error_msg = ["User name / Email not found."];
		callback(null, params);
	} else {
		params.user_info = user_info;
		compare_user_password(null, params, callback);
	}
};

// compare user password
const compare_user_password = (err, params, callback) => {
	params.candidatePassword = params.form_data.password;
	params.user_info.comparePassword(params.form_data.password, function(err, isMatch) {
		error_handler(err, callback);

		if ( isMatch === false ) {
			params.error_condition = true;
			params.error_msg = ["Password does not match."];
		}

		callback(null, params);
	});
};

module.exports = user;

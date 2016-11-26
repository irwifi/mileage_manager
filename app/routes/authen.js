"use strict";
const helper = require("../handlers/hhelper");
const muser = require("../models/musers");
const mpass_reset = require("../models/mpass_reset");

const authen_router = helper.express.Router();

// Authentication model
// model 1: users and sign up by themselves
// model 2: only admin can create new users
const authen_model =  2;

// route for "authen/", display login page
authen_router.get('/', (req, res) => {
	if(authen_model === 1) {
		const params = {
			authen: false,
			page: "authen",
			host: helper.hostname,
			title: 'User Authentication',
			header_msg: "Please sign in to proceed"
		};
		res.render('index', params);
	} else {
		helper.async.waterfall([
				(callback) => {callback(null, null, {res});},
				muser.admin_exist_check
			], display_startup_from
		);
	}
});

// route for "authen/signup", user sign up 
authen_router.post("/signup", (req, res) => {
	const params = {res, req};
	params.form_data = {};
	params.form_data.user_email = helper.sanitize_data({data: req.body.signup_email});
	params.form_data.password = helper.sanitize_data({data: req.body.signup_password, no_trim: true});
	params.form_data.retype_password = helper.sanitize_data({data: req.body.signup_retype_password, no_trim: true});

	if(authen_model === 2) {
		params.form_data.user_role = helper.sanitize_data({data: req.body.user_role});
		params.form_data.first_admin = helper.sanitize_data({data: req.body.first_admin});
	}

	const validate_errors = validate_new_user(null, params.form_data);

	if(validate_errors.length === 0) {
		params.doc_data = {};
		params.doc_data.user_email = params.form_data.user_email;
		params.doc_data.password = params.form_data.password;
		params.doc_data.user_role = params.form_data.user_role;
		// params.async_level is used for returning to correct parameter in async callback. it is used in hmodels.error_handler method.
		params.async_level = 2;
		helper.async.waterfall([
				(async_callback) => {async_callback(null, null, params);},
				muser.check_email_exist,
				duplicate_email_error,
				muser.create_new_user
			], new_user_response
		);
	} else {
		send_back_authen_errors (null, {res, form: "signup", errors: validate_errors, form_data: params.form_data});
	}
});

// route for "authen/signin", user sign in
authen_router.post("/signin", (req, res) => {
	const params = {res, req};
	params.form_data = {
		user_email : helper.sanitize_data({data: req.body.signin_email}), 
		password : helper.sanitize_data({data: req.body.signin_password, no_trim: true})
	};

	const validate_errors = validate_login(null, params.form_data);

	if(validate_errors.length === 0) {
		params.form = 'signin';
		params.doc_data = params.form_data;
		// params.async_level is used for returning to correct parameter in async callback. it is used in hmodels.error_handler method.
		params.async_level = 2;
		helper.async.waterfall([
				(async_callback) => {async_callback(null, null, params);},
				muser.user_info_fetch,
				user_check_error_report,
				muser.compare_user_password
			], send_error_or_log_uer
		);
	} else {
		send_back_authen_errors (null, {res, form: "signin", errors: validate_errors, form_data: params.form_data});
	}
});

// route for "authen/signout", user sign in
authen_router.get("/signout", (req, res) => {
	req.authen.reset();
	res.redirect("/");
});

// route for "authen/forgot_password"
authen_router.route("/forgot_password")
// get route: display the forgot password form
.get((req, res) => {
	const params = {
		authen: false,
		page: "forgot_password",
		host: helper.hostname,
		title: "Forgot Password",
		header_msg: "Reset Password"
	};
	res.render("index", params);
})
// post route: send password change request
.post((req, res) => {
	const params = {res, req};
	params.form_data = {user_email: helper.sanitize_data({data: req.body.forgot_email})};

	const validate_errors = validate_forgot_password(null, params.form_data);

	if(validate_errors.length === 0) {
		// host and env variables are used in method send_forgot_pasword_email for creating reset link
		params.host = helper.hostname;
		params.env = helper.confg.env;
		params.doc_data = params.form_data;
		// params.async_level is used for returning to correct parameter in async callback. it is used in hmodels.error_handler method.
		params.async_level = 4;
		helper.async.waterfall([
				(callback) => {callback(null, null, params);},
				muser.check_email_exist,
				email_check_error_report,
				muser.generate_reset_password_link,
				mpass_reset.password_request_entry,
				muser.send_forgot_pasword_email
			], forgot_password_response_message
		);
	} else {
		send_back_forgot_password_errors (null, {res, form: "forgot_password", errors: validate_errors, form_data: params.form_data});
	}
});

// route for "authen/reset_password/reset_phrase", reset password link
authen_router.get("/reset_password/:reset_phrase", (req, res) => {
	const params = { req, res, reset_phrase: req.params.reset_phrase };

	// params.async_level is used for returning to correct parameter in async callback. it is used in hmodels.error_handler method.
	params.async_level = 4;	
	helper.async.waterfall([
			(callback) => {callback(null, null, params);},
			mpass_reset.reset_link_existence_check,
			reset_link_existence_error_report,
			mpass_reset.reset_link_expiry_check,
			mpass_reset.expired_link_status_change,
			reset_link_expiry_error_report
		], reset_link_validation_response
	);
});

// route for "authen/reset_password/", reset password
authen_router.put('/reset_password', (req, res) => {
	const params = {req, res};
	params.form_data = {
		new_password: helper.sanitize_data({data: req.body.new_password, no_trim: true}), 
		retype_password: helper.sanitize_data({data: req.body.retype_password, no_trim: true}), 
		reset_phrase: helper.sanitize_data({data: req.body.reset_link})};
	const validate_errors = validate_reset_password(null, params.form_data);

	if(validate_errors.length === 0) {
		params.doc_data = params.form_data;
		params.reset_phrase = params.form_data.reset_phrase;
		// params.async_level is used for returning to correct parameter in async callback. it is used in hmodels.error_handler method.
		params.async_level = 9;
		helper.async.waterfall([
				(callback) => {callback(null, null, params);},
				mpass_reset.reset_link_existence_check,
				reset_link_existence_error_report,
				mpass_reset.reset_link_expiry_check,
				mpass_reset.expired_link_status_change,
				reset_link_expiry_error_report,
				muser.user_info_fetch,
				user_check_error_report,
				muser.update_password,
				mpass_reset.reset_link_status_change,
				password_change_report
			], reset_password_response
		);
	} else {
		send_back_forgot_password_errors (null, {res, form: "reset_password", errors: validate_errors, form_data: {reset_link: params.form_data.reset_phrase}});
	}
});

// route for "authen/change_password"
authen_router.route("/change_password")
// get route: display change password form
.get((req, res) => {
	const params = {
		page: "change_password",
		host: helper.hostname,
		title: "Change Password",
		header_msg: "",
		user_name: req.authen.user_name
	};
	res.render("index", params);
})
// post route: submit password change
.put((req, res) => {
	const params = {req, res};
	params.form_data = {
		old_password: helper.sanitize_data({data: req.body.old_password, no_trim: true}),
		new_password: helper.sanitize_data({data: req.body.new_password, no_trim: true}),
		retype_password: helper.sanitize_data({data: req.body.retype_password, no_trim: true}),
	};

	const validate_errors = validate_change_password(null, params.form_data);
	if(validate_errors.length === 0) {
		params.doc_data = params.form_data;
		params.doc_data.user_email = req.authen.user_name;
		params.doc_data.password = params.form_data.old_password;
		params.user_email = params.doc_data.user_email;
		// params.async_level is used for returning to correct parameter in async callback. it is used in hmodels.error_handler method.
		params.async_level = 5;
		helper.async.waterfall([
				(callback) => {callback(null, null, params);},
				muser.user_info_fetch,
				user_check_error_report,
				muser.compare_user_password,
				old_password_check_report,
				muser.update_password,
				password_change_report
			], change_password_response
		);
	} else {
		send_back_change_password_errors (null, {req, res, errors: validate_errors});
	}
});

// check if user exists
const user_check_error_report = (err, params, callback) => {
	if ( params.doc !== undefined && params.doc.name === "user_info_fetch" ) {
		params.user_info = params.doc.doc_info;
		delete params.doc;
	}
	if(params.user_info === null) {
		params.errors = ["User name / Email not found."];
		err = params;
	}
	helper.hmodels.error_handler(err, params, callback);
};

// check if old password is correct
const old_password_check_report = (err, params, callback) => {
	if(params.doc !== undefined && params.doc.name === "compare_user_password") {
		params.is_match = params.doc.is_match;
		delete params.doc;
	}
	if ( params.is_match === false ) {
		params.errors = ["Old password does not match."];
		err = params;
	}

	helper.hmodels.error_handler(err, params, callback);
};

// display sign up form for first user if there is no user or else display the user sign in form
const display_startup_from = (err, params) => {
	let user_count;
	if(params.doc !== undefined && params.doc.name === "admin_exist_check") {
		user_count = params.doc.doc_count;
		delete params.doc;
	}

	let params_out;
	if(user_count !== undefined && user_count === 0) {
		params_out = {
			authen: false,
			page: "signup",
			host: helper.hostname,
			title: "First Admin Sign Up",
			header_msg: "There are no admin user in the system. Create the first admin to proceed.",
			first_admin: true,
			authen_model: authen_model
		};
	} else {
		params_out = {
			authen: false,
			page: "signin",
			host: helper.hostname,
			title: "User Sign In",
			header_msg: "Please sign in to proceed"
		};
	}
	params.res.render('index', params_out);		
};

// response after checking the existence of reset link
const reset_link_existence_error_report = (err, params, callback) => {
	if(params.doc !== undefined && params.doc.name === "reset_link_existence_check") {
		params.reset_link_info = params.doc.doc_info;
		delete params.doc;
	}

	if ( params.reset_link_info !== undefined && params.reset_link_info === null ) {
		// invalid reset link
		params.reset_message = ["The reset link is not correct. Please repeat the Forgot Password process once again."];
	} else if(params.reset_link_info.status === 2) {
		// reset link already used
		params.reset_message = ["The reset link has already been used to reset the password once. Please repeat the Forgot Password process once again."];
	} else if(params.reset_link_info.status === 3) {
		// reset link expired
		params.reset_message = ["The reset link has expired. Please repeat the Forgot Password process once again."];
	} else {
		// this value is required during the fetching of user in update_password method of user
		params.user_email = params.reset_link_info.user_email;
		if(params.doc_data === undefined) {
			params.doc_data = {user_email: params.reset_link_info.user_email};
		} else {
			params.doc_data.user_email = params.reset_link_info.user_email;
		}
	}

	if(params.reset_message !== undefined) {
		err = params;
	}
	helper.hmodels.error_handler(err, params, callback);
};

// response after checking and updating the status of expiry of reset link
const reset_link_expiry_error_report = (err, params, callback) => {
	if(params.doc !== undefined && params.doc.name === "expired_link_status_change") {
		params.status_change_info = params.doc.update_info;
		delete params.doc;

		params.reset_message = ["The reset link has expired. Please repeat the Forgot Password process once again."];
		err = params;
	}
	helper.hmodels.error_handler(err, params, callback);
};

// response after resetting password and changing status
const password_change_report = (err, params, callback) => {
	if(params.doc !== undefined) {
		if(params.doc.name === "reset_link_status_change") {
			params.reset_message = ["Password has been reset. <a href='/authen/'>Click here</a> to log in."];
			delete params.doc;
		} else if (params.doc.name == "update_password") {
			params.message = ["Password has been successfully changed. <a href='/authen/'>Click here</a> to log in."];
			delete params.doc;
		}
	}
	helper.hmodels.error_handler(err, params, callback);
};

// create duplicate email error message
const duplicate_email_error = (err, params, callback) => {
	let email_count;
	if(params.doc !== undefined && params.doc.name === "check_email_exist") {
		email_count = params.doc.doc_count;
		delete params.doc;
	}
	if(email_count !== undefined && email_count > 0) {
		// the email alreay exists
		params.error_msg = ["Email id already exists."];
		err = params;
	}
	helper.hmodels.error_handler(err, params, callback);
};

// response after creating new user
const new_user_response = (err, params) => {
	if ( err !== null ) {
		params = err;
		send_back_authen_errors (null, {res: params.res, form: 'signup', errors: params.error_msg, form_data: params.form_data});
	} else {
		let user_info;
		if(params.doc !== undefined && params.doc.name === "create_new_user") {
			user_info =params.doc.doc_info;
			delete params.doc;
			log_user_session ( null, { req: params.req, user_info } );
		}
		params.res.redirect("/");
	}
};

// send error message if error else log in the user
const send_error_or_log_uer = (err, params) => {
	if ( err !== null ) {
		params = err;
	} else {
		if(params.doc !== undefined && params.doc.name === "compare_user_password") {
			params.is_match = params.doc.is_match;
			delete params.doc;
		}

		if ( params.is_match === false ) {
			params.errors = ["Password does not match."];
		} else {
			log_user_session ( null, { req: params.req, user_info: params.user_info } );
			params.res.redirect("/");
		}
	}

	if ( params.errors !== undefined && params.errors !== null ) {
		send_back_authen_errors (null, {res: params.res, form: params.form, errors: params.errors, form_data: params.form_data});
	} 
};

// send the authentication error messages
const send_back_authen_errors = (err, params) => {
	const params_out = {
		res: params.res,
		authen: false,
		page: params.form,
		host: helper.hostname,
		form: params.form,
		errors: params.errors,
		user_email: params.form_data.user_email
	};

	if(params.form === "signup") {
		params_out.user_role = params.form_data.user_role;
		if(authen_model === 2) {
			params_out.authen_model = authen_model;
		}

		if(params.form_data.first_admin === "true") {
			params_out.title = "First Admin Sign Up";
			params_out.header_msg = "There are no admin user in the system. Create the first admin to proceed.";
			params_out.first_admin = true;
		} else {
			params_out.title = "User Sign Up";
			params_out.header_msg = "Please fill the form to sign up";
		}
	} else {
		params_out.title = "User Sign In";
		params_out.header_msg = "Please sign in to proceed";
	}

	params.res.render('index', params_out);
};

// send the forgot password error messages
const send_back_forgot_password_errors = (err, params) => {
	const res = params.res;

	const params_out = {
		res,
		authen: false,
		page: 'forgot_password',
		host: helper.hostname,
		title: "Forgot Password",
		header_msg: "Reset Password",
		form: params.form,
		errors: params.errors,
	};
	if(params.form_data.user_email !== undefined) {
		params_out.user_email = params.user_email;
	}
	if(params.form_data.reset_link !== undefined) {
		params_out.reset_link = params.reset_link;
	}
	res.render('index', params_out);
};

// send the change password error messages
const send_back_change_password_errors = (err, params) => {
	const params_out = {
		res: params.res,
		page: 'change_password',
		host: helper.hostname,
		title: "Change Password",
		header_msg: "",
		errors: params.errors,
		user_name: params.req.authen.user_name
	};
	params.res.render('index', params_out);
};

// validate email id
const validate_email = ( err, params ) => {
	const user_email = params.user_email;
	const email_length = user_email.length;
	let error;

	if(email_length === 0) {
		error = "Please enter email id.";
	} else  if (email_length > 100) {
		error = "Email id too long.";
	} else if (helper.validator.isEmail(user_email) === false) {
		error = "Please enter valid email id.";
	}

	helper.push_error ( { error, errors: params.errors } );
};

// validate password
const validate_password = ( err, params ) => {
	const password = params.password;
	const password_length = password.length;
	let error;

	if(password_length === 0) {
		error = "Please enter password.";
	} else  if ( password_length < 6 ) {
		error = "Password should be at least 6 characters.";
	} else  if (password_length > 30) {
		error = "Password too long.";
	}

	helper.push_error ( { error, errors: params.errors } );
};

// validate the retype password
const validate_retype_password = ( err, params ) => {
	let error;

	if( params.password !== params.retype_password ) {
		error = "Retype password does not match.";
	}

	helper.push_error ( { error, errors: params.errors } );
};

// login the user: add user id to the authentication session
const log_user_session = (err, params) => {
	const req = params.req;
	req.authen.user_id = params.user_info._id;
	req.authen.user_name = params.user_info.username;
	req.authen.user_email = params.user_info.user_email;
};

// validate user signup form
const validate_new_user = (err, params) => {
	let errors = [];

	validate_email( null, { errors, user_email: params.user_email } );
	validate_password( null, { errors, password: params.password } );
	validate_retype_password( null, { errors, password: params.password, retype_password: params.retype_password } );

	return errors;
};

// validate user login form
const validate_login = (err, params) => {
	let errors = [];

	validate_email( null, { errors, user_email: params.user_email } );
	validate_password( null, { errors, password: params.password } );

	return errors;
};

// validate forgot password form
const validate_forgot_password = ( err, params ) => {
	let errors = [];

	validate_email( null, { errors, user_email: params.user_email } );

	return errors;
};

// validate reset password form
const validate_reset_password = ( err, params ) => {
	let errors = [];

	validate_password( null, { errors, password: params.new_password } );
	validate_retype_password( null, { errors, password: params.new_password, retype_password: params.retype_password } );

	return errors;
};

// validate change password form
const validate_change_password = ( err, params ) => {
	let errors = [];

	validate_password( null, { errors, password: params.old_password } );
	validate_password( null, { errors, password: params.new_password } );
	validate_retype_password( null, { errors, password: params.new_password, retype_password: params.retype_password } );

	return errors;
};

// response of checking the existence of forgot password email
const email_check_error_report = (err, params, callback) => {
	const email_count = params.doc.doc_count;
	delete params.doc;

	if (email_count === 0) {
		params.errors = ["Email id not found."];
		err = params;
	}
	helper.hmodels.error_handler(err, params, callback);
};

// response after forgot password process
const forgot_password_response_message = (err, params) => {
	if (err !== null) {
		params = err;
		send_back_forgot_password_errors (null, {res: params.res, form: "forgot_password", errors: params.errors, form_data: params.form_data});
	} else {
		// display message after sending password reset email
		// for development mode display the reset link too
		const reset_link_message = "An email has been sent to you. Please check your email and follow the steps to reset the password.";
		const message = [reset_link_message, params.reset_link]; 

		const params_out = {
			authen: false,
			page: "message",
			host: helper.hostname,
			title: "Forgot Password",
			header_msg: "Password Reset",
			message,
			display_reset_link: params.display_reset_link,
			reset_link: params.reset_link
		};
		params.res.render("index", params_out);
	}
};

// response of reset link validity check
const reset_link_validation_response = (err, params) => {
	let params_out;
	if(err !== null) {
		params = err;
		// invalid reset link
		params_out = {
			authen: false,
			page: "message",
			host: helper.hostname,
			title: "Forgot Password",
			header_msg: "Reset Password",
			message: params.reset_message
		};
	} else {
		// valid reset link
		params_out = {
			authen: false,
			page: "forgot_password",
			host: helper.hostname,
			title: "Forgot Password",
			header_msg: "Reset Password",
			form: 'reset_password',
			reset_link: params.req.params.reset_phrase
		};
	}
	params.res.render("index", params_out);
};

// response of resetting the password
const reset_password_response = (err, params) => {
	if ( err !== null ) {
		params = err;
	}
	const params_out = {
		authen: false,
		page: "message",
		host: helper.hostname,
		title: "Forgot Password",
		header_msg: "Reset Password",
		message: params.reset_message, 
	};
	params.res.render("index", params_out);
};

// response of changing the password
const change_password_response = (err, params) => {
	if ( err !== null ) {
		params = err;
		send_back_change_password_errors(null, params);
	} else {
		params.req.authen.reset();
		const params_out = {
			authen: false,
			page: "message",
			host: helper.hostname,
			title: "Change Password",
			header_msg: "",
			message: params.message, 
		};
		params.res.render("index", params_out);
	}
};

module.exports = authen_router;

"use strict";
const helper = require("../handlers/hhelper");
const hmodels = require("../handlers/hmodels");
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
	const form_data = {};
	form_data.user_email = helper.sanitize_data({data: req.body.signup_email});
	form_data.password = helper.sanitize_data({data: req.body.signup_password, no_trim: true});
	form_data.retype_password = helper.sanitize_data({data: req.body.signup_retype_password, no_trim: true});

	if(authen_model === 2) {
		form_data.user_role = helper.sanitize_data({data: req.body.user_role});
		form_data.first_admin = helper.sanitize_data({data: req.body.first_admin});
	}

	const params = {res, req, form_data};

	const validate_errors = validate_new_user(null, {user_email: form_data.user_email, password: form_data.password, retype_password: form_data.retype_password});

	if(validate_errors.length === 0) {
		// for returning to correct parameter in async callback
		// this parameter is used in hmodels.error_handler method
		params.async_level = 2;
		helper.async.waterfall([
				(callback) => {callback(null, null, params);},	
				muser.check_email_exist,
				duplicate_email_error,
				muser.create_new_user
			], new_user_response
		);
	} else {
		send_back_authen_errors (null, {res, form: "signup", errors: validate_errors, form_data});
	}
});

// route for "authen/signin", user sign in
authen_router.post("/signin", (req, res) => {
	const form_data = {user_email : helper.sanitize_data({data: req.body.signin_email}), password : helper.sanitize_data({data: req.body.signin_password, no_trim: true})};
	const params = {res, req, form_data};

	const validate_errors = validate_login(null, {user_email: form_data.user_email, password: form_data.password});

	if(validate_errors.length === 0) {
		params.form = 'signin';
		helper.async.waterfall([
				(async_callback) => {async_callback(null, null, params);},
				muser.authenticate_login,
			], send_error_or_log_uer
		);
	} else {
		send_back_authen_errors (null, {res, form: "signin", errors: validate_errors, form_data});
	}
});

// route for "authen/signout", user sign in
authen_router.get("/signout", (req, res) => {
	req.authen.reset();
	res.redirect("/");
});

// route for "authen/forgot_password"
authen_router.route("/forgot_password")
// get route : display the forgot password form
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
// post route : send password change request
.post((req, res) => {
	const form_data = {user_email: helper.sanitize_data({data: req.body.forgot_email})};
	const params = {res, req, form_data};

	const validate_errors = validate_forgot_password(null, {user_email: form_data.user_email});

	if(validate_errors.length === 0) {
		// host and env variables are used in method send_forgot_pasword_email for creating reset link
		params.host = helper.hostname;
		params.env = helper.confg.env;

		// for returning to correct parameter in async callback
		// this parameter is used in hmodels.error_handler method
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
		send_back_forgot_password_errors (null, {res, form: "forgot_password", errors: validate_errors, user_email: form_data.user_email});
	}
});

// route for "authen/reset_password/reset_phrase", reset password link
authen_router.get("/reset_password/:reset_phrase", (req, res) => {
	const params = { req, res, reset_phrase: req.params.reset_phrase };

	// for returning to correct parameter in async callback
	// this parameter is used in hmodels.error_handler method
	params.async_level = 3;	
	helper.async.waterfall([
			(callback) => {callback(null, null, params);},
			mpass_reset.reset_link_existence_check,
			reset_link_existence_error_report,
			mpass_reset.reset_link_expiry_check,
			mpass_reset.expired_link_status_change,
		], reset_link_validation_response
	);
});

// route for "authen/reset_password/", reset password
authen_router.put('/reset_password', (req, res) => {
	const form_data = {new_password: helper.sanitize_data({data: req.body.new_password, no_trim: true}), retype_password: helper.sanitize_data({data: req.body.retype_password, no_trim: true}), reset_phrase: helper.sanitize_data({data: req.body.reset_link})};
	const validate_errors = validate_reset_password(null, form_data);

	if(validate_errors.length === 0) {
		const params = {req, res, form_data, reset_phrase: form_data.reset_phrase};
		params.async_level = 1;
		helper.async.waterfall([
				(callback) => {callback(null, null, params);},
				mpass_reset.reset_link_existence_check,
				muser.update_password
			], reset_password_response
		);
	} else {
		send_back_forgot_password_errors (null, {res, form: "reset_password", errors: validate_errors, reset_link: helper.sanitize_data({data: req.body.reset_link})});
	}
});

// display sign up form for first user if there is no user or else display the user sign in form
const display_startup_from = (err, params) => {
	let params_out;
	const user_count = params.doc.doc_count;
	delete params.doc;
	if(user_count === 0) {
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
	const reset_link_info = params.doc.doc_info;
	delete params.doc;
	if ( reset_link_info === null ) {
		// invalid reset link
		params.reset_message = ["The reset link is not correct. Please repeat the Forgot Password process once again."];
		params.stop = true;
	}
	hmodels.error_handler(err, params, callback);
};

// create duplicate email error message
const duplicate_email_error = (err, params, callback) => {
	const email_count = params.doc.doc_count;
	delete params.doc;
	if(email_count > 0) {
		// the email alreay exists
		params.error_condition = true;
		params.error_msg = ["Email id already exists."];
		params.stop = true;
	}
	hmodels.error_handler(err, params, callback);
};

// response after creating new user
const new_user_response = (err, params) => {
	helper.error_handler(err);

	if ( params.error_condition !== undefined && params.error_condition === true ) {
		send_back_authen_errors (null, {res: params.res, form: 'signup', errors: params.error_msg, form_data: params.form_data});
	} else {
		const user_info =params.doc.doc_info;
		log_user_session ( null, { req: params.req, user_id: user_info._id } );
		params.res.redirect("/");
	}
};

// send error message if error else log in the user
const send_error_or_log_uer = (err, params) => {
	helper.error_handler(err);
	const res = params.res;

	if ( params.error_condition !== undefined && params.error_condition === true ) {
		send_back_authen_errors (null, {res, form: params.form, errors: params.error_msg, form_data: params.form_data});
	} else {
		log_user_session ( null, { req: params.req, user_id: params.doc.doc_info._id } );
		res.redirect("/");
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
		user_email: params.user_email,
		reset_link: params.reset_link
	};
	res.render('index', params_out);
};

// validate email id
const validate_email = ( err, params ) => {
	const user_email = params.user_email;
	const email_length = user_email.length;
	let error;

	if(email_length === 0) {
		error = "Please enter email id.";
	} else if (helper.validator.isEmail(user_email) === false) {
		error = "Please enter valid email id.";
	} else  if (email_length > 100) {
		error = "Email id too long.";
	}

	push_error ( null, { error, errors: params.errors } );
};

// push individual error messages to error list
const push_error = ( err, params ) => {
	if ( params.error !== undefined ) {
		params.errors.push(params.error);
	}
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

	push_error ( null, { error, errors: params.errors } );
};

// validate the retype password
const validate_retype_password = ( err, params ) => {
	let error;

	if( params.password !== params.retype_password ) {
		error = "Retype password does not match.";
	}

	push_error ( null, { error, errors: params.errors } );
};

// login the user: add user id to the authentication session
const log_user_session = (err, params) => {
	const req = params.req;
	req.authen.user_id = params.user_id;
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

// response of checking the existence of forgot password email
const email_check_error_report = (err, params, callback) => {
	helper.error_handler(err);
	const email_count = params.doc.doc_count;
	delete params.doc;

	if (email_count === 0) {
		params.stop = true;
		params.errors = ["Email id not found."];
	}
	hmodels.error_handler(err, params, callback);
};

// response after forgot password process
const forgot_password_response_message = (err, params) => {
	helper.error_handler(err);

	if (params.errors !== undefined && params.errors.length > 0) {
		send_back_forgot_password_errors (err, {res: params.res, form: "forgot_password", errors: params.errors, user_email: params.form_data.user_email});
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
	if ( params.reset_message === undefined ) {
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
	} else {
		// invalid reset link
		params_out = {
			authen: false,
			page: "message",
			host: helper.hostname,
			title: "Forgot Password",
			header_msg: "Reset Password",
			message: params.reset_message
		};
	}
	params.res.render("index", params_out);
};

// response of resetting the password
const reset_password_response = (err, params) => {
	if ( params.reset_message !== undefined ) {
		const params_out = {
			authen: false,
			page: "message",
			host: helper.hostname,
			title: "Forgot Password",
			header_msg: "Reset Password",
			message: [params.reset_message], 
		};
		params.res.render("index", params_out);
	}
};

module.exports = authen_router;

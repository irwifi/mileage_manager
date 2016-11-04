"use strict";
const helper = require("../handlers/hhelper");
const muser = require("../models/musers");
const mpass_reset = require("../models/mpass_reset");

const authen_router = helper.express.Router();

// route for "authen/", display login page
authen_router.get('/', (req, res) => {
	helper.async.waterfall([
			(callback) => {callback(null, null, {res});},
			muser.user_exist_check
		], display_authen_from
	);
});

// route for "authen/signup", user sign up 
authen_router.post("/signup", (req, res) => {
	const user_email = helper.sanitize_data({data: req.body.signup_email});
	const form_data = {username: user_email, user_email: user_email, password: helper.sanitize_data({data: req.body.signup_password, no_trim: true})};
	const params = {res, req, form_data};

	const validate_errors = validate_new_user(null, {user_email: form_data.user_email, password: form_data.password, retype_password: helper.sanitize_data({data: req.body.signup_retype_password, no_trim: true})});

	if(validate_errors.length === 0) {
		// for returning to correct parameter in callback
		// this statement is placed here because it can not be used within check_email_exist  since it is used in other place
		params.async_callback = true;
		helper.async.waterfall([
				(callback) => {callback(null, null, params);},	
				muser.check_email_exist,
				muser.create_new_user
			], new_user_response
		);
	} else {
		send_back_authen_errors (null, {res, form: "signup", errors: validate_errors, user_email: form_data.user_email});
	}
});

// route for "authen/signin", user sign in
authen_router.post("/signin", (req, res) => {
	const form_data = {user_email : helper.sanitize_data({data: req.body.signin_email}), password : helper.sanitize_data({data: req.body.signin_password})};
	const params = {res, req, form_data};

	const validate_errors = validate_login(null, {user_email: form_data.user_email, password: form_data.password});

	if(validate_errors.length === 0) {
		params.error_form = 'signin';
		helper.async.waterfall([
				(async_callback) => {async_callback(null, null, params);},
				muser.authenticate_login,
			], send_error_or_log_uer
		);
	} else {
		send_back_authen_errors (null, {res, form: "signin", errors: validate_errors, user_email: form_data.user_email});
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
		helper.async.waterfall([
				(callback) => {callback(null, null, params);},
				muser.check_email_exist,
			], forgot_password_email_check_response
		);
	} else {
		send_back_forgot_password_errors (null, {res, form: "forgot_password", errors: validate_errors, user_email: form_data.user_email});
	}
});

// route for "authen/reset_password/reset_phrase", reset password link
authen_router.get("/reset_password/:reset_phrase", (req, res) => {
	const params = { req, res };
	helper.async.waterfall([
			(callback) => {callback(null, null, params);},
			mpass_reset.reset_link_existence_check
		], reset_link_existence_check_response
	);
});

// response of reset link existence check
const reset_link_existence_check_response = (err, params) => {
	params.pass_reset_info = params.doc.doc_info;
	delete params.doc;

	let params_out;
	if ( params.pass_reset_info !== null ) {
		// valid reset link
		params_out = {
			authen: false,
			page: "forgot_password",
			host: helper.hostname,
			header_msg: "Reset Password",
			form: 'reset_password'
			, reset_link: params.req.params.reset_phrase
		};
	} else {
		// invalid reset link
		params_out = {
			authen: false,
			page: "message",
			title: "Mileage Manager",
			host: helper.hostname,
			header_msg: "Reset Password",
			message: ["The reset link is not correct. Please repeat the Forgot Password process once again."]
		};
	}
	params.res.render("index", params_out);
};

// route for "authen/reset_password/", reset password
authen_router.put('/reset_password', (req, res) => {
	const form_data = {new_password: helper.sanitize_data({data: req.body.new_password}), retype_password: helper.sanitize_data({data: req.body.retype_password}), reset_phrase: helper.sanitize_data({data: req.body.reset_link})};
	const validate_errors = validate_reset_password(null, form_data);

	if(validate_errors.length === 0) {
		const params = {res, form_data};
		helper.async.waterfall([
				(callback) => {callback(null, null, params);},
				mpass_reset.reset_link_expiry_check,
				mpass_reset.expired_link_status_change,
				muser.update_password
			], reset_password_response
		);
	} else {
		send_back_forgot_password_errors (null, {res, form: "reset_password", errors: validate_errors, reset_link: helper.sanitize_data({data: req.body.reset_link})});
	}
});

// display first user sign up form
const display_authen_from = (err, params) => {
	let params_out = {};
	if(params.doc_count === 0) {
		params_out = {
			authen: false,
			page: "signup",
			title: "First User Sign Up",
			host: helper.hostname,
			header_msg: "There are no user in the system. Create the first user to proceed. The created user will have the Admin privilege.",
			first_user: true
		};
	} else {
		params_out = {
			authen: false,
			page: "signin",
			title: "User Sign In",
			host: helper.hostname,
			header_msg: "Please signin to proceed"
		};
	}
	params.res.render('index', params_out);		
};

// response after creating new user
const new_user_response = (err, params) => {
	helper.error_handler(err);
	params.error_form = 'signup';
	params.error_msg = ["Email id already exists."];
	send_error_or_log_uer(err, params);
};

// send error message if error else log in the user
const send_error_or_log_uer = (err, params) => {
	helper.error_handler(err);
	const res = params.res;

	if ( params.error_condition !== undefined && params.error_condition === true ) {
		send_back_authen_errors (null, {res, form: params.error_form, errors: params.error_msg, user_email: params.form_data.user_email});
	} else {
		log_user_session ( null, { req: params.req, user_id: params.doc.doc_info._id } );
		res.redirect("/");
	}
};

// send the authentication error messages
const send_back_authen_errors = (err, params) => {
	const res = params.res;

	const params_out = {
		res,
		page: 'authen',
		title: "Mileage Manager",
		host: helper.hostname,
		header_msg: "Please sign in to proceed",
		form: params.form,
		errors: params.errors,
		user_email: params.user_email
	};
	res.render('index', params_out);
};

// send the forgot password error messages
const send_back_forgot_password_errors = (err, params) => {
	const res = params.res;

	const params_out = {
		res,
		authen: false,
		page: 'forgot_password',
		title: "Mileage Manager",
		host: helper.hostname,
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

// response after checking the email presence for forgot password
const forgot_password_email_check_response = (err, params) => {
	helper.error_handler(err);
	const user_count = params.doc_count;
	if (user_count > 0) {
		params.host = helper.hostname;
		params.env = helper.confg.env;
		helper.async.waterfall([
				(async_callback) => {async_callback(null, null, params);},
				muser.generate_reset_password_link,
				mpass_reset.password_request_entry,
				muser.send_forgot_pasword_email
			], forgot_password_email_send_msg
		);
	} else {
		send_back_forgot_password_errors (null, {res: params.res, form: "forgot_password", errors: ["Email id not found."], user_email: params.form_data.user_email});
	}
};

// display message after sending password reset email
// for development mode display the reset link too
const forgot_password_email_send_msg = (err, params) => {
	helper.error_handler(err);

	// display rest link for development mode
	let message;
	let reset_link_message = "An email has been sent to you. Please check your email and follow the steps to reset the password.";
	message = [reset_link_message, params.reset_link]; 

	const params_out = {
		page: "authen",
		host: helper.hostname,
		header_msg: "Password Reset",
		forgot_password: "message",
		message: message, 
		display_reset_link: params.display_reset_link,
		reset_link: params.reset_link
	};
	params.res.render("index", params_out);
};

// response of resetting the password
const reset_password_response = (err, params) => {
	if ( params.reset_message !== undefined ) {
		const params_out = {
			authen: false,
			page: "message",
			title: "Mileage Manager",
			host: helper.hostname,
			header_msg: "Reset Password",
			message: [params.reset_message], 
		};
		params.res.render("index", params_out);
	}
};

module.exports = authen_router;

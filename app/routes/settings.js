"use strict";
const helper = require("../handlers/hhelper");
const msettings = require("../models/msettings");

const settings_router = helper.express.Router();

/* settings route */
settings_router.route('/')
.get((req, res) => {
	render_settings(null, {res, req});
})
.put((req, res) => {
	const params = {res, req};
	if(req.body.km_mile === undefined) {
		req.body.km_mile = '';
	}
	params.form_data = {
		km_mile: helper.sanitize_data({data: req.body.km_mile}),
		max_fuel_capacity: helper.sanitize_data({data: req.body.max_fuel_capacity})
	};
	
	const validate_errors = validate_settings(null, params.form_data);

	if(validate_errors.length === 0) {
		params.doc_data = params.form_data;
		// params.async_level is used for returning to correct parameter in async callback. it is used in hmodels.error_handler method.
		params.async_level = 0;
		helper.async.waterfall([
				(async_callback) => {async_callback(null, null, params);},
				msettings.update_settings
			], settings_update_report
		);
	} else {
		render_settings(null, {res, req, errors: validate_errors, form_data: params.form_data});
	}
});

// validate settings form
const validate_settings = (err, params, callback) => {
	let errors = [];

	validate_km_mile( null, { errors, km_mile: params.km_mile } );
	validate_max_fuel_capacity( null, { errors, max_fuel_capacity: params.max_fuel_capacity } );

	return errors;
};

// validate km_mile
const validate_km_mile = (err, params) => {
	let error;
	const km_mile = params.km_mile; 

	if(km_mile.length === 0) {
		error = "Please select Kilometer or Mile.";
	} else  if (km_mile.length > 4) {
		error = "Please enter valid Km/Mile value.";
	} else if(!(['km', 'mile'].includes(km_mile))) {
		error = "Please enter valid Km/Mile value.";
	}

	helper.push_error ( { error, errors: params.errors } );
};

// validate maximum fuel capacity
const validate_max_fuel_capacity = (err, params) => {
	let error;
	const max_fuel_capacity = params.max_fuel_capacity;

	if(max_fuel_capacity.length === 0) {
		error = "Please enter maximum fuelcapacity.";
	} else  if (isNaN(max_fuel_capacity) === true) {
		error = "Please enter valid maximum fuel capacity.";
	} else  if (max_fuel_capacity < 1) {
		error = "Please enter valid maximum fuel capacity.";
	} else  if (max_fuel_capacity.length > 2) {
		error = "Please enter valid maximum fuel capacity.";
	}

	helper.push_error ( { error, errors: params.errors } );
};

// response after updating the settings
const settings_update_report = (err, params) => {
	if(params.doc !== undefined && params.doc.name === "update_settings") {
		params.settings_info = params.doc.doc_info;
		delete params.doc;

		params.update = true;
	}

	render_settings(null, params);
};

// render settings form
const render_settings = (err, params) => {
	const params_out = {
		page: "settings",
		host: helper.hostname,
		title: "Settings",
		header_msg: "",
		user_name: params.req.authen.user_name
	};
	if(params.errors !== undefined) {
		params_out.errors = params.errors;
	}
	if(params.update === true) {
		params_out.success = true;
	}
	helper.async.waterfall([
			(async_callback) => {async_callback(null, null, params);},
			msettings.settings_info_fetch
		], (err, params) => {
			if(params.doc !== undefined && params.doc.name === "settings_info_fetch") {
				params.settings_info = params.doc.doc_info;
				delete params.doc;
			}

			if(params.settings_info !== undefined && params.settings_info !== null) {
				params_out.km_mile = params.settings_info.km_mile;
				params_out.max_fuel_capacity = params.settings_info.max_fuel_capacity;
			}
			params.res.render('index', params_out);
		}
	);
};

module.exports = settings_router;

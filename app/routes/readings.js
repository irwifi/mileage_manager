"use strict";
const helper = require("../handlers/hhelper");
const mreadings = require("../models/mreadings");

const readings_router = helper.express.Router();

const max_fuel_capacity = 20;

/* GET dashboard. */
readings_router.route('/')
.get((req, res) => {
	render_dashboard(null, {res, req});
})
.post((req, res) => {
	if(req.body.destination === undefined) {
		req.body.destination = '';
	}
	const form_data = {
		travel_date: helper.sanitize_data({data: req.body.travel_date}).replace(/&#x2F;/g, "/"),
		odo_readings: helper.sanitize_data({data: req.body.odo_readings}),
		fuel_added: helper.sanitize_data({data: req.body.fuel_added}),
		fuel_readings: helper.sanitize_data({data: req.body.fuel_readings}),
		destination: helper.sanitize_data({data: req.body.destination})
	};
	const params = {res, req, form_data};

	const validate_errors = validate_readings_entry(null, form_data);

	if(validate_errors.length === 0) {
		// for returning to correct parameter in async callback
		// this parameter is used in hmodels.error_handler method
		params.async_level = 2;
		helper.async.waterfall([
				(async_callback) => {async_callback(null, null, params);},
				mreadings.repeatitive_entry_check,
				repeatitive_entry_report,
				mreadings.save_travel_info
			], travel_info_entry_report
		);
	} else {
		render_dashboard(null, {res, req, errors: validate_errors, form_data});
	}
});

// return tomorrow's date
const tomorrow = () => {
	const today = new Date();	
	const tomorrow =  (today.getMonth() + 1) + '/' + (today.getDate() + 1) + '/' + today.getFullYear();

	return  tomorrow;
};

// validate readings entry form
const validate_readings_entry = (err, params, callback) => {
	let errors = [];

	validate_travel_date( null, { errors, travel_date: params.travel_date } );
	validate_odo_readings( null, { errors, odo_readings: params.odo_readings } );
	validate_fuel_added( null, { errors, fuel_added: params.fuel_added } );
	validate_fuel_readings( null, { errors, fuel_readings: params.fuel_readings } );
	validate_destination( null, { errors, destination: params.destination } );

	return errors;
};

// validate travel_date
const validate_travel_date = (err, params) => {
	let error;
	const travel_date = params.travel_date; 

	if(travel_date.length === 0) {
		error = "Please enter the date.";
	} else  if (travel_date.length > 10) {
		error = "Please enter valid date.";
	} else  if ( Date.parse(travel_date) < 1 ) {
		error = "Please enter valid date.";
	} else if ( new Date(travel_date) > new Date() ) {
		error = "Date exceeds today's date.";
	}

	helper.push_error ( { error, errors: params.errors } );
};

// validate odometer readings
const validate_odo_readings = (err, params) => {
	let error;
	const odo_readings = params.odo_readings;

	if(odo_readings.length === 0) {
		error = "Please enter the odometer readings.";
	} else  if (isNaN(odo_readings) === true) {
		error = "Please enter valid odometer readings.";
	} else  if (odo_readings < 1) {
		error = "Please enter valid odometer readings.";
	} else  if (odo_readings.length > 6) {
		error = "Please enter valid odometer readings.";
	}

	helper.push_error ( { error, errors: params.errors } );
};

// validate fuel added
const validate_fuel_added = (err, params) => {
	let error;
	const fuel_added = params.fuel_added;

	if (isNaN(fuel_added) === true) {
		error = "Please enter valid added fuel amount.";
	} else  if (fuel_added > max_fuel_capacity) {
		error = "Added fuel amount exceeds the maximum fuel capacity.";
	}

	helper.push_error ( { error, errors: params.errors } );
};

// validate fuel readings
const validate_fuel_readings = (err, params) => {
	let error;
	const fuel_readings = params.fuel_readings;

	if(fuel_readings.length === 0) {
		error = "Please enter the fuel readings.";
	} else  if (isNaN(fuel_readings) === true) {
		error = "Please enter valid fuel readings.";
	} else  if (fuel_readings > max_fuel_capacity) {
		error = "Fuel readings exceeds the maximum fuel capacity.";
	}

	helper.push_error ( { error, errors: params.errors } );
};

// validate destination
const validate_destination = (err, params) => {
	let error;
	const destination = params.destination;

	if(destination.length === 0) {
		error = "Please enter the destination.";
	} else  if(destination.length > 50) {
		error = "Destination name too long.";
	}

	helper.push_error ( { error, errors: params.errors } );
};

// displays the repetitive warning message if found
const repeatitive_entry_report = (err, params, callback) => {
	if(params.doc !== undefined && params.doc.name === "repeatitive_entry_check") {
		params.readings_count = params.doc.doc_count;
		delete params.doc;

		if(params.readings_count > 0) {
			params.errors = ["Readings already exist at odometer reading value of " + params.form_data.odo_readings];
			err = params;
			delete params.async_level;
		}
	}
	helper.hmodels.error_handler(err, params, callback);
};

// response of entering the readings info
const travel_info_entry_report = (err, params) => {
	if(err !== null) {
		params = err;
	} else {
		if(params.doc !== undefined && params.doc.name === "save_travel_info") {
			params.readings_info = params.doc.doc_info;
			delete params.doc;

			params.jump = "readings_list_section";
		}
	}

	render_dashboard(null, params);
};

const render_dashboard = (err, params) => {
	const params_out = {
		page: "dashboard",
		host: helper.hostname,
		title: "hide_title",
		header_msg: "",
		user_name: params.req.authen.user_name
	};

	if(params.errors !== undefined) {
		params_out.errors = params.errors,
		params_out.odo_readings = params.form_data.odo_readings;
		params_out.fuel_added = params.form_data.fuel_added;
		params_out.fuel_readings = params.form_data.fuel_readings;
	}

	if(params.jump !== undefined) {
		params_out.jump = params.jump;
	}

	helper.async.waterfall([
			(async_callback) => {async_callback(null, null, params);},
			mreadings.destination_list_fetch
		], (err, params) => {
			if(params.doc !== undefined && params.doc.name === "destination_list_fetch") {
				params.destination_list = params.doc.doc_info;
				delete params.doc;

				if(params.destination_list.length > 0) {
					params_out.destination_list = params.destination_list;
				}
			}
			params.res.render('index', params_out);			
		}
	);
}

module.exports = readings_router;

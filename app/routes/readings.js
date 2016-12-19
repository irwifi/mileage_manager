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
	const params = {res, req};
	if(req.body.destination === undefined) {
		req.body.destination = '';
	}
	params.form_data = {
		travel_date: helper.sanitize_data({data: req.body.travel_date}).replace(/&#x2F;/g, "/"),
		odo_readings: helper.sanitize_data({data: req.body.odo_readings}),
		fuel_added: helper.sanitize_data({data: req.body.fuel_added}),
		fuel_readings: helper.sanitize_data({data: req.body.fuel_readings}),
		destination: helper.sanitize_data({data: req.body.destination})
	};

	const validate_errors = validate_readings_entry(null, params.form_data);

	if(validate_errors.length === 0) {
		params.doc_data = params.form_data;
		// params.async_level is used for returning to correct parameter in async callback. it is used in hmodels.error_handler method.
		params.async_level = 2;
		helper.async.waterfall([
				(async_callback) => {async_callback(null, null, params);},
				mreadings.previous_entry_fetch,
				previous_entry_check,
				mreadings.save_travel_info
			], travel_info_entry_report
		);
	} else {
		render_dashboard(null, {res, req, errors: validate_errors, form_data: params.form_data});
	}
});

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
	} else  if (fuel_added < 0) {
		error = "Added fuel quantity can not be negative.";
	} else  if (fuel_added > max_fuel_capacity) {
		error = "Added fuel quantity exceeds the maximum fuel capacity.";
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
	} else  if (fuel_readings < 0) {
		error = "Fuel readings can not be negative.";
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

// compare the readings entry with previous one
const previous_entry_check = (err, params, callback) => {
	if(params.doc !== undefined && params.doc.name === "previous_entry_fetch") {
		params.previous_readings_info = params.doc.doc_info;
		delete params.doc;

		if(params.previous_readings_info !== null) {
			params.errors = [];
			if(params.previous_readings_info.km_readings > params.form_data.odo_readings) {
				params.errors.push(["Odometer readings less than previous entry."]);
			}
			
			if(params.form_data.fuel_readings > parseInt(params.form_data.fuel_added) + params.previous_readings_info.fuel_readings) {
				params.errors.push(["Fuel readings higher than sum of added fuel and previous fuel readings."]);
			}

			if(new Date(params.previous_readings_info.date) - new Date(params.form_data.travel_date) > 0) {
				params.errors.push(["Date can not be earlier than last entry."]);
			}

			if(params.errors !== undefined && params.errors.length > 0) {
				err = params;
				delete params.async_level;				
			}
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

	// params.async_level is used for returning to correct parameter in async callback. it is used in hmodels.error_handler method.
	params.async_level = 2;
	helper.async.waterfall([
			(async_callback) => {async_callback(null, null, params);},
			mreadings.destination_list_fetch,
			destination_list_fetch_report,
			mreadings.readings_data_fetch
		], (err, params) => {
			if(params.doc !== undefined && params.doc.name === "readings_data_fetch") {
				params_out.readings_data = params.doc.doc_info;
				delete params.doc;
			}
			if(params.destination_list.length > 0) {
				params_out.destination_list = params.destination_list;
			}
			params.res.render('index', params_out);
		}
	);
}

const destination_list_fetch_report = (err, params, callback) => {
	if(params.doc !== undefined && params.doc.name === "destination_list_fetch") {
		params.destination_list = params.doc.doc_info;
		delete params.doc;
	}

	helper.hmodels.error_handler(err, params, callback);
};

module.exports = readings_router;

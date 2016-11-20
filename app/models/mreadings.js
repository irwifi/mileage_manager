"use strict";
const mongoose = require('mongoose');

const hmodels = require("../handlers/hmodels");

// mongoose.set('debug', true);

// Define readings schema
const readingsSchema = new mongoose.Schema(
	{
		date: {type: Date, required:true},
		km_readings: {type: Number, required:true},
		fuel_added: {type: Number},
		fuel_readings: {type: Number, required: true},
		destination: {type: String, required: true}
	},
	{timestamps: true}
);

const readings = {};

// Define readings model
readings.readings_model = mongoose.model('readings', readingsSchema);

// fetch destination list
readings.destination_list_fetch = (err, params, callback) => {
	params.doc = {};
	params.doc.name = "destination_list_fetch";
	params.doc.model = readings.readings_model;
	params.doc.select = 'destination';
	params.doc.condition = {};
	hmodels.distinct_doc(null, params, callback);
};

// fetch readings info
readings.get_readings_info = (err, params, callback) => {
	params.doc = {};
	params.doc.name = "get_readings_info";
	params.doc.model = readings.readings_model;
	params.doc.condition = { readings_email: params.form_data.readings_email };
	hmodels.find_one(null, params, callback);
};

// check if readings exists
readings.repeatitive_entry_check = (err, params, callback) => {
	params.doc = {};
	params.doc.name = "repeatitive_entry_check";
	params.doc.model = readings.readings_model;
	params.doc.condition = { km_readings: params.form_data.odo_readings };
	hmodels.count_doc(null, params, callback);	
};

// enter travel info
readings.save_travel_info = (err, params, callback) => {
	params.doc = {};
	params.doc.name = "save_travel_info";
	params.doc.model = readings.readings_model;
	params.doc.form_data = {date: params.form_data.travel_date, km_readings: params.form_data.odo_readings, fuel_added: params.form_data.fuel_added, fuel_readings: params.form_data.fuel_readings, destination: params.form_data.destination};
	hmodels.create_doc(null, params, callback);
};

module.exports = readings;

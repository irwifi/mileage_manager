"use strict";
const mongoose = require('mongoose');

const hmodels = require("../handlers/hmodels");

// mongoose.set('debug', true);

// Define readings schema
const readingsSchema = new mongoose.Schema(
	{
		date: {type: String, required:true},
		km_readings: {type: Number, required:true, unique: true},
		fuel_added: {type: Number},
		fuel_readings: {type: Number, required: true},
		destination: {type: String, required: true}
		// , cumulative_fuel: {type: Number, required: true}
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

// fetch the last readings entry
readings.previous_entry_fetch = (err, params, callback) => {
	params.doc = {};
	params.doc.name = "previous_entry_fetch";
	params.doc.model = readings.readings_model;
	params.doc.options = { sort: {'createdAt': -1}}; 
	hmodels.find_one(null, params, callback);
};

// fetch readings data
readings.readings_data_fetch = (err, params, callback) => {
	params.doc = {};
	params.doc.name = "readings_data_fetch";
	params.doc.model = readings.readings_model;
	params.doc.condition = { };
	hmodels.find_doc(null, params, callback);
};

// enter travel info
readings.save_travel_info = (err, params, callback) => {
	params.doc = {};
	params.doc.name = "save_travel_info";
	params.doc.model = readings.readings_model;
	params.doc.doc_data = {date: params.doc_data.travel_date, km_readings: params.doc_data.odo_readings, fuel_added: params.doc_data.fuel_added, fuel_readings: params.doc_data.fuel_readings, destination: params.doc_data.destination};
	hmodels.create_doc(null, params, callback);
};

module.exports = readings;

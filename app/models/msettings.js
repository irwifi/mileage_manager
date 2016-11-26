"use strict";
const mongoose = require('mongoose');

const hmodels = require("../handlers/hmodels");

// mongoose.set('debug', true);

// Define settings schema
const settingsSchema = new mongoose.Schema(
	{
		km_mile: {type: String, required: true},
		max_fuel_capacity: {type: Number, required: true}
	},
	{timestamps: true}
);

const settings = {};

// Define settings model
settings.settings_model = mongoose.model('settings', settingsSchema);

// fetch settings info
settings.settings_info_fetch = (err, params, callback) => {
	params.doc = {};
	params.doc.name = "settings_info_fetch";
	params.doc.model = settings.settings_model;
	params.doc.select = '';
	params.doc.condition = {};
	hmodels.find_one(null, params, callback);
};

// update settings
settings.update_settings = (err, params, callback) => {
	params.doc = {};
	params.doc.name = "update_settings";
	params.doc.model = settings.settings_model;
	params.doc.condition = {};
	params.doc.options = {upsert:true};
	params.doc.doc_data = {km_mile: params.doc_data.km_mile, max_fuel_capacity: params.doc_data.max_fuel_capacity};
	hmodels.update_doc(err, params, callback);	
};

module.exports = settings;

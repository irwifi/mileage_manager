"use strict";
const mongoose = require('mongoose');

const hmodels = {};

// error handler 
hmodels.error_handler = (err, params, callback) => {
	if(err) { return callback(err);}
	else {
		if ( params.async_callback === true ) {
			delete params.async_callback;
			callback(err, err, params);
		} else {
			callback(null, params);	
		}
	}
};

// count the number of models
hmodels.count_doc = (err, params, callback) => {
	const model = params.model;
	model.count(params.condition, (err, doc_count) => {
		params.doc_count = doc_count;
		hmodels.error_handler(err, params, callback);
	});
};

// save document
hmodels.save_doc = (err, params, callback) => {
	const model = params.model;
	const doc_data = params.form_data;
	const new_instance = new model(doc_data);
	new_instance.save((err, doc_info) => {
		params.doc = {};
		params.doc.doc_info = doc_info;
		hmodels.error_handler(err, params, callback);
	});
};

// find one document
hmodels.find_one = (err, params, callback) => {
	if ( params.doc.select === undefined ) {
		params.doc.select = "";
	}

	const model = params.doc.model;
	model.findOne(params.doc.condition, (err, doc_info) => {
		params.doc.doc_info = doc_info;
		hmodels.error_handler(err, params, callback);
	}).select(params.doc.select);
};

// update document
hmodels.update_doc = (err, params, callback) => {
	params.doc.model.update(params.doc.condition, {$set: params.doc.form_data}, params.doc.options, (err, update_info) => {
		params.doc.update_info = update_info;
		hmodels.error_handler(err, params, callback);
	});
};

// update document
hmodels.find_one_and_update = (err, params, callback) => {
	params.doc.model.findOneAndUpdate(params.doc.condition, {$set: params.doc.form_data}, params.doc.options, (err, doc_info) => {
		params.doc.doc_info = doc_info;
		hmodels.error_handler(err, params, callback);
	});
};

module.exports = hmodels;

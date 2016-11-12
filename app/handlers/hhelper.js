"use strict";
const helper = {};

helper.express = require('express');
// helper.request = require('request');
helper.async = require('async');
helper.validator = require('validator');

helper.confg = require("../../confg/confg");
helper.hmodels = require("../handlers/hmodels");

// host name
helper.hostname = helper.confg.hostname;

// error handler
helper.error_handler = (err) => {
	if (err) {
		return console.log(err);
	}
};

// sanitize input data
helper.sanitize_data = (params) => {
	const raw_data = params.data;
	let cooked_data = helper.validator.escape(raw_data);
	if(params.no_trim !== undefined) {
		cooked_data = cooked_data.trim();
	}
	return cooked_data;
};

module.exports = helper;

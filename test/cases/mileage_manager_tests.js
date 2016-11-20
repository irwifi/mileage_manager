"use strict";
const express = require('express');
const async = require('async');
const request = require('supertest');
const chai = require('chai');
const expect = chai.expect;

const app = require('../../app/app');
const hdb = require('../../app/handlers/hdb_mongo');
const muser = require("../../app/models/musers");

chai.use(require('chai-string'));

// insert data into the document
const insert_data = (err, params, callback) => {
	hdb.db.collection(params.doc).insert(params.data, callback);
};

// fetch one document from database
const find_one = (err, params, callback) => {
	hdb.db.collection(params.doc).findOne(params.condition, params.select, callback);
};

// expect object
const expect_object = (err, params) => {
	expect(params.obj).to.be.an('object');
	for(const item in params.obj_items) {
		if( Array.isArray(params.obj_items[item]) === true ) {
			expect(params.obj).to.have.property(params.obj_items[item][0], params.obj_items[item][1]);
		} else {
			expect(params.obj).to.have.property(params.obj_items[item]);
		}
	}
}

// return date with difference from today
const date_from_today = (difference) => {
	const today = new Date();	
	const return_date =  (today.getMonth() + 1) + '/' + (today.getDate() + difference) + '/' + today.getFullYear();

	return  return_date;
};

describe('Mileage Manager Tests:', () => {
	const logged_app = request.agent(app) ;

	// this block runs only once before everything else within this test
	// log in before starting the tests
	before((done) => {
		async.series([
			(async_callback) => {
				hdb.connect(null, {}, async_callback);
			},
			(async_callback) => {
				hdb.db.createCollection('readings', 
					(err, result) => {
						async_callback(err);
					}
				);
			},
			(async_callback) => {
				hdb.db.createCollection('users', 
					(err, result) => {
						async_callback(err);
					}
				);
			},
			(async_callback) => {
				hdb.db.collection('users').remove(
					(err, result) => {
						async_callback(err);
					}
				);
			},
			(async_callback) => {				
				muser.create_new_user(null, {form_data: {user_email: 'abc@sample.com', password: '123456', user_role: 'admin'}}, async_callback);
			},
			(async_callback) => {
				logged_app
				.post('/authen/signin')
				.send({ signin_email: 'abc@sample.com', signin_password: '123456'})
				.end((err, res) => {
          				if (err) return done(err);
          				done();
        			});
			}
		], done);
	});

	// this will run before each describes within this test
	beforeEach((done) => {
		async.series([
			(async_callback) => {
				hdb.db.collection('readings').remove(
					(err, result) => {
						async_callback(err);
					}
				);
			}
		], done);
	});

	// Dashboard functionality
	describe('Dashboard functionality:', () => {
		it('Landing page after authentication', (done) => {
			logged_app
			.get('/')
			.expect(302)
			.end((err, res) => {
				if (err) return done(err);
				expect(res.headers).to.have.property('location');
				expect(res.headers.location).to.equal('/readings');
				done();
			});
		});

		it('Dashboard response:', (done) => {
			logged_app
			.get('/readings')
			.expect(200)
			.end((err, res) => {
				if (err) return done(err);
				expect(res.text).to.containIgnoreSpaces('abc@sample.com');
				expect(res.text).to.containIgnoreSpaces('<a href="#readings_entry_section">Home');
				expect(res.text).to.containIgnoreSpaces('<a href="#chart_section">Chart');
				expect(res.text).to.containIgnoreSpaces('<a href="#readings_list_section">Data');
				expect(res.text).to.containIgnoreSpaces('<a href="/readings/statistics">Statistics');
				expect(res.text).to.containIgnoreSpaces('<a href="authen/change_password">Change Password</a>');
				expect(res.text).to.containIgnoreSpaces('<a href="settings">Settings</a>');
				expect(res.text).to.containIgnoreSpaces('<a href="/authen/signout"> Sign Out </a>');
				expect(res.text).to.containIgnoreSpaces('Enter the fuel and odometer readings');
				expect(res.text).to.containIgnoreSpaces('id="form_readings"');
				expect(res.text).to.containIgnoreSpaces('id="travel_date"');
				expect(res.text).to.containIgnoreSpaces('id="odo_readings"');
				expect(res.text).to.containIgnoreSpaces('id="fuel_added"');
				expect(res.text).to.containIgnoreSpaces('id="fuel_readings"');
				expect(res.text).to.containIgnoreSpaces('id="destination"');
				expect(res.text).to.containIgnoreSpaces('id="new_destination"');
				expect(res.text).to.containIgnoreSpaces('');
				done();
			});
		});

		it('Travel Info submit without any data:', (done) => {
			logged_app
			.post('/readings')
			.send({ travel_date: '', odo_readings: '', fuel_added: '', fuel_readings: '', destination: '' })
			.expect(200)
			.end((err, res) => {
				if (err) return done(err);
				expect(res.text).to.containIgnoreSpaces('id="form_readings"');
				expect(res.text).to.containIgnoreSpaces('<div class="alert alert-danger');
				expect(res.text).to.containIgnoreSpaces('Please enter the date');
				expect(res.text).to.containIgnoreSpaces('Please enter the odometer readings');
				expect(res.text).to.containIgnoreSpaces('Please enter the fuel readings');
				expect(res.text).to.containIgnoreSpaces('Please enter the destination');
				done();
			});
		});

		it('Travel Info submit with invalid data (date, odometer readings, fuel added and readings quantity)', (done) => {
			logged_app
			.post('/readings')
			.send({ travel_date: 'invalid_data', odo_readings: 'invalid_data', fuel_added: 'invalid_data', fuel_readings: 'invalid_data', destination: '' })
			.expect(200)
			.end((err, res) => {
				if (err) return done(err);
				expect(res.text).to.containIgnoreSpaces('id="form_readings"');
				expect(res.text).to.containIgnoreSpaces('<div class="alert alert-danger');
				expect(res.text).to.containIgnoreSpaces('Please enter valid date');
				expect(res.text).to.containIgnoreSpaces('Please enter valid odometer readings');
				expect(res.text).to.containIgnoreSpaces('Please enter valid added fuel amount');
				expect(res.text).to.containIgnoreSpaces('Please enter valid fuel readings');
				done();
			});
		});

		// get maximum capacity value
		it('Travel Info submit with exceeding values (date exceeding today, odometer readings exceeding 6 digits, fuel added and readings exceeding maximum capacity and desination name logner than 50 characters):', (done) => {
			logged_app
			.post('/readings')
			.send({ travel_date: date_from_today(1), odo_readings: '1234567', fuel_added: '', fuel_readings: '', destination: '123456789112345678921234567893123456789412345678951' })
			.expect(200)
			.end((err, res) => {
				if (err) return done(err);
				expect(res.text).to.containIgnoreSpaces('id="form_readings"');
				expect(res.text).to.containIgnoreSpaces('<div class="alert alert-danger');
				expect(res.text).to.containIgnoreSpaces('Date exceeds today');
				expect(res.text).to.containIgnoreSpaces('Please enter valid odometer readings');
				// expect(res.text).to.containIgnoreSpaces('Added fuel amount exceeds the maximum fuel capacity');
				// expect(res.text).to.containIgnoreSpaces('Fuel readings exceeds the maximum fuel capacity');
				expect(res.text).to.containIgnoreSpaces('Destination name too long');
				done();
			});
		});

		// repetitive data means readings already exists with same km_readings value
		it('Travel Info submit with repetitive data:', (done) => {
			async.series([
				(async_callback) => {
					// insert test readings record
					insert_data(null, {doc: 'readings', data: {date: new Date(date_from_today(0)), km_readings: 5555, fuel_added: 10, fuel_readings: 15, destination: 'Kathmandu'}}, async_callback);
				},
				(async_callback) => {
					logged_app
					.post('/readings')
					.send({ travel_date: date_from_today(0), odo_readings: '5555', fuel_added: '10', fuel_readings: '15', destination: 'Kathmandu' })
					.expect(200)
					.end((err, res) => {
						if (err) return done(err);
						expect(res.text).to.containIgnoreSpaces('<div class="alert alert-danger');
						expect(res.text).to.containIgnoreSpaces('Readings already exist at odometer reading value of 5555');
						done();
					});
				}
			], done);
		});

		it('Travel Info submit with valid data:', (done) => {
			logged_app
			.post('/readings')
			.send({ travel_date: date_from_today(0), odo_readings: '5555', fuel_added: '10', fuel_readings: '15', destination: 'Kathmandu' })
			.expect(200)
			.end((err, res) => {
				if (err) return done(err);
				async.waterfall([
					(async_callback) => {async_callback(null, null, {doc: "readings", condition: {}, select: {}});},
						find_one
					], (err, readings_info) => {
						expect(res.text).to.not.containIgnoreSpaces('<div class="alert alert-danger');
						expect_object(null, {obj: readings_info, obj_items: [['km_readings', 5555], ['fuel_added', 10], ['fuel_readings', 15], ['destination', 'Kathmandu']]});
						expect(readings_info.date.toString()).to.containIgnoreSpaces(new Date(date_from_today(0)).toString());
						done();
					}
				);
			});
		});
	});
});
